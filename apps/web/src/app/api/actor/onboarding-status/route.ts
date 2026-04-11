import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { queryTi } from '@/lib/db';
import { getActorByAuth0UserId } from '@/lib/hdicr/representation-client';
import { getActorById } from '@/lib/hdicr/identity-client';
import { hasAnyActiveConsent } from '@/lib/hdicr/consent-client';

// DB-OWNER: TI (local profile state) + HDICR via HTTP clients

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

    const roleResult = await queryTi(
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

    const actorByAuth0 = await getActorByAuth0UserId(user.sub);
    const actorId = (actorByAuth0?.id as string | undefined) || null;
    const hasRegistration = Boolean(actorId);

    const actor = actorId ? await getActorById(actorId) : null;
    const verificationStatus = (actor?.verificationStatus as string | undefined) || 'unregistered';
    const registryId = (actor?.registryId as string | undefined) || null;
    const isVerified = verificationStatus === 'verified';

    const hasActiveConsent = hasRegistration
      ? await hasAnyActiveConsent(actorId!, DEFAULT_TENANT_ID)
      : false;

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
        registryId,
        verificationStatus,
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
