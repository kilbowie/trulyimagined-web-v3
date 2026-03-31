import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import { z } from 'zod';
import {
  getOrCreateStripeCustomer,
  getPlanById,
  getPlanPriceId,
  getPlansForRoles,
  isStripeBillingConfigured,
} from '@/lib/billing';
import { stripe } from '@/lib/stripe';

const CheckoutSchema = z.object({
  planId: z.string().min(1),
});

export async function POST(request: NextRequest) {
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

    const payload = CheckoutSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ success: false, error: 'Invalid request payload' }, { status: 400 });
    }

    const auth0UserId = session.user.sub;
    const profileResult = await query(
      'SELECT id, role, email, username FROM user_profiles WHERE auth0_user_id = $1 LIMIT 1',
      [auth0UserId]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];
    const roles = profile.role ? [profile.role] : [];
    const allowedPlans = getPlansForRoles(roles);

    const selectedPlan = getPlanById(payload.data.planId);
    if (!selectedPlan || !allowedPlans.some((plan) => plan.id === selectedPlan.id)) {
      return NextResponse.json(
        { success: false, error: 'Selected billing plan is not available for your role.' },
        { status: 403 }
      );
    }

    const priceId = getPlanPriceId(selectedPlan);
    if (!priceId) {
      return NextResponse.json(
        {
          success: false,
          error: `${selectedPlan.priceEnvKey} is not configured for this environment.`,
        },
        { status: 503 }
      );
    }

    const customer = await getOrCreateStripeCustomer({
      auth0UserId,
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

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      metadata: {
        app: 'trulyimagined',
        auth0_user_id: auth0UserId,
        user_profile_id: profile.id,
        requested_plan_id: selectedPlan.id,
      },
      subscription_data: {
        metadata: {
          app: 'trulyimagined',
          auth0_user_id: auth0UserId,
          user_profile_id: profile.id,
          plan_id: selectedPlan.id,
        },
      },
      success_url: `${appBaseUrl}/dashboard/account/billing?checkout=success`,
      cancel_url: `${appBaseUrl}/dashboard/account/billing?checkout=cancelled`,
    });

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error('[BILLING_CHECKOUT_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session',
      },
      { status: 500 }
    );
  }
}
