/**
 * Run migration 010: Link Feedback to Support Tickets
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { Pool } = require('pg');
const { URL } = require('url');
const fs = require('fs');

// Parse DATABASE_URL and remove sslmode parameter
let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('?sslmode=')) {
  connectionString = connectionString.replace(/\?sslmode=\w+/, '');
}

// Parse the connection string
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
    console.log('🔄 Running migration 010: Link Feedback to Support Tickets...\n');

    // Read migration SQL
    const sql = fs.readFileSync('infra/database/migrations/010_feedback_support_linkage.sql', 'utf8');

    // Execute migration
    await client.query(sql);

    console.log('✅ Migration 010 completed successfully!');
    console.log('   - Added feedback_id column to support_tickets table');
    console.log('   - Created index on feedback_id column');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
