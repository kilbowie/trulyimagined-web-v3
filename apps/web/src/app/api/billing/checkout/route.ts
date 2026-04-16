import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { z } from 'zod';
import {
  getAgencySeatAddonPriceId,
  type BillingInterval,
  getOrCreateStripeCustomer,
  getPlanById,
  getPlanPriceId,
  getPlansForRoles,
  isStripeBillingConfigured,
} from '@/lib/billing';
import { getBillingProfileByAuth0UserId } from '@/lib/hdicr/billing-client';
import { queryTi } from '@/lib/db';
import { stripe } from '@/lib/stripe';

const CheckoutSchema = z.object({
  planId: z.string().min(1),
  interval: z.enum(['monthly', 'yearly']).optional(),
  seatCount: z.number().int().min(1).max(500).optional(),
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
      return NextResponse.json(
        { success: false, error: 'Invalid request payload' },
        { status: 400 }
      );
    }

    const auth0UserId = session.user.sub;
    const profile = await getBillingProfileByAuth0UserId(auth0UserId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const localUserProfileId = await resolveLocalUserProfileId(auth0UserId);
    if (!localUserProfileId) {
      return NextResponse.json(
        { success: false, error: 'Local TI user profile not found' },
        { status: 404 }
      );
    }

    const roles = profile.role ? [profile.role] : [];
    const allowedPlans = getPlansForRoles(roles);

    const selectedPlan = getPlanById(payload.data.planId);
    if (!selectedPlan || !allowedPlans.some((plan) => plan.id === selectedPlan.id)) {
      return NextResponse.json(
        { success: false, error: 'Selected billing plan is not available for your role.' },
        { status: 403 }
      );
    }

    const selectedInterval =
      (payload.data.interval as BillingInterval | undefined) ?? selectedPlan.defaultInterval;

    const priceId = getPlanPriceId(selectedPlan, selectedInterval);
    if (!priceId) {
      const missingEnvKey = selectedPlan.priceEnvKeys[selectedInterval];
      return NextResponse.json(
        {
          success: false,
          error: `${missingEnvKey ?? 'Selected plan price'} is not configured for this environment.`,
        },
        { status: 503 }
      );
    }

    const lineItems: Array<{ price: string; quantity: number }> = [{ price: priceId, quantity: 1 }];

    const seatCount = payload.data.seatCount ?? 1;
    const additionalSeatCount = seatCount > 1 ? seatCount - 1 : 0;
    if (
      additionalSeatCount > 0 &&
      ['agency_independent', 'agency_boutique', 'agency_sme'].includes(selectedPlan.id)
    ) {
      const addonPriceId = getAgencySeatAddonPriceId();
      if (!addonPriceId) {
        return NextResponse.json(
          {
            success: false,
            error: 'STRIPE_PRICE_AGENCY_SEAT_ADDON is not configured for this environment.',
          },
          { status: 503 }
        );
      }

      lineItems.push({
        price: addonPriceId,
        quantity: additionalSeatCount,
      });
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
      line_items: lineItems,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      metadata: {
        app: 'trulyimagined',
        auth0_user_id: auth0UserId,
        user_profile_id: localUserProfileId,
        requested_plan_id: selectedPlan.id,
        requested_interval: selectedInterval,
        requested_seat_count: String(seatCount),
      },
      subscription_data: {
        metadata: {
          app: 'trulyimagined',
          auth0_user_id: auth0UserId,
          user_profile_id: localUserProfileId,
          plan_id: selectedPlan.id,
          interval: selectedInterval,
          seat_count: String(seatCount),
        },
      },
      success_url: `${appBaseUrl}/dashboard/account/billing?checkout=success`,
      cancel_url: `${appBaseUrl}/dashboard/account/billing?checkout=cancelled`,
    });

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      interval: selectedInterval,
      seatCount,
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

async function resolveLocalUserProfileId(auth0UserId: string): Promise<string | null> {
  const result = await queryTi(
    `SELECT id
     FROM user_profiles
     WHERE auth0_user_id = $1
     LIMIT 1`,
    [auth0UserId]
  );

  return (result.rows[0]?.id as string | undefined) ?? null;
}
