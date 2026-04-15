import { NextResponse } from 'next/server';
import { createConnectOnboardingLink } from '@/lib/stripe';
import { getConnectActorContext } from '../_shared';

export async function POST() {
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

    return NextResponse.json({
      success: true,
      accountId: stripeAccountId,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error('[STRIPE CONNECT] onboarding route failed', error);
    return NextResponse.json({ error: 'Failed to generate onboarding link' }, { status: 500 });
  }
}
