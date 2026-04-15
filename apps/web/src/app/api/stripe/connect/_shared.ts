import { auth0 } from '@/lib/auth0';
import { getUserProfile } from '@/lib/auth';
import { queryTi } from '@/lib/db';
import { mapConnectAccountStatus, retrieveConnectAccount, type ConnectAccountStatus } from '@/lib/stripe';

type ConnectActorContext = {
  auth0UserId: string;
  userProfileId: string;
  email: string;
  role: string;
  actorId: string;
  stripeAccountId: string | null;
};

export async function getConnectActorContext(): Promise<
  { ok: true; context: ConnectActorContext } | { ok: false; status: number; error: string }
> {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const profile = await getUserProfile();
  if (!profile) {
    return { ok: false, status: 404, error: 'User profile not found' };
  }

  const role = String(profile.role || '');
  if (!['Actor', 'Agent'].includes(role)) {
    return { ok: false, status: 403, error: 'Forbidden: Actor or Agent role required' };
  }

  const userProfileId = String(profile.id || '').trim();
  if (!userProfileId) {
    return { ok: false, status: 400, error: 'Profile is missing id' };
  }

  const actorResult = await queryTi(
    `SELECT id, email, stripe_account_id
     FROM actors
     WHERE user_profile_id = $1 OR auth0_user_id = $2
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userProfileId, user.sub]
  );

  if ((actorResult.rowCount ?? 0) === 0) {
    return { ok: false, status: 404, error: 'Actor record not found' };
  }

  const actor = actorResult.rows[0] as {
    id: string;
    email?: string | null;
    stripe_account_id?: string | null;
  };

  return {
    ok: true,
    context: {
      auth0UserId: user.sub,
      userProfileId,
      email: actor.email || user.email || '',
      role,
      actorId: actor.id,
      stripeAccountId: actor.stripe_account_id || null,
    },
  };
}

function deriveConnectStatus(status: ConnectAccountStatus): string {
  if (status.onboardingComplete) {
    return 'active';
  }

  if (status.disabledReason) {
    return 'restricted';
  }

  return 'pending';
}

export async function updateActorConnectStatus(accountId: string) {
  const account = await retrieveConnectAccount(accountId);
  const status = mapConnectAccountStatus(account);

  await queryTi(
    `UPDATE actors
     SET stripe_account_status = $2,
         stripe_onboarding_complete = $3,
         updated_at = NOW()
     WHERE stripe_account_id = $1`,
    [accountId, deriveConnectStatus(status), status.onboardingComplete]
  );

  return status;
}
