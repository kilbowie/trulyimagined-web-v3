/**
 * GET /api/consent-ledger/current
 *
 * Get current consent entry for authenticated actor
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getCurrentConsentLedger, resolveActorIdByAuth0UserId } from '@/lib/hdicr/consent-client';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    let actorId: string | null = null;
    try {
      actorId = await resolveActorIdByAuth0UserId(auth0UserId);
    } catch (error) {
      console.warn('[CONSENT LEDGER] HDICR actor-id resolution unavailable', error);
      return NextResponse.json({
        current: null,
        history: [],
        serviceUnavailable: true,
        message: 'Consent service temporarily unavailable',
      });
    }

    if (!actorId) {
      return NextResponse.json({
        current: null,
        history: [],
        message: 'No actor record found',
      });
    }

    // 4. Get consent data
    const searchParams = request.nextUrl.searchParams;
    const includeHistory = searchParams.get('includeHistory') === 'true';

    let current: unknown = null;
    let history: unknown[] = [];
    let licensesOnCurrentVersion = 0;
    try {
      const result = await getCurrentConsentLedger(actorId, includeHistory);
      current = result.current;
      history = result.history;
      licensesOnCurrentVersion = result.licensesOnCurrentVersion;
    } catch (error) {
      console.warn('[CONSENT LEDGER] HDICR getCurrentConsentLedger unavailable', error);
      return NextResponse.json({
        current: null,
        history: [],
        actorId,
        licensesOnCurrentVersion: 0,
        serviceUnavailable: true,
        message: 'Consent service temporarily unavailable',
      });
    }

    return NextResponse.json({
      current,
      history,
      actorId,
      licensesOnCurrentVersion,
    });
  } catch (error) {
    console.error('[CONSENT LEDGER] Get current error:', error);
    return NextResponse.json({ error: 'Failed to fetch consent data' }, { status: 500 });
  }
}
