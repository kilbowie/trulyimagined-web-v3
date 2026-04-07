import { getHdicrRemoteBaseUrlOrThrow, invokeHdicrRemote } from '@/lib/hdicr/hdicr-http-client';

const billingRemoteBaseUrl = getHdicrRemoteBaseUrlOrThrow('billing', 'client-initialization');

export async function getBillingProfileByAuth0UserId(auth0UserId: string) {
  const payload = await invokeHdicrRemote<{
    profile?: Record<string, any> | null;
  }>({
    domain: 'billing',
    baseUrl: billingRemoteBaseUrl,
    path: `/v1/billing/profile?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    method: 'GET',
    operation: 'profile-by-auth0',
  });

  return payload.profile ?? null;
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
