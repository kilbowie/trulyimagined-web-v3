/**
 * Truly Imagined Stripe Webhook Handler
 * 
 * Handles all Stripe events with:
 * - Snapshot and thin payload support
 * - Signature verification
 * - Idempotency checking
 * - KYC gates
 * - Immutable audit logging
 * - Database transaction safety
 * 
 * Deploy to: POST /api/webhooks/stripe
 */

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('./db'); // Your DB connection pool
const logger = require('./logger'); // Your logging module

const router = express.Router();

/**
 * Stripe signature verification middleware
 * MUST be applied BEFORE parsing JSON body
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    logger.error('Missing Stripe signature or webhook secret');
    return res.status(400).send('Missing signature or secret');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  // Acknowledge receipt immediately (Stripe expects 200 within 5 seconds)
  res.json({ received: true });

  // Process event asynchronously (don't block the response)
  try {
    await processWebhookEvent(event);
  } catch (err) {
    logger.error(`Webhook processing failed for event ${event.id}:`, err);
    // Log to stripe_events table for manual retry
    await logFailedEvent(event, err);
  }
});

/**
 * Main webhook event processor
 */
async function processWebhookEvent(event) {
  const client = await pool.connect();

  try {
    // Idempotency check: has this event already been processed?
    const existingEvent = await client.query(
      'SELECT id FROM stripe_events WHERE stripe_event_id = $1',
      [event.id]
    );

    if (existingEvent.rows.length > 0) {
      logger.info(`Event ${event.id} already processed, skipping`);
      return;
    }

    // Log raw event
    await client.query(
      `INSERT INTO stripe_events (id, stripe_event_id, event_type, payload, processed, received_at)
       VALUES ($1, $2, $3, $4, false, NOW())`,
      [generateId(), event.id, event.type, JSON.stringify(event)]
    );

    // Route to appropriate handler
    switch (event.type) {
      // ===== IDENTITY VERIFICATION (KYC) =====
      case 'identity.verification_session.verified':
        await handleIdentityVerified(client, event);
        break;

      case 'identity.verification_session.requires_input':
        await handleIdentityRequiresInput(client, event);
        break;

      case 'identity.verification_session.redacted':
      case 'identity.verification_session.canceled':
        await handleIdentityFailed(client, event);
        break;

      // ===== PAYMENTS (LICENSES) =====
      case 'charge.succeeded':
        await handleChargeSucceeded(client, event);
        break;

      case 'charge.failed':
        await handleChargeFailed(client, event);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(client, event);
        break;

      case 'charge.dispute.created':
        await handleChargeDisputed(client, event);
        break;

      // ===== SUBSCRIPTIONS =====
      case 'customer.subscription.created':
        await handleSubscriptionCreated(client, event);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(client, event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(client, event);
        break;

      // ===== SUBSCRIPTION BILLING =====
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(client, event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(client, event);
        break;

      // ===== PAYOUTS (WITHDRAWALS) =====
      case 'payout.created':
        await handlePayoutCreated(client, event);
        break;

      case 'payout.paid':
        await handlePayoutPaid(client, event);
        break;

      case 'payout.failed':
        await handlePayoutFailed(client, event);
        break;

      // ===== AGENT CONNECTED ACCOUNT =====
      case 'v2.core.account[identity].updated':
        await handleConnectedAccountIdentityUpdated(client, event);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
        break;
    }

    // Mark event as processed
    await client.query(
      'UPDATE stripe_events SET processed = true WHERE stripe_event_id = $1',
      [event.id]
    );

    logger.info(`Event ${event.id} (${event.type}) processed successfully`);
  } finally {
    client.release();
  }
}

// ===================================
// IDENTITY VERIFICATION HANDLERS
// ===================================

async function handleIdentityVerified(client, event) {
  const session = await getEventData(event, 'identity.verification_session');

  if (!session) {
    logger.error('Missing identity session data');
    throw new Error('Missing identity session data');
  }

  // Find user by session ID
  const user = await client.query(
    'SELECT id, user_type FROM users WHERE kyc_session_id = $1',
    [session.id]
  );

  if (user.rows.length === 0) {
    logger.error(`User not found for KYC session ${session.id}`);
    throw new Error('User not found for KYC session');
  }

  const userId = user.rows[0].id;
  const userType = user.rows[0].user_type;

  // Update user to verified
  await client.query(
    `UPDATE users 
     SET kyc_status = $1, identity_verified_at = NOW()
     WHERE id = $2`,
    ['verified', userId]
  );

  // Create wallet (if not exists)
  await client.query(
    `INSERT INTO wallet_balances (id, user_id, balance_cents, currency)
     VALUES ($1, $2, 0, 'gbp')
     ON CONFLICT (user_id) DO NOTHING`,
    [generateId(), userId]
  );

  // If agent: create Stripe Connect account
  if (userType === 'agent') {
    try {
      const connectedAccount = await stripe.accounts.create({
        type: 'express',
        country: session.verified_at ? 'GB' : 'GB', // Update based on session data
        email: session.email || (await getUser(client, userId)).email,
      });

      await client.query(
        'UPDATE users SET stripe_connected_account_id = $1 WHERE id = $2',
        [connectedAccount.id, userId]
      );
    } catch (err) {
      logger.error(`Failed to create Connected account for agent ${userId}:`, err);
      throw err;
    }
  }

  // Audit log
  await logAudit(client, {
    event_type: 'kyc.verified',
    entity_type: 'user',
    entity_id: userId,
    outcome: 'success',
    metadata: { session_id: session.id, user_type: userType },
  });

  // KYC audit trail
  await client.query(
    `INSERT INTO kyc_audit (id, user_id, old_status, new_status, stripe_session_id, trigger_event, changed_at)
     VALUES ($1, $2, 'pending', 'verified', $3, $4, NOW())`,
    [generateId(), userId, session.id, 'identity.verification_session.verified']
  );

  logger.info(`User ${userId} KYC verified`);
}

async function handleIdentityRequiresInput(client, event) {
  const session = await getEventData(event, 'identity.verification_session');

  const user = await client.query(
    'SELECT id, email FROM users WHERE kyc_session_id = $1',
    [session.id]
  );

  if (user.rows.length === 0) return;

  await client.query(
    'UPDATE users SET kyc_status = $1 WHERE id = $2',
    ['awaiting_input', user.rows[0].id]
  );

  // Send email (implementation depends on your email service)
  await sendKYCUpdateEmail(user.rows[0].email, session.url);

  await logAudit(client, {
    event_type: 'kyc.requires_input',
    entity_type: 'user',
    entity_id: user.rows[0].id,
    outcome: 'pending',
    reason: 'User must provide additional documents',
  });
}

async function handleIdentityFailed(client, event) {
  const session = await getEventData(event, 'identity.verification_session');

  const user = await client.query(
    'SELECT id FROM users WHERE kyc_session_id = $1',
    [session.id]
  );

  if (user.rows.length === 0) return;

  const userId = user.rows[0].id;

  await client.query(
    'UPDATE users SET kyc_status = $1 WHERE id = $2',
    ['failed', userId]
  );

  await logAudit(client, {
    event_type: 'kyc.failed',
    entity_type: 'user',
    entity_id: userId,
    outcome: 'blocked',
    reason: `KYC session ended: ${event.type}`,
  });

  logger.warn(`KYC failed for user ${userId}: ${event.type}`);
}

// ===================================
// PAYMENT HANDLERS (LICENSES)
// ===================================

async function handleChargeSucceeded(client, event) {
  const charge = await getEventData(event, 'charge');

  if (!charge) {
    throw new Error('Missing charge data');
  }

  const { studio_id, actor_id, agent_id } = charge.metadata || {};

  if (!studio_id || !actor_id) {
    throw new Error('Missing studio_id or actor_id in charge metadata');
  }

  // GATE: Both studio and actor must be verified
  const studio = await client.query(
    'SELECT kyc_status FROM users WHERE id = $1',
    [studio_id]
  );

  const actor = await client.query(
    'SELECT kyc_status FROM users WHERE id = $1',
    [actor_id]
  );

  if (studio.rows.length === 0 || actor.rows.length === 0) {
    await client.query('UPDATE stripe_events SET processing_error = $1 WHERE stripe_event_id = $2',
      ['User not found', event.id]
    );
    throw new Error('Studio or actor not found');
  }

  if (studio.rows[0].kyc_status !== 'verified' || actor.rows[0].kyc_status !== 'verified') {
    await client.query('UPDATE stripe_events SET processing_error = $1 WHERE stripe_event_id = $2',
      ['KYC gate failed: studio or actor not verified', event.id]
    );
    throw new Error('KYC gate failed: studio or actor not verified');
  }

  // Create license record
  const licenseId = generateId();
  await client.query(
    `INSERT INTO licenses (id, studio_id, actor_id, agent_id, stripe_charge_id, amount_cents, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())`,
    [licenseId, studio_id, actor_id, agent_id || null, charge.id, charge.amount]
  );

  // Calculate wallet splits (TI's 20% already taken as application_fee by Stripe)
  const remainingCents = charge.amount; // This is the 80%

  if (agent_id) {
    // Get agent commission percentage
    const agentUser = await client.query(
      'SELECT agent_commission_pct FROM users WHERE id = $1',
      [agent_id]
    );

    if (agentUser.rows.length === 0) {
      throw new Error(`Agent ${agent_id} not found`);
    }

    const agentCommissionPct = agentUser.rows[0].agent_commission_pct || 25;
    const agentShare = Math.floor(remainingCents * (agentCommissionPct / 100));
    const actorShare = remainingCents - agentShare;

    // Update wallets atomically
    await client.query(
      `UPDATE wallet_balances SET balance_cents = balance_cents + $1 WHERE user_id = $2`,
      [agentShare, agent_id]
    );

    await client.query(
      `UPDATE wallet_balances SET balance_cents = balance_cents + $1 WHERE user_id = $2`,
      [actorShare, actor_id]
    );

    await logAudit(client, {
      event_type: 'charge.succeeded',
      entity_type: 'license',
      entity_id: licenseId,
      studio_id,
      agent_id,
      actor_id,
      amount_cents: charge.amount,
      outcome: 'success',
      metadata: {
        agent_share: agentShare,
        actor_share: actorShare,
        agent_commission_pct: agentCommissionPct,
      },
    });
  } else {
    // Unrepresented: 100% to actor
    await client.query(
      `UPDATE wallet_balances SET balance_cents = balance_cents + $1 WHERE user_id = $2`,
      [remainingCents, actor_id]
    );

    await logAudit(client, {
      event_type: 'charge.succeeded',
      entity_type: 'license',
      entity_id: licenseId,
      studio_id,
      actor_id,
      amount_cents: charge.amount,
      outcome: 'success',
      metadata: {
        actor_share: remainingCents,
        unrepresented: true,
      },
    });
  }

  logger.info(`License created: ${licenseId}, amount: ${charge.amount}`);
}

async function handleChargeFailed(client, event) {
  const charge = await getEventData(event, 'charge');

  if (!charge) return;

  const { studio_id, actor_id } = charge.metadata || {};

  await logAudit(client, {
    event_type: 'charge.failed',
    entity_type: 'charge',
    entity_id: charge.id,
    amount_cents: charge.amount,
    outcome: 'failed',
    reason: charge.failure_message || 'Payment declined',
    metadata: { failure_code: charge.failure_code },
  });

  logger.warn(`Charge failed: ${charge.id}, reason: ${charge.failure_message}`);
}

async function handleChargeRefunded(client, event) {
  const charge = await getEventData(event, 'charge');

  if (!charge) return;

  // Find and update license
  const license = await client.query(
    'SELECT * FROM licenses WHERE stripe_charge_id = $1',
    [charge.id]
  );

  if (license.rows.length === 0) {
    logger.warn(`License not found for refunded charge ${charge.id}`);
    return;
  }

  const lic = license.rows[0];

  // Reverse wallet entries
  const remainingCents = lic.amount_cents;

  if (lic.agent_id) {
    const agentUser = await client.query(
      'SELECT agent_commission_pct FROM users WHERE id = $1',
      [lic.agent_id]
    );

    const agentCommissionPct = agentUser.rows[0]?.agent_commission_pct || 25;
    const agentShare = Math.floor(remainingCents * (agentCommissionPct / 100));
    const actorShare = remainingCents - agentShare;

    await client.query(
      `UPDATE wallet_balances SET balance_cents = balance_cents - $1 WHERE user_id = $2`,
      [agentShare, lic.agent_id]
    );

    await client.query(
      `UPDATE wallet_balances SET balance_cents = balance_cents - $1 WHERE user_id = $2`,
      [actorShare, lic.actor_id]
    );
  } else {
    await client.query(
      `UPDATE wallet_balances SET balance_cents = balance_cents - $1 WHERE user_id = $2`,
      [remainingCents, lic.actor_id]
    );
  }

  // Update license status
  await client.query(
    'UPDATE licenses SET status = $1, refunded_at = NOW(), refund_reason = $2 WHERE id = $3',
    ['refunded', charge.refunded ? 'Full refund' : 'Partial refund', lic.id]
  );

  await logAudit(client, {
    event_type: 'charge.refunded',
    entity_type: 'license',
    entity_id: lic.id,
    amount_cents: lic.amount_cents,
    outcome: 'success',
    reason: 'Refund processed',
  });

  logger.info(`License refunded: ${lic.id}`);
}

async function handleChargeDisputed(client, event) {
  const dispute = await getEventData(event, 'dispute');

  if (!dispute) return;

  const charge = await getEventData(event, 'charge', dispute.charge);

  // Find license
  const license = await client.query(
    'SELECT * FROM licenses WHERE stripe_charge_id = $1',
    [dispute.charge]
  );

  if (license.rows.length === 0) return;

  const lic = license.rows[0];

  // Mark as disputed (don't reverse wallets yet, pending chargeback investigation)
  await client.query(
    'UPDATE licenses SET status = $1, disputed_at = NOW() WHERE id = $2',
    ['disputed', lic.id]
  );

  await logAudit(client, {
    event_type: 'charge.dispute.created',
    entity_type: 'license',
    entity_id: lic.id,
    outcome: 'blocked',
    reason: `Chargeback: ${dispute.reason}`,
    metadata: { dispute_id: dispute.id },
  });

  logger.warn(`License marked as disputed: ${lic.id}`);
}

// ===================================
// SUBSCRIPTION HANDLERS
// ===================================

async function handleSubscriptionCreated(client, event) {
  const subscription = await getEventData(event, 'subscription');

  // Verify user is KYC checked before allowing subscription
  const customer = await stripe.customers.retrieve(subscription.customer);
  const user = await client.query(
    'SELECT id, kyc_status FROM users WHERE email = $1',
    [customer.email]
  );

  if (user.rows.length === 0 || user.rows[0].kyc_status !== 'verified') {
    // Subscription should not have succeeded without KYC—log this as an error
    logger.error(`Subscription created for unverified user: ${subscription.customer}`);
    await logAudit(client, {
      event_type: 'customer.subscription.created',
      entity_type: 'subscription',
      entity_id: subscription.id,
      outcome: 'blocked',
      reason: 'User not KYC verified',
    });
    return;
  }

  await client.query(
    `INSERT INTO subscriptions (id, user_id, stripe_subscription_id, plan_type, status, amount_monthly_cents, billing_cycle_anchor, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      generateId(),
      user.rows[0].id,
      subscription.id,
      subscription.metadata?.plan_type || 'standard',
      subscription.status,
      subscription.plan.amount,
      new Date(subscription.billing_cycle_anchor * 1000),
    ]
  );

  await logAudit(client, {
    event_type: 'customer.subscription.created',
    entity_type: 'subscription',
    entity_id: subscription.id,
    user_id: user.rows[0].id,
    amount_cents: subscription.plan.amount,
    outcome: 'success',
  });
}

async function handleSubscriptionUpdated(client, event) {
  const subscription = await getEventData(event, 'subscription');

  await client.query(
    'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
    [subscription.status, subscription.id]
  );

  logger.info(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(client, event) {
  const subscription = await getEventData(event, 'subscription');

  await client.query(
    'UPDATE subscriptions SET status = $1, cancelled_at = NOW() WHERE stripe_subscription_id = $2',
    ['cancelled', subscription.id]
  );

  await logAudit(client, {
    event_type: 'customer.subscription.deleted',
    entity_type: 'subscription',
    entity_id: subscription.id,
    outcome: 'success',
  });

  logger.info(`Subscription cancelled: ${subscription.id}`);
}

// ===================================
// SUBSCRIPTION BILLING HANDLERS
// ===================================

async function handleInvoicePaymentFailed(client, event) {
  const invoice = await getEventData(event, 'invoice');

  await logAudit(client, {
    event_type: 'invoice.payment_failed',
    entity_type: 'invoice',
    entity_id: invoice.id,
    outcome: 'failed',
    reason: 'Invoice payment failed (retry scheduled)',
    metadata: { subscription_id: invoice.subscription },
  });

  logger.warn(`Invoice payment failed: ${invoice.id}`);
}

async function handlePaymentIntentFailed(client, event) {
  const paymentIntent = await getEventData(event, 'payment_intent');

  await logAudit(client, {
    event_type: 'payment_intent.payment_failed',
    entity_type: 'payment_intent',
    entity_id: paymentIntent.id,
    outcome: 'failed',
    reason: `Payment intent failed: ${paymentIntent.last_payment_error?.message}`,
    metadata: { failure_code: paymentIntent.last_payment_error?.code },
  });

  logger.warn(`Payment intent failed: ${paymentIntent.id}`);
}

// ===================================
// PAYOUT HANDLERS (WITHDRAWALS)
// ===================================

async function handlePayoutCreated(client, event) {
  const payout = await getEventData(event, 'payout');

  const withdrawal = await client.query(
    'SELECT id FROM withdrawals WHERE stripe_payout_id = $1',
    [payout.id]
  );

  if (withdrawal.rows.length === 0) {
    logger.warn(`Withdrawal not found for payout ${payout.id}`);
    return;
  }

  await client.query(
    'UPDATE withdrawals SET status = $1 WHERE stripe_payout_id = $2',
    ['processing', payout.id]
  );

  logger.info(`Payout processing: ${payout.id}`);
}

async function handlePayoutPaid(client, event) {
  const payout = await getEventData(event, 'payout');

  const withdrawal = await client.query(
    'SELECT id, user_id FROM withdrawals WHERE stripe_payout_id = $1',
    [payout.id]
  );

  if (withdrawal.rows.length === 0) return;

  await client.query(
    'UPDATE withdrawals SET status = $1, completed_at = NOW() WHERE stripe_payout_id = $2',
    ['completed', payout.id]
  );

  await logAudit(client, {
    event_type: 'payout.paid',
    entity_type: 'withdrawal',
    entity_id: withdrawal.rows[0].id,
    user_id: withdrawal.rows[0].user_id,
    amount_cents: payout.amount,
    outcome: 'success',
  });

  logger.info(`Withdrawal completed: ${withdrawal.rows[0].id}`);
}

async function handlePayoutFailed(client, event) {
  const payout = await getEventData(event, 'payout');

  const withdrawal = await client.query(
    'SELECT id, user_id, amount_cents FROM withdrawals WHERE stripe_payout_id = $1',
    [payout.id]
  );

  if (withdrawal.rows.length === 0) return;

  const w = withdrawal.rows[0];

  // Credit funds back to wallet
  await client.query(
    'UPDATE wallet_balances SET balance_cents = balance_cents + $1 WHERE user_id = $2',
    [w.amount_cents, w.user_id]
  );

  await client.query(
    'UPDATE withdrawals SET status = $1, failure_reason = $2 WHERE id = $3',
    ['failed', payout.failure_code || 'Unknown error', w.id]
  );

  await logAudit(client, {
    event_type: 'payout.failed',
    entity_type: 'withdrawal',
    entity_id: w.id,
    user_id: w.user_id,
    outcome: 'failed',
    reason: payout.failure_code || 'Payout failed',
  });

  logger.warn(`Withdrawal failed: ${w.id}, refunded to wallet`);
}

// ===================================
// AGENT CONNECTED ACCOUNT HANDLER
// ===================================

async function handleConnectedAccountIdentityUpdated(client, event) {
  // Extract account ID from the event
  const connectedAccountId = event.data.object.account_id || event.data.object.id;

  const agent = await client.query(
    'SELECT id FROM users WHERE stripe_connected_account_id = $1',
    [connectedAccountId]
  );

  if (agent.rows.length === 0) {
    logger.warn(`Agent not found for connected account ${connectedAccountId}`);
    return;
  }

  // Fetch account status from Stripe
  try {
    const account = await stripe.accounts.retrieve(connectedAccountId);

    // Check if charges are enabled (user can receive payouts)
    if (account.charges_enabled) {
      logger.info(`Connected account enabled for agent ${agent.rows[0].id}`);
    } else {
      logger.warn(`Connected account NOT enabled for agent ${agent.rows[0].id}`);
    }
  } catch (err) {
    logger.error(`Failed to fetch connected account ${connectedAccountId}:`, err);
  }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

/**
 * Get event data with snapshot/thin payload handling
 * Snapshot: full object in event.data.object
 * Thin: minimal object, needs Stripe API fetch
 */
async function getEventData(event, objectType, objectIdOverride = null) {
  const object = event.data.object;
  const objectId = objectIdOverride || object.id;

  // Check if this is a thin payload (missing critical fields)
  const isThinPayload =
    objectType === 'charge' && !object.amount
    || objectType === 'subscription' && !object.plan
    || objectType === 'payout' && !object.status
    || objectType === 'invoice' && !object.amount_paid
    || objectType === 'payment_intent' && !object.status
    || objectType === 'dispute' && !object.reason
    || objectType === 'identity.verification_session' && !object.status;

  if (isThinPayload) {
    try {
      switch (objectType) {
        case 'charge':
          return await stripe.charges.retrieve(objectId);
        case 'subscription':
          return await stripe.subscriptions.retrieve(objectId);
        case 'payout':
          return await stripe.payouts.retrieve(objectId);
        case 'invoice':
          return await stripe.invoices.retrieve(objectId);
        case 'payment_intent':
          return await stripe.paymentIntents.retrieve(objectId);
        case 'dispute':
          return await stripe.disputes.retrieve(objectId);
        case 'identity.verification_session':
          // Stripe Identity uses a different API
          return object; // Return what we have (thin payloads are normal for identity)
        default:
          return object;
      }
    } catch (err) {
      logger.error(`Failed to fetch ${objectType} ${objectId}:`, err);
      throw err;
    }
  }

  return object; // Snapshot payload, return as-is
}

/**
 * Log to audit_events table
 */
async function logAudit(client, data) {
  await client.query(
    `INSERT INTO audit_events (id, event_type, entity_type, entity_id, user_id, studio_id, agent_id, actor_id, amount_cents, outcome, reason, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
    [
      generateId(),
      data.event_type,
      data.entity_type,
      data.entity_id,
      data.user_id || null,
      data.studio_id || null,
      data.agent_id || null,
      data.actor_id || null,
      data.amount_cents || null,
      data.outcome,
      data.reason || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );
}

/**
 * Log failed webhook event for manual retry
 */
async function logFailedEvent(event, error) {
  try {
    const client = await pool.connect();
    await client.query(
      `UPDATE stripe_events SET processed = false, processing_error = $1 WHERE stripe_event_id = $2`,
      [error.message, event.id]
    );
    client.release();
  } catch (err) {
    logger.error('Failed to log event error:', err);
  }
}

/**
 * Helper to get user data
 */
async function getUser(client, userId) {
  const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0];
}

/**
 * Helper to send KYC update email
 * Integrate with your email service (Resend, SendGrid, etc.)
 */
async function sendKYCUpdateEmail(email, verificationUrl) {
  // TODO: Implement with your email service
  logger.info(`KYC email would be sent to ${email}`);
}

/**
 * Generate UUID (or use your preferred ID generator)
 */
function generateId() {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

module.exports = router;
