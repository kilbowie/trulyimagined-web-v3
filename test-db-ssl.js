// Quick database connection test with SSL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    'postgresql://trimg_admin:ThundercatsBatman88*@trimg-db-v3.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com:5432/trulyimagined_v3',
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testConnection() {
  try {
    console.log('Testing database connection with SSL...');
    const result = await pool.query('SELECT NOW(), current_database()');
    console.log('✅ Connection successful!');
    console.log('Current time:', result.rows[0].now);
    console.log('Database:', result.rows[0].current_database);

    // Test user_profiles table
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as count 
      FROM user_profiles
    `);
    console.log('✅ user_profiles table accessible');
    console.log('Current profiles:', tableCheck.rows[0].count);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
