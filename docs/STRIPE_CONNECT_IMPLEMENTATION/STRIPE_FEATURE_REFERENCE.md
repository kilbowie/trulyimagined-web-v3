# Stripe Feature Implementation Reference
_Truly Imagined · Internal Reference · April 2026_

---

## Overview

This document explains how each Stripe feature is implemented within the TI platform,
how they relate to each other, and what each one does at a practical level.
Intended audience: sole founder reference, onboarding future engineers.

All Stripe code lives exclusively in TI (Next.js 15, App Router, Vercel).
HDICR has no Stripe dependency.

---

## Feature 1: Stripe Connect (Express)

### What it is
Stripe Connect is Stripe's marketplace and platform product. It allows TI to facilitate
payments between studios (who pay) and actors/agencies (who receive), while taking a
platform fee automatically on each transaction.

TI is the **platform account** — the Stripe account you own and control.
Actors and agencies are **Express connected accounts** — sub-accounts within your platform,
owned by their respective users, managed by Stripe on TI's behalf.

### Why Express (not Standard or Custom)
- **Standard:** assumes counterparties already have Stripe accounts. Wrong for actors.
- **Express:** Stripe hosts the onboarding UI (KYC, bank details), returns user to TI when done.
  Low engineering overhead. Correct choice for a solo founder.
- **Custom:** you build the entire onboarding and compliance surface. Not appropriate until
  you have a dedicated engineering team.

### How it works in TI

**Actor/Agency onboarding flow:**
1. User upgrades to paid plan or initiates first deal
2. TI calls `POST /api/stripe/connect/account` — creates an Express connected account
3. Stripe returns an `accountLink.url` — TI redirects user there
4. User completes Stripe's hosted KYC (legal name, DOB, address, bank account, government ID)
5. Stripe redirects back to TI's return URL
6. TI calls `GET /api/stripe/connect/status` — checks `details_submitted` and `charges_enabled`
7. If both true: user is payout-eligible, `stripe_account_status = 'active'` in DB
8. `account.updated` Connect webhook fires and also updates DB status

**What Stripe stores (in their system, not yours):**
- Actor's bank account details
- Identity documents submitted during Express onboarding
- Payout schedule and balance

**What TI stores:**
- `stripe_account_id` (e.g. `acct_1234...`) — the connected account ID
- `stripe_account_status` — `'pending' | 'active' | 'restricted'`
- `stripe_onboarding_complete` — boolean

**Key constraint:** An actor cannot receive licensing payouts until their connected account
is active (`charges_enabled = true`). The deal initiation route checks this before creating
a PaymentIntent.

---

## Feature 2: Stripe Identity

### What it is
Stripe Identity is a document verification and liveness detection product. It confirms
that a person is who they claim to be at a higher assurance level than Connect's built-in
KYC. It uses government ID + selfie matching.

### How it differs from Connect KYC
| | Stripe Connect KYC | Stripe Identity |
|---|---|---|
| **Purpose** | Payout eligibility | Identity trust / HDICR registration |
| **Trigger** | Express account onboarding | Actor onboarding Step 3 |
| **Who controls flow** | Stripe (hosted) | TI (modal or redirect) |
| **Result stored** | In Stripe's Connect system | In TI DB + synced to HDICR |
| **Required for payouts** | Yes | No (but required for HDICR consent registry) |

Both are required. They serve different purposes and can complete independently.
An actor might complete Connect KYC (payout-eligible) but not yet complete Stripe Identity
(consent registry not yet active). Both must be complete for full marketplace participation.

### How it works in TI

**Session creation:**
1. Actor reaches onboarding Step 3 (Verify Identity)
2. Frontend calls `POST /api/stripe/identity/session`
3. TI creates a `VerificationSession` with `type: 'document'`, `require_matching_selfie: true`
4. `ti_user_id` stored in session metadata (so webhook can identify the user)
5. TI returns `clientSecret` to frontend
6. Frontend uses Stripe.js Identity modal: `stripe.verifyIdentity(clientSecret)`
7. Actor completes document upload + selfie in Stripe's modal

**Webhook handling:**
1. `identity.verification_session.verified` fires on webhook endpoint
2. TI updates `users` table: `identity_verified = true`, `identity_status = 'verified'`
3. TI calls HDICR `POST /identity/verify-confirmed` with Auth0 M2M token
4. HDICR updates actor's identity record in consent registry

**If verification fails:**
- `identity.verification_session.requires_input` fires
- TI updates status, prompts actor to retry
- Actor can request a new session (TI checks for existing pending session first to avoid duplicates)

**Data retention:**
- Stripe retains identity documents per their retention policy (typically 7 years)
- TI does not store document images — only verification status and session ID
- HDICR stores verification confirmation and assurance level only

---

## Feature 3: Stripe Subscriptions (Products & Prices)

### What it is
Standard Stripe recurring billing. Used for all TI tier subscriptions:
Actor Creator, Agency (Independent/Boutique/Agency), Studio (Indie/Mid).

### How it works in TI

**Subscription creation:**
1. User selects plan and interval (monthly or annual)
2. TI uses Stripe's hosted Checkout or Payment Element
3. On successful subscription: `customer.subscription.created` webhook fires
4. TI provisions access by updating `user_subscriptions` table
5. Stripe handles recurring billing automatically

**Plan changes (upgrades/downgrades):**
- Agency seat add-on: increment `quantity` on the seat add-on subscription item
- Stripe calculates proration automatically
- `customer.subscription.updated` webhook fires, TI updates DB

**Annual commitments:**
- Annual prices have `recurring.interval: year`
- Price metadata includes `commitment: 'annual'`
- Cancellation flow must check commitment status before allowing mid-year cancellation
  (to be implemented in Phase 1)

**Price IDs:**
All 13 price IDs are stored as environment variables (populated after running seed script).
TI code references prices by env var name, never hardcoded Stripe IDs.

---

## Feature 4: Deal Payments (PaymentIntents + Application Fees)

### What it is
The deal payment flow uses Stripe PaymentIntents with `application_fee_amount` and
`transfer_data.destination` to automatically split a studio's payment between the
platform (TI) and the actor/agency connected account.

### Payment model (confirmed)
- **Option 1:** Studio pays `deal_value` only. Platform fee is extracted from that amount.
  Actor receives `deal_value - platform_fee`.
- This is standard industry practice. Deal value is what the studio pays; actor receives net.

### Platform fee bands
| Deal Value | Platform Fee |
|---|---|
| Up to $5,000 | 17.5% |
| $5,001 – $50,000 | 13% |
| $50,001 – $100,000 | 9% |
| Above $100,000 | 7.5% |

Fee is calculated in `/lib/stripe/platformFee.ts` and passed as `application_fee_amount`
(in cents) to the PaymentIntent.

### How it works in TI

1. Studio and actor/agency agree deal value on platform
2. Studio calls `POST /api/stripe/deals/initiate`
3. TI calculates platform fee using band logic
4. TI inserts `deals` row with status `'pending'` and full fee breakdown for audit
5. TI creates PaymentIntent:
   ```
   amount: dealValueCents
   application_fee_amount: platformFeeCents    ← goes to TI platform account
   transfer_data.destination: actorAccountId   ← remainder goes to actor
   ```
6. TI returns `clientSecret` to studio's frontend
7. Studio completes payment via Stripe Payment Element
8. `payment_intent.succeeded` webhook fires → deal marked `'paid'`
9. Stripe automatically transfers `actorPayoutCents` to actor's connected account

**What Stripe does automatically:**
- Splits the payment
- Routes application fee to platform balance
- Initiates transfer to connected account
- Fires `transfer.created` Connect webhook

**What TI does:**
- Calculates fee band
- Records full audit trail in `deals` table
- Listens for webhook confirmation
- Updates deal status

---

## Feature 5: Webhooks (Single Endpoint)

### Architecture
One endpoint: `POST /api/stripe/webhooks`
One signing secret: `STRIPE_WEBHOOK_SECRET`
Handles: platform events, Connect events, Identity events

### Event routing logic
```
Incoming event
    ↓
Signature verified? → No → 400
    ↓ Yes
Already processed? (check webhook_events) → Yes → 200 (idempotent)
    ↓ No
Insert event ID → route by event.account presence
    ↓
event.account present? → Connect handler
    ↓ No
Platform or Identity handler (by event.type)
    ↓
setImmediate(async DB writes) → return 200 immediately
```

### Critical App Router requirement
Stripe webhook signature verification requires the **raw unparsed request body**.
In Next.js App Router, this means:
```typescript
const rawBody = await request.text()  // ✓ correct
// NOT: const body = await request.json()  // ✗ breaks signature verification
```
This is different from Pages Router which required `bodyParser: false` config.
In App Router, there is no body parser to disable — `request.text()` gives raw body directly.

### Idempotency
Every event is inserted into `webhook_events` table before processing.
If Stripe retries a failed delivery, the duplicate event ID is caught and returns 200
without reprocessing. This prevents double-charging, double-provisioning, or duplicate
HDICR sync calls.

### Response behaviour
Always return 200 immediately after queuing work via `setImmediate`.
Never await DB writes inside the response path.
Stripe considers any non-200 response a failure and will retry (up to 3 days).

---

## How the Three Stripe Products Interact

```
Actor signs up
    → Stripe Identity: verify who they are (HDICR trust layer)
    → Stripe Connect: verify they can receive money (payout eligibility)
    → Stripe Subscriptions: Creator tier for marketplace access

Studio signs up
    → Stripe Subscriptions: Indie/Mid tier for platform access
    → Stripe Customer created for deal payments

Deal agreed
    → Stripe PaymentIntent with application_fee + transfer_data
    → Studio pays → TI takes fee → Actor receives net amount
```

These three products are independent but complementary.
A failure in one does not cascade to the others.
All three are managed through the single webhook endpoint.

---

## HDICR Integration Points

TI calls HDICR (never the other way around for Stripe-related matters):

| Event | TI Action | HDICR API Called |
|---|---|---|
| Identity verified | Update TI DB | `POST /identity/verify-confirmed` |
| (Future) Consent revoked | Update TI marketplace | `GET /consent/status/{actorId}` |
| (Future) Deal completed | Update TI deals | `POST /licensing/deal-confirmed` |

All TI → HDICR calls use Auth0 M2M tokens from `/lib/stripe/hdicrSync.ts`.
HDICR validates the M2M token on every request. No Stripe SDK or secrets in HDICR.
