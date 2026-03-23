#!/usr/bin/env node

/**
 * Run Migration 005: Verifiable Credentials
 * 
 * This script applies only migration 005, skipping earlier migrations
 * that have already been applied.
 */

import { DatabaseClient } from './client';
import fs from 'fs';
import path from 'path';

async function runMigration005() {
  console.log('[MIGRATION] Running migration 005: Verifiable Credentials...\n');

  const db = DatabaseClient.getInstance();
  const migrationPath = path.join(__dirname, '../migrations/005_verifiable_credentials.sql');

  try {
    // Check if migration file exists
    if (!fs.existsSync(migrationPath)) {
      console.error(`[MIGRATION] Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    // Read and execute migration
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await db.query(sql);
    
    console.log('[MIGRATION] ✓ Migration 005 completed successfully\n');
    process.exit(0);
  } catch (error: any) {
    console.error('[MIGRATION] ✗ Migration 005 failed:');
    console.error(error.message);
    process.exit(1);
  }
}

runMigration005();
