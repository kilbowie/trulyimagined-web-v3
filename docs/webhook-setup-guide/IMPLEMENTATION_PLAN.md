# Truly Imagined: Stripe Webhook Implementation Plan

**Generated:** April 2026  
**Status:** Ready for implementation  
**Environment:** Production (Vercel + RDS)

---

## Overview

This document outlines the complete webhook integration for Truly Imagined's KYC-gated payment and licensing marketplace. The system handles:

- **Identity verification** (Stripe Identity) with compliance gates
- **Payment processing** (charges, refunds, disputes)
- **Subscription management** (monthly memberships)
- **Wallet escrow** (funds held pending agent/actor release)
- **Per-license payout auditability** (immutable audit trail)

---

## Architecture Summary

### Three Personas, One Flow:

```
Actor Profile (with KYC)
    ↓
    [identity.verification_session.verified] → kyc_status = 'verified'
    ↓
    [Can be licensed] ← Studio purchases license ← Studio's KYC verified
    ↓
    [Wallet created: balance = actor_share]
    ↓
    [Agent requests payout per license] → balance transferred to actor
    ↓
    [Actor withdraws to bank] → Stripe payout

Agent Profile (with KYC)
    ↓
    [identity.verification_session.verified] → kyc_status = 'verified'
    ↓
    [Create Stripe Connected account] → stripe_connected_account_id set
    ↓
    [Can represent actors] ← Receive agent_share from licenses
    ↓
    [Wallet accumulates splits from all licenses]
    ↓
    [Agent requests payout to specific actor per license]
    ↓
    [Agent withdraws to bank]

Studio Profile (with KYC)
    ↓
    [identity.verification_session.verified] → kyc_status = 'verified'
    ↓
    [Add payment method] → Can purchase licenses
    ↓
    [Purchase actor license] → charge.succeeded
    ↓
    [Charge = 100%, split:] → TI takes 20%, agent/actor take 80%
    ↓
    [License record created, wallets updated atomically]
```

---

## Files Generated

### 1. **copilot_webhook_audit_prompt.md**
- VS Code Copilot audit checklist (10 sections, 50+ checkpoints)
- Run this against both TI and HDICR repos to identify gaps
- Output format: spreadsheet of missing components

### 2. **stripe-webhook-handler.js**
- Production-grade Node.js/Express webhook handler
- Handles 19 Stripe events
- Supports snapshot + thin payloads (auto-detects and fetches if needed)
- KYC gates enforced in code
- Idempotency checking
- Immutable audit logging
- Ready to deploy

### 3. **WEBHOOK_SETUP_GUIDE.md**
- Complete environment setup (`.env` variables)
- Step-by-step Stripe Dashboard configuration
- Local testing with Stripe CLI or ngrok
- Monitoring dashboards (query stripe_events, audit_events)
- Security best practices
- Deployment checklist

### 4. **database-migration.sql**
- PostgreSQL migration for TI RDS
- 9 tables: users, subscriptions, licenses, wallet_balances, payout_requests, withdrawals, audit_events, kyc_audit, stripe_events
- Immutable audit tables (triggers prevent updates)
- KYC gates as database constraints
- Indexes for performance
- Views for easy reporting

---

## Implementation Timeline

### Phase 1: Preparation (1-2 days)
- [ ] Run Copilot audit on both TI and HDICR repos
- [ ] Create gap list (database, endpoints, handlers)
- [ ] Provision Stripe test account (if not already done)
- [ ] Set up local development environment (Stripe CLI, ngrok)

### Phase 2: Database Setup (1 day)
- [ ] Run `database-migration.sql` on TI production RDS
- [ ] Verify all tables created with correct constraints
- [ ] Create database user/role for webhook handler (read/write)
- [ ] Test audit table immutability (attempt UPDATE → should fail)

### Phase 3: Environment Configuration (1 day)
- [ ] Generate Stripe API keys (Secret + Publishable)
- [ ] Set up Stripe Connect for agents
- [ ] Register webhook endpoint in Stripe Dashboard (see SETUP_GUIDE.md)
- [ ] Copy webhook signing secret to `.env.production`
- [ ] Deploy environment variables to Vercel

### Phase 4: Webhook Implementation (2-3 days)
- [ ] Deploy `stripe-webhook-handler.js` to `/api/webhooks/stripe`
- [ ] Test locally with Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  stripe trigger charge.succeeded
  stripe trigger identity.verification_session.verified
  ```
- [ ] Verify signature verification works
- [ ] Verify idempotency (send same event twice → only processes once)
- [ ] Check audit logging (query `audit_events` table)
- [ ] Test snapshot vs thin payloads (see handler code)

### Phase 5: KYC Gate Testing (1-2 days)
- [ ] Create test user with `kyc_status = 'unverified'`
- [ ] Attempt to create license → should fail (constraint violation)
- [ ] Trigger `identity.verification_session.verified` → kyc_status → 'verified'
- [ ] Retry license creation → should succeed
- [ ] Verify wallet created automatically
- [ ] Test agent payout request → verify wallet balance decreases atomically

### Phase 6: Payment Flow Testing (1-2 days)
- [ ] Create test charge with `charge.succeeded` event
- [ ] Verify license record created
- [ ] Verify wallet splits calculated correctly (agent % + actor %)
- [ ] Test `charge.refunded` → verify wallets reversed
- [ ] Test `charge.dispute.created` → verify license flagged
- [ ] Test subscription events → verify idempotency

### Phase 7: Staging to Production (1 day)
- [ ] Switch webhook endpoint from test to live Stripe account
- [ ] Update `STRIPE_WEBHOOK_SECRET` to live signing secret
- [ ] Deploy to production (Vercel)
- [ ] Monitor webhook delivery (Stripe Dashboard → Webhooks → Logs)
- [ ] Check for errors in `stripe_events.processing_error`

### Phase 8: Monitoring & Hardening (ongoing)
- [ ] Set up CloudWatch/Vercel logs monitoring
- [ ] Create alerts for failed webhook events
- [ ] Create alerts for KYC gate bypasses (attempt to charge unverified user)
- [ ] Weekly audit of `audit_events` table
- [ ] Quarterly webhook secret rotation

---

## Event-by-Event Breakdown

### Identity Verification (KYC Gates Everything)

```
identity.verification_session.created
  └─ Set kyc_session_id, kyc_status = 'pending'

identity.verification_session.processing
  └─ Informational only

identity.verification_session.requires_input
  └─ kyc_status = 'awaiting_input', email user

identity.verification_session.verified ✓ CRITICAL
  └─ kyc_status = 'verified'
  └─ Create wallet_balance
  └─ If agent: create Stripe Connected account

identity.verification_session.redacted / canceled
  └─ kyc_status = 'failed'
  └─ Block all transactions
```

### License Purchases (Payment Flow)

```
charge.succeeded ✓ CRITICAL
  ├─ GATE: studio.kyc_status = 'verified' AND actor.kyc_status = 'verified'
  ├─ Create license record
  ├─ Calculate splits:
  │   ├─ TI takes 20% (via Stripe application_fee)
  │   ├─ Remaining 80% split:
  │   │   ├─ If agent: agent_share = 80% × agent_commission_pct
  │   │   └─ Actor share = 80% - agent_share
  │   └─ If unrepresented: actor gets 100% of 80%
  └─ Update wallet_balances atomically

charge.failed
  └─ Log to audit_events, don't create license

charge.refunded
  ├─ Reverse wallet entries
  ├─ Update license.status = 'refunded'
  └─ Log refund reason

charge.dispute.created
  ├─ license.status = 'disputed'
  └─ Freeze funds (don't auto-release)
```

### Subscriptions (Monthly Membership)

```
customer.subscription.created
  ├─ GATE: subscriber.kyc_status = 'verified' (if not, log error)
  └─ Create subscription record

customer.subscription.updated
  └─ Update subscription.status

customer.subscription.deleted
  └─ subscription.status = 'cancelled'
```

### Subscription Billing (Reliability)

```
invoice.payment_failed
  └─ Log to audit_events (Stripe auto-retries)

payment_intent.payment_failed
  └─ Log failure_code for compliance
```

### Payouts (Withdrawals)

```
payout.created
  └─ withdrawal.status = 'processing'

payout.paid ✓ CRITICAL
  ├─ withdrawal.status = 'completed'
  └─ Log to audit_events

payout.failed
  ├─ Credit funds back to wallet_balance
  ├─ withdrawal.status = 'failed'
  └─ Log failure reason
```

### Agent Connected Account

```
v2.core.account[identity].updated
  └─ Check charges_enabled, log if agent ready for payouts
```

---

## Critical Gates & Constraints

### Database-Level (SQL Constraints)

```sql
-- Subscription requires verified user
ALTER TABLE subscriptions ADD CONSTRAINT 
  subscription_requires_verified_user CHECK (
    (SELECT kyc_status FROM users WHERE id = user_id) = 'verified'
  );

-- License requires all three users verified
ALTER TABLE licenses ADD CONSTRAINT 
  license_requires_verified_studio CHECK (
    (SELECT kyc_status FROM users WHERE id = studio_id) = 'verified'
  );

-- Payout requires agent + actor verified
ALTER TABLE payout_requests ADD CONSTRAINT 
  payout_requires_verified_agent CHECK (
    (SELECT kyc_status FROM users WHERE id = agent_id) = 'verified'
  );

-- Wallet only exists if user verified
ALTER TABLE wallet_balances ADD CONSTRAINT 
  wallet_requires_verified_user CHECK (
    (SELECT kyc_status FROM users WHERE id = user_id) = 'verified'
  );
```

### Application-Level (Webhook Handler)

```javascript
// In charge.succeeded handler:
if (studio.kyc_status !== 'verified' || actor.kyc_status !== 'verified') {
  throw new Error('KYC gate failed');
}
```

### API-Level (Endpoint Checks)

```javascript
// Before creating license endpoint:
if (studio.kyc_status !== 'verified') {
  return res.status(403).json({ error: 'Studio not KYC verified' });
}
```

---

## Idempotency & Retries

**Stripe will retry webhooks automatically if you don't return 200 OK:**
- 1 min, 5 min, 30 min, 2 hr, 5 hr, 10 hr, 24 hr delays

**Handler prevents duplicate processing:**

```sql
-- Check if already processed
SELECT id FROM stripe_events WHERE stripe_event_id = 'evt_xxx';

-- If found, skip processing (return 200 immediately)
-- If not found, process and insert to stripe_events
```

**Manual retry from Stripe Dashboard:**
1. Go to Webhooks → endpoint → event log
2. Find failed event
3. Click "Resend"

---

## Monitoring & Alerts

### Query templates:

```sql
-- Recent webhook failures
SELECT event_type, processing_error, received_at
FROM stripe_events
WHERE processed = false AND received_at > NOW() - INTERVAL '1 hour'
ORDER BY received_at DESC;

-- Audit trail for a specific license
SELECT event_type, outcome, reason, created_at
FROM audit_events
WHERE entity_id = 'license-uuid'
ORDER BY created_at DESC;

-- Wallet balance for an actor
SELECT u.name, w.balance_cents FROM wallet_balances w
JOIN users u ON u.id = w.user_id
WHERE u.id = 'actor-uuid';

-- All KYC failures in the last 7 days
SELECT * FROM audit_events
WHERE event_type = 'kyc.failed'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Pending payouts
SELECT agent_id, actor_id, license_id, amount_cents
FROM payout_requests
WHERE status = 'pending'
ORDER BY requested_at DESC;
```

### Vercel Logs:
```bash
# Check recent webhook logs
vercel logs --tail

# Filter for errors
vercel logs --tail | grep "ERROR\|error\|failed"
```

### Stripe Dashboard:
1. **Webhooks** → select endpoint
2. **Logs** tab shows all delivery attempts + responses
3. **Events** tab shows API calls (for context)

---

## Security Checklist

- [ ] `STRIPE_SECRET_KEY` never logged or exposed
- [ ] `STRIPE_WEBHOOK_SECRET` in environment variables only
- [ ] Webhook signature verification before database writes
- [ ] HTTPS only (Vercel provides automatically)
- [ ] Rate limiting on webhook retries
- [ ] Database user for webhook handler has minimal permissions (read/write only, no DDL)
- [ ] Audit logs immutable (triggers prevent updates)
- [ ] Sensitive data (card numbers, SSNs) never logged
- [ ] Error messages don't reveal system internals
- [ ] Secrets rotation every 90 days

---

## Known Limitations & Future Improvements

### Current (MVP):

✓ Snapshot + thin payload support (auto-detects)  
✓ KYC gates at database + code level  
✓ Immutable audit trail  
✓ Per-license auditability  
✓ Atomic wallet splits  

### Phase 2 (Future):

- [ ] Real-time dashboards (ChartJS/Grafana)
- [ ] Automated compliance reports (PDF export)
- [ ] Webhook replay for debugging
- [ ] Circuit breaker pattern for Stripe API calls
- [ ] Dead-letter queue for failed events
- [ ] Email notifications on KYC verification
- [ ] SMS alerts for large disputes
- [ ] Stripe Radar integration for fraud detection

---

## Questions & Troubleshooting

### Q: Why are KYC gates in both database AND code?

**A:** Defense in depth. If someone bypasses the code, the database constraints catch it. If there's a bug in constraints, the code checks catch it. Redundancy is good for compliance.

### Q: What if Stripe webhook delivery fails 7 times?

**A:** Stripe stops retrying. You must manually resend from Dashboard → Webhooks → event log → "Resend" button. The webhook handler logs failed events to `stripe_events.processing_error` so you can see what went wrong.

### Q: Can I use the same webhook endpoint for test + live mode?

**A:** No. You need two separate endpoints (two different URLs or two different Stripe dashboard configurations). Use ngrok or staging URL for test mode.

### Q: What if charge.succeeded fires but wallet_balances insert fails?

**A:** The entire webhook handler runs in a database transaction. If any step fails, the entire transaction rolls back, and `stripe_events.processing_error` is populated. Stripe will retry. Fix the issue and manually resend.

### Q: How do I test thin payloads locally?

**A:** Stripe CLI normally sends full payloads. To test thin payloads, modify your handler code temporarily to simulate them:

```javascript
// Temporarily remove critical fields for testing
const charge = event.data.object;
delete charge.amount; // Simulate thin payload
delete charge.metadata;

// Handler should fetch full object from Stripe API
```

---

## Deployment Checklist

**Before going live:**

- [ ] Database migration run successfully
- [ ] Webhook handler deployed and responding with 200 OK
- [ ] Signature verification passing
- [ ] Local testing with Stripe CLI completed
- [ ] All 19 events registered in Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` set in `.env.production`
- [ ] Webhook endpoint URL is HTTPS
- [ ] Monitoring alerts configured
- [ ] Audit logging tested (create a test charge, check audit_events)
- [ ] KYC gates tested (unverified user can't create license)
- [ ] Team trained on monitoring & incident response
- [ ] Runbook created for webhook failure scenarios

---

## Support & References

- **Stripe Webhooks Docs**: https://stripe.com/docs/webhooks
- **Stripe Identity Docs**: https://stripe.com/docs/identity
- **Stripe CLI Docs**: https://stripe.com/docs/stripe-cli
- **Stripe Events API**: https://stripe.com/docs/api/events
- **Payment Processing Flows**: See `stripe-webhook-handler.js` comments

---

## Next Steps

1. **Run Copilot audit** on TI + HDICR repos using prompt in `copilot_webhook_audit_prompt.md`
2. **Share findings** with me (gap list)
3. **I'll generate** any missing endpoints/code
4. **Deploy database** migration to production RDS
5. **Deploy webhook handler** to Vercel
6. **Register endpoint** in Stripe Dashboard (follow SETUP_GUIDE.md)
7. **Test locally** with Stripe CLI
8. **Go live** and monitor

---

**Status:** ✓ Ready for implementation  
**Generated by:** Anthropic Claude  
**Last updated:** April 2026
