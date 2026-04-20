/**
 * POST /api/deals/[dealId]/refund
 *
 * Studio initiates refund on a paid deal.
 * - Validates deal is paid (payment_status = 'paid')
 * - Creates Stripe refund for the PaymentIntent
 * - Updates deal payment_status to 'refunded'
 * - Revokes the actor's associated license
 * - Logs audit trail
 *
 * Authorization: Studio owner or Admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { queryTi } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { createStructuredConsole } from '@/lib/logger';

const log = createStructuredConsole('deals_refund');

interface RouteParams {
  params: Promise<{ dealId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse<any>> {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const isAdmin = roles.includes('Admin');

    const { dealId } = await params;

    // Get deal with authorization check
    const dealResult = await queryTi(
      `SELECT
         d.id,
         d.studio_id,
         d.actor_id,
         d.studio_user_id,
         d.status,
         d.payment_status,
         d.payment_intent_id,
         s.user_profile_id AS studio_user_profile_id
       FROM deals d
       JOIN studios s ON s.id = d.studio_id
       WHERE d.id = $1
         AND d.deleted_at IS NULL`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const deal = dealResult.rows[0] as {
      id: string;
      studio_id: string;
      actor_id: string;
      studio_user_id: string;
      status: string;
      payment_status: string;
      payment_intent_id: string | null;
      studio_user_profile_id: string;
    };

    // Check authorization: requester must be studio owner or admin
    if (!isAdmin && deal.studio_user_profile_id !== session.user.sub) {
      return NextResponse.json(
        { error: 'Forbidden: Only studio owner or admin can refund deals' },
        { status: 403 }
      );
    }

    // Validate deal is paid
    if (deal.payment_status !== 'paid') {
      return NextResponse.json(
        {
          error: `Cannot refund deal with payment_status '${deal.payment_status}'. Only 'paid' deals can be refunded.`,
        },
        { status: 409 }
      );
    }

    if (!deal.payment_intent_id) {
      return NextResponse.json(
        { error: 'Deal has no payment_intent_id. Cannot refund.' },
        { status: 409 }
      );
    }

    // Create Stripe refund
    let refundId: string;
    try {
      const refund = await stripe.refunds.create({
        payment_intent: deal.payment_intent_id,
        metadata: {
          deal_id: deal.id,
          refund_initiated_by: session.user.sub,
          refund_reason: 'studio_requested',
        },
      });
      refundId = refund.id;
    } catch (stripeError) {
      log.error('stripe_refund_failed', stripeError);
      return NextResponse.json(
        {
          error: 'Failed to create Stripe refund',
          details: stripeError instanceof Error ? stripeError.message : String(stripeError),
        },
        { status: 500 }
      );
    }

    // Update deal to refunded status
    await queryTi(
      `UPDATE deals
       SET payment_status = 'refunded',
           updated_at = NOW()
       WHERE id = $1`,
      [deal.id]
    );

    // Revoke the license associated with this deal
    const licenseRevoke = await queryTi(
      `UPDATE licenses
       SET status = 'revoked',
           revoked_at = NOW(),
           updated_at = NOW()
       WHERE deal_id = $1
         AND status = 'active'
       RETURNING id`,
      [deal.id]
    );

    // Log audit entry
    await queryTi(
      `INSERT INTO stripe_events_audit (
         action,
         user_profile_id,
         resource_id,
         resource_type,
         changes,
         metadata,
         created_at
       )
       VALUES (
         'deal.refunded',
         $1,
         $2,
         'deal',
         $3,
         $4,
         NOW()
       )`,
      [
        session.user.sub,
        deal.id,
        JSON.stringify({
          deal_id: deal.id,
          payment_intent_id: deal.payment_intent_id,
          refund_id: refundId,
          actor_id: deal.actor_id,
          license_revoked: (licenseRevoke.rowCount ?? 0) > 0,
        }),
        JSON.stringify({
          refund_initiated_by: session.user.sub,
          is_admin: isAdmin,
        }),
      ]
    );

    log.info('deal_refund_success', {
      dealId: deal.id,
      refundId,
      licenseRevoked: (licenseRevoke.rowCount ?? 0) > 0,
    });

    return NextResponse.json({
      success: true,
      data: {
        dealId: deal.id,
        refundId,
        paymentStatus: 'refunded',
        licenseRevoked: (licenseRevoke.rowCount ?? 0) > 0,
      },
    });
  } catch (error) {
    log.error('deals_refund_error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
