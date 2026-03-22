#!/usr/bin/env node

/**
 * Database Migration Runner
 * Applies SQL migrations to PostgreSQL database
 */

import { DatabaseClient } from './client';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  console.log('[MIGRATION] Starting database migrations...\n');

  const db = DatabaseClient.getInstance();
  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.error(`[MIGRATION] Migrations directory not found: ${migrationsDir}`);
      process.exit(1);
    }

    // Get all .sql files
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[MIGRATION] No migration files found.');
      process.exit(0);
    }

    console.log(`[MIGRATION] Found ${files.length} migration file(s):\n`);

    // Run each migration
    for (const file of files) {
      console.log(`[MIGRATION] Running: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        await db.query(sql);
        console.log(`[MIGRATION] ✓ ${file} completed successfully\n`);
      } catch (error: any) {
        console.error(`[MIGRATION] ✗ ${file} failed:`);
        console.error(error.message);
        console.error('\nStopping migrations due to error.');
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
