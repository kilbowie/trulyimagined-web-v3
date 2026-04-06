import { query } from '@/lib/db';
import {
  getHdicrAdapterMode,
  getHdicrRemoteBaseUrl,
  warnIfRemoteModeEnabled,
} from '@/lib/hdicr/flags';

warnIfRemoteModeEnabled('billing');

function isBillingRemoteMode() {
  return getHdicrAdapterMode('billing') === 'remote';
}

function getBillingRemoteBaseUrlOrThrow(operation: string) {
  const baseUrl = getHdicrRemoteBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `[HDICR] Billing ${operation} is configured for remote mode but HDICR_REMOTE_BASE_URL is missing (fail-closed).`
    );
  }
  return baseUrl;
}

async function getBillingProfileByAuth0UserIdLocal(auth0UserId: string) {
  const profileResult = await query(
    'SELECT id, role, email, username FROM user_profiles WHERE auth0_user_id = $1 LIMIT 1',
    [auth0UserId]
  );

  return profileResult.rows[0] || null;
}

export async function getBillingProfileByAuth0UserId(auth0UserId: string) {
  if (isBillingRemoteMode()) {
    const baseUrl = getBillingRemoteBaseUrlOrThrow('profile-lookup');
    const url = new URL(
      `/billing/profile?auth0UserId=${encodeURIComponent(auth0UserId)}`,
      baseUrl
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
      profile?: Record<string, unknown> | null;
    };

    return payload.profile ?? null;
  }

  return getBillingProfileByAuth0UserIdLocal(auth0UserId);
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
