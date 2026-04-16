import { createVerificationSession } from '@/lib/stripe';
import {
  getUserProfileIdByAuth0UserId,
  getVerificationLinksSummary,
} from '@/lib/hdicr/identity-client';

type StripeIdentitySessionParams = {
  auth0UserId: string;
  email: string | null | undefined;
  legalName: string | null | undefined;
  professionalName: string | null | undefined;
};

type VerificationLink = Record<string, unknown>;

export async function startStripeIdentitySession(params: StripeIdentitySessionParams) {
  const userProfileId = await getUserProfileIdByAuth0UserId(params.auth0UserId);
  if (!userProfileId) {
    return null;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe Identity not configured. Set STRIPE_SECRET_KEY environment variable.');
  }

  const session = await createVerificationSession(params.email ?? '', {
    user_profile_id: userProfileId,
    user_email: params.email ?? '',
    legal_name: params.legalName ?? '',
  });

  console.log('[VERIFICATION] Created Stripe Identity session:', {
    userId: userProfileId,
    sessionId: session.id,
    status: session.status,
  });

  const sessionData = session as unknown as { expires_at?: number };

  return {
    provider: 'stripe',
    verificationId: session.id,
    status: session.status,
    clientSecret: session.client_secret,
    url: session.url,
    expiresAt: sessionData.expires_at
      ? new Date(sessionData.expires_at * 1000).toISOString()
      : null,
    message: 'Please complete the verification process using the provided URL or client secret',
    nextSteps: [
      'User redirects to session.url or uses client_secret with @stripe/stripe-js',
      'User uploads government ID (passport/license/national ID)',
      'User completes liveness check (selfie)',
      'Stripe processes verification (usually < 1 minute)',
      'Webhook receives verification result',
      'Identity link created in database',
    ],
  };
}

export async function getStripeIdentityStatus(auth0UserId: string) {
  const verificationData = await getVerificationLinksSummary(auth0UserId);
  if (!verificationData) {
    return null;
  }

  const status = calculateVerificationStatus(verificationData.links);

  return {
    userId: verificationData.userProfileId,
    status: status.overallStatus,
    verificationLevel: status.highestVerificationLevel,
    assuranceLevel: status.highestAssuranceLevel,
    lastVerified: status.lastVerified,
    providers: verificationData.links.map((link: VerificationLink) => ({
      provider: link.provider,
      providerType: link.provider_type,
      verificationLevel: link.verification_level,
      assuranceLevel: link.assurance_level,
      verifiedAt: link.verified_at,
    })),
    summary: status,
  };
}

function calculateVerificationStatus(links: VerificationLink[]) {
  if (links.length === 0) {
    return {
      overallStatus: 'unverified',
      highestVerificationLevel: null,
      highestAssuranceLevel: null,
      lastVerified: null,
      totalProviders: 0,
      kycProviders: 0,
      governmentProviders: 0,
    };
  }

  const verificationLevelRank: Record<string, number> = {
    'very-high': 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const assuranceLevelRank: Record<string, number> = {
    high: 3,
    substantial: 2,
    low: 1,
  };

  let highestVerificationLevel: string | null = null;
  let highestVerificationRank = 0;
  let highestAssuranceLevel: string | null = null;
  let highestAssuranceRank = 0;
  let lastVerified: string | null = null;
  let kycProviders = 0;
  let governmentProviders = 0;

  for (const link of links) {
    const verificationLevel = link.verification_level as string | null;
    const assuranceLevel = link.assurance_level as string | null;
    const verifiedAt = link.verified_at as string | null;
    const providerType = link.provider_type as string;

    if (verificationLevel) {
      const rank = verificationLevelRank[verificationLevel] || 0;
      if (rank > highestVerificationRank) {
        highestVerificationRank = rank;
        highestVerificationLevel = verificationLevel;
      }
    }

    if (assuranceLevel) {
      const rank = assuranceLevelRank[assuranceLevel] || 0;
      if (rank > highestAssuranceRank) {
        highestAssuranceRank = rank;
        highestAssuranceLevel = assuranceLevel;
      }
    }

    if (verifiedAt && (!lastVerified || new Date(verifiedAt) > new Date(lastVerified))) {
      lastVerified = verifiedAt;
    }

    if (providerType === 'kyc') {
      kycProviders++;
    } else if (providerType === 'government') {
      governmentProviders++;
    }
  }

  let overallStatus = 'partially-verified';
  if (highestVerificationLevel === 'very-high' || highestAssuranceLevel === 'high') {
    overallStatus = 'fully-verified';
  } else if (highestVerificationLevel === 'high' || highestAssuranceLevel === 'substantial') {
    overallStatus = 'verified';
  }

  return {
    overallStatus,
    highestVerificationLevel,
    highestAssuranceLevel,
    lastVerified,
    totalProviders: links.length,
    kycProviders,
    governmentProviders,
  };
}
