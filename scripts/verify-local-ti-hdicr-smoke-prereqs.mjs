#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const repoRoot = process.cwd();
const webEnvPath = path.join(repoRoot, 'apps', 'web', '.env.local');
const rootEnvPath = path.join(repoRoot, '.env.local');

if (fs.existsSync(webEnvPath)) {
  dotenv.config({ path: webEnvPath });
}
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: false });
}

const requiredEnv = [
  'HDICR_API_URL',
  'AUTH0_DOMAIN',
  'AUTH0_M2M_CLIENT_ID',
  'AUTH0_M2M_CLIENT_SECRET',
  'AUTH0_M2M_AUDIENCE',
];

function fail(message) {
  console.error(`[local-smoke-prereqs] ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`[local-smoke-prereqs] ${message}`);
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const bodyText = await res.text();
  let bodyJson = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = null;
  }
  return { res, bodyText, bodyJson };
}

async function main() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    fail(`missing required env vars: ${missing.join(', ')}`);
    return;
  }

  const hdicrBase = String(process.env.HDICR_API_URL).replace(/\/$/, '');
  const auth0Domain = String(process.env.AUTH0_DOMAIN);
  const audience = String(process.env.AUTH0_M2M_AUDIENCE);

  ok(`env vars present (${requiredEnv.length})`);

  const health = await fetch(`${hdicrBase}/health`).catch((error) => ({ error }));
  if (health && 'error' in health) {
    fail(`cannot reach ${hdicrBase}/health (${health.error.message})`);
    return;
  }

  if (!health.ok) {
    const body = await health.text();
    fail(`health check failed (${health.status}): ${body.slice(0, 300)}`);
    return;
  }

  ok(`health endpoint reachable (${hdicrBase}/health)`);

  const tokenResponse = await fetchJson(`https://${auth0Domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience,
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenResponse.res.ok || !tokenResponse.bodyJson?.access_token) {
    fail(
      `M2M token fetch failed (${tokenResponse.res.status}): ${tokenResponse.bodyText.slice(0, 300)}`
    );
    return;
  }

  const token = tokenResponse.bodyJson.access_token;
  ok('M2M token acquisition succeeded');

  const probePath = '/v1/identity/actors/exists?auth0UserId=local-smoke-check';
  const probe = await fetch(`${hdicrBase}${probePath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Correlation-ID': `local-smoke-${Date.now()}`,
    },
  }).catch((error) => ({ error }));

  if (probe && 'error' in probe) {
    fail(`protected endpoint probe failed (${probe.error.message})`);
    return;
  }

  if ([200, 400, 404].includes(probe.status)) {
    ok(`protected endpoint reachable (${probe.status})`);
    ok('local TI -> HDICR smoke prerequisites passed');
    return;
  }

  const probeBody = await probe.text();
  fail(`protected endpoint returned unexpected status ${probe.status}: ${probeBody.slice(0, 300)}`);
}

main().catch((error) => {
  fail(`unexpected error: ${error instanceof Error ? error.message : String(error)}`);
});
