/**
 * GET /api/consent-ledger/current
 * 
 * Get current consent entry for authenticated actor
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import { getLatestConsent, getConsentHistory } from '@/lib/consent-ledger';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    // 2. Get user profile
    const profileResult = await query(
      'SELECT id FROM user_profiles WHERE auth0_user_id = $1',
      [auth0UserId]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];

    // 3. Find actor record
    const actorResult = await query(
      'SELECT id FROM actors WHERE user_profile_id = $1',
      [profile.id]
    );

    if (actorResult.rows.length === 0) {
      return NextResponse.json({
        current: null,
        history: [],
        message: 'No actor record found',
      });
    }

    const actorId = actorResult.rows[0].id;

    // 4. Get consent data
    const searchParams = request.nextUrl.searchParams;
    const includeHistory = searchParams.get('includeHistory') === 'true';

    const current = await getLatestConsent(actorId);
    const history = includeHistory ? await getConsentHistory(actorId, 20) : [];

    return NextResponse.json({
      current,
      history,
      actorId,
    });
  } catch (error) {
    console.error('[CONSENT LEDGER] Get current error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consent data' },
      { status: 500 }
    );
  }
}
