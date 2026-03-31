import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getOrCreateStripeCustomer, isStripeBillingConfigured } from '@/lib/billing';
import { stripe } from '@/lib/stripe';

export async function POST() {
  try {
    if (!isStripeBillingConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Billing is not configured in this environment.' },
        { status: 503 }
      );
    }

    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const customer = await getOrCreateStripeCustomer({
      auth0UserId: session.user.sub,
      email: session.user.email,
      name: session.user.name,
    });

    const appBaseUrl = process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL;
    if (!appBaseUrl) {
      return NextResponse.json(
        { success: false, error: 'APP_BASE_URL (or AUTH0_BASE_URL) must be configured.' },
        { status: 500 }
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${appBaseUrl}/dashboard/account/billing`,
    });

    return NextResponse.json({ success: true, url: portal.url });
  } catch (error) {
    console.error('[BILLING_PORTAL_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create billing portal session',
      },
      { status: 500 }
    );
  }
}
