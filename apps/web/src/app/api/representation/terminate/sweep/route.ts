import { NextRequest, NextResponse } from 'next/server';
import { applyDueRepresentationTerminations } from '@/lib/representation-termination';

/**
 * GET /api/representation/terminate/sweep
 * Cron endpoint that applies due termination notices.
 */
export async function GET(request: NextRequest) {
  try {
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    const expectedSecret = process.env.REPRESENTATION_TERMINATION_CRON_SECRET;
    const providedSecret = request.nextUrl.searchParams.get('secret');

    const isAuthorizedByVercelCron = vercelCronHeader === '1';
    const isAuthorizedBySecret = Boolean(expectedSecret) && providedSecret === expectedSecret;

    if (!isAuthorizedByVercelCron && !isAuthorizedBySecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await applyDueRepresentationTerminations();
    const authMode = isAuthorizedByVercelCron ? 'vercel-cron-header' : 'shared-secret';

    return NextResponse.json({
      success: true,
      triggeredAt: new Date().toISOString(),
      authMode,
      ...result,
    });
  } catch (error) {
    console.error('[REPRESENTATION_TERMINATION_SWEEP] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
