import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

/**
 * POST /api/identity/unlink
 * Unlinks an external identity provider from the user's profile
 *
 * Step 7: Multi-Provider Identity Linking
 * Soft delete - sets is_active = FALSE
 */
export async function POST(request: NextRequest) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { linkId, provider } = body;

    // Validation
    if (!linkId && !provider) {
      return NextResponse.json(
        {
          error: 'Must provide either linkId or provider to unlink',
        },
        { status: 400 }
      );
    }

    // Get user profile ID from Auth0 user ID
    const userResult = await query(`SELECT id FROM user_profiles WHERE auth0_user_id = $1`, [
      session.user.sub,
    ]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    let result;
    let unlinkedProvider = '';

    if (linkId) {
      // Unlink by specific link ID
      result = await query(
        `UPDATE identity_links 
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1 AND user_profile_id = $2
         RETURNING provider`,
        [linkId, userId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          {
            error: 'Identity link not found or unauthorized',
          },
          { status: 404 }
        );
      }

      unlinkedProvider = result.rows[0].provider;
    } else if (provider) {
      // Unlink all links for this provider
      result = await query(
        `UPDATE identity_links 
         SET is_active = FALSE, updated_at = NOW()
         WHERE user_profile_id = $1 AND provider = $2 AND is_active = TRUE
         RETURNING id`,
        [userId, provider]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          {
            error: 'No active links found for this provider',
          },
          { status: 404 }
        );
      }

      unlinkedProvider = provider;
    }

    console.log('[IDENTITY-UNLINK] Unlinked provider:', {
      userId,
      linkId,
      provider: unlinkedProvider,
      count: result?.rows.length || 0,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Identity provider unlinked successfully',
        unlinkedProvider,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[IDENTITY-UNLINK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to unlink identity provider',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
