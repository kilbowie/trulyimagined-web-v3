import { NextRequest, NextResponse } from 'next/server';
import { applyDueRepresentationTerminations } from '@/lib/representation-termination';

/**
 * POST /api/representation/terminate/sweep
 * Cron endpoint that applies due termination notices.
 */
export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.REPRESENTATION_TERMINATION_CRON_SECRET;
    const providedSecret = request.headers.get('x-cron-secret');

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await applyDueRepresentationTerminations();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[REPRESENTATION_TERMINATION_SWEEP] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
