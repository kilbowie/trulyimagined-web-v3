import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { queryHdicr } from '@/lib/db';

// DB-OWNER: HDICR

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'trulyimagined';

type OnboardingStep = {
  id: 'registration' | 'verification' | 'consent' | 'profile_live';
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

    const roleResult = await queryHdicr(
      `SELECT role, profile_completed
       FROM user_profiles
       WHERE auth0_user_id = $1
       LIMIT 1`,
      [user.sub]
    );

    if (roleResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const role = roleResult.rows[0].role as string;
    if (role !== 'Actor') {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const profileCompleted = Boolean(roleResult.rows[0].profile_completed);

    const actorResult = await queryHdicr(
      `SELECT id, registry_id, verification_status, created_at
       FROM actors
       WHERE auth0_user_id = $1
         AND tenant_id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [user.sub, DEFAULT_TENANT_ID]
    );

    const actor = actorResult.rows[0] || null;
    const hasRegistration = Boolean(actor?.id);
    const isVerified = actor?.verification_status === 'verified';

    let hasActiveConsent = false;

    if (hasRegistration) {
      const consentResult = await queryHdicr(
        `SELECT EXISTS (
           SELECT 1
           FROM consent_ledger
           WHERE actor_id = $1::uuid
             AND status = 'active'
         ) AS has_active_consent`,
        [actor.id]
      );
      hasActiveConsent = Boolean(consentResult.rows[0]?.has_active_consent);
    }

    const profileLive = hasRegistration && isVerified && hasActiveConsent && profileCompleted;

    const steps: OnboardingStep[] = [
      {
        id: 'registration',
        label: 'Register identity profile',
        completed: hasRegistration,
        href: '/dashboard/register-identity',
      },
      {
        id: 'verification',
        label: 'Complete identity verification',
        completed: isVerified,
        href: '/dashboard/verify-identity',
      },
      {
        id: 'consent',
        label: 'Configure consent preferences',
        completed: hasActiveConsent,
        href: '/dashboard/consent-preferences',
      },
      {
        id: 'profile_live',
        label: 'Go live on the platform',
        completed: profileLive,
        href: '/dashboard/profile',
      },
    ];

    const nextStep = steps.find((step) => !step.completed) || null;

    return NextResponse.json({
      success: true,
      data: {
        actorId: actor?.id || null,
        registryId: actor?.registry_id || null,
        verificationStatus: actor?.verification_status || 'unregistered',
        profileCompleted,
        steps,
        nextStep,
        progress: {
          completed: steps.filter((step) => step.completed).length,
          total: steps.length,
        },
      },
    });
  } catch (error) {
    console.error('[ACTOR_ONBOARDING_STATUS] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
