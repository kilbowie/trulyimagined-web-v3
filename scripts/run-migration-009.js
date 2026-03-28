/**
 * Run Database Migration 009 - User Feedback
 * 
 * This script runs the user feedback migration.
 */

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../infra/database/migrations/009_user_feedback.sql');
    console.log(`📖 Reading migration: ${migrationPath}`);
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log('🚀 Running migration 009_user_feedback.sql...\n');
    await client.query(sql);

    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    console.log('\n📊 Verifying tables...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_feedback')
      ORDER BY table_name;
    `);

    console.log('Tables created:');
    tables.rows.forEach((row) => {
      console.log(`  ✓ ${row.table_name}`);
    });

    // Verify view
    const views = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_feedback_with_details')
      ORDER BY table_name;
    `);

    console.log('\nViews created:');
    views.rows.forEach((row) => {
      console.log(`  ✓ ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run if executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✨ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
