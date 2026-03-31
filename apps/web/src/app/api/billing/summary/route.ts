import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import {
  findStripeCustomerByAuth0User,
  getPlanPriceId,
  getPlansForRoles,
  isStripeBillingConfigured,
} from '@/lib/billing';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;
    const profileResult = await query(
      'SELECT id, role, email, username FROM user_profiles WHERE auth0_user_id = $1 LIMIT 1',
      [auth0UserId]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const profile = profileResult.rows[0];
    const roles = profile.role ? [profile.role] : [];

    const availablePlans = getPlansForRoles(roles).map((plan) => ({
      ...plan,
      configured: Boolean(getPlanPriceId(plan)),
    }));

    if (!isStripeBillingConfigured()) {
      return NextResponse.json({
        success: true,
        stripeConfigured: false,
        customer: null,
        subscription: null,
        invoices: [],
        availablePlans,
      });
    }

    const customer = await findStripeCustomerByAuth0User(auth0UserId, session.user.email);
    if (!customer) {
      return NextResponse.json({
        success: true,
        stripeConfigured: true,
        customer: null,
        subscription: null,
        invoices: [],
        availablePlans,
      });
    }

    const subscriptionList = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 1,
      expand: ['data.items.data.price.product'],
    });

    const activeSubscription = subscriptionList.data[0] || null;
    const firstSubscriptionItem = activeSubscription?.items?.data?.[0] || null;

    const invoiceList = await stripe.invoices.list({
      customer: customer.id,
      limit: 5,
    });

    return NextResponse.json({
      success: true,
      stripeConfigured: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
      subscription: activeSubscription
        ? {
            id: activeSubscription.id,
            status: activeSubscription.status,
            cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
            currentPeriodEnd: firstSubscriptionItem?.current_period_end || null,
            items: activeSubscription.items.data.map((item) => ({
              id: item.id,
              priceId: item.price.id,
              productName:
                typeof item.price.product === 'string'
                  ? item.price.product
                  : 'deleted' in item.price.product
                    ? 'Subscription Product'
                    : item.price.product.name || 'Subscription Product',
            })),
          }
        : null,
      invoices: invoiceList.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        created: invoice.created,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      })),
      availablePlans,
    });
  } catch (error) {
    console.error('[BILLING_SUMMARY_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load billing summary',
      },
      { status: 500 }
    );
  }
}
