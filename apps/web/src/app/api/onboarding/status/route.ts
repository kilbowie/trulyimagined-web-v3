import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserProfile } from '@/lib/auth';
import {
  getActorByAuth0UserId,
  checkActiveConsent,
  checkManualVerificationRequest,
} from '@/lib/hdicr/client-helpers';

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

    const profile = await getUserProfile();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (profile.role !== 'Actor') {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const actor = await getActorByAuth0UserId(user.sub, DEFAULT_TENANT_ID);
    const actorId = actor?.id || null;
    const hasRegistration = Boolean(actorId);
    const isVerified = actor?.verificationStatus === 'verified';

    let hasActiveConsent = false;
    let hasManualVerificationRequest = false;

    if (actorId) {
      const [consentResult, verificationResult] = await Promise.all([
        checkActiveConsent(actorId),
        checkManualVerificationRequest(actorId, DEFAULT_TENANT_ID),
      ]);

      hasActiveConsent = consentResult;
      hasManualVerificationRequest = verificationResult;
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
        registryId: actor?.registryId || null,
        verificationStatus: actor?.verificationStatus || 'unregistered',
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
