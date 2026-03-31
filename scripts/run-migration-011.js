/**
 * Run migration 011: Add IAM status flags to user_profiles
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { Pool } = require('pg');
const { URL } = require('url');
const fs = require('fs');

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

if (connectionString.includes('?sslmode=')) {
  connectionString = connectionString.replace(/\?sslmode=\w+/, '');
}

const dbUrl = new URL(connectionString.replace('postgresql://', 'postgres://'));

const pool = new Pool({
  host: dbUrl.hostname,
  port: dbUrl.port || 5432,
  database: dbUrl.pathname.split('/')[1],
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Running migration 011: Add IAM status flags to user_profiles...');

    const sql = fs.readFileSync(
      'infra/database/migrations/011_user_profile_status_flags.sql',
      'utf8'
    );

    await client.query(sql);

    console.log('Migration 011 completed successfully.');
    console.log(' - Added is_verified column to user_profiles');
    console.log(' - Added is_pro column to user_profiles');
    console.log(' - Added indexes for is_verified and is_pro');
  } catch (error) {
    console.error('Migration 011 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(() => {
  process.exit(1);
});
