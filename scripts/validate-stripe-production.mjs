#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

const args = new Set(process.argv.slice(2));
const isLiveMode = args.has('--live');
const allowMissingEnv = args.has('--allow-missing-env');
const repoRoot = process.cwd();

const webEnvPath = path.join(repoRoot, 'apps', 'web', '.env.local');
const rootEnvPath = path.join(repoRoot, '.env.local');

if (fs.existsSync(webEnvPath)) {
  dotenv.config({ path: webEnvPath });
}
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: false });
}

const webhookUrl = process.env.WEBHOOK_URL ?? 'https://trulyimagined.com/api/webhooks/stripe';
const appBaseUrl = process.env.APP_BASE_URL || process.env.AUTH0_BASE_URL;

const priceEnvKeys = [
  'STRIPE_PRICE_ACTOR_PROFESSIONAL_MONTHLY',
  'STRIPE_PRICE_ACTOR_PROFESSIONAL_YEARLY',
  'STRIPE_PRICE_AGENCY_INDEPENDENT_MONTHLY',
  'STRIPE_PRICE_AGENCY_INDEPENDENT_YEARLY',
  'STRIPE_PRICE_AGENCY_BOUTIQUE_MONTHLY',
  'STRIPE_PRICE_AGENCY_BOUTIQUE_YEARLY',
  'STRIPE_PRICE_AGENCY_SME_MONTHLY',
  'STRIPE_PRICE_AGENCY_SME_YEARLY',
  'STRIPE_PRICE_AGENCY_SEAT_ADDON',
  'STRIPE_PRICE_STUDIO_INDIE_MONTHLY',
  'STRIPE_PRICE_STUDIO_INDIE_YEARLY',
  'STRIPE_PRICE_STUDIO_MIDMARKET_MONTHLY',
  'STRIPE_PRICE_STUDIO_MIDMARKET_YEARLY',
];

const requiredEnv = [
  'STRIPE_CONNECT_RETURN_URL',
  'STRIPE_CONNECT_REFRESH_URL',
  ...priceEnvKeys,
];

if (!appBaseUrl) {
  requiredEnv.push('APP_BASE_URL or AUTH0_BASE_URL');
}

if (isLiveMode) {
  requiredEnv.push('STRIPE_SECRET_KEY');
}

const results = {
  pass: [],
  warn: [],
  fail: [],
};

function logPass(message) {
  results.pass.push(message);
  console.log(`[stripe-prod-validation] PASS: ${message}`);
}

function logWarn(message) {
  results.warn.push(message);
  console.warn(`[stripe-prod-validation] WARN: ${message}`);
}

function logFail(message) {
  results.fail.push(message);
  console.error(`[stripe-prod-validation] FAIL: ${message}`);
}

function summarizeAndExit() {
  console.log('');
  console.log('[stripe-prod-validation] Summary');
  console.log(`  PASS: ${results.pass.length}`);
  console.log(`  WARN: ${results.warn.length}`);
  console.log(`  FAIL: ${results.fail.length}`);

  if (results.fail.length > 0) {
    process.exit(2);
  }
  if (results.warn.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

function getMissingEnvKeys() {
  return requiredEnv.filter((key) => {
    if (key === 'APP_BASE_URL or AUTH0_BASE_URL') {
      return !appBaseUrl;
    }
    const value = process.env[key];
    return !value || !String(value).trim();
  });
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const body = await response.text();
  return { response, body };
}

async function stripeRequest(method, pathName, bodyParams) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required for live mode');
  }

  const url = `https://api.stripe.com${pathName}`;
  const headers = {
    Authorization: `Bearer ${secretKey}`,
  };

  const init = { method, headers };

  if (bodyParams) {
    const encoded = new URLSearchParams(bodyParams);
    init.body = encoded;
    init.headers = {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  const { response, body } = await fetchText(url, init);
  let json = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = json?.error?.message || body || response.statusText;
    throw new Error(`${method} ${pathName} failed (${response.status}): ${message}`);
  }

  return json;
}

function calculatePlatformFee(dealValueCents) {
  if (dealValueCents <= 500_000) {
    return Math.floor((dealValueCents * 1750) / 10_000);
  }
  if (dealValueCents <= 5_000_000) {
    return Math.floor((dealValueCents * 1300) / 10_000);
  }
  if (dealValueCents <= 10_000_000) {
    return Math.floor((dealValueCents * 900) / 10_000);
  }
  return Math.floor((dealValueCents * 750) / 10_000);
}

async function checkWebhookEndpointLiveness() {
  try {
    const { response, body } = await fetchText(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'probe' }),
    });

    if (response.status === 400) {
      logPass(`webhook endpoint reachable and rejecting unsigned requests (${webhookUrl})`);
      return;
    }

    if (response.status === 401 || response.status === 403) {
      logFail(
        `webhook endpoint blocked by deployment protection (${response.status}); configure bypass secret and retry`
      );
      return;
    }

    logFail(`webhook endpoint unexpected status ${response.status}: ${body.slice(0, 180)}`);
  } catch (error) {
    logFail(`webhook endpoint probe failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runLiveStripeValidation() {
  const account = await stripeRequest('POST', '/v1/accounts', {
    type: 'express',
    country: 'GB',
    email: `stripe-validation+${Date.now()}@trulyimagined.test`,
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
  });
  logPass(`created Connect account (${account.id})`);

  const accountLink = await stripeRequest('POST', '/v1/account_links', {
    account: account.id,
    refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL,
    return_url: process.env.STRIPE_CONNECT_RETURN_URL,
    type: 'account_onboarding',
  });
  logPass(`generated Connect onboarding link for ${account.id}`);

  const dealValueCents = 10_000;
  const platformFeeCents = calculatePlatformFee(dealValueCents);
  const paymentIntent = await stripeRequest('POST', '/v1/payment_intents', {
    amount: String(dealValueCents),
    currency: 'gbp',
    'automatic_payment_methods[enabled]': 'true',
    application_fee_amount: String(platformFeeCents),
    'transfer_data[destination]': account.id,
    description: 'STRIPE-015 production validation payment intent',
    'metadata[app]': 'trulyimagined',
    'metadata[flow]': 'deal_payment_validation',
  });
  logPass(
    `created test deal payment intent (${paymentIntent.id}) with application fee ${platformFeeCents}`
  );

  const customer = await stripeRequest('POST', '/v1/customers', {
    email: `stripe-validation+${Date.now()}@trulyimagined.test`,
    name: 'STRIPE-015 Validation Customer',
  });
  logPass(`created test customer (${customer.id}) for checkout validation`);

  for (const key of priceEnvKeys) {
    const priceId = process.env[key];
    const session = await stripeRequest('POST', '/v1/checkout/sessions', {
      mode: 'subscription',
      customer: customer.id,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${appBaseUrl}/dashboard/account/billing?checkout=success`,
      cancel_url: `${appBaseUrl}/dashboard/account/billing?checkout=cancelled`,
      'metadata[app]': 'trulyimagined',
      'metadata[validation_key]': key,
    });
    logPass(`created checkout session for ${key} (${session.id})`);
  }

  const verificationSession = await stripeRequest('POST', '/v1/identity/verification_sessions', {
    type: 'document',
    return_url: `${appBaseUrl}/dashboard/verify-identity?session_id={VERIFICATION_SESSION_ID}`,
    'metadata[app]': 'trulyimagined',
    'metadata[validation_run]': String(Date.now()),
  });
  logPass(`created identity verification session (${verificationSession.id})`);

  if (process.env.TI_DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.TI_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    try {
      const query = await pool.query(
        `SELECT COUNT(*)::int AS recent_identity_events
         FROM stripe_events
         WHERE event_type LIKE 'identity.verification_session.%'
           AND received_at >= NOW() - INTERVAL '15 minutes'`
      );

      const count = query.rows[0]?.recent_identity_events ?? 0;
      if (count > 0) {
        logPass(`observed ${count} recent identity webhook event(s) in stripe_events`);
      } else {
        logWarn('no recent identity webhook events found in stripe_events; verify dashboard webhook subscriptions');
      }
    } finally {
      await pool.end();
    }
  } else {
    logWarn('TI_DATABASE_URL not set; skipping webhook delivery verification against stripe_events');
  }

  const hasHdicrEnv =
    process.env.HDICR_API_URL &&
    process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_M2M_CLIENT_ID &&
    process.env.AUTH0_M2M_CLIENT_SECRET &&
    process.env.AUTH0_M2M_AUDIENCE;

  if (!hasHdicrEnv) {
    logWarn('HDICR auth/client env vars missing; skipping verify-confirmed sync reachability check');
    return;
  }

  const tokenPayload = await fetch('https://' + process.env.AUTH0_DOMAIN + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: process.env.AUTH0_M2M_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });

  const tokenJson = await tokenPayload.json();
  if (!tokenPayload.ok || !tokenJson?.access_token) {
    throw new Error(`failed to acquire HDICR M2M token (${tokenPayload.status})`);
  }

  const syncProbe = await fetch(
    String(process.env.HDICR_API_URL).replace(/\/$/, '') + '/identity/verify-confirmed',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenJson.access_token}`,
        'X-Correlation-ID': `stripe-015-${Date.now()}`,
      },
      body: JSON.stringify({
        ti_user_id: crypto.randomUUID(),
        verification_session_id: verificationSession.id,
        verified_at: new Date().toISOString(),
        assurance_level: 'high',
      }),
    }
  );

  if (syncProbe.status >= 500) {
    const body = await syncProbe.text();
    throw new Error(`HDICR verify-confirmed probe failed (${syncProbe.status}): ${body.slice(0, 200)}`);
  }

  logPass(`HDICR verify-confirmed endpoint reachable (${syncProbe.status})`);
  logWarn(
    'verify-confirmed probe used synthetic ti_user_id; complete end-to-end sync validation with a real TI user in test tenant'
  );

  if (!accountLink?.url) {
    logFail('Connect onboarding URL generation did not return a usable URL');
  }
}

async function main() {
  console.log('[stripe-prod-validation] Mode:', isLiveMode ? 'live' : 'preflight');

  const missing = getMissingEnvKeys();
  if (missing.length > 0) {
    const message = `missing required env vars: ${missing.join(', ')}`;
    if (allowMissingEnv) {
      logWarn(message);
    } else {
      logFail(message);
    }
  } else {
    logPass(`required environment variables are present (${requiredEnv.length})`);
  }

  await checkWebhookEndpointLiveness();

  if (!isLiveMode) {
    logWarn('live Stripe validation steps are skipped in preflight mode (run with --live)');
    summarizeAndExit();
    return;
  }

  if (results.fail.length > 0 && !allowMissingEnv) {
    summarizeAndExit();
    return;
  }

  try {
    await runLiveStripeValidation();
  } catch (error) {
    logFail(error instanceof Error ? error.message : String(error));
  }

  summarizeAndExit();
}

main().catch((error) => {
  logFail(error instanceof Error ? error.message : String(error));
  summarizeAndExit();
});
