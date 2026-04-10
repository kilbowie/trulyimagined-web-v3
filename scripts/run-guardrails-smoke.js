const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), 'apps', 'web', '.env.local') });

function normalizeConnectionString(connectionString) {
  return connectionString.replace('postgresql://', 'postgres://').replace(/\?sslmode=\w+/, '');
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set (expected from apps/web/.env.local).');
  }

  const client = new Client({
    connectionString: normalizeConnectionString(databaseUrl),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const files = [
    '020_guardrails_foundation.sql',
    '021_guardrails_immutability_and_audit.sql',
    '022_guardrails_data_flow_contracts.sql',
  ];

  for (const file of files) {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'infra', 'database', 'migrations', file),
      'utf8'
    );
    console.log(`[TARGETED MIGRATION] Applying ${file}`);
    await client.query(sql);
    console.log(`[TARGETED MIGRATION] Applied ${file}`);
  }

  const schemaResult = await client.query(
    "SELECT nspname AS schema_name FROM pg_namespace WHERE nspname IN ('hdicr','hdicr_auth','ti') ORDER BY nspname"
  );
  console.log('[SMOKE] schemas:', schemaResult.rows.map((row) => row.schema_name).join(','));

  const viewResult = await client.query(
    `SELECT table_schema, table_name
     FROM information_schema.views
     WHERE (table_schema = 'hdicr' AND table_name IN ('v_actors_for_ti', 'v_active_consent_for_ti', 'v_actor_verification_for_ti'))
        OR (table_schema = 'public' AND table_name IN ('v_hdicr_audit_trail', 'v_ti_audit_trail', 'v_cross_plane_access', 'v_guardrails_blocked_mutations'))
     ORDER BY table_schema, table_name`
  );
  console.log('[SMOKE] view_count:', viewResult.rowCount);

  const triggerResult = await client.query(
    "SELECT tgname FROM pg_trigger WHERE tgname = 'trg_guardrails_consent_ledger_immutable'"
  );
  console.log('[SMOKE] consent_trigger:', triggerResult.rowCount === 1 ? 'present' : 'missing');

  // Functional smoke: guardrails should block UPDATE against consent_ledger.
  const consentRowResult = await client.query('SELECT id FROM public.consent_ledger LIMIT 1');
  if (consentRowResult.rowCount > 0) {
    const rowId = consentRowResult.rows[0].id;
    try {
      await client.query('BEGIN');
      await client.query('UPDATE public.consent_ledger SET status = status WHERE id = $1', [rowId]);
      await client.query('ROLLBACK');
      console.log('[SMOKE] immutability_check: FAILED (UPDATE unexpectedly succeeded)');
    } catch (error) {
      await client.query('ROLLBACK');
      console.log('[SMOKE] immutability_check: PASSED (UPDATE blocked)');
    }
  } else {
    console.log('[SMOKE] immutability_check: SKIPPED (no consent_ledger rows found)');
  }

  await client.end();
  console.log('[TARGETED MIGRATION] COMPLETE');
}

run().catch((error) => {
  console.error('[TARGETED MIGRATION] FAILED', error);
  process.exit(1);
});
