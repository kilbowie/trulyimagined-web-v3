/**
 * GET /api/admin/payouts
 *
 * Admin endpoint to retrieve payout summary across all studios.
 * - Lists all Stripe transfers (payouts) to connected accounts
 * - Aggregates by studio/studio_user
 * - Shows totals: pending, paid, failed, reversed
 *
 * Authorization: Admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { queryTi } from '@/lib/db';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin())) {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '50', 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 50;

    // Get studio info for all Stripe Connect accounts
    const studioResult = await queryTi(
      `SELECT
         sa.id,
         sa.user_profile_id,
         sa.stripe_account_id,
         s.id AS studio_id,
         s.name AS studio_name,
         up.email,
         sa.account_status,
         sa.payouts_enabled,
         sa.created_at
       FROM stripe_accounts sa
       JOIN user_profiles up ON up.id = sa.user_profile_id
       LEFT JOIN studios s ON s.user_profile_id = sa.user_profile_id
       WHERE sa.deleted_at IS NULL
         AND sa.stripe_account_id IS NOT NULL
       ORDER BY sa.updated_at DESC
       LIMIT $1`,
      [limit]
    );

    // For each connected account, fetch transfer history from Stripe
    const payoutSummary = [];

    for (const studio of studioResult.rows) {
      try {
        const transfers = await stripe.transfers.list(
          {
            limit: 100,
            destination: studio.stripe_account_id,
          }
        );

        // Aggregate transfer statuses
        const summary = {
          total: 0,
          successful: 0,
          reversed: 0,
          totalAmountCents: 0,
          totalReversedCents: 0,
          transfers: transfers.data.slice(0, 10), // Latest 10 for preview
        };

        for (const transfer of transfers.data) {
          summary.total += 1;
          if (transfer.reversed) {
            summary.reversed += 1;
            summary.totalReversedCents += transfer.amount_reversed ?? 0;
          } else {
            summary.successful += 1;
          }
          summary.totalAmountCents += transfer.amount;
        }

        payoutSummary.push({
          studioId: studio.studio_id,
          studioName: studio.studio_name,
          userEmail: studio.email,
          stripeAccountId: studio.stripe_account_id,
          accountStatus: studio.account_status,
          payoutsEnabled: studio.payouts_enabled,
          transferSummary: summary,
          connectedAt: studio.created_at,
        });
      } catch (stripeError) {
        console.warn('[ADMIN_PAYOUTS] Failed to fetch transfers for studio:', {
          studioId: studio.studio_id,
          stripeAccountId: studio.stripe_account_id,
          error: stripeError instanceof Error ? stripeError.message : String(stripeError),
        });
        payoutSummary.push({
          studioId: studio.studio_id,
          studioName: studio.studio_name,
          userEmail: studio.email,
          stripeAccountId: studio.stripe_account_id,
          accountStatus: studio.account_status,
          payoutsEnabled: studio.payouts_enabled,
          transferSummary: null,
          error: 'Failed to fetch transfers from Stripe',
          connectedAt: studio.created_at,
        });
      }
    }

    // Calculate platform totals
    const totals = {
      totalStudios: payoutSummary.length,
      totalTransfers: payoutSummary.reduce((sum, s) => sum + (s.transferSummary?.total ?? 0), 0),
      totalPaidCents: payoutSummary.reduce((sum, s) => sum + (s.transferSummary?.totalAmountCents ?? 0), 0),
      studiosWithPayoutsEnabled: payoutSummary.filter((s) => s.payoutsEnabled).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        totals,
        studios: payoutSummary,
      },
    });
  } catch (error) {
    console.error('[ADMIN_PAYOUTS] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
