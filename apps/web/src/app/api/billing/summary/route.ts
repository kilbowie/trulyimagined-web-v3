import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import {
  findStripeCustomerByAuth0User,
  getPlanPriceId,
  getPlansForRoles,
  isStripeBillingConfigured,
} from '@/lib/billing';
import {
  getBillingOpportunities,
  getBillingProfileByAuth0UserId,
} from '@/lib/hdicr/billing-client';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;
    const profile = await getBillingProfileByAuth0UserId(auth0UserId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const roles = profile.role ? [profile.role] : [];

    const availablePlans = getPlansForRoles(roles).map((plan) => ({
      ...plan,
      configured: Boolean(getPlanPriceId(plan)),
    }));

    if (!isStripeBillingConfigured()) {
      return NextResponse.json({
        success: true,
        stripeConfigured: false,
        role: profile.role || null,
        customer: null,
        subscription: null,
        invoices: [],
        billingHistory: [],
        paymentsHistory: [],
        cards: [],
        opportunities: getBillingOpportunities(profile.role || null),
        availablePlans,
      });
    }

    const customer = await findStripeCustomerByAuth0User(auth0UserId, session.user.email);
    if (!customer) {
      return NextResponse.json({
        success: true,
        stripeConfigured: true,
        role: profile.role || null,
        customer: null,
        subscription: null,
        invoices: [],
        billingHistory: [],
        paymentsHistory: [],
        cards: [],
        opportunities: getBillingOpportunities(profile.role || null),
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
      limit: 12,
    });

    const paymentList = await stripe.charges.list({
      customer: customer.id,
      limit: 12,
    });

    const paymentMethodList = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
      limit: 12,
    });

    const billingHistory = invoiceList.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      created: invoice.created,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
    }));

    const paymentsHistory = paymentList.data.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      amountRefunded: payment.amount_refunded,
      currency: payment.currency,
      created: payment.created,
      description: payment.description,
      receiptUrl: payment.receipt_url,
      paymentMethodDetails:
        payment.payment_method_details?.type === 'card' && payment.payment_method_details.card
          ? {
              brand: payment.payment_method_details.card.brand,
              last4: payment.payment_method_details.card.last4,
            }
          : null,
    }));

    const cards = paymentMethodList.data.map((method) => ({
      id: method.id,
      brand: method.card?.brand || null,
      last4: method.card?.last4 || null,
      expMonth: method.card?.exp_month || null,
      expYear: method.card?.exp_year || null,
      country: method.card?.country || null,
      funding: method.card?.funding || null,
    }));

    return NextResponse.json({
      success: true,
      stripeConfigured: true,
      role: profile.role || null,
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
      billingHistory,
      paymentsHistory,
      cards,
      opportunities: getBillingOpportunities(profile.role || null),
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
