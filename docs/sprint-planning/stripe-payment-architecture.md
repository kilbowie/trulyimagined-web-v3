# Stripe Payment Architecture for Truly Imagined MVP

## Overview

Truly Imagined requires a three-way payment split:
1. **Actor**: receives primary remuneration for consent & usage rights
2. **Agent**: receives negotiated cut (typically 10–20%) from actor's portion
3. **Truly Imagined**: receives platform fee (typically 10–15% of deal value)

**Critical constraint:** All payments must flow through Stripe to maintain PCI-DSS compliance. No direct bank transfers, no card storage, no payment data touching TI infrastructure.

---

## Payment Flow Architecture

### Deal Signing → License Issuance → Payment Setup

```
1. Deal signed (actor + agent + studio agree terms)
   ├─ License created in `licenses` table
   ├─ Remuneration breakdown stored in `licenses.commercial_terms` (JSON)
   │  {
   │    "actor_gross_fee": 10000,       // Total fee actor receives
   │    "agent_percentage": 15,          // Agent takes 15% of actor's portion
   │    "ti_percentage": 12,             // TI takes 12% of deal value
   │    "studio_payable": 10000,         // Studio owes this total
   │    "payment_due_date": "2024-05-15",
   │    "payment_terms": "net 30"
   │  }
   │
   ├─ Payment method verified (studio Stripe account or token)
   │
   └─ Payout setup created in TI database
      ├─ Agent payout record (agent_id, amount, status: pending)
      ├─ Actor payout record (actor_id, amount, status: pending)
      └─ TI revenue record (ti_id, amount, status: pending)

2. Studio makes payment via Stripe (within payment_due_date)
   ├─ Payment Intent created: amount = studio_payable
   ├─ Payment authorized & captured
   ├─ Webhook received: payment.success
   │
   └─ Payment split logic triggered:
      ├─ Calculate actor net = actor_gross_fee - (actor_gross_fee * agent_percentage / 100)
      ├─ Calculate agent fee = actor_gross_fee * (agent_percentage / 100)
      ├─ Calculate ti fee = studio_payable * (ti_percentage / 100)
      ├─ Create Stripe Transfer:
      │  ├─ Transfer to actor bank (connected account or external account)
      │  ├─ Transfer to agent bank (connected account or external account)
      │  └─ TI keeps ti_fee in platform account
      │
      └─ Update payout records to status: paid
         └─ Emit audit log: [actor_id] paid £X on [date], agent took 15%, TI took 12%
```

---

## Stripe Setup for MVP

### 1. Account Structure

**Primary Account:** Truly Imagined Stripe account (connects to TI bank account)
- Holds platform fees (TI revenue share)
- Issues transfers to connected accounts (agents, actors)
- Receives payments from Studios

**Connected Accounts:** One per Agent / Actor (optional for MVP, required for production scaling)
- Agent Stripe Connected Account: enables direct payouts to agent bank
- Actor Stripe Connected Account: enables direct payouts to actor bank
- Alternative (MVP-friendly): Store external bank accounts in Stripe, use transfers to those accounts

### 2. Payment Methods

**For Studios (payers):**
- Stripe Payment Intent API (no card storage on TI servers)
- Invoices → Studio clicks link → Stripe-hosted payment page
- Saved payment methods (studios can authorize once, pay multiple times)

**For Actors/Agents (payees):**
- Stripe Connected Account (OAuth onboarding, automatic payouts)
- OR: Store external bank account in Stripe using Bank Account Tokens (no PII on TI servers)

### 3. PCI-DSS Compliance Strategy

**TI Infrastructure touches ZERO payment data:**
- No card numbers stored
- No bank account numbers stored (use Stripe tokens)
- No CVV/CVC data
- No ACH credentials

**Stripe handles all:**
- Card tokenization
- Bank account verification
- Payment authorization
- Fund settlement
- Payout execution

**TI only stores:**
- Stripe PaymentIntent IDs (for lookup)
- Stripe Transfer IDs (for audit trail)
- Stripe Customer IDs (optional, for saved payment methods)
- Business logic (split percentages, remuneration amounts)

**Audit & Compliance:**
- Log all Stripe events (webhook logs)
- Never log full payment details
- Example: `payment_intent.succeeded: pi_xyz, amount: 10000, status: succeeded` ✓
- Example: NEVER log full card or bank data ✗

---

## Database Schema Extensions

### `licenses` Table (additions)

```sql
ALTER TABLE licenses ADD COLUMN (
  commercial_terms JSONB NOT NULL DEFAULT '{}',
  -- Example:
  -- {
  --   "actor_gross_fee": 10000,
  --   "agent_percentage": 15,
  --   "ti_percentage": 12,
  --   "studio_payable": 10000,
  --   "payment_due_date": "2024-05-15",
  --   "payment_terms": "net 30",
  --   "currency": "GBP"
  -- }

  payment_status VARCHAR(20) DEFAULT 'pending',
  -- pending, partially_paid, paid, disputed, refunded, failed

  payment_intent_id VARCHAR(255) UNIQUE,
  -- Stripe PaymentIntent ID for lookup

  paid_at TIMESTAMP
);
```

### New Table: `payouts`

```sql
CREATE TABLE payouts (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT NOT NULL REFERENCES licenses(id),
  recipient_type VARCHAR(20) NOT NULL,  -- actor, agent, ti
  recipient_id BIGINT NOT NULL,           -- actor_id, agent_id, or null for ti
  amount_pence BIGINT NOT NULL,           -- Amount in pence (to avoid floats)
  currency VARCHAR(3) DEFAULT 'GBP',
  stripe_transfer_id VARCHAR(255) UNIQUE, -- Stripe Transfer ID
  status VARCHAR(20) DEFAULT 'pending',   -- pending, paid, failed, reversed
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  failure_reason TEXT,
  metadata JSONB,                         -- For debugging/tracking
  UNIQUE(license_id, recipient_type, recipient_id)
);

CREATE INDEX idx_payouts_recipient ON payouts(recipient_type, recipient_id);
CREATE INDEX idx_payouts_status ON payouts(status);
```

### New Table: `payment_methods`

```sql
CREATE TABLE payment_methods (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES user_profiles(id),
  user_type VARCHAR(20) NOT NULL,  -- actor, agent, studio
  stripe_customer_id VARCHAR(255),  -- For saved cards (studios)
  stripe_bank_account_id VARCHAR(255),  -- For payee accounts (actors/agents)
  stripe_connected_account_id VARCHAR(255),  -- For connected accounts
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, stripe_customer_id),
  UNIQUE(user_id, stripe_bank_account_id),
  UNIQUE(user_id, stripe_connected_account_id)
);
```

### New Table: `payment_audit_log`

```sql
CREATE TABLE payment_audit_log (
  id BIGSERIAL PRIMARY KEY,
  license_id BIGINT REFERENCES licenses(id),
  event_type VARCHAR(50),  -- payment_intent.created, payment_intent.succeeded, transfer.created, etc.
  stripe_event_id VARCHAR(255) UNIQUE,  -- Stripe webhook event ID (for deduplication)
  status VARCHAR(50),
  amount_pence BIGINT,
  metadata JSONB,  -- Non-sensitive event data
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_audit_license ON payment_audit_log(license_id);
CREATE INDEX idx_payment_audit_event ON payment_audit_log(event_type, status);
```

---

## API Endpoints

### Studio-facing (Payer)

#### POST `/api/payment/invoice/create`
- **Auth:** Studio user
- **Input:** license_id
- **Output:** Stripe-hosted invoice URL (studio clicks to pay)
- **Logic:**
  1. Fetch license + commercial_terms
  2. Create Stripe Invoice via Invoice API
  3. Send invoice to studio email
  4. Return payment link

#### POST `/api/payment/intent/create` (alternative for immediate payment)
- **Auth:** Studio user
- **Input:** license_id, payment_method_id (optional, for saved card)
- **Output:** Stripe PaymentIntent client secret
- **Logic:**
  1. Fetch license + amount
  2. Create PaymentIntent (amount = studio_payable)
  3. Return client secret (frontend completes 3DS if needed)
  4. Webhook: payment_intent.succeeded triggers split logic

#### GET `/api/payment/status`
- **Auth:** Studio user
- **Output:** Payment status for their licenses

### Actor/Agent-facing (Payee)

#### POST `/api/payout/bank-account/add`
- **Auth:** Actor or Agent
- **Input:** Bank account details (sort code, account number) OR Stripe token (if pre-tokenized)
- **Logic:**
  1. Tokenize bank account in Stripe (no storage on TI)
  2. Store Stripe bank account ID in `payment_methods` table
  3. Verify account (Stripe micro-deposit verification, optional for MVP)

#### GET `/api/payout/history`
- **Auth:** Actor or Agent
- **Output:** List of payouts (amounts, dates, status)
- **Privacy:** Only show actor/agent their own payouts

#### GET `/api/payout/earnings`
- **Auth:** Agent
- **Output:** Earnings dashboard (total received, pending, per-actor breakdown)

### Admin-facing

#### POST `/api/payment/webhook/stripe`
- **Auth:** Stripe signature verification
- **Logic:**
  1. Verify signature using Stripe secret
  2. Log event in `payment_audit_log`
  3. Route to handler based on event.type:
     - payment_intent.succeeded → trigger payout split
     - payment_intent.payment_failed → update payment_status, notify studio
     - transfer.created, transfer.failed → update payout status
     - transfer.reversed → handle refund/reversal

#### GET `/api/admin/payments`
- **Auth:** Admin
- **Output:** Dashboard with all payments, splits, disputes

---

## Payout Split Logic (Core Service)

### Service: `PayoutService.processPayout(licenseId, paymentIntentId)`

```javascript
async function processPayout(licenseId, paymentIntentId) {
  // 1. Fetch license + commercial_terms
  const license = await db.query(
    `SELECT * FROM licenses WHERE id = $1`,
    [licenseId]
  );
  const terms = license.commercial_terms;

  // 2. Verify payment was successful
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== 'succeeded') {
    throw new Error('Payment not succeeded');
  }

  // 3. Calculate splits (in pence to avoid float precision issues)
  const studioPayablePence = terms.studio_payable * 100;
  const actorGrossPence = terms.actor_gross_fee * 100;
  const agentPercentage = terms.agent_percentage || 0;
  const tiPercentage = terms.ti_percentage || 0;

  const agentFeePence = Math.round(actorGrossPence * (agentPercentage / 100));
  const actorNetPence = actorGrossPence - agentFeePence;
  const tiFeePence = Math.round(studioPayablePence * (tiPercentage / 100));

  // 4. Create payout records
  const payouts = [];

  // Actor payout
  payouts.push({
    license_id: licenseId,
    recipient_type: 'actor',
    recipient_id: license.actor_id,
    amount_pence: actorNetPence,
    stripe_transfer_id: null, // Will be filled after transfer created
    status: 'pending',
  });

  // Agent payout (if agent exists and percentage > 0)
  if (license.agent_id && agentPercentage > 0) {
    payouts.push({
      license_id: licenseId,
      recipient_type: 'agent',
      recipient_id: license.agent_id,
      amount_pence: agentFeePence,
      stripe_transfer_id: null,
      status: 'pending',
    });
  }

  // TI payout (platform fee)
  payouts.push({
    license_id: licenseId,
    recipient_type: 'ti',
    recipient_id: null,
    amount_pence: tiFeePence,
    stripe_transfer_id: null,
    status: 'paid', // TI fee stays in platform account, no transfer needed
  });

  // 5. Execute Stripe Transfers for actor & agent
  for (const payout of payouts) {
    if (payout.recipient_type === 'ti') continue; // TI keeps funds, no transfer

    // Fetch recipient bank account
    const bankAccount = await db.query(
      `SELECT stripe_bank_account_id FROM payment_methods
       WHERE user_id = (SELECT user_id FROM actors WHERE id = $1)
       AND stripe_bank_account_id IS NOT NULL
       LIMIT 1`,
      [payout.recipient_id]
    );

    if (!bankAccount) {
      throw new Error(`No bank account found for ${payout.recipient_type} ${payout.recipient_id}`);
    }

    // Create Stripe Transfer
    const transfer = await stripe.transfers.create({
      amount: payout.amount_pence,
      currency: 'gbp',
      destination: bankAccount.stripe_bank_account_id,
      metadata: {
        license_id: licenseId,
        recipient_type: payout.recipient_type,
        recipient_id: payout.recipient_id,
      },
    });

    // Update payout record with transfer ID
    payout.stripe_transfer_id = transfer.id;
    payout.status = 'paid';

    // Insert into database
    await db.query(
      `INSERT INTO payouts (license_id, recipient_type, recipient_id, amount_pence, stripe_transfer_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        payout.license_id,
        payout.recipient_type,
        payout.recipient_id,
        payout.amount_pence,
        payout.stripe_transfer_id,
        payout.status,
      ]
    );
  }

  // 6. Update license payment status
  await db.query(
    `UPDATE licenses SET payment_status = 'paid', paid_at = NOW(), payment_intent_id = $1 WHERE id = $2`,
    [paymentIntentId, licenseId]
  );

  // 7. Emit audit events
  await auditLog.log({
    license_id: licenseId,
    event_type: 'payment.split_completed',
    metadata: {
      actor_net: actorNetPence / 100,
      agent_fee: agentFeePence / 100,
      ti_fee: tiFeePence / 100,
    },
  });

  // 8. Notify all parties
  await sendNotifications({
    actor: 'Your payout has been processed',
    agent: `You've received £${(agentFeePence / 100).toFixed(2)}`,
    studio: 'Payment confirmed',
  });

  return { payouts, transfers: payouts.filter(p => p.recipient_type !== 'ti') };
}
```

---

## Refund & Dispute Handling

### Refund Flow (Studio initiates)

1. Studio requests refund in TI dashboard
2. Admin reviews: checks license terms, consent status, usage logs
3. If refund approved:
   - Stripe refund created (targets original PaymentIntent)
   - Refund split logic: reverse actor/agent payouts proportionally
   - Send refund to studio Stripe account
   - Update license: payment_status = 'refunded'
   - Audit log: note reason, who approved, amount

### Dispute (from arbitration)

- If consent revocation triggers arbitration and becomes unresolved:
  - License marked: payment_status = 'disputed'
  - Funds held: Stripe transfer stays in transit or held
  - Notification: all parties informed dispute ongoing
  - Resolution: arbitration outcome determines refund or release

---

## Webhook Handlers

### `POST /api/webhooks/stripe`

```javascript
router.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Deduplication: check if we've already processed this event
  const existing = await db.query(
    `SELECT id FROM payment_audit_log WHERE stripe_event_id = $1`,
    [event.id]
  );
  if (existing.rows.length > 0) {
    return res.json({ received: true }); // Already processed
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'transfer.created':
        await handleTransferCreated(event.data.object);
        break;
      case 'transfer.failed':
        await handleTransferFailed(event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Log success
    await db.query(
      `INSERT INTO payment_audit_log (stripe_event_id, event_type, status, metadata)
       VALUES ($1, $2, 'processed', $3)`,
      [event.id, event.type, JSON.stringify(event.data)]
    );

    res.json({ received: true });
  } catch (err) {
    // Log error but return 200 so Stripe doesn't retry
    console.error(`Webhook error: ${err.message}`);
    await db.query(
      `INSERT INTO payment_audit_log (stripe_event_id, event_type, status, metadata)
       VALUES ($1, $2, 'failed', $3)`,
      [event.id, event.type, JSON.stringify({ error: err.message })]
    );
    res.json({ received: true });
  }
});
```

---

## Testing & Validation

### Unit Tests
- `processPayout()` with various agent percentages
- Refund split calculations (verify actors/agents get proportional reversal)
- Bank account tokenization (Stripe test mode)

### Integration Tests
- Full payment flow: create license → create invoice → studio pays → payout split executed
- Dispute flow: payment → arbitration triggered → funds frozen/released
- Refund flow: payment → refund requested → reversal processed

### Test Cards (Stripe)
- `4242 4242 4242 4242` - Success
- `4000 0000 0000 9995` - Decline
- `4000 0025 0000 3155` - Require 3DS

### Compliance Checklist
- [ ] No card/bank data stored on TI servers
- [ ] All Stripe events logged (with deduplication)
- [ ] Audit trail complete (who, what, when, why for every transaction)
- [ ] PCI-DSS SAQ A-EP (Service Provider, Hosted Payment Form)
- [ ] Stripe Terms of Service compliance
- [ ] FCA/PRA compliance (UK-regulated remittance service? TBD based on volume)

---

## Regulatory Considerations

### PCI-DSS Level
**MVP Target: SAQ A-EP (Simplified)**
- TI uses Stripe-hosted forms
- TI stores zero card/bank data
- TI never sees full payment details

### FCA/PRA (UK)
- **Remittance Activity Exemption:** If TI is just splitting payments (not holding funds long-term), likely exempt
- **Payment Account Directive (PSD2):** If TI becomes a payment institution, requires PSD2 authorization
- **Recommendation:** Consult UK fintech solicitor once volumes are clear (£X transactions/month)

### GDPR
- Payment data is personal data (bank account, payment history)
- Stripe is DPA-compliant (check Stripe DPA)
- TI audit logs contain minimal PII (transaction IDs, not names/amounts in plaintext)
- Right to deletion: handled via Stripe token deletion + database cleanup

---

## Monitoring & Alerting

### Critical Alerts
- Payment failed (notify studio + admin)
- Transfer failed (notify actor/agent + admin)
- Payout mismatch (script to reconcile Stripe → TI database, run nightly)
- Webhook lag (if processing > 5 min, alert)

### Dashboard Metrics
- Total revenue (actor + agent + TI)
- Payment success rate
- Average payout latency (payment → actor/agent receives funds)
- Failed transfers (manual resolution needed)

---

## Go-Live Checklist

- [ ] Stripe account created & connected
- [ ] Webhook endpoint deployed & verified
- [ ] Test payments processed end-to-end
- [ ] Payout split logic verified with sample data
- [ ] Refund logic tested
- [ ] Error handling & retry logic in place
- [ ] Audit logging complete
- [ ] Documentation for studios (how to pay)
- [ ] Documentation for actors/agents (how to add bank account)
- [ ] Admin dashboard for payment monitoring
- [ ] Legal review (Stripe ToS, payment terms in licenses)
- [ ] Staging environment with real Stripe test data
