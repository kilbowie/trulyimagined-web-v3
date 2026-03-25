#!/usr/bin/env node
/**
 * Run database migration: 004_actor_media.sql
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('🔍 Running migration: 004_actor_media.sql');

    // Read migration file
    const migrationPath = path.join(__dirname, '../infra/database/migrations/004_actor_media.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Run migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Created table: actor_media');
    console.log('   - id, actor_id, media_type, file_name, s3_key, s3_url');
    console.log('   - title, photo_credit, description');
    console.log('   - is_primary, display_order');
    console.log('   - Indexes and triggers created');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
