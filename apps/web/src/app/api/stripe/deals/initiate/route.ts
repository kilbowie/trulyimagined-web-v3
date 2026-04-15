import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth0 } from '@/lib/auth0';
import { getUserProfile } from '@/lib/auth';
import { queryTi } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { calculateDealBreakdown } from '@/lib/stripe/platformFee';

const InitiateDealSchema = z.object({
  actorUserProfileId: z.string().uuid(),
  dealValueCents: z.number().int().positive(),
  currency: z.string().trim().toLowerCase().default('gbp'),
  description: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

type ActorRow = {
  id: string;
  user_profile_id: string;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  verification_status: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getUserProfile();
    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const role = String(profile.role || '');
    if (!['Enterprise', 'Admin'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Enterprise or Admin role required' },
        { status: 403 }
      );
    }

    const parsed = InitiateDealSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { actorUserProfileId, dealValueCents, currency, description, metadata } = parsed.data;

    const actorResult = await queryTi(
      `SELECT id, user_profile_id, stripe_account_id, stripe_onboarding_complete, verification_status
       FROM actors
       WHERE user_profile_id = $1
       LIMIT 1`,
      [actorUserProfileId]
    );

    if ((actorResult.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { success: false, error: 'Actor not found for provided user_profile_id' },
        { status: 404 }
      );
    }

    const actor = actorResult.rows[0] as ActorRow;

    if (!actor.stripe_account_id || !actor.stripe_onboarding_complete) {
      return NextResponse.json(
        { success: false, error: 'Actor is not payout-enabled on Stripe Connect yet' },
        { status: 409 }
      );
    }

    const breakdown = calculateDealBreakdown(dealValueCents);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: breakdown.dealValueCents,
      currency,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: breakdown.platformFeeCents,
      transfer_data: {
        destination: actor.stripe_account_id,
      },
      description: description || `TI deal payment for actor ${actor.user_profile_id}`,
      metadata: {
        app: 'trulyimagined',
        flow: 'deal_payment',
        studio_user_profile_id: String(profile.id),
        actor_user_profile_id: actor.user_profile_id,
        deal_value_cents: String(breakdown.dealValueCents),
        platform_fee_cents: String(breakdown.platformFeeCents),
        actor_payout_cents: String(breakdown.actorPayoutCents),
        actor_verification_status: actor.verification_status || 'unknown',
        ...(metadata || {}),
      },
    });

    const insertResult = await queryTi(
      `INSERT INTO deals (
         studio_user_id,
         actor_user_id,
         deal_value_cents,
         platform_fee_cents,
         actor_payout_cents,
         stripe_payment_intent_id,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [
        String(profile.id),
        actor.user_profile_id,
        breakdown.dealValueCents,
        breakdown.platformFeeCents,
        breakdown.actorPayoutCents,
        paymentIntent.id,
      ]
    );

    const dealId = insertResult.rows[0]?.id as string | undefined;

    return NextResponse.json({
      success: true,
      deal: {
        id: dealId,
        stripePaymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: 'pending',
        ...breakdown,
      },
    });
  } catch (error) {
    console.error('[STRIPE DEALS] initiate route failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate deal payment',
      },
      { status: 500 }
    );
  }
}
