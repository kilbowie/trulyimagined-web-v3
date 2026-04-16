/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint for Identity verification events
 *
 * Step 7: Multi-Provider Identity Linking
 * Handles: identity.verification_session.verified, identity.verification_session.requires_input
 *
 * Setup:
 * 1. Configure webhook in Stripe Dashboard: https://dashboard.stripe.com/webhooks
 * 2. Add endpoint URL: https://yourdomain.com/api/webhooks/stripe
 * 3. Select events: identity.verification_session.*
 * 4. Copy webhook signing secret to STRIPE_WEBHOOK_SECRET env var
 *
 * @see https://stripe.com/docs/identity/verify-identity-documents#handle-verification-outcomes
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { BILLING_PLANS } from '@/lib/billing';
import {
  stripe,
  mapStripeStatusToVerificationLevel,
  getVerifiedIdentityData,
  mapConnectAccountStatus,
} from '@/lib/stripe';
import { getAgencySeatAddonPriceId, getPlanByPriceId } from '@/lib/billing';
import { verifyStripeIdentityConfirmed } from '@/lib/hdicr/stripe-webhook-client';
import { queryTi } from '@/lib/db';
import Stripe from 'stripe';
import * as Sentry from '@sentry/nextjs';

const HDICR_SYNC_MAX_ATTEMPTS = 3;
const HDICR_SYNC_RETRY_DELAYS_MS = [250, 750];
const WEBHOOK_FAILURE_ALERT_WINDOW_MINUTES = Number.parseInt(
  process.env.STRIPE_WEBHOOK_ALERT_WINDOW_MINUTES ?? '15',
  10
);
const WEBHOOK_FAILURE_ALERT_THRESHOLD = Number.parseInt(
  process.env.STRIPE_WEBHOOK_ALERT_THRESHOLD ?? '5',
  10
);
const CRITICAL_WEBHOOK_EVENT_TYPES = new Set([
  'identity.verification_session.verified',
  'charge.succeeded',
  'payout.failed',
]);
const ENTITLED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);
const ENTITLEMENT_PLAN_KEYS = new Set(BILLING_PLANS.map((plan) => plan.id));

/**
 * Webhook handler - must be POST route with raw body
 * Next.js automatically parses body, so we need to use raw request
 */
export async function POST(request: NextRequest) {
  let event: Stripe.Event | null = null;
  let stripeEventRecorded = false;

  try {
    // Get raw body for signature verification
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[STRIPE WEBHOOK] Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      console.error('[STRIPE WEBHOOK] Signature verification failed:', error.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${error.message}` },
        { status: 400 }
      );
    }

    console.log('[STRIPE WEBHOOK] Received event:', {
      type: event.type,
      id: event.id,
    });

    const replayState = await persistStripeEventReceipt(event, body);
    stripeEventRecorded = replayState.recorded;

    if (replayState.alreadyProcessed) {
      console.log('[STRIPE WEBHOOK] Duplicate already-processed event replayed, acknowledging', {
        id: event.id,
        type: event.type,
      });
      return NextResponse.json({ received: true, replayed: true }, { status: 200 });
    }

    // Connect events are delivered for connected accounts with event.account populated.
    if (event.account) {
      await handleConnectEvent(event);
      await markStripeEventProcessed(event.id);
      return NextResponse.json({ received: true, connect: true }, { status: 200 });
    }

    // Handle verification session events
    switch (event.type) {
      case 'identity.verification_session.verified':
        await handleVerificationVerified(event.data.object as Stripe.Identity.VerificationSession);
        break;

      case 'identity.verification_session.requires_input':
        await handleVerificationRequiresInput(
          event.data.object as Stripe.Identity.VerificationSession
        );
        break;

      case 'identity.verification_session.processing':
        await handleVerificationProcessing(
          event.data.object as Stripe.Identity.VerificationSession
        );
        break;

      case 'identity.verification_session.canceled':
        await handleVerificationCanceled(event.data.object as Stripe.Identity.VerificationSession);
        break;

      case 'identity.verification_session.redacted':
        await handleVerificationCanceled(event.data.object as Stripe.Identity.VerificationSession);
        break;

      // ===== PAYMENTS & PAYOUTS — deferred via setImmediate (Option C: non-critical) =====
      // Returns 200 immediately; handler runs after response is sent.
      // Errors are caught inside setImmediate and recorded via markStripeEventProcessingError.
      case 'charge.succeeded':
      case 'charge.failed':
      case 'charge.refunded':
      case 'charge.dispute.created':
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'payout.created':
      case 'payout.paid':
      case 'payout.failed': {
        const capturedEvent = event;
        setImmediate(async () => {
          try {
            switch (capturedEvent.type) {
              case 'charge.succeeded':
                await handleChargeSucceeded(capturedEvent.data.object as Stripe.Charge);
                break;
              case 'charge.failed':
                await handleChargeFailed(capturedEvent.data.object as Stripe.Charge);
                break;
              case 'charge.refunded':
                await handleChargeRefunded(capturedEvent.data.object as Stripe.Charge);
                break;
              case 'charge.dispute.created':
                await handleChargeDisputed(capturedEvent.data.object as Stripe.Dispute);
                break;
              case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(
                  capturedEvent.data.object as Stripe.PaymentIntent
                );
                break;
              case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(capturedEvent.data.object as Stripe.PaymentIntent);
                break;
              case 'customer.subscription.created':
                await handleSubscriptionCreated(capturedEvent.data.object as Stripe.Subscription);
                break;
              case 'customer.subscription.updated':
                await handleSubscriptionUpdated(capturedEvent.data.object as Stripe.Subscription);
                break;
              case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(capturedEvent.data.object as Stripe.Subscription);
                break;
              case 'payout.created':
                await handlePayoutCreated(capturedEvent.data.object as Stripe.Payout);
                break;
              case 'payout.paid':
                await handlePayoutPaid(capturedEvent.data.object as Stripe.Payout);
                break;
              case 'payout.failed':
                await handlePayoutFailed(capturedEvent.data.object as Stripe.Payout);
                break;
            }
            await markStripeEventProcessed(capturedEvent.id);
          } catch (err) {
            await markStripeEventProcessingError(capturedEvent.id, capturedEvent.type, err);
          }
        });
        return NextResponse.json({ received: true }, { status: 200 });
      }

      // ===== EXPLICITLY DEFERRED =====
      // Acknowledged with 200 but no processing yet
      case 'identity.verification_session.created':
      case 'invoice.payment_failed':
        console.log('[STRIPE WEBHOOK] Event acknowledged but handling deferred:', event.type);
        break;

      default:
        // v2 event types (e.g. 'v2.core.account[identity].updated') are not yet in the
        // Stripe SDK enum but are valid Stripe deliveries — fall through here.
        if ((event.type as string).startsWith('v2.')) {
          console.log('[STRIPE WEBHOOK] v2 event acknowledged but handling deferred:', event.type);
        } else {
          console.log('[STRIPE WEBHOOK] Unhandled event type:', event.type);
        }
    }

    await markStripeEventProcessed(event.id);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    if (event?.id && stripeEventRecorded) {
      await markStripeEventProcessingError(event.id, event.type, error);
    }

    console.error('[STRIPE WEBHOOK] Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Webhook processing failed', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Handle successful verification
 * Creates identity_link record with verified status
 */
async function handleVerificationVerified(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    console.error('[STRIPE WEBHOOK] Missing user_profile_id in session metadata');
    return;
  }

  console.log('[STRIPE WEBHOOK] Processing verified session:', {
    sessionId: session.id,
    userProfileId,
    status: session.status,
  });

  try {
    await updateTiVerificationStatus({
      userProfileId,
      verificationStatus: 'verified',
      eventType: 'identity.verification_session.verified',
      sessionId: session.id,
    });

    // Get verified identity data
    const verifiedData = await getVerifiedIdentityData(session.id);

    if (!verifiedData) {
      console.error('[STRIPE WEBHOOK] Failed to get verified identity data');
      return;
    }

    // Map Stripe status to verification levels
    const levels = mapStripeStatusToVerificationLevel('verified');

    await withHdicrSyncRetries('identity-verify-confirmed', () =>
      verifyStripeIdentityConfirmed({
        tiUserId: userProfileId,
        verificationSessionId: session.id,
        verifiedAt: new Date().toISOString(),
        assuranceLevel: levels.assurance_level,
      })
    );

    console.log('[STRIPE WEBHOOK] Synced verified identity to HDICR', {
      userProfileId,
      sessionId: session.id,
      assuranceLevel: levels.assurance_level,
      hasVerifiedData: Boolean(verifiedData),
    });
  } catch (error) {
    await insertWebhookAuditEntry({
      action: 'identity.verification_session.verified.sync_failed',
      userProfileId,
      resourceId: userProfileId,
      changes: {
        stripe_session_id: session.id,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      },
    });
    console.error('[STRIPE WEBHOOK] Error creating/updating identity link:', error);
    throw error;
  }
}

/**
 * Handle verification that requires additional input
 * Updates identity_link with medium verification level
 */
async function handleVerificationRequiresInput(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    console.error('[STRIPE WEBHOOK] Missing user_profile_id in session metadata');
    return;
  }

  console.log('[STRIPE WEBHOOK] Processing requires_input session:', {
    sessionId: session.id,
    userProfileId,
    lastError: session.last_error?.reason,
  });

  await updateTiVerificationStatus({
    userProfileId,
    verificationStatus: 'pending',
    eventType: 'identity.verification_session.requires_input',
    sessionId: session.id,
    errorReason: session.last_error?.reason || null,
  });

  console.log('[STRIPE WEBHOOK] requires_input recorded in TI; HDICR sync not required', {
    sessionId: session.id,
    userProfileId,
  });
}

/**
 * Handle verification that is processing
 */
async function handleVerificationProcessing(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    return;
  }

  console.log('[STRIPE WEBHOOK] Processing session:', {
    sessionId: session.id,
    userProfileId,
  });

  await updateTiVerificationStatus({
    userProfileId,
    verificationStatus: 'pending',
    eventType: 'identity.verification_session.processing',
    sessionId: session.id,
  });

  // No action needed - just log for monitoring
}

/**
 * Handle canceled verification
 */
async function handleVerificationCanceled(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    return;
  }

  console.log('[STRIPE WEBHOOK] Canceled session:', {
    sessionId: session.id,
    userProfileId,
  });

  await updateTiVerificationStatus({
    userProfileId,
    verificationStatus: 'rejected',
    eventType: 'identity.verification_session.canceled',
    sessionId: session.id,
  });

  console.log('[STRIPE WEBHOOK] canceled/redacted recorded in TI; HDICR sync not required', {
    sessionId: session.id,
    userProfileId,
  });
}

async function updateTiVerificationStatus(params: {
  userProfileId: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  eventType: string;
  sessionId: string;
  errorReason?: string | null;
}) {
  const previousActorResult = await queryTi(
    `SELECT id, verification_status
     FROM actors
     WHERE user_profile_id = $1
     LIMIT 1`,
    [params.userProfileId]
  );

  const previousActor = previousActorResult.rows[0] as
    | { id?: string; verification_status?: string | null }
    | undefined;

  const oldStatus = previousActor?.verification_status ?? null;

  const actorResult = await queryTi(
    `UPDATE actors
     SET verification_status = $1,
         updated_at = NOW()
     WHERE user_profile_id = $2
     RETURNING id`,
    [params.verificationStatus, params.userProfileId]
  );

  const actorId = actorResult.rows[0]?.id as string | undefined;

  if (!actorId) {
    console.warn('[STRIPE WEBHOOK] No actor row found for user profile during TI status update', {
      userProfileId: params.userProfileId,
      verificationStatus: params.verificationStatus,
      eventType: params.eventType,
    });
  }

  await insertWebhookAuditEntry({
    action: `${params.eventType}.ti_state_updated`,
    userProfileId: params.userProfileId,
    resourceId: actorId || params.userProfileId,
    changes: {
      stripe_session_id: params.sessionId,
      verification_status: params.verificationStatus,
      actor_updated: Boolean(actorId),
      error_reason: params.errorReason || null,
    },
  });

  await insertKycStatusTransitionEntry({
    userProfileId: params.userProfileId,
    oldStatus,
    newStatus: params.verificationStatus,
    stripeSessionId: params.sessionId,
    triggerEvent: params.eventType,
    reason: params.errorReason || null,
  });
}

async function persistStripeEventReceipt(
  event: Stripe.Event,
  payloadJson: string
): Promise<{ recorded: boolean; alreadyProcessed: boolean }> {
  try {
    const insertResult = await queryTi(
      `INSERT INTO stripe_events (
         stripe_event_id,
         event_type,
         payload,
         processed,
         connect_account_id
       )
       VALUES ($1, $2, $3::jsonb, FALSE, $4)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING id`,
      [event.id, event.type, payloadJson, event.account ?? null]
    );

    if ((insertResult.rowCount ?? 0) > 0) {
      return { recorded: true, alreadyProcessed: false };
    }

    const existingResult = await queryTi(
      `SELECT processed
       FROM stripe_events
       WHERE stripe_event_id = $1
       LIMIT 1`,
      [event.id]
    );

    const alreadyProcessed = Boolean(existingResult.rows[0]?.processed);
    return { recorded: true, alreadyProcessed };
  } catch (error) {
    console.warn(
      '[STRIPE WEBHOOK] stripe_events persistence unavailable, continuing without replay DB',
      {
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      }
    );

    return { recorded: false, alreadyProcessed: false };
  }
}

async function markStripeEventProcessed(stripeEventId: string): Promise<void> {
  try {
    await queryTi(
      `UPDATE stripe_events
       SET processed = TRUE,
           processing_error = NULL,
           processed_at = NOW()
       WHERE stripe_event_id = $1`,
      [stripeEventId]
    );
  } catch (error) {
    console.warn('[STRIPE WEBHOOK] Failed to mark stripe event as processed', {
      stripeEventId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function markStripeEventProcessingError(
  stripeEventId: string,
  eventType: string,
  error: unknown
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  try {
    await queryTi(
      `UPDATE stripe_events
       SET processed = FALSE,
           processing_error = $2,
           processed_at = NULL
       WHERE stripe_event_id = $1`,
      [stripeEventId, errorMessage]
    );

    await emitWebhookFailureAlerts({
      stripeEventId,
      eventType,
      errorMessage,
    });
  } catch (updateError) {
    console.warn('[STRIPE WEBHOOK] Failed to persist stripe event processing error', {
      stripeEventId,
      error: updateError instanceof Error ? updateError.message : String(updateError),
    });
  }
}

async function emitWebhookFailureAlerts(params: {
  stripeEventId: string;
  eventType: string;
  errorMessage: string;
}): Promise<void> {
  // Always capture critical event failures individually for rapid triage.
  if (CRITICAL_WEBHOOK_EVENT_TYPES.has(params.eventType)) {
    Sentry.captureMessage(
      `[STRIPE WEBHOOK] Critical event processing failed: ${params.eventType}`,
      'error'
    );
  }

  const threshold = Number.isFinite(WEBHOOK_FAILURE_ALERT_THRESHOLD)
    ? WEBHOOK_FAILURE_ALERT_THRESHOLD
    : 5;
  const windowMinutes = Number.isFinite(WEBHOOK_FAILURE_ALERT_WINDOW_MINUTES)
    ? WEBHOOK_FAILURE_ALERT_WINDOW_MINUTES
    : 15;

  if (threshold <= 0 || windowMinutes <= 0) {
    return;
  }

  try {
    const result = await queryTi(
      `SELECT COUNT(*)::int AS failure_count
       FROM stripe_events
       WHERE processed = FALSE
         AND processing_error IS NOT NULL
         AND received_at >= NOW() - ($1::int * INTERVAL '1 minute')`,
      [windowMinutes]
    );

    const failureCount = Number(result.rows[0]?.failure_count ?? 0);
    if (failureCount < threshold) {
      return;
    }

    console.error('[STRIPE WEBHOOK][ALERT] Failure threshold exceeded', {
      stripeEventId: params.stripeEventId,
      eventType: params.eventType,
      failureCount,
      threshold,
      windowMinutes,
      errorMessage: params.errorMessage,
    });

    Sentry.captureMessage(
      `[STRIPE WEBHOOK][ALERT] ${failureCount} failures in last ${windowMinutes}m (threshold ${threshold})`,
      'error'
    );
  } catch (alertError) {
    console.warn('[STRIPE WEBHOOK] Failed to emit threshold alert', {
      stripeEventId: params.stripeEventId,
      eventType: params.eventType,
      error: alertError instanceof Error ? alertError.message : String(alertError),
    });
  }
}

async function insertKycStatusTransitionEntry(params: {
  userProfileId: string;
  oldStatus: string | null;
  newStatus: 'pending' | 'verified' | 'rejected';
  stripeSessionId: string;
  triggerEvent: string;
  reason: string | null;
}): Promise<void> {
  try {
    await queryTi(
      `INSERT INTO kyc_status_transitions (
         user_profile_id,
         old_status,
         new_status,
         stripe_session_id,
         trigger_event,
         reason
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.userProfileId,
        params.oldStatus,
        params.newStatus,
        params.stripeSessionId,
        params.triggerEvent,
        params.reason,
      ]
    );
  } catch (error) {
    console.warn('[STRIPE WEBHOOK] Failed to persist kyc status transition', {
      userProfileId: params.userProfileId,
      triggerEvent: params.triggerEvent,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function withHdicrSyncRetries<T>(operation: string, handler: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= HDICR_SYNC_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await handler();
    } catch (error) {
      lastError = error;
      const isFinalAttempt = attempt >= HDICR_SYNC_MAX_ATTEMPTS;

      console.error('[STRIPE WEBHOOK] HDICR sync attempt failed', {
        operation,
        attempt,
        maxAttempts: HDICR_SYNC_MAX_ATTEMPTS,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFinalAttempt) {
        break;
      }

      const delayMs = HDICR_SYNC_RETRY_DELAYS_MS[attempt - 1] ?? 1000;
      await delay(delayMs);
    }
  }

  throw new Error(
    `[STRIPE WEBHOOK] HDICR sync failed for ${operation} after ${HDICR_SYNC_MAX_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

// ============================================================
// CONNECT EVENT HANDLERS (P2)
// ============================================================

async function handleConnectEvent(event: Stripe.Event): Promise<void> {
  const accountId = event.account;

  if (!accountId) {
    return;
  }

  switch (event.type) {
    case 'account.updated':
      await handleConnectAccountUpdated(accountId, event.data.object as Stripe.Account);
      break;

    case 'transfer.created':
      await handleConnectTransferCreated(accountId, event.data.object as Stripe.Transfer);
      break;

    case 'transfer.reversed':
      await handleConnectTransferReversed(accountId, event.data.object as Stripe.Transfer);
      break;

    case 'transfer.updated':
      await handleConnectTransferUpdated(accountId, event.data.object as Stripe.Transfer);
      break;

    default:
      console.log('[STRIPE WEBHOOK] Unhandled Connect event type:', {
        type: event.type,
        accountId,
      });
  }
}

async function handleConnectAccountUpdated(
  accountId: string,
  account: Stripe.Account
): Promise<void> {
  const status = mapConnectAccountStatus(account);
  const normalizedStatus = status.onboardingComplete
    ? 'active'
    : status.disabledReason
      ? 'restricted'
      : 'pending';

  const result = await queryTi(
    `UPDATE actors
     SET stripe_account_status = $2,
         stripe_onboarding_complete = $3,
         updated_at = NOW()
     WHERE stripe_account_id = $1
     RETURNING id, user_profile_id`,
    [accountId, normalizedStatus, status.onboardingComplete]
  );

  console.log('[STRIPE WEBHOOK] Connect account status updated', {
    accountId,
    normalizedStatus,
    onboardingComplete: status.onboardingComplete,
    requirementsDue: status.requirementsDue,
    actorUpdated: (result.rowCount ?? 0) > 0,
  });
}

async function handleConnectTransferCreated(
  accountId: string,
  transfer: Stripe.Transfer
): Promise<void> {
  const sourceTransactionId =
    typeof transfer.source_transaction === 'string'
      ? transfer.source_transaction
      : transfer.source_transaction?.id;

  let paymentIntentId: string | null = null;

  if (sourceTransactionId) {
    try {
      const charge = await stripe.charges.retrieve(sourceTransactionId, {
        expand: ['payment_intent'],
      });

      paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? null);

      if (paymentIntentId) {
        const updateResult = await queryTi(
          `UPDATE deals
           SET stripe_transfer_id = COALESCE(stripe_transfer_id, $2),
               updated_at = NOW()
           WHERE stripe_payment_intent_id = $1
           RETURNING id, status`,
          [paymentIntentId, transfer.id]
        );

        console.log('[STRIPE WEBHOOK] Connect transfer linked to deal', {
          accountId,
          transferId: transfer.id,
          paymentIntentId,
          dealsUpdated: updateResult.rowCount ?? 0,
        });
      }
    } catch (error) {
      console.warn('[STRIPE WEBHOOK] Failed resolving transfer source transaction charge', {
        accountId,
        transferId: transfer.id,
        sourceTransactionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('[STRIPE WEBHOOK] Connect transfer.created received', {
    accountId,
    transferId: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
    sourceTransaction: sourceTransactionId,
    paymentIntentId,
  });
}

async function handleConnectTransferReversed(
  accountId: string,
  transfer: Stripe.Transfer
): Promise<void> {
  console.warn('[STRIPE WEBHOOK] Connect transfer.reversed received', {
    accountId,
    transferId: transfer.id,
    amountReversed: transfer.amount_reversed,
    amount: transfer.amount,
    currency: transfer.currency,
  });
}

async function handleConnectTransferUpdated(
  accountId: string,
  transfer: Stripe.Transfer
): Promise<void> {
  console.log('[STRIPE WEBHOOK] Connect transfer.updated received', {
    accountId,
    transferId: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
  });
}

// ============================================================
// PAYMENT / COMMERCIAL EVENT HANDLERS (P1-3)
// ============================================================

/**
 * KYC gate: asserts the actor linked to a user_profile_id is verified.
 * Throws if not found or not verified — surfaces as a 500 with stripe_events error.
 */
async function assertActorKycVerified(userProfileId: string, role: string): Promise<void> {
  const result = await queryTi(
    `SELECT verification_status FROM actors WHERE user_profile_id = $1 LIMIT 1`,
    [userProfileId]
  );

  if (result.rows.length === 0) {
    throw new Error(`[KYC Gate] No actor record for ${role} user_profile_id: ${userProfileId}`);
  }

  const { verification_status } = result.rows[0] as { verification_status: string };
  if (verification_status !== 'verified') {
    throw new Error(
      `[KYC Gate] ${role} is not verified (status: ${verification_status}) for user_profile_id: ${userProfileId}`
    );
  }
}

/**
 * Upsert wallet balance: create row if absent, otherwise add delta atomically.
 */
async function upsertWalletBalance(userProfileId: string, deltaCents: number): Promise<void> {
  await queryTi(
    `INSERT INTO wallet_balances (user_profile_id, balance_cents, currency)
     VALUES ($1, $2, 'gbp')
     ON CONFLICT (user_profile_id) DO UPDATE
     SET balance_cents = wallet_balances.balance_cents + $2,
         updated_at    = NOW()`,
    [userProfileId, deltaCents]
  );
}

/**
 * Handle charge.succeeded — create commercial_license, credit actor/agent wallets.
 * Enforces KYC gate: both studio and actor must be verified (P1-5).
 *
 * Required charge metadata:
 *   studio_user_profile_id, actor_user_profile_id
 * Optional:
 *   agent_user_profile_id, agent_commission_pct (default 25), use_case
 */
async function handleChargeSucceeded(charge: Stripe.Charge): Promise<void> {
  const {
    studio_user_profile_id: studioProfileId,
    actor_user_profile_id: actorProfileId,
    agent_user_profile_id: agentProfileId,
    agent_commission_pct: rawCommission,
    use_case: useCase,
  } = charge.metadata ?? {};

  if (!studioProfileId || !actorProfileId) {
    console.warn('[STRIPE WEBHOOK] charge.succeeded: missing required metadata, skipping', {
      chargeId: charge.id,
    });
    return;
  }

  // P1-5 KYC gate
  await assertActorKycVerified(studioProfileId, 'studio');
  await assertActorKycVerified(actorProfileId, 'actor');

  const amountCents = charge.amount;
  const currency = (charge.currency ?? 'gbp').toLowerCase();
  const agentCommissionPct = agentProfileId
    ? Math.max(0, Math.min(100, Number(rawCommission ?? 25)))
    : 0;
  const agentShare = agentProfileId ? Math.floor(amountCents * (agentCommissionPct / 100)) : 0;
  const actorShare = amountCents - agentShare;

  await queryTi(
    `INSERT INTO commercial_licenses (
       studio_user_profile_id,
       actor_user_profile_id,
       agent_user_profile_id,
       stripe_charge_id,
       amount_cents,
       currency,
       use_case,
       status,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8::jsonb)`,
    [
      studioProfileId,
      actorProfileId,
      agentProfileId ?? null,
      charge.id,
      amountCents,
      currency,
      useCase ?? null,
      JSON.stringify({
        agent_commission_pct: agentCommissionPct,
        agent_share_cents: agentShare,
        actor_share_cents: actorShare,
      }),
    ]
  );

  await upsertWalletBalance(actorProfileId, actorShare);
  if (agentProfileId && agentShare > 0) {
    await upsertWalletBalance(agentProfileId, agentShare);
  }

  await insertWebhookAuditEntry({
    action: 'charge.succeeded',
    userProfileId: actorProfileId,
    resourceId: charge.id,
    changes: {
      studio_user_profile_id: studioProfileId,
      actor_user_profile_id: actorProfileId,
      agent_user_profile_id: agentProfileId ?? null,
      amount_cents: amountCents,
      actor_share_cents: actorShare,
      agent_share_cents: agentShare,
    },
  });

  console.log('[STRIPE WEBHOOK] Commercial license created, wallets credited', {
    chargeId: charge.id,
    actorProfileId,
    amountCents,
  });
}

/**
 * Handle charge.failed — audit entry only.
 */
async function handleChargeFailed(charge: Stripe.Charge): Promise<void> {
  const { actor_user_profile_id: actorProfileId, studio_user_profile_id: studioProfileId } =
    charge.metadata ?? {};

  const auditUserId = actorProfileId ?? studioProfileId;
  if (auditUserId) {
    await insertWebhookAuditEntry({
      action: 'charge.failed',
      userProfileId: auditUserId,
      resourceId: charge.id,
      changes: {
        failure_code: charge.failure_code,
        failure_message: charge.failure_message,
        amount_cents: charge.amount,
        studio_user_profile_id: studioProfileId ?? null,
        actor_user_profile_id: actorProfileId ?? null,
      },
    });
  }

  console.warn('[STRIPE WEBHOOK] Charge failed', {
    chargeId: charge.id,
    failureCode: charge.failure_code,
    failureMessage: charge.failure_message,
  });
}

/**
 * Handle charge.refunded — update commercial_license to 'refunded', reverse wallet credits.
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const licResult = await queryTi(
    `SELECT id, actor_user_profile_id, agent_user_profile_id, amount_cents, metadata
     FROM commercial_licenses
     WHERE stripe_charge_id = $1
     LIMIT 1`,
    [charge.id]
  );

  if (licResult.rows.length === 0) {
    console.warn('[STRIPE WEBHOOK] charge.refunded: no matching commercial_license', {
      chargeId: charge.id,
    });
    return;
  }

  const lic = licResult.rows[0] as {
    id: string;
    actor_user_profile_id: string;
    agent_user_profile_id: string | null;
    amount_cents: number;
    metadata: { actor_share_cents?: number; agent_share_cents?: number } | null;
  };

  const actorShare = lic.metadata?.actor_share_cents ?? lic.amount_cents;
  const agentShare = lic.agent_user_profile_id ? (lic.metadata?.agent_share_cents ?? 0) : 0;

  await upsertWalletBalance(lic.actor_user_profile_id, -actorShare);
  if (lic.agent_user_profile_id && agentShare > 0) {
    await upsertWalletBalance(lic.agent_user_profile_id, -agentShare);
  }

  const refundReason = charge.refunds?.data?.[0]?.reason ?? 'refunded';
  await queryTi(
    `UPDATE commercial_licenses
     SET status       = 'refunded',
         refunded_at  = NOW(),
         refund_reason = $2,
         updated_at   = NOW()
     WHERE id = $1`,
    [lic.id, refundReason]
  );

  await insertWebhookAuditEntry({
    action: 'charge.refunded',
    userProfileId: lic.actor_user_profile_id,
    resourceId: charge.id,
    changes: {
      license_id: lic.id,
      actor_share_reversed: actorShare,
      agent_share_reversed: agentShare,
      refund_reason: refundReason,
    },
  });

  console.log('[STRIPE WEBHOOK] Charge refunded, wallets reversed', {
    chargeId: charge.id,
    licenseId: lic.id,
  });
}

/**
 * Handle charge.dispute.created — mark commercial_license as 'disputed'.
 */
async function handleChargeDisputed(dispute: Stripe.Dispute): Promise<void> {
  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : (dispute.charge as Stripe.Charge).id;

  const result = await queryTi(
    `UPDATE commercial_licenses
     SET status      = 'disputed',
         disputed_at = NOW(),
         updated_at  = NOW()
     WHERE stripe_charge_id = $1
     RETURNING id, actor_user_profile_id`,
    [chargeId]
  );

  if (result.rows.length === 0) {
    console.warn('[STRIPE WEBHOOK] charge.dispute.created: no matching commercial_license', {
      chargeId,
      disputeId: dispute.id,
    });
    return;
  }

  const lic = result.rows[0] as { id: string; actor_user_profile_id: string };

  await insertWebhookAuditEntry({
    action: 'charge.dispute.created',
    userProfileId: lic.actor_user_profile_id,
    resourceId: chargeId,
    changes: { license_id: lic.id, dispute_id: dispute.id, dispute_reason: dispute.reason },
  });

  console.warn('[STRIPE WEBHOOK] Charge disputed, license flagged', {
    chargeId,
    disputeId: dispute.id,
  });
}

/**
 * Handle payment_intent.succeeded for deal settlement.
 * Idempotent: only transitions pending/failed deals to paid.
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const result = await queryTi(
    `UPDATE deals
     SET status = 'paid',
         settled_at = COALESCE(settled_at, NOW()),
         updated_at = NOW()
     WHERE stripe_payment_intent_id = $1
       AND status IN ('pending', 'failed')
     RETURNING id, studio_user_id, actor_user_id, status`,
    [paymentIntent.id]
  );

  if ((result.rowCount ?? 0) === 0) {
    console.log('[STRIPE WEBHOOK] payment_intent.succeeded already settled or deal not found', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const deal = result.rows[0] as {
    id: string;
    studio_user_id: string;
    actor_user_id: string;
    status: string;
  };

  await insertWebhookAuditEntry({
    action: 'payment_intent.succeeded',
    userProfileId: deal.actor_user_id,
    resourceId: paymentIntent.id,
    changes: {
      deal_id: deal.id,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      studio_user_id: deal.studio_user_id,
      actor_user_id: deal.actor_user_id,
    },
  });

  console.log('[STRIPE WEBHOOK] Deal settled from payment_intent.succeeded', {
    dealId: deal.id,
    paymentIntentId: paymentIntent.id,
  });
}

/**
 * Handle payment_intent.payment_failed — audit entry only.
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const userProfileId =
    paymentIntent.metadata?.user_profile_id ?? paymentIntent.metadata?.actor_user_profile_id;

  if (userProfileId) {
    await insertWebhookAuditEntry({
      action: 'payment_intent.payment_failed',
      userProfileId,
      resourceId: paymentIntent.id,
      changes: {
        last_payment_error: paymentIntent.last_payment_error?.message ?? null,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
    });
  }

  console.warn('[STRIPE WEBHOOK] PaymentIntent failed', {
    paymentIntentId: paymentIntent.id,
    error: paymentIntent.last_payment_error?.message,
  });
}

function deriveSubscriptionSeatCount(subscription: Stripe.Subscription): number {
  const addonPriceId = getAgencySeatAddonPriceId();
  if (!addonPriceId) {
    return 1;
  }

  const addonItem = subscription.items.data.find((item) => item.price.id === addonPriceId);
  const addonQuantity = addonItem?.quantity ?? 0;
  return Math.max(1, addonQuantity + 1);
}

function deriveSubscriptionInterval(
  subscription: Stripe.Subscription
): 'monthly' | 'yearly' | 'unknown' {
  const addonPriceId = getAgencySeatAddonPriceId();
  const primaryItem = subscription.items.data.find((item) => item.price.id !== addonPriceId);
  const interval = primaryItem?.price.recurring?.interval;

  if (interval === 'month') {
    return 'monthly';
  }

  if (interval === 'year') {
    return 'yearly';
  }

  return 'unknown';
}

function deriveSubscriptionPlanKey(subscription: Stripe.Subscription): string {
  const metadataPlan = subscription.metadata?.plan_id;
  if (metadataPlan && metadataPlan.trim()) {
    return metadataPlan.trim();
  }

  const addonPriceId = getAgencySeatAddonPriceId();
  const primaryItem = subscription.items.data.find((item) => item.price.id !== addonPriceId);
  const matchedPlan = primaryItem ? getPlanByPriceId(primaryItem.price.id) : null;

  return matchedPlan?.plan.id ?? 'unknown';
}

function deriveSubscriptionPeriodEndEpoch(subscription: Stripe.Subscription): number | null {
  const addonPriceId = getAgencySeatAddonPriceId();
  const primaryItem = subscription.items.data.find((item) => item.price.id !== addonPriceId);

  return primaryItem?.current_period_end ?? null;
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const userProfileId = subscription.metadata?.user_profile_id;

  if (!userProfileId) {
    console.warn('[STRIPE WEBHOOK] subscription.created missing user_profile_id metadata', {
      subscriptionId: subscription.id,
    });
    return;
  }

  const interval = deriveSubscriptionInterval(subscription);
  const seatCount = deriveSubscriptionSeatCount(subscription);
  const planKey = deriveSubscriptionPlanKey(subscription);
  const periodEndEpoch = deriveSubscriptionPeriodEndEpoch(subscription);

  await queryTi(
    `INSERT INTO user_subscriptions (
       user_id,
       stripe_subscription_id,
       stripe_customer_id,
       plan_key,
       interval,
       status,
       current_period_end,
       seat_count
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7::bigint) END,
       $8
     )
     ON CONFLICT (stripe_subscription_id) DO UPDATE
     SET stripe_customer_id   = EXCLUDED.stripe_customer_id,
         plan_key             = EXCLUDED.plan_key,
         interval             = EXCLUDED.interval,
         status               = EXCLUDED.status,
         current_period_end   = EXCLUDED.current_period_end,
         seat_count           = EXCLUDED.seat_count,
         updated_at           = NOW()`,
    [
      userProfileId,
      subscription.id,
      String(subscription.customer),
      planKey,
      interval,
      subscription.status,
      periodEndEpoch,
      seatCount,
    ]
  );

  await syncSubscriptionEntitlements(userProfileId);

  console.log('[STRIPE WEBHOOK] subscription.created synced to user_subscriptions', {
    subscriptionId: subscription.id,
    userProfileId,
    planKey,
    interval,
    seatCount,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const userProfileId =
    subscription.metadata?.user_profile_id ??
    (await resolveUserProfileIdFromSubscriptionId(subscription.id)) ??
    null;

  if (!userProfileId) {
    console.warn('[STRIPE WEBHOOK] subscription.updated unable to resolve user_profile_id', {
      subscriptionId: subscription.id,
    });
    return;
  }

  const interval = deriveSubscriptionInterval(subscription);
  const seatCount = deriveSubscriptionSeatCount(subscription);
  const planKey = deriveSubscriptionPlanKey(subscription);
  const periodEndEpoch = deriveSubscriptionPeriodEndEpoch(subscription);

  await queryTi(
    `INSERT INTO user_subscriptions (
       user_id,
       stripe_subscription_id,
       stripe_customer_id,
       plan_key,
       interval,
       status,
       current_period_end,
       seat_count
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7::bigint) END,
       $8
     )
     ON CONFLICT (stripe_subscription_id) DO UPDATE
     SET stripe_customer_id   = EXCLUDED.stripe_customer_id,
         plan_key             = EXCLUDED.plan_key,
         interval             = EXCLUDED.interval,
         status               = EXCLUDED.status,
         current_period_end   = EXCLUDED.current_period_end,
         seat_count           = EXCLUDED.seat_count,
         updated_at           = NOW()`,
    [
      userProfileId,
      subscription.id,
      String(subscription.customer),
      planKey,
      interval,
      subscription.status,
      periodEndEpoch,
      seatCount,
    ]
  );

  await syncSubscriptionEntitlements(userProfileId);

  console.log('[STRIPE WEBHOOK] subscription.updated synced to user_subscriptions', {
    subscriptionId: subscription.id,
    userProfileId,
    planKey,
    interval,
    seatCount,
    status: subscription.status,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const result = await queryTi(
    `UPDATE user_subscriptions
     SET status = 'canceled',
         current_period_end = CASE
           WHEN $2::bigint IS NULL THEN current_period_end
           ELSE to_timestamp($2::bigint)
         END,
         updated_at = NOW()
     WHERE stripe_subscription_id = $1
     RETURNING id, user_id`,
    [subscription.id, deriveSubscriptionPeriodEndEpoch(subscription)]
  );

  if ((result.rowCount ?? 0) === 0) {
    console.warn('[STRIPE WEBHOOK] subscription.deleted no matching local subscription row', {
      subscriptionId: subscription.id,
    });
    return;
  }

  const affectedUserProfileId = result.rows[0]?.user_id as string | undefined;
  if (affectedUserProfileId) {
    await syncSubscriptionEntitlements(affectedUserProfileId);
  }

  console.log('[STRIPE WEBHOOK] subscription.deleted marked canceled', {
    subscriptionId: subscription.id,
    affectedRows: result.rowCount ?? 0,
  });
}

async function syncSubscriptionEntitlements(userProfileId: string): Promise<void> {
  const entitlementResult = await queryTi(
    `SELECT EXISTS (
       SELECT 1
       FROM user_subscriptions
       WHERE user_id = $1
         AND status = ANY($2::text[])
         AND plan_key = ANY($3::text[])
     ) AS has_entitlement`,
    [userProfileId, Array.from(ENTITLED_SUBSCRIPTION_STATUSES), Array.from(ENTITLEMENT_PLAN_KEYS)]
  );

  const hasEntitlement = Boolean(entitlementResult.rows[0]?.has_entitlement);

  const updateResult = await queryTi(
    `UPDATE user_profiles
     SET is_pro = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userProfileId, hasEntitlement]
  );

  if ((updateResult.rowCount ?? 0) === 0) {
    console.warn('[STRIPE WEBHOOK] subscription entitlement sync found no TI user profile', {
      userProfileId,
      hasEntitlement,
    });
    return;
  }

  await insertWebhookAuditEntry({
    action: hasEntitlement
      ? 'subscription.entitlement.provisioned'
      : 'subscription.entitlement.revoked',
    userProfileId,
    resourceId: userProfileId,
    changes: {
      is_pro: hasEntitlement,
    },
  });

  console.log('[STRIPE WEBHOOK] Subscription entitlement synchronized', {
    userProfileId,
    hasEntitlement,
  });
}

async function resolveUserProfileIdFromSubscriptionId(
  subscriptionId: string
): Promise<string | null> {
  const result = await queryTi(
    `SELECT user_id
     FROM user_subscriptions
     WHERE stripe_subscription_id = $1
     LIMIT 1`,
    [subscriptionId]
  );

  return (result.rows[0]?.user_id as string | undefined) ?? null;
}

/**
 * Handle payout.created — insert withdrawal row with status 'processing'.
 *
 * Required payout metadata:
 *   user_profile_id  (the withdrawing user)
 */
async function handlePayoutCreated(payout: Stripe.Payout): Promise<void> {
  const userProfileId = payout.metadata?.user_profile_id;

  if (!userProfileId) {
    console.warn('[STRIPE WEBHOOK] payout.created: missing user_profile_id in metadata', {
      payoutId: payout.id,
    });
    return;
  }

  await queryTi(
    `INSERT INTO withdrawals (
       user_profile_id,
       amount_cents,
       currency,
       status,
       stripe_payout_id,
       metadata
     )
     VALUES ($1, $2, $3, 'processing', $4, $5::jsonb)
     ON CONFLICT (stripe_payout_id) DO NOTHING`,
    [
      userProfileId,
      payout.amount,
      (payout.currency ?? 'gbp').toLowerCase(),
      payout.id,
      JSON.stringify({ arrival_date: payout.arrival_date, method: payout.method }),
    ]
  );

  await insertWebhookAuditEntry({
    action: 'payout.created',
    userProfileId,
    resourceId: payout.id,
    changes: { amount_cents: payout.amount, currency: payout.currency },
  });

  console.log('[STRIPE WEBHOOK] Withdrawal initiated (payout.created)', {
    payoutId: payout.id,
    userProfileId,
    amountCents: payout.amount,
  });
}

/**
 * Handle payout.paid — mark withdrawal completed.
 */
async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  const result = await queryTi(
    `UPDATE withdrawals
     SET status       = 'completed',
         completed_at = NOW()
     WHERE stripe_payout_id = $1
     RETURNING id, user_profile_id`,
    [payout.id]
  );

  if (result.rows.length === 0) {
    console.warn('[STRIPE WEBHOOK] payout.paid: no matching withdrawal', { payoutId: payout.id });
    return;
  }

  const row = result.rows[0] as { id: string; user_profile_id: string };

  await insertWebhookAuditEntry({
    action: 'payout.paid',
    userProfileId: row.user_profile_id,
    resourceId: payout.id,
    changes: { withdrawal_id: row.id },
  });

  console.log('[STRIPE WEBHOOK] Withdrawal completed (payout.paid)', { payoutId: payout.id });
}

/**
 * Handle payout.failed — mark withdrawal failed with reason.
 */
async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  const failureReason = payout.failure_message ?? payout.failure_code ?? 'payout_failed';

  const result = await queryTi(
    `UPDATE withdrawals
     SET status         = 'failed',
         failure_reason = $2
     WHERE stripe_payout_id = $1
     RETURNING id, user_profile_id`,
    [payout.id, failureReason]
  );

  if (result.rows.length === 0) {
    console.warn('[STRIPE WEBHOOK] payout.failed: no matching withdrawal', { payoutId: payout.id });
    return;
  }

  const row = result.rows[0] as { id: string; user_profile_id: string };

  await insertWebhookAuditEntry({
    action: 'payout.failed',
    userProfileId: row.user_profile_id,
    resourceId: payout.id,
    changes: {
      withdrawal_id: row.id,
      failure_message: payout.failure_message,
      failure_code: payout.failure_code,
    },
  });

  console.warn('[STRIPE WEBHOOK] Withdrawal failed (payout.failed)', {
    payoutId: payout.id,
    failureReason,
  });
}

async function insertWebhookAuditEntry(params: {
  action: string;
  userProfileId: string;
  resourceId: string;
  changes: Record<string, unknown>;
}) {
  try {
    const resourceIdIsUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        params.resourceId
      );

    const changes = {
      ...params.changes,
      external_resource_id: resourceIdIsUuid ? undefined : params.resourceId,
    };

    await queryTi(
      `INSERT INTO audit_log (
         user_id,
         user_type,
         action,
         resource_type,
         resource_id,
         changes
       )
       VALUES ($1, 'system', $2, 'stripe_webhook_identity', $3::uuid, $4::jsonb)`,
      [
        params.userProfileId,
        params.action,
        resourceIdIsUuid ? params.resourceId : null,
        JSON.stringify(changes),
      ]
    );
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Failed to persist webhook audit entry', {
      action: params.action,
      userProfileId: params.userProfileId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
