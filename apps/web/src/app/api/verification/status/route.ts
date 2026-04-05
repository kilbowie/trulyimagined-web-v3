import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getVerificationLinksSummary } from '@/lib/hdicr/identity-client';

/**
 * GET /api/verification/status?provider={provider}
 * Checks the overall identity verification status for the current user
 *
 * Returns summary of all verification links and highest assurance level achieved
 */
export async function GET(_request: NextRequest) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verificationData = await getVerificationLinksSummary(session.user.sub);
    if (!verificationData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    const userId = verificationData.userProfileId;
    const links = verificationData.links;

    // Calculate overall verification status
    const status = calculateVerificationStatus(links);

    console.log('[VERIFICATION-STATUS] Retrieved verification status:', {
      userId,
      totalLinks: links.length,
      highestVerificationLevel: status.highestVerificationLevel,
      highestAssuranceLevel: status.highestAssuranceLevel,
    });

    return NextResponse.json(
      {
        userId,
        status: status.overallStatus,
        verificationLevel: status.highestVerificationLevel,
        assuranceLevel: status.highestAssuranceLevel,
        lastVerified: status.lastVerified,
        providers: links.map((link: Record<string, unknown>) => ({
          provider: link.provider,
          providerType: link.provider_type,
          verificationLevel: link.verification_level,
          assuranceLevel: link.assurance_level,
          verifiedAt: link.verified_at,
        })),
        summary: status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[VERIFICATION-STATUS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to retrieve verification status',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate overall verification status from identity links
 */
function calculateVerificationStatus(links: Record<string, unknown>[]) {
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
    const verLevel = link.verification_level as string | null;
    const assLevel = link.assurance_level as string | null;
    const verifiedAt = link.verified_at as string | null;
    const providerType = link.provider_type as string;

    // Track highest verification level
    if (verLevel) {
      const rank = verificationLevelRank[verLevel] || 0;
      if (rank > highestVerificationRank) {
        highestVerificationRank = rank;
        highestVerificationLevel = verLevel;
      }
    }

    // Track highest assurance level
    if (assLevel) {
      const rank = assuranceLevelRank[assLevel] || 0;
      if (rank > highestAssuranceRank) {
        highestAssuranceRank = rank;
        highestAssuranceLevel = assLevel;
      }
    }

    // Track most recent verification
    if (verifiedAt && (!lastVerified || new Date(verifiedAt) > new Date(lastVerified))) {
      lastVerified = verifiedAt;
    }

    // Count provider types
    if (providerType === 'kyc') {
      kycProviders++;
    } else if (providerType === 'government') {
      governmentProviders++;
    }
  }

  // Determine overall status
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
