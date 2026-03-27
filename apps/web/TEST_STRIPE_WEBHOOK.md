# Stripe Webhook Local Testing Guide

## Prerequisites

1. **Install Stripe CLI** (if not already installed)
   - Download from: https://stripe.com/docs/stripe-cli
   - Or via Homebrew: `brew install stripe/stripe-cli/stripe`
   - Or via Scoop (Windows): `scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git` then `scoop install stripe`

2. **Authenticate Stripe CLI**
   ```powershell
   stripe login
   ```
   This will open your browser to authorize the CLI.

---

## Local Development Testing

### Step 1: Start Your Next.js Dev Server
```powershell
cd apps/web
pnpm dev
```
Your app should be running on `http://localhost:3000`

### Step 2: Start Stripe Webhook Forwarding (NEW TERMINAL)
```powershell
# In a NEW terminal window
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Expected Output:**
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

### Step 3: Copy the Webhook Secret
1. Copy the `whsec_xxxxxxxxxxxxx` value from the Stripe CLI output
2. Add it to your `.env.local` file:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```
3. Restart your Next.js dev server (Ctrl+C and `pnpm dev` again)

### Step 4: Test the Webhook
In a **third terminal**, trigger test events:

```powershell
# Test verified session
stripe trigger identity.verification_session.verified

# Test requires input
stripe trigger identity.verification_session.requires_input

# Test processing
stripe trigger identity.verification_session.processing

# Test canceled
stripe trigger identity.verification_session.canceled
```

### Step 5: Check Your Terminal Logs
You should see in your Next.js terminal:
```
[STRIPE WEBHOOK] Received event: { type: 'identity.verification_session.verified', id: 'evt_xxxxx' }
[STRIPE WEBHOOK] Processing verified session: { sessionId: 'vs_xxxxx', ... }
```

---

## Testing Real Identity Verification Flow

1. **Create a verification session** via your app or API:
   ```bash
   curl -X POST http://localhost:3000/api/verification/start \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"provider":"stripe"}'
   ```

2. **Complete the verification** at the returned URL
3. **Watch the webhook** get triggered automatically in your Stripe CLI terminal
4. **Check your database** to see the `identity_links` record created

---

## Production Webhook Setup

When ready for production:

1. **Create webhook in Stripe Dashboard**
   - Go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - URL: `https://trulyimagined.com/api/webhooks/stripe`
   - Events:
     - `identity.verification_session.verified`
     - `identity.verification_session.requires_input`
     - `identity.verification_session.processing`
     - `identity.verification_session.canceled`

2. **Copy production webhook secret**
   - After creating, copy the signing secret (starts with `whsec_`)
   - Add to Vercel environment variables:
     - Name: `STRIPE_WEBHOOK_SECRET`
     - Value: `whsec_xxxxxxxxxxxxx`
     - Environment: Production

3. **Add to AWS Secrets Manager**
   ```powershell
   aws secretsmanager create-secret `
     --name prod/stripe-webhook-secret `
     --secret-string "whsec_xxxxxxxxxxxxx" `
     --region eu-west-1
   ```

---

## Troubleshooting

### "Missing stripe-signature header"
- Make sure you're using Stripe CLI's `stripe listen` command
- The header is automatically added by Stripe CLI

### "Webhook signature verification failed"
- Check that `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the CLI output
- Restart your Next.js dev server after updating `.env.local`

### "STRIPE_WEBHOOK_SECRET not configured"
- Ensure the environment variable is set in `.env.local`
- Check there are no typos in the variable name

### No events showing up
- Verify Stripe CLI is still running (`stripe listen`)
- Check your Next.js app is running on port 3000
- Look for error messages in the Stripe CLI terminal

### Events firing but not processing
- Check your Next.js terminal for error messages
- Verify database connection is working
- Check that `user_profile_id` is in the session metadata

---

## Useful Commands

```powershell
# List available test events
stripe trigger --help

# View webhook event details
stripe events list --limit 5

# Tail live webhook events
stripe listen --print-json

# Test with specific event ID
stripe events resend evt_xxxxxxxxxxxxx
```

---

## Quick Reference

**Stripe CLI Documentation**: https://stripe.com/docs/stripe-cli
**Identity Verification Events**: https://stripe.com/docs/identity/verification-sessions#events
**Webhook Handler Code**: `apps/web/src/app/api/webhooks/stripe/route.ts`
