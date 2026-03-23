import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

interface IdentityLink {
  linkId: string;
  provider: string;
  providerType: string;
  verificationLevel: string | null;
  assuranceLevel: string | null;
  verifiedAt: string | null;
  linkedAt: string;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  isExpired: boolean;
  metadata: Record<string, unknown> | null;
}

/**
 * GET /api/identity/links?activeOnly=true
 * Lists all identity provider links for the current user
 * 
 * Step 7: Multi-Provider Identity Linking
 */
export async function GET(request: NextRequest) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Get user profile ID from Auth0 user ID
    const userResult = await query(
      `SELECT id FROM user_profiles WHERE auth0_user_id = $1`,
      [session.user.sub]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // Build query
    let sql = `
      SELECT 
        id,
        provider,
        provider_type,
        verification_level,
        assurance_level,
        verified_at,
        linked_at,
        last_verified_at,
        expires_at,
        is_active,
        metadata
      FROM identity_links 
      WHERE user_profile_id = $1
    `;

    if (activeOnly) {
      sql += ` AND is_active = TRUE`;
    }

    sql += ` ORDER BY 
      CASE verification_level 
        WHEN 'very-high' THEN 4 
        WHEN 'high' THEN 3 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 1 
        ELSE 0 
      END DESC,
      linked_at DESC`;

    const result = await query(sql, [userId]);

    const now = new Date();

    // Transform and enrich results
    const links: IdentityLink[] = result.rows.map((row: Record<string, unknown>) => {
      const expiresAt = row.expires_at ? new Date(row.expires_at as string) : null;
      const isExpired = expiresAt ? expiresAt < now : false;

      return {
        linkId: row.id as string,
        provider: row.provider as string,
        providerType: row.provider_type as string,
        verificationLevel: row.verification_level as string | null,
        assuranceLevel: row.assurance_level as string | null,
        verifiedAt: row.verified_at as string | null,
        linkedAt: row.linked_at as string,
        lastVerifiedAt: row.last_verified_at as string | null,
        expiresAt: row.expires_at as string | null,
        isActive: (row.is_active as boolean) && !isExpired,
        isExpired,
        metadata: row.metadata as Record<string, unknown> | null,
      };
    });

    // Calculate summary statistics
    const summary = calculateLinksSummary(links);

    console.log('[IDENTITY-LINKS] Listed identity links:', {
      userId,
      total: links.length,
      active: summary.active,
    });

    return NextResponse.json(
      {
        userId,
        links,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[IDENTITY-LINKS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to list identity links',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate summary statistics for identity links
 */
function calculateLinksSummary(links: IdentityLink[]) {
  const byProvider: Record<string, number> = {};
  let active = 0;
  let inactive = 0;

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

  for (const link of links) {
    // Count by provider
    byProvider[link.provider] = (byProvider[link.provider] || 0) + 1;

    // Count active/inactive
    if (link.isActive && !link.isExpired) {
      active++;

      // Track highest verification level (only for active links)
      if (link.verificationLevel) {
        const rank = verificationLevelRank[link.verificationLevel] || 0;
        if (rank > highestVerificationRank) {
          highestVerificationRank = rank;
          highestVerificationLevel = link.verificationLevel;
        }
      }

      // Track highest assurance level (only for active links)
      if (link.assuranceLevel) {
        const rank = assuranceLevelRank[link.assuranceLevel] || 0;
        if (rank > highestAssuranceRank) {
          highestAssuranceRank = rank;
          highestAssuranceLevel = link.assuranceLevel;
        }
      }
    } else {
      inactive++;
    }
  }

  return {
    total: links.length,
    active,
    inactive,
    byProvider,
    highestVerificationLevel,
    highestAssuranceLevel,
  };
}
