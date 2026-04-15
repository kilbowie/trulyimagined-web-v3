#!/usr/bin/env node
/**
 * P0-2 readiness check: verify the production webhook endpoint is reachable.
 *
 * The endpoint must return HTTP 400 (missing Stripe-Signature header) rather
 * than 404/502/etc, which proves the route is deployed and handler is running.
 *
 * Usage:
 *   node scripts/verify-webhook-endpoint-live.mjs
 *   WEBHOOK_URL=https://staging.trulyimagined.com/api/webhooks/stripe node scripts/verify-webhook-endpoint-live.mjs
 *
 * Env:
 *   WEBHOOK_URL  (default: https://trulyimagined.com/api/webhooks/stripe)
 */

const url = process.env.WEBHOOK_URL ?? 'https://trulyimagined.com/api/webhooks/stripe';

console.log(`[verify-webhook-endpoint] Probing ${url} ...`);

async function probe() {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Deliberately omit Stripe-Signature — we expect a 400
      body: JSON.stringify({ type: 'probe' }),
    });
  } catch (err) {
    console.error(`[verify-webhook-endpoint] FAIL — network error: ${err.message}`);
    console.error('  → The endpoint is not reachable. Check deployment status and DNS.');
    process.exit(2);
  }

  console.log(`[verify-webhook-endpoint] HTTP ${res.status} ${res.statusText}`);

  if (res.status === 400) {
    const body = await res.text().catch(() => '');
    console.log(
      `[verify-webhook-endpoint] PASS — endpoint is live and rejecting unsigned requests (${body.slice(0, 120)})`
    );
    console.log('');
    console.log('Next step: Register this URL in the Stripe Dashboard');
    console.log(`  URL: ${url}`);
    console.log('  Events to subscribe:');
    console.log('    identity.verification_session.verified');
    console.log('    identity.verification_session.requires_input');
    console.log('    identity.verification_session.processing');
    console.log('    identity.verification_session.canceled');
    console.log('    identity.verification_session.redacted');
    console.log('    charge.succeeded');
    console.log('    charge.failed');
    console.log('    charge.refunded');
    console.log('    charge.dispute.created');
    console.log('    payment_intent.payment_failed');
    console.log('    payout.created');
    console.log('    payout.paid');
    console.log('    payout.failed');
    console.log('');
    console.log('After registering, copy the webhook signing secret (whsec_...) and set:');
    console.log('  STRIPE_WEBHOOK_SECRET=whsec_... in Vercel environment variables');
    process.exit(0);
  }

  if (res.status === 404) {
    console.error('[verify-webhook-endpoint] FAIL — 404 Not Found.');
    console.error('  → Deployment may be missing or route not yet deployed. Redeploy and retry.');
    process.exit(2);
  }

  if (res.status === 200) {
    // Should not happen without a valid signature — but some proxy health checks return 200
    console.warn(
      `[verify-webhook-endpoint] WARN — unexpectedly got 200 without a Stripe-Signature.`
    );
    console.warn(
      '  → The route may not be enforcing signature verification. Investigate route.ts.'
    );
    process.exit(1);
  }

  // 5xx or other unexpected status
  if (res.status >= 500) {
    console.error(`[verify-webhook-endpoint] FAIL — server error ${res.status}.`);
    const body = await res.text().catch(() => '');
    console.error(`  Response: ${body.slice(0, 200)}`);
    console.error('  → Check Vercel function logs for runtime errors.');
    process.exit(2);
  }

  // 401/403 from Vercel deployment protection
  if (res.status === 401 || res.status === 403) {
    console.error(
      `[verify-webhook-endpoint] FAIL — ${res.status} (Vercel Deployment Protection may be enabled).`
    );
    console.error(
      '  → Disable protection for this route or configure a bypass secret, then retry.'
    );
    process.exit(2);
  }

  console.warn(
    `[verify-webhook-endpoint] UNEXPECTED status ${res.status} — manual review required.`
  );
  process.exit(1);
}

probe();
