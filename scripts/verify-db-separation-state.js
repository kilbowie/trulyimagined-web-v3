#!/usr/bin/env node

const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const repoRoot = process.cwd();

dotenv.config({ path: path.join(repoRoot, 'apps', 'web', '.env.local') });
dotenv.config({ path: path.join(repoRoot, '.env.local') });

function normalizeConnectionString(connectionString) {
  return connectionString.replace('postgresql://', 'postgres://').replace(/\?sslmode=\w+/, '');
}

function fail(message) {
  throw new Error(`[verify-db-separation] ${message}`);
}

async function withClient(connectionString, label, fn) {
  const client = new Client({
    connectionString: normalizeConnectionString(connectionString),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`[verify-db-separation] connected: ${label}`);
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function assertTablesExist(client, schema, tables, label) {
  const { rows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1`,
    [schema]
  );
  const found = new Set(rows.map((r) => r.table_name));
  const missing = tables.filter((t) => !found.has(t));
  if (missing.length > 0) {
    fail(`${label} missing required tables in schema ${schema}: ${missing.join(', ')}`);
  }
}

async function assertTenantColumns(client, tableToColumn, label) {
  for (const [tableName, columnName] of Object.entries(tableToColumn)) {
    const { rows } = await client.query(
      `SELECT data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [tableName, columnName]
    );

    if (rows.length === 0) {
      fail(`${label} missing ${columnName} column on public.${tableName}`);
    }

    const row = rows[0];
    if (row.is_nullable !== 'NO') {
      fail(`${label} column public.${tableName}.${columnName} must be NOT NULL`);
    }
  }
}

async function assertIndexesExist(client, indexes, label) {
  const { rows } = await client.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`
  );
  const found = new Set(rows.map((r) => r.indexname));
  const missing = indexes.filter((idx) => !found.has(idx));
  if (missing.length > 0) {
    fail(`${label} missing required indexes: ${missing.join(', ')}`);
  }
}

async function assertNoForbiddenFks(client) {
  const forbiddenColumns = [
    ['actor_media', 'actor_id'],
    ['representation_requests', 'actor_id'],
    ['actor_agent_relationships', 'actor_id'],
    ['representation_terminations', 'actor_id'],
    ['agent_invitation_codes', 'used_by_actor_id'],
  ];

  for (const [tableName, columnName] of forbiddenColumns) {
    const { rows } = await client.query(
      `SELECT tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'
         AND tc.table_name = $1
         AND kcu.column_name = $2`,
      [tableName, columnName]
    );

    if (rows.length > 0) {
      fail(
        `forbidden FK still present on public.${tableName}.${columnName} (${rows[0].constraint_name})`
      );
    }
  }
}

async function assertHdicrRefSchema(client) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'hdicr_ref'`
  );
  if (rowCount !== 1) {
    fail('TI database missing hdicr_ref schema');
  }

  const requiredTables = ['user_profiles', 'actors', 'licenses', 'consent_ledger_active'];
  await assertTablesExist(client, 'hdicr_ref', requiredTables, 'TI');
}

async function assertOutboxExists(client) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_events'`
  );
  if (rowCount !== 1) {
    fail('HDICR database missing public.sync_events outbox table');
  }
}

async function main() {
  const hdicrUrl = process.env.HDICR_DATABASE_URL;
  const tiUrl = process.env.TI_DATABASE_URL;

  if (!hdicrUrl) {
    fail('HDICR_DATABASE_URL is not set');
  }
  if (!tiUrl) {
    fail('TI_DATABASE_URL is not set');
  }

  await withClient(hdicrUrl, 'HDICR', async (client) => {
    await assertTablesExist(
      client,
      'public',
      [
        'user_profiles',
        'actors',
        'identity_links',
        'verifiable_credentials',
        'consent_ledger',
        'licenses',
        'manual_verification_sessions',
        'sync_events',
      ],
      'HDICR'
    );

    await assertTenantColumns(
      client,
      {
        user_profiles: 'tenant_id',
        consent_ledger: 'tenant_id',
        api_clients: 'tenant_id',
        licenses: 'tenant_id',
        license_usage_log: 'tenant_id',
        bitstring_status_lists: 'tenant_id',
        credential_status_entries: 'tenant_id',
        manual_verification_sessions: 'tenant_id',
      },
      'HDICR'
    );

    await assertIndexesExist(
      client,
      [
        'idx_user_profiles_tenant_id',
        'idx_consent_ledger_tenant_actor_version',
        'idx_api_clients_tenant_status',
        'idx_licenses_tenant_actor_status',
        'idx_license_usage_log_tenant_actor_created_at',
        'idx_bitstring_status_lists_tenant_purpose',
        'idx_credential_status_entries_tenant_credential',
      ],
      'HDICR'
    );

    await assertOutboxExists(client);
    console.log('[verify-db-separation] HDICR checks passed');
  });

  await withClient(tiUrl, 'TI', async (client) => {
    await assertTablesExist(
      client,
      'public',
      [
        'actor_media',
        'support_tickets',
        'support_ticket_messages',
        'user_feedback',
        'agents',
        'representation_requests',
        'actor_agent_relationships',
        'agency_team_members',
        'representation_terminations',
        'agent_invitation_codes',
      ],
      'TI'
    );

    await assertTenantColumns(
      client,
      {
        actor_media: 'tenant_id',
        support_tickets: 'tenant_id',
        support_ticket_messages: 'tenant_id',
        user_feedback: 'tenant_id',
        agents: 'tenant_id',
        representation_requests: 'tenant_id',
        actor_agent_relationships: 'tenant_id',
        agency_team_members: 'tenant_id',
        representation_terminations: 'tenant_id',
        agent_invitation_codes: 'tenant_id',
      },
      'TI'
    );

    await assertIndexesExist(
      client,
      [
        'idx_actor_media_tenant_actor_type',
        'idx_support_tickets_tenant_status_created_at',
        'idx_agents_tenant_auth0_user_id',
        'idx_representation_requests_tenant_actor_status',
        'idx_agent_invitation_codes_tenant_agent',
      ],
      'TI'
    );

    await assertNoForbiddenFks(client);
    await assertHdicrRefSchema(client);
    console.log('[verify-db-separation] TI checks passed');
  });

  console.log('[verify-db-separation] all checks passed');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
