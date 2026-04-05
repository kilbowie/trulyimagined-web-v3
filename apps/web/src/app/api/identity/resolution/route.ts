/**
 * GET /api/identity/resolution
 *
 * Get identity resolution and confidence score for the authenticated user
 *
 * Step 8: Identity Confidence Scoring
 *
 * Returns:
 * - Overall identity confidence score (0-100%)
 * - Assurance level (low/medium/high/very-high)
 * - GPG 45 & eIDAS level mappings
 * - List of linked identity providers
 * - Provider breakdown with individual contributions
 * - Recommendations to improve confidence
 *
 * Example response:
 * {
 *   "userProfileId": "123",
 *   "linkedProvidersCount": 2,
 *   "overallConfidence": 0.85,
 *   "confidencePercentage": 85,
 *   "assuranceLevel": "high",
 *   "gpg45Level": "High (GPG 45)",
 *   "eidasLevel": "High (eIDAS)",
 *   "hasGovernmentId": true,
 *   "hasLivenessCheck": true,
 *   "providerBreakdown": [...],
 *   "recommendations": [...]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getIdentityResolution } from '@/lib/hdicr/identity-client';

export async function GET(_request: NextRequest) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identityResolution = await getIdentityResolution(session.user.sub);
    if (!identityResolution) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    const { userProfileId, resolution } = identityResolution;

    console.log('[IDENTITY RESOLUTION] Calculated confidence:', {
      userProfileId,
      confidence: resolution.confidencePercentage,
      level: resolution.assuranceLevel,
      linkedProviders: resolution.linkedProvidersCount,
    });

    return NextResponse.json(resolution, { status: 200 });
  } catch (error) {
    console.error('[IDENTITY RESOLUTION] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to resolve identity',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
