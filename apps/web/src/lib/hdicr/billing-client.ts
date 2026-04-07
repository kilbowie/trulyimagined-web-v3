import { getHdicrRemoteBaseUrl } from '@/lib/hdicr/flags';

function getBillingRemoteBaseUrlOrThrow(operation: string) {
  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `[HDICR] Billing ${operation} is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).`
    );
  }
  return baseUrl;
}

const billingRemoteBaseUrl = getBillingRemoteBaseUrlOrThrow('client-initialization');

export async function getBillingProfileByAuth0UserId(auth0UserId: string) {
  const url = new URL(
    `/v1/billing/profile?auth0UserId=${encodeURIComponent(auth0UserId)}`,
    billingRemoteBaseUrl
  );

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `[HDICR] Remote billing profile lookup failed with status ${response.status} (fail-closed).`
    );
  }

  const payload = (await response.json()) as {
    profile?: Record<string, any> | null;
  };

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
