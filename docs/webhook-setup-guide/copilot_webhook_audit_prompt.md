# Copilot Audit Prompt: Truly Imagined Webhook Architecture

## Context
You are auditing the Truly Imagined (TI) and HDICR codebases to prepare for implementing Stripe webhooks with KYC gates and marketplace payment flows. The system has two services:
- **HDICR** (AWS Lambda/API Gateway): Identity verification + consent
- **TI** (Vercel): Licensing, marketplace, payments
- Each has separate RDS database

The architecture requires:
1. KYC verification gates ALL transactions (actors, studios, agents)
2. Payment splits routed to wallet balances (escrow model)
3. Per-license payout auditability
4. Immutable audit trail for compliance
5. Webhook handlers for 19 Stripe events with snapshot AND thin payload support

---

## Audit Checklist: Run this against each codebase

### 1. Database Schema Audit
**For TI service:**
```
- [ ] Does `users` table exist with columns: id, user_type, kyc_status, kyc_session_id, stripe_customer_id, stripe_connected_account_id?
- [ ] Does `kyc_status` use enum: 'unverified' | 'pending' | 'awaiting_input' | 'verified' | 'failed' | 'abandoned'?
- [ ] Do `subscriptions`, `licenses`, `wallet_balances`, `payout_requests`, `withdrawals` tables exist?
- [ ] Do all transaction tables have constraints checking `kyc_status = 'verified'`?
- [ ] Does `audit_events` table exist (immutable, no UPDATE)?
- [ ] Does `kyc_audit` table exist (immutable KYC status change history)?
- [ ] Does `stripe_events` table exist (raw webhook log for debugging)?
```

**For HDICR service:**
```
- [ ] Does `identity_sessions` table exist with columns: id, user_id, stripe_session_id, status?
- [ ] Is there an API endpoint to write KYC verification results?
- [ ] Can HDICR be called by TI to sync KYC state?
```

### 2. API Endpoint Audit
**For TI service (should exist or need creation):**
```
- [ ] GET /api/users/:user_id → Returns kyc_status
- [ ] POST /api/kyc/start → Initiates Stripe Identity session, returns verification URL
- [ ] POST /api/webhooks/stripe → Receives Stripe events (THE WEBHOOK ENDPOINT)
- [ ] POST /api/licenses → Creates license (gated by studio + actor kyc_status = 'verified')
- [ ] POST /api/agents/:agent_id/request-payout → Agent requests payout to actor per license
- [ ] POST /api/users/:user_id/withdrawals → Initiates bank payout
- [ ] GET /api/audit/events → Returns audit log (filtered by user or license)
```

**For HDICR service (should exist):**
```
- [ ] POST /api/identity/session/webhook → Receives identity.verification_session events
- [ ] GET /api/users/:user_id/kyc-status → Returns current KYC status
```

### 3. Webhook Handler Audit
**For TI service (Vercel):**
```
- [ ] Is there a webhook handler at /api/webhooks/stripe?
- [ ] Does it verify Stripe signature using STRIPE_WEBHOOK_SECRET?
- [ ] Does it handle idempotency (check if event already processed)?
- [ ] Does it support BOTH snapshot and thin payloads?
  - [ ] Snapshot: Full object in event.data.object
  - [ ] Thin: Minimal object, needs Stripe API fetch
- [ ] Does it handle these events?
  - [ ] charge.succeeded (create license + wallet splits)
  - [ ] charge.failed, charge.refunded, charge.dispute.created
  - [ ] customer.subscription.created, updated, deleted
  - [ ] invoice.payment_failed, payment_intent.payment_failed
  - [ ] payout.created, payout.paid, payout.failed
  - [ ] identity.verification_session.verified (sync from HDICR or handle directly)
```

**For HDICR service (Lambda):**
```
- [ ] Is there a webhook handler for identity events?
- [ ] Does it trigger on identity.verification_session.verified, requires_input, redacted, cancelled?
- [ ] Does it write to kyc_audit table (immutable)?
- [ ] Does it call TI API to sync KYC status? (if TI is source of truth)
```

### 4. Error Handling & Logging Audit
```
- [ ] Are failed webhook events logged to stripe_events table with error reason?
- [ ] Is there a dead-letter queue or retry mechanism for failed events?
- [ ] Are database constraint violations caught and logged (don't silently fail)?
- [ ] Are Stripe API failures (rate limits, network) handled gracefully?
- [ ] Are audit_events logged for every transaction attempt (success or failure)?
```

### 5. Security Audit
```
- [ ] Is STRIPE_WEBHOOK_SECRET stored in environment variables (not hardcoded)?
- [ ] Is the webhook endpoint accessible ONLY via HTTPS?
- [ ] Is Stripe signature verification happening BEFORE any database writes?
- [ ] Are raw Stripe event payloads logged (for compliance), but sanitized in application logs?
- [ ] Is there rate limiting on webhook retries to prevent loops?
```

### 6. KYC Gate Audit (critical)
```
- [ ] Can a studio with kyc_status = 'unverified' create a charge? (should fail)
- [ ] Can an actor with kyc_status = 'unverified' be licensed? (should fail)
- [ ] Can an agent with kyc_status = 'unverified' request payouts? (should fail)
- [ ] Does the database schema ENFORCE these constraints?
- [ ] Are there API-level checks BEFORE database writes?
- [ ] Is kyc_status checked in the webhook handler BEFORE creating licenses?
```

### 7. Wallet & Escrow Audit
```
- [ ] When charge.succeeded fires, does it:
  - [ ] Calculate splits correctly (agent % + actor %)?
  - [ ] Update wallet_balances atomically (both agent + actor in one transaction)?
  - [ ] Log to audit_events with amounts?
- [ ] When payout_request is created, does it:
  - [ ] Deduct from agent wallet?
  - [ ] Credit to actor wallet?
  - [ ] Create immutable payout_request record?
- [ ] When withdrawal is initiated, does it:
  - [ ] Deduct from wallet_balances?
  - [ ] Call Stripe payout API?
  - [ ] Create withdrawal record with stripe_payout_id?
- [ ] When payout.failed webhook fires, does it:
  - [ ] Credit funds back to wallet_balances?
  - [ ] Log failure reason?
```

### 8. Audit Trail Audit
```
- [ ] Is every financial event logged to audit_events?
  - [ ] charge.succeeded → record license creation + splits
  - [ ] charge.refunded → record reversal
  - [ ] charge.dispute.created → record dispute + wallet freeze
  - [ ] payout.paid → record completion
  - [ ] payout.failed → record failure + reversal
- [ ] Is kyc_audit immutable (no UPDATE, only INSERT)?
- [ ] Can you query audit_events by date range, user, entity_id, event_type?
```

### 9. Payload Style Compatibility Audit
**For each webhook handler:**
```
- [ ] Does it check if event.data.object is complete (snapshot)?
- [ ] Does it fall back to Stripe API fetch if object is minimal (thin)?
- [ ] Example pattern:
  let chargeData = event.data.object;
  if (!chargeData.amount || !chargeData.metadata) {
    // Thin payload, fetch from Stripe
    chargeData = await stripe.charges.retrieve(event.data.object.id);
  }
- [ ] Is there error handling if Stripe API call fails?
```

### 10. Integration Points Audit
```
- [ ] Does TI call HDICR to verify KYC status when creating subscriptions?
- [ ] Does HDICR sync KYC updates back to TI?
- [ ] Is there a service-to-service auth mechanism (API key, signed requests)?
- [ ] Are integration failures logged and alertable?
```

---

## Questions to Answer After Audit

1. **Which tables/columns need to be created vs. already exist?**
2. **Which endpoints need to be built vs. already exist?**
3. **Are there existing webhook handlers? If so, do they handle snapshot + thin payloads?**
4. **How is KYC status currently stored? Does it match the enum?**
5. **Is there an audit log table? Is it immutable?**
6. **How will HDICR and TI communicate for KYC sync?**

---

## Next Steps (after audit)

1. Run this checklist against both repos
2. Document gaps in a spreadsheet:
   - Column A: Component (e.g., "users table kyc_status enum")
   - Column B: Current state (exists / missing / incomplete)
   - Column C: Priority (critical / high / medium)
3. Share findings with me
4. I'll generate implementation code for all gaps, starting with database migrations

---

## Prompt for Copilot (paste into VS Code)

```
@workspace
You are auditing the Truly Imagined marketplace system for Stripe webhook integration.
The system has two services: TI (Vercel, payments/licensing) and HDICR (Lambda, identity).

Run this audit checklist against the codebase:

1. DATABASE SCHEMA: List all tables in TI and HDICR. Check for:
   - users (with kyc_status enum)
   - kyc_audit (immutable)
   - wallet_balances
   - licenses
   - payout_requests
   - withdrawals
   - audit_events (immutable)
   - stripe_events (raw logs)

2. API ENDPOINTS: List all /api endpoints and check for:
   - POST /api/webhooks/stripe
   - POST /api/kyc/start
   - POST /api/licenses
   - POST /api/agents/:id/request-payout
   - POST /api/users/:id/withdrawals

3. WEBHOOK HANDLERS: Find webhook handler code and check:
   - Does it verify Stripe signature?
   - Does it handle snapshot + thin payloads?
   - Does it process charge.succeeded, charge.failed, subscription.*, payout.*, identity.*?
   - Does it create audit logs?

4. KYC GATES: Search for where KYC status is checked:
   - Before creating licenses
   - Before processing charges
   - Before allowing payouts

5. MISSING PIECES: List what needs to be implemented (database schema, endpoints, handlers).

Format output as a markdown table with columns: Component | Status | Notes | Priority
```

Save this as a file to share with me after running it.
