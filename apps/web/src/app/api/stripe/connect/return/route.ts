import { NextRequest, NextResponse } from 'next/server';
import { updateActorConnectStatus } from '../_shared';

function resolveAppBaseUrl(request: NextRequest): string {
  const configured = process.env.AUTH0_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured;
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get('account') || url.searchParams.get('account_id');

  if (!accountId) {
    return NextResponse.json({ error: 'Missing Stripe account id in query string' }, { status: 400 });
  }

  try {
    const status = await updateActorConnectStatus(accountId);
    const baseUrl = resolveAppBaseUrl(request);
    const destination = new URL('/dashboard/verify-identity', baseUrl);

    destination.searchParams.set('connect_status', status.onboardingComplete ? 'complete' : 'pending');
    destination.searchParams.set('account_id', accountId);

    return NextResponse.redirect(destination);
  } catch (error) {
    console.error('[STRIPE CONNECT] return route failed', error);
    return NextResponse.json({ error: 'Failed to process Connect return callback' }, { status: 500 });
  }
}
