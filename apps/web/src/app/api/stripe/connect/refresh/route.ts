import { NextRequest, NextResponse } from 'next/server';
import { createConnectOnboardingLink } from '@/lib/stripe';
import { getConnectActorContext } from '../_shared';

export async function GET(request: NextRequest) {
  try {
    const actorContext = await getConnectActorContext();
    if (!actorContext.ok) {
      return NextResponse.json({ error: actorContext.error }, { status: actorContext.status });
    }

    const { stripeAccountId } = actorContext.context;
    if (!stripeAccountId) {
      return NextResponse.json(
        { error: 'No Stripe Connect account found. Create one first.' },
        { status: 400 }
      );
    }

    const accountLink = await createConnectOnboardingLink(stripeAccountId);

    const accept = request.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      return NextResponse.redirect(accountLink.url);
    }

    return NextResponse.json({
      success: true,
      accountId: stripeAccountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error('[STRIPE CONNECT] refresh route failed', error);
    return NextResponse.json({ error: 'Failed to refresh onboarding link' }, { status: 500 });
  }
}
