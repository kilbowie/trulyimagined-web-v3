#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.join(process.cwd(), 'apps', 'web', '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const DEFAULT_BATCH_SIZE = parseInt(process.env.HDICR_SYNC_BATCH_SIZE || '100', 10);
const DEFAULT_POLL_MS = parseInt(process.env.HDICR_SYNC_POLL_MS || '3000', 10);

function normalizeConnectionString(connectionString) {
  return connectionString.replace('postgresql://', 'postgres://').replace(/\?sslmode=\w+/, '');
}

function toJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function asTimestamp(value) {
  return value || new Date().toISOString();
}

function inferDeletedAt(eventType, payload) {
  if (eventType === 'deleted') {
    return asTimestamp(payload.deleted_at || payload.updated_at || payload.created_at);
  }
  return payload.deleted_at || null;
}

async function createClient(connectionString, label) {
  const client = new Client({
    connectionString: normalizeConnectionString(connectionString),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log(`[sync-worker] connected: ${label}`);
  return client;
}

async function fetchPendingEvents(hdicrClient, batchSize) {
  const { rows } = await hdicrClient.query(
    `SELECT id, aggregate_type, aggregate_id, event_type, tenant_id, payload, source_version
     FROM public.sync_events
     WHERE processed_at IS NULL
     ORDER BY occurred_at ASC
     LIMIT $1`,
    [batchSize]
  );
  return rows;
}

async function markProcessed(hdicrClient, eventId) {
  await hdicrClient.query(
    `UPDATE public.sync_events
     SET processed_at = NOW(),
         last_error = NULL
     WHERE id = $1`,
    [eventId]
  );
}

async function markFailed(hdicrClient, eventId, errorMessage) {
  await hdicrClient.query(
    `UPDATE public.sync_events
     SET retry_count = retry_count + 1,
         last_error = LEFT($2, 4000)
     WHERE id = $1`,
    [eventId, errorMessage]
  );
}

async function upsertUserProfile(tiClient, event) {
  const payload = toJson(event.payload);
  const deletedAt = inferDeletedAt(event.event_type, payload);

  await tiClient.query(
    `INSERT INTO hdicr_ref.user_profiles (
       source_id,
       tenant_id,
       auth0_user_id,
       email,
       display_name,
       source_version,
       synced_at,
       deleted_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
     ON CONFLICT (source_id) DO UPDATE
     SET tenant_id = EXCLUDED.tenant_id,
         auth0_user_id = EXCLUDED.auth0_user_id,
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         source_version = EXCLUDED.source_version,
         synced_at = NOW(),
         deleted_at = EXCLUDED.deleted_at
     WHERE hdicr_ref.user_profiles.source_version <= EXCLUDED.source_version`,
    [
      event.aggregate_id,
      event.tenant_id,
      payload.auth0_user_id || '',
      payload.email || null,
      payload.name || payload.display_name || null,
      event.source_version,
      deletedAt,
    ]
  );
}

async function upsertActor(tiClient, event) {
  const payload = toJson(event.payload);
  const deletedAt = inferDeletedAt(event.event_type, payload);

  await tiClient.query(
    `INSERT INTO hdicr_ref.actors (
       source_id,
       tenant_id,
       user_profile_id,
       auth0_user_id,
       registry_id,
       display_name,
       verification_status,
       source_version,
       synced_at,
       deleted_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
     ON CONFLICT (source_id) DO UPDATE
     SET tenant_id = EXCLUDED.tenant_id,
         user_profile_id = EXCLUDED.user_profile_id,
         auth0_user_id = EXCLUDED.auth0_user_id,
         registry_id = EXCLUDED.registry_id,
         display_name = EXCLUDED.display_name,
         verification_status = EXCLUDED.verification_status,
         source_version = EXCLUDED.source_version,
         synced_at = NOW(),
         deleted_at = EXCLUDED.deleted_at
     WHERE hdicr_ref.actors.source_version <= EXCLUDED.source_version`,
    [
      event.aggregate_id,
      event.tenant_id,
      payload.user_profile_id || null,
      payload.auth0_user_id || '',
      payload.registry_id || null,
      payload.name || payload.display_name || null,
      payload.verification_status || null,
      event.source_version,
      deletedAt,
    ]
  );
}

async function upsertLicense(tiClient, event) {
  const payload = toJson(event.payload);
  const deletedAt = inferDeletedAt(event.event_type, payload);

  await tiClient.query(
    `INSERT INTO hdicr_ref.licenses (
       source_id,
       tenant_id,
       actor_id,
       status,
       license_type,
       expires_at,
       source_version,
       synced_at,
       deleted_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
     ON CONFLICT (source_id) DO UPDATE
     SET tenant_id = EXCLUDED.tenant_id,
         actor_id = EXCLUDED.actor_id,
         status = EXCLUDED.status,
         license_type = EXCLUDED.license_type,
         expires_at = EXCLUDED.expires_at,
         source_version = EXCLUDED.source_version,
         synced_at = NOW(),
         deleted_at = EXCLUDED.deleted_at
     WHERE hdicr_ref.licenses.source_version <= EXCLUDED.source_version`,
    [
      event.aggregate_id,
      event.tenant_id,
      payload.actor_id,
      payload.status || null,
      payload.license_type || null,
      payload.expires_at || null,
      event.source_version,
      deletedAt,
    ]
  );
}

async function upsertConsentLedgerActive(tiClient, event) {
  const payload = toJson(event.payload);
  const isWithdrawn = payload.status === 'withdrawn' || event.event_type === 'deleted';

  await tiClient.query(
    `INSERT INTO hdicr_ref.consent_ledger_active (
       source_id,
       tenant_id,
       actor_id,
       consent_type,
       version,
       granted_at,
       source_version,
       synced_at,
       deleted_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
     ON CONFLICT (source_id) DO UPDATE
     SET tenant_id = EXCLUDED.tenant_id,
         actor_id = EXCLUDED.actor_id,
         consent_type = EXCLUDED.consent_type,
         version = EXCLUDED.version,
         granted_at = EXCLUDED.granted_at,
         source_version = EXCLUDED.source_version,
         synced_at = NOW(),
         deleted_at = EXCLUDED.deleted_at
     WHERE hdicr_ref.consent_ledger_active.source_version <= EXCLUDED.source_version`,
    [
      event.aggregate_id,
      event.tenant_id,
      payload.actor_id,
      payload.consent_type || 'unknown',
      payload.version || 1,
      payload.created_at || null,
      event.source_version,
      isWithdrawn ? asTimestamp(payload.updated_at || payload.created_at) : null,
    ]
  );
}

async function upsertIdentityLinkProjection(tiClient, event) {
  // Identity links currently influence TI only indirectly; placeholder for future projections.
  // Keep operation as no-op but successful for event progression.
  void tiClient;
  void event;
}

async function applyEventToTi(tiClient, event) {
  switch (event.aggregate_type) {
    case 'user_profiles':
      await upsertUserProfile(tiClient, event);
      return;
    case 'actors':
      await upsertActor(tiClient, event);
      return;
    case 'licenses':
      await upsertLicense(tiClient, event);
      return;
    case 'consent_ledger':
      await upsertConsentLedgerActive(tiClient, event);
      return;
    case 'identity_links':
      await upsertIdentityLinkProjection(tiClient, event);
      return;
    default:
      // Unknown aggregate types are marked processed to avoid worker deadlock.
      console.warn(
        `[sync-worker] skipping unsupported aggregate_type=${event.aggregate_type} event_id=${event.id}`
      );
  }
}

async function processBatch(hdicrClient, tiClient, batchSize) {
  const events = await fetchPendingEvents(hdicrClient, batchSize);
  if (events.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await tiClient.query('BEGIN');
      await applyEventToTi(tiClient, event);
      await tiClient.query('COMMIT');

      await markProcessed(hdicrClient, event.id);
      processed += 1;
    } catch (error) {
      await tiClient.query('ROLLBACK');
      const message = error && error.message ? error.message : String(error);
      await markFailed(hdicrClient, event.id, message);
      failed += 1;
      console.error(
        `[sync-worker] failed event_id=${event.id} aggregate_type=${event.aggregate_type}: ${message}`
      );
    }
  }

  return { processed, failed };
}

async function runOnce(batchSize) {
  const hdicrUrl = process.env.HDICR_DATABASE_URL;
  const tiUrl = process.env.TI_DATABASE_URL;

  if (!hdicrUrl) {
    throw new Error('HDICR_DATABASE_URL is not set');
  }
  if (!tiUrl) {
    throw new Error('TI_DATABASE_URL is not set');
  }

  const hdicrClient = await createClient(hdicrUrl, 'HDICR');
  const tiClient = await createClient(tiUrl, 'TI');

  try {
    const result = await processBatch(hdicrClient, tiClient, batchSize);
    console.log(
      `[sync-worker] batch complete: processed=${result.processed} failed=${result.failed}`
    );
    return result;
  } finally {
    await hdicrClient.end();
    await tiClient.end();
  }
}

async function runWatch(batchSize, pollMs) {
  const hdicrUrl = process.env.HDICR_DATABASE_URL;
  const tiUrl = process.env.TI_DATABASE_URL;

  if (!hdicrUrl) {
    throw new Error('HDICR_DATABASE_URL is not set');
  }
  if (!tiUrl) {
    throw new Error('TI_DATABASE_URL is not set');
  }

  const hdicrClient = await createClient(hdicrUrl, 'HDICR');
  const tiClient = await createClient(tiUrl, 'TI');

  const shutdown = async () => {
    console.log('[sync-worker] shutting down');
    await hdicrClient.end();
    await tiClient.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`[sync-worker] watch mode started (batchSize=${batchSize}, pollMs=${pollMs})`);

  while (true) {
    const { processed, failed } = await processBatch(hdicrClient, tiClient, batchSize);
    if (processed > 0 || failed > 0) {
      console.log(`[sync-worker] cycle: processed=${processed} failed=${failed}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const watch = args.includes('--watch');
  const batchArg = args.find((arg) => arg.startsWith('--batch='));
  const pollArg = args.find((arg) => arg.startsWith('--poll-ms='));

  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : DEFAULT_BATCH_SIZE;
  const pollMs = pollArg ? parseInt(pollArg.split('=')[1], 10) : DEFAULT_POLL_MS;

  if (Number.isNaN(batchSize) || batchSize <= 0) {
    throw new Error('Invalid --batch value; must be a positive integer');
  }
  if (Number.isNaN(pollMs) || pollMs <= 0) {
    throw new Error('Invalid --poll-ms value; must be a positive integer');
  }

  if (watch) {
    await runWatch(batchSize, pollMs);
    return;
  }

  await runOnce(batchSize);
}

main().catch((error) => {
  console.error(`[sync-worker] fatal: ${error.message || error}`);
  process.exit(1);
});
