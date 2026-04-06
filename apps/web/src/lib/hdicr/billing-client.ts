import { query } from '@/lib/db';

export async function getBillingProfileByAuth0UserId(auth0UserId: string) {
  const profileResult = await query(
    'SELECT id, role, email, username FROM user_profiles WHERE auth0_user_id = $1 LIMIT 1',
    [auth0UserId]
  );

  return profileResult.rows[0] || null;
}

export function getBillingOpportunities(role: string | null) {
  const isActor = role === 'Actor';

  return {
    canMonetizeLicensing: isActor,
    recommendedActions: isActor
      ? [
          {
            label: 'Manage License Grants',
            href: '/dashboard/licenses',
          },
          {
            label: 'Issue Verifiable Credentials',
            href: '/dashboard/verifiable-credentials',
          },
          {
            label: 'Refine Consent Preferences',
            href: '/dashboard/consent-preferences',
          },
        ]
      : [],
  };
}
