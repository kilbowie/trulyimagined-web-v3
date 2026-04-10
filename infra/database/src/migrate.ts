#!/usr/bin/env node

/**
 * Database Migration Runner
 * Applies SQL migrations to PostgreSQL database, tracking applied migrations
 * in a schema_migrations table so that re-runs are safe and idempotent.
 *
 * Usage:
 *   pnpm --filter @trulyimagined/database migrate
 *
 * First-time run against an already-initialised database (baseline):
 *   pnpm --filter @trulyimagined/database migrate -- --baseline=019
 *   This marks all migrations with a numeric prefix <= 019 as already applied
 *   without executing them, then runs any migrations > 019 normally.
 */

import { DatabaseClient } from './client';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const TRACKING_TABLE = 'schema_migrations';

/**
 * Parse --baseline=NNN from argv.
 * Returns the numeric string (zero-padded) or null if not supplied.
 */
function parseBaseline(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--baseline='));
  if (!arg) return null;
  return arg.split('=')[1].padStart(3, '0');
}

/** SHA-256 checksum of a file's contents, for drift detection. */
function checksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Extract the leading numeric prefix from a migration filename, e.g. "019" from "019_foo.sql". */
function migrationNumber(filename: string): string {
  return filename.split('_')[0].padStart(3, '0');
}

async function ensureTrackingTable(db: DatabaseClient): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) UNIQUE NOT NULL,
      checksum    VARCHAR(64),
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(db: DatabaseClient): Promise<Set<string>> {
  const { rows } = await db.query<{ filename: string }>(
    `SELECT filename FROM ${TRACKING_TABLE} ORDER BY filename`
  );
  return new Set(rows.map((r) => r.filename));
}

async function recordApplied(db: DatabaseClient, filename: string, sql: string): Promise<void> {
  await db.query(
    `INSERT INTO ${TRACKING_TABLE} (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING`,
    [filename, checksum(sql)]
  );
}

async function runMigrations() {
  console.log('[MIGRATION] Starting database migrations...\n');

  const db = DatabaseClient.getInstance();
  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    if (!fs.existsSync(migrationsDir)) {
      console.error(`[MIGRATION] Migrations directory not found: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[MIGRATION] No migration files found.');
      await db.close();
      process.exit(0);
    }

    // Bootstrap tracking table
    await ensureTrackingTable(db);

    const applied = await getApplied(db);

    // --baseline: seed tracking table without running those migrations
    const baseline = parseBaseline();
    if (baseline !== null) {
      console.log(`[MIGRATION] Baseline mode: marking migrations <= ${baseline} as applied\n`);
      for (const file of files) {
        if (migrationNumber(file) <= baseline && !applied.has(file)) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          await recordApplied(db, file, sql);
          console.log(`[MIGRATION] Baselined (skipped): ${file}`);
          applied.add(file);
        }
      }
      console.log('');
    }

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('[MIGRATION] Database is up to date. No pending migrations.');
      await db.close();
      process.exit(0);
    }

    console.log(`[MIGRATION] ${pending.length} pending migration(s):\n`);

    for (const file of pending) {
      console.log(`[MIGRATION] Running: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        await db.query(sql);
        await recordApplied(db, file, sql);
        console.log(`[MIGRATION] ✓ ${file} applied successfully\n`);
      } catch (error: any) {
        console.error(`[MIGRATION] ✗ ${file} failed:`);
        console.error(error.message);
        console.error('\nStopping migrations due to error. Already-completed migrations were recorded.');
        await db.close();
        process.exit(1);
      }
    }

    console.log('[MIGRATION] All migrations completed successfully!');
    await db.close();
    process.exit(0);
  } catch (error: any) {
    console.error('[MIGRATION] Fatal error:', error.message);
    await db.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
