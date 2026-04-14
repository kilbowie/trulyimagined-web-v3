# Stripe Webhook Setup Guide for Truly Imagined

## 1. Environment Variables (.env.local or .env.production)

```bash
# Stripe API Keys (from Stripe Dashboard → Developers → API Keys)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx  # Generated after webhook endpoint created

# Database (TI service)
DATABASE_URL=postgresql://user:password@localhost:5432/truly_imagined_prod

# Logging
LOG_LEVEL=info
LOG_SERVICE=truly-imagined

# Email (for KYC notifications)
EMAIL_SERVICE=resend  # or sendgrid, mailgun, etc.
EMAIL_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=notifications@trulyimagined.com
```

**IMPORTANT:**
- Never commit `.env.local` or `.env.production` to Git
- Use GitHub Secrets (if using GitHub Actions) or Vercel Environment Variables
- Rotate webhook secrets every 90 days
- Keep `STRIPE_SECRET_KEY` restricted to backend only—never expose to frontend

---

## 2. Register Webhook Endpoint in Stripe Dashboard

### Step 1: Access Webhook Settings
1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**

### Step 2: Configure Endpoint
- **Endpoint URL**: `https://trulyimagined.com/api/webhooks/stripe`
  - For local testing with ngrok: `https://xxxxx.ngrok.io/api/webhooks/stripe`
- **Events to send**: Select the 19 events (see list below)
- **API version**: Leave as default (latest)

### Step 3: Select Events to Send

**Select these 19 events:**

**Identity Verification (KYC):**
- [ ] `identity.verification_session.created`
- [ ] `identity.verification_session.processing`
- [ ] `identity.verification_session.requires_input`
- [ ] `identity.verification_session.verified` ✓ CRITICAL
- [ ] `identity.verification_session.redacted`
- [ ] `identity.verification_session.canceled`

**Payments (Licenses):**
- [ ] `charge.succeeded` ✓ CRITICAL
- [ ] `charge.failed`
- [ ] `charge.refunded`
- [ ] `charge.dispute.created`

**Subscriptions:**
- [ ] `customer.subscription.created`
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`

**Subscription Billing:**
- [ ] `invoice.payment_failed`
- [ ] `payment_intent.payment_failed`

**Payouts (Withdrawals):**
- [ ] `payout.created`
- [ ] `payout.paid`
- [ ] `payout.failed`

**Agent Connected Account:**
- [ ] `v2.core.account[identity].updated`

### Step 4: Copy Webhook Secret
After creating the endpoint:
1. Click the endpoint to open details
2. Copy the **Signing Secret** (starts with `whsec_`)
3. Paste into `.env.local` as `STRIPE_WEBHOOK_SECRET`

---

## 3. Webhook Endpoint Implementation in Express.js

### Mount the webhook router in your main app:

```javascript
// app.js or index.js
const express = require('express');
const webhookRouter = require('./routes/webhooks/stripe');

const app = express();

// IMPORTANT: Webhook must be BEFORE JSON parsing middleware
// because Stripe signature verification requires raw request body
app.use('/api/webhooks/stripe', webhookRouter);

// Then add JSON parsing for other routes
app.use(express.json());

// Other routes...
```

**Webhook will be accessible at:**
```
https://trulyimagined.com/api/webhooks/stripe
```

### Vercel-specific deployment notes:

```javascript
// For Vercel serverless functions (api/webhooks/stripe.js):
import express from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

// Raw body for signature verification
app.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Process event...
  res.json({ received: true });
});

export default app;
```

---

## 4. Testing Webhook Locally

### Option A: Use Stripe CLI (recommended)

1. **Install Stripe CLI** (https://stripe.com/docs/stripe-cli)

2. **Login to your Stripe account:**
   ```bash
   stripe login
   ```

3. **Forward events to local endpoint:**
   ```bash
   stripe listen --events charge.succeeded,charge.failed,customer.subscription.created,identity.verification_session.verified --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Copy the webhook signing secret** from CLI output and add to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxx...
   ```

5. **Trigger test events from CLI:**
   ```bash
   stripe trigger charge.succeeded
   stripe trigger customer.subscription.created
   stripe trigger identity.verification_session.verified
   ```

### Option B: Use ngrok (for HTTPS tunneling)

1. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```

2. **Copy forwarding URL** (e.g., `https://xxxxx.ngrok.io`)

3. **Register webhook in Stripe Dashboard:**
   - Endpoint URL: `https://xxxxx.ngrok.io/api/webhooks/stripe`
   - Copy signing secret to `.env.local`

4. **Test with Stripe Dashboard test events:**
   - Go to Webhooks → select endpoint → scroll to "Test data"
   - Send test events

---

## 5. Monitoring Webhook Delivery

### In Stripe Dashboard:

1. **Webhooks** → Select your endpoint
2. **Logs** tab shows:
   - Event type
   - Timestamp
   - Response status (200 = success, 4xx = your error, 5xx = timeout)
   - Request/response bodies

### In your application:

- Query `stripe_events` table:
  ```sql
  SELECT event_type, processed, processing_error, received_at
  FROM stripe_events
  ORDER BY received_at DESC
  LIMIT 50;
  ```

- Check `audit_events` for business logic execution:
  ```sql
  SELECT event_type, entity_type, outcome, created_at
  FROM audit_events
  WHERE created_at > NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC;
  ```

---

## 6. Error Handling & Retries

### Stripe automatically retries failed webhooks:
- 1 minute delay
- 5 minutes delay
- 30 minutes delay
- 2 hours delay
- 5 hours delay
- 10 hours delay
- 24 hours delay

**Your webhook handler must:**
1. Return `200 OK` within 5 seconds
2. Process asynchronously (don't block response)
3. Check idempotency (same event shouldn't be processed twice)

### If a webhook fails repeatedly:

1. Check `stripe_events.processing_error` for reason
2. Fix the issue in code
3. Manually retry from Stripe Dashboard:
   - Webhooks → endpoint → event → "Resend"

---

## 7. Security Best Practices

### Signature Verification (already in handler.js):
```javascript
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

✓ **Always verify before trusting event data**

### Secrets Management:

```bash
# DO NOT commit to Git
❌ STRIPE_SECRET_KEY=sk_live_xxx
❌ STRIPE_WEBHOOK_SECRET=whsec_xxx

# Use environment files (gitignored)
✓ .env.local (local development)
✓ .env.production (production, not in repo)

# Use platform secrets
✓ Vercel Environment Variables (Settings → Environment Variables)
✓ GitHub Secrets (Settings → Secrets and variables → Actions)
✓ AWS Secrets Manager (for Lambda/HDICR)
```

### HTTPS Only:
- Production endpoint **must** use HTTPS
- Stripe won't send to HTTP endpoints (security risk)
- Vercel provides HTTPS automatically
- For local testing, use ngrok (provides HTTPS tunnel)

---

## 8. Deployment Checklist

Before deploying to production:

- [ ] `STRIPE_WEBHOOK_SECRET` is in production environment variables
- [ ] `STRIPE_SECRET_KEY` is in production environment variables
- [ ] Database tables created (see migration script)
- [ ] `/api/webhooks/stripe` endpoint is registered in Stripe Dashboard
- [ ] Endpoint returns `200 OK` within 5 seconds (test with `stripe trigger`)
- [ ] Webhook signing verification is enabled
- [ ] Idempotency check is working (check `stripe_events` table)
- [ ] Audit logging is working (check `audit_events` table)
- [ ] KYC gates are enforced (test unverified user trying to purchase)
- [ ] Error handling catches and logs all exceptions
- [ ] Sensitive data (API keys, etc.) is NOT logged
- [ ] Monitoring/alerting is set up for failed events

---

## 9. Rotating Webhook Secrets

Every 90 days (recommended):

1. Go to Stripe Dashboard → Webhooks
2. Click your endpoint → Signing secret section
3. Click "Reveal" → "Rotate"
4. New secret is generated
5. Update `.env.production` with new secret
6. Redeploy
7. Old secret expires after 24 hours

---

## 10. Payload Style Reference

**Snapshot payloads** (default):
```json
{
  "id": "evt_1234567890",
  "object": "event",
  "type": "charge.succeeded",
  "data": {
    "object": {
      "id": "ch_1234567890",
      "object": "charge",
      "amount": 5000,
      "metadata": { "studio_id": "uuid", "actor_id": "uuid" }
    }
  }
}
```

**Thin payloads** (minimal data):
```json
{
  "id": "evt_1234567890",
  "object": "event",
  "type": "charge.succeeded",
  "data": {
    "object": {
      "id": "ch_1234567890",
      "object": "charge"
    }
  }
}
```

The handler code automatically fetches full data if thin payload detected.

---

## Questions?

- **Stripe Docs**: https://stripe.com/docs/webhooks
- **Webhook Signing**: https://stripe.com/docs/webhooks/signatures
- **Event Types**: https://stripe.com/docs/api/events
- **Testing**: https://stripe.com/docs/stripe-cli
