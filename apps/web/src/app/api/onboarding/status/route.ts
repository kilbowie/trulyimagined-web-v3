import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { queryHdicr } from '@/lib/db';

// DB-OWNER: HDICR

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'trulyimagined';

type OnboardingStepId = 'signup' | 'profile' | 'verify-identity' | 'consent' | 'complete';

type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  completed: boolean;
  href: string;
};

export async function GET() {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileResult = await queryHdicr(
      `SELECT id, role, profile_completed
       FROM user_profiles
       WHERE auth0_user_id = $1
       LIMIT 1`,
      [user.sub]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];
    if (profile.role !== 'Actor') {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const actorResult = await queryHdicr(
      `SELECT id, registry_id, verification_status
       FROM actors
       WHERE auth0_user_id = $1
         AND tenant_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [user.sub, DEFAULT_TENANT_ID]
    );

    const actor = actorResult.rows[0] || null;
    const actorId = actor?.id || null;
    const hasRegistration = Boolean(actorId);
    const isVerified = actor?.verification_status === 'verified';

    let hasActiveConsent = false;
    let hasManualVerificationRequest = false;

    if (actorId) {
      const [consentResult, manualVerificationResult] = await Promise.all([
        queryHdicr(
          `SELECT EXISTS (
             SELECT 1
             FROM consent_ledger
             WHERE actor_id = $1::uuid
               AND status = 'active'
           ) AS has_active_consent`,
          [actorId]
        ),
        queryHdicr(
          `SELECT EXISTS (
             SELECT 1
             FROM manual_verification_sessions
             WHERE actor_id = $1::uuid
               AND tenant_id = $2
               AND status IN ('pending_scheduling', 'scheduled', 'completed')
           ) AS has_manual_verification_request`,
          [actorId, DEFAULT_TENANT_ID]
        ),
      ]);

      hasActiveConsent = Boolean(consentResult.rows[0]?.has_active_consent);
      hasManualVerificationRequest = Boolean(
        manualVerificationResult.rows[0]?.has_manual_verification_request
      );
    }

    // Clarification-driven flow:
    // 1) Actor can proceed to consent before being verified.
    // 2) Profile only goes live when verification is complete.
    const hasVerificationProgress = isVerified || hasManualVerificationRequest;

    const steps: OnboardingStep[] = [
      {
        id: 'signup',
        label: 'Sign in',
        completed: true,
        href: '/dashboard/onboarding?step=signup',
      },
      {
        id: 'profile',
        label: 'Register profile',
        completed: hasRegistration,
        href: '/dashboard/onboarding?step=profile',
      },
      {
        id: 'verify-identity',
        label: 'Verify identity (Stripe or video call)',
        completed: hasVerificationProgress,
        href: '/dashboard/onboarding?step=verify-identity',
      },
      {
        id: 'consent',
        label: 'Register consent preferences',
        completed: hasActiveConsent,
        href: '/dashboard/onboarding?step=consent',
      },
      {
        id: 'complete',
        label: 'Complete onboarding',
        completed: hasRegistration && hasActiveConsent && isVerified,
        href: '/dashboard/onboarding?step=complete',
      },
    ];

    const currentStep: OnboardingStepId = (() => {
      if (!hasRegistration) return 'profile';
      if (!hasVerificationProgress) return 'verify-identity';
      if (!hasActiveConsent) return 'consent';
      if (!isVerified) return 'verify-identity';
      return 'complete';
    })();

    return NextResponse.json({
      success: true,
      data: {
        actorId,
        registryId: actor?.registry_id || null,
        verificationStatus: actor?.verification_status || 'unregistered',
        profileCompleted: Boolean(profile.profile_completed),
        canProfileGoLive: hasRegistration && hasActiveConsent && isVerified,
        currentStep,
        steps,
        progress: {
          completed: steps.filter((step) => step.completed).length,
          total: steps.length,
        },
      },
    });
  } catch (error) {
    console.error('[ONBOARDING_STATUS] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
