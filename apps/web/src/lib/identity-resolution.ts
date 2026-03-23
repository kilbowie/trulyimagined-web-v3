/**
 * Identity Resolution & Confidence Scoring
 *
 * Step 8: Identity Confidence Scoring
 *
 * Calculates overall identity confidence based on:
 * - Number of linked identity providers
 * - Verification levels of each provider
 * - Provider weights (based on trust level)
 * - GPG 45 & eIDAS assurance mapping
 *
 * Algorithm:
 * 1. Fetch all active identity links for user
 * 2. Apply provider-specific weights
 * 3. Calculate weighted average confidence score
 * 4. Determine overall assurance level (low/medium/high/very-high)
 *
 * @see TECHNICAL_ARCHITECTURE.md Section 4.2
 */

import { query } from './db';

/**
 * Provider weights based on trust level and verification rigor
 *
 * Scoring logic:
 * - Stripe Identity: 0.4 (Government ID + liveness)
 * - UK Gov Verify: 0.4 (GPG 45 certified)
 * - Bank OpenID: 0.3 (Financial institution KYC)
 * - Onfido: 0.35 (Professional KYC provider)
 * - Auth0: 0.1 (Email verification only)
 * - Mock: 0.05 (Development only)
 */
export const PROVIDER_WEIGHTS: Record<string, number> = {
  'stripe-identity': 0.4,
  'uk-gov-verify': 0.4,
  'uk-gov-one-login': 0.4,
  'bank-openid': 0.3,
  onfido: 0.35,
  yoti: 0.35,
  auth0: 0.1,
  'mock-kyc': 0.05,
};

/**
 * Verification level score mapping
 */
export const VERIFICATION_LEVEL_SCORES: Record<string, number> = {
  'very-high': 1.0,
  high: 0.85,
  medium: 0.6,
  low: 0.3,
  pending: 0.0,
  none: 0.0,
};

/**
 * Identity link data structure
 */
export interface IdentityLink {
  id: string;
  user_profile_id: string;
  provider: string;
  provider_user_id: string;
  provider_type: string;
  verification_level: string;
  assurance_level: string;
  is_active: boolean;
  verified_at: Date | null;
  last_verified_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
  metadata?: Record<string, unknown>;
  credential_data?: Record<string, unknown>; // Add this field
}

/**
 * Identity resolution result
 */
export interface IdentityResolution {
  userProfileId: string;
  identityLinks: IdentityLink[];
  linkedProvidersCount: number;
  overallConfidence: number; // 0.0 to 1.0
  confidencePercentage: number; // 0 to 100
  assuranceLevel: 'very-high' | 'high' | 'medium' | 'low' | 'none';
  gpg45Level: string;
  eidasLevel: string;
  hasGovernmentId: boolean;
  hasLivenessCheck: boolean;
  highestVerificationLevel: string;
  providerBreakdown: {
    provider: string;
    weight: number;
    verificationLevel: string;
    score: number;
    contributionToConfidence: number;
  }[];
  recommendations: string[];
}

/**
 * Resolve identity and calculate confidence score for a user
 *
 * @param userProfileId - User profile ID
 * @returns Identity resolution with confidence score
 */
export async function resolveIdentity(userProfileId: string): Promise<IdentityResolution> {
  // Fetch all active identity links for this user
  const linksResult = await query(
    `SELECT 
      id,
      user_profile_id,
      provider,
      provider_user_id,
      provider_type,
      verification_level,
      assurance_level,
      is_active,
      verified_at,
      last_verified_at,
      expires_at,
      created_at,
      metadata,
      credential_data
    FROM identity_links 
    WHERE user_profile_id = $1 
      AND is_active = TRUE
    ORDER BY verification_level DESC, created_at DESC`,
    [userProfileId]
  );

  const identityLinks: IdentityLink[] = linksResult.rows;

  // If no links, return minimal resolution
  if (identityLinks.length === 0) {
    return {
      userProfileId,
      identityLinks: [],
      linkedProvidersCount: 0,
      overallConfidence: 0.0,
      confidencePercentage: 0,
      assuranceLevel: 'none',
      gpg45Level: 'none',
      eidasLevel: 'none',
      hasGovernmentId: false,
      hasLivenessCheck: false,
      highestVerificationLevel: 'none',
      providerBreakdown: [],
      recommendations: [
        'Complete identity verification with Stripe Identity',
        'Link additional identity providers to increase confidence',
      ],
    };
  }

  // Calculate weighted confidence score
  let weightedScore = 0;
  let totalWeight = 0;
  const providerBreakdown: IdentityResolution['providerBreakdown'] = [];

  for (const link of identityLinks) {
    const providerWeight = PROVIDER_WEIGHTS[link.provider] || 0.1;
    const verificationScore = VERIFICATION_LEVEL_SCORES[link.verification_level] || 0.0;
    const contribution = providerWeight * verificationScore;

    weightedScore += contribution;
    totalWeight += providerWeight;

    providerBreakdown.push({
      provider: link.provider,
      weight: providerWeight,
      verificationLevel: link.verification_level,
      score: verificationScore,
      contributionToConfidence: contribution,
    });
  }

  // Calculate overall confidence (0-1 scale)
  const overallConfidence = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const confidencePercentage = Math.round(overallConfidence * 100);

  // Determine assurance level based on confidence
  let assuranceLevel: IdentityResolution['assuranceLevel'] = 'none';
  if (overallConfidence >= 0.9) {
    assuranceLevel = 'very-high';
  } else if (overallConfidence >= 0.7) {
    assuranceLevel = 'high';
  } else if (overallConfidence >= 0.5) {
    assuranceLevel = 'medium';
  } else if (overallConfidence > 0) {
    assuranceLevel = 'low';
  }

  // Map to GPG 45 levels
  const gpg45Level = mapToGPG45(assuranceLevel);

  // Map to eIDAS levels
  const eidasLevel = mapToEIDAS(assuranceLevel);

  // Check for government ID and liveness
  const hasGovernmentId = identityLinks.some(
    (link) =>
      link.provider === 'stripe-identity' ||
      link.provider === 'onfido' ||
      link.provider === 'yoti' ||
      link.provider === 'uk-gov-verify'
  );

  const hasLivenessCheck = identityLinks.some((link) => {
    const credentialData = link.credential_data as Record<string, unknown> | undefined;
    return credentialData?.livenessCheck === true;
  });

  // Find highest verification level
  const verificationLevels = ['very-high', 'high', 'medium', 'low', 'pending', 'none'];
  const highestVerificationLevel =
    verificationLevels.find((level) =>
      identityLinks.some((link) => link.verification_level === level)
    ) || 'none';

  // Generate recommendations
  const recommendations = generateRecommendations({
    overallConfidence,
    linkedProviders: identityLinks.length,
    hasGovernmentId,
    hasLivenessCheck,
    highestVerificationLevel,
  });

  return {
    userProfileId,
    identityLinks,
    linkedProvidersCount: identityLinks.length,
    overallConfidence,
    confidencePercentage,
    assuranceLevel,
    gpg45Level,
    eidasLevel,
    hasGovernmentId,
    hasLivenessCheck,
    highestVerificationLevel,
    providerBreakdown,
    recommendations,
  };
}

/**
 * Map assurance level to GPG 45 confidence level
 */
function mapToGPG45(assuranceLevel: string): string {
  switch (assuranceLevel) {
    case 'very-high':
      return 'Very High (GPG 45)';
    case 'high':
      return 'High (GPG 45)';
    case 'medium':
      return 'Medium (GPG 45)';
    case 'low':
      return 'Low (GPG 45)';
    default:
      return 'None';
  }
}

/**
 * Map assurance level to eIDAS Level of Assurance
 */
function mapToEIDAS(assuranceLevel: string): string {
  switch (assuranceLevel) {
    case 'very-high':
    case 'high':
      return 'High (eIDAS)';
    case 'medium':
      return 'Substantial (eIDAS)';
    case 'low':
      return 'Low (eIDAS)';
    default:
      return 'None';
  }
}

/**
 * Generate recommendations to improve identity confidence
 */
function generateRecommendations(context: {
  overallConfidence: number;
  linkedProviders: number;
  hasGovernmentId: boolean;
  hasLivenessCheck: boolean;
  highestVerificationLevel: string;
}): string[] {
  const recommendations: string[] = [];

  // Confidence-based recommendations
  if (context.overallConfidence < 0.5) {
    recommendations.push('Complete identity verification to reach medium confidence level');
  }

  if (context.overallConfidence < 0.7) {
    recommendations.push('Verify with additional providers to reach high confidence level');
  }

  // Provider-specific recommendations
  if (!context.hasGovernmentId) {
    recommendations.push('Complete Stripe Identity verification with government-issued ID');
  }

  if (!context.hasLivenessCheck) {
    recommendations.push('Complete liveness check (selfie verification) for higher trust');
  }

  if (context.linkedProviders < 2) {
    recommendations.push('Link at least 2 identity providers for increased confidence');
  }

  // High confidence encouragement
  if (context.overallConfidence >= 0.9) {
    recommendations.push('Excellent! You have very high identity confidence.');
  } else if (context.overallConfidence >= 0.7) {
    recommendations.push('Good! You have high identity confidence.');
  }

  return recommendations;
}

/**
 * Get quick confidence summary for a user (lightweight version)
 *
 * @param userProfileId - User profile ID
 * @returns Quick confidence summary
 */
export async function getConfidenceSummary(userProfileId: string): Promise<{
  confidence: number;
  confidencePercentage: number;
  level: string;
  linkedProvidersCount: number;
}> {
  const resolution = await resolveIdentity(userProfileId);

  return {
    confidence: resolution.overallConfidence,
    confidencePercentage: resolution.confidencePercentage,
    level: resolution.assuranceLevel,
    linkedProvidersCount: resolution.linkedProvidersCount,
  };
}
