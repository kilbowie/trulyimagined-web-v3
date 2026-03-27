/**
 * Test the actual database query that getUserRoles() runs
 *
 * This replicates exactly what the Next.js app does when checking roles
 */

const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
const auth0UserId = 'auth0|69c0a8726e8cd2f46877d134';

if (!connectionString) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  console.log('\nSet it with:');
  console.log(
    '$env:DATABASE_URL = "postgresql://trimg_admin:...@trimg-db-001.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com:5432/trulyimagined_v3?sslmode=require"'
  );
  process.exit(1);
}

async function testUserRoleQuery() {
  // Parse connection string manually to configure SSL (same as fix scripts)
  const dbUrl = new URL(connectionString.replace('postgresql://', 'postgres://'));
  const client = new Client({
    host: dbUrl.hostname,
    port: dbUrl.port || 5432,
    database: dbUrl.pathname.split('/')[1].split('?')[0],
    user: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // This is the EXACT query that getUserRoles() runs
    console.log('🔍 Testing getUserRoles() query...');
    console.log(`Query: SELECT role FROM user_profiles WHERE auth0_user_id = '${auth0UserId}'`);
    console.log('');

    const result = await client.query('SELECT role FROM user_profiles WHERE auth0_user_id = $1', [
      auth0UserId,
    ]);

    console.log('📊 Query Results:');
    console.log('─────────────────');
    console.log(`Rows returned: ${result.rows.length}`);

    if (result.rows.length > 0) {
      console.log('✅ ROLE FOUND!\n');
      result.rows.forEach((row, i) => {
        console.log(`Row ${i + 1}:`);
        console.log(`  role: ${row.role}`);
      });

      console.log('\n✅ DATABASE QUERY WORKS CORRECTLY');
      console.log('');
      console.log('🤔 If you still see role selection page, the issue is:');
      console.log('   1. Next.js app not connecting to database properly');
      console.log('   2. DATABASE_URL not set in apps/web/.env.local');
      console.log('   3. Database connection pooling issue');
      console.log('   4. Server needs to be restarted');
    } else {
      console.log('❌ NO ROLE FOUND\n');
      console.log('This is the problem! The query returns no results.');
      console.log('');
      console.log('Checking if profile exists...');

      // Check if profile exists at all
      const checkProfile = await client.query(
        'SELECT * FROM user_profiles WHERE auth0_user_id = $1',
        [auth0UserId]
      );

      if (checkProfile.rows.length === 0) {
        console.log('❌ NO PROFILE EXISTS in database');
        console.log('');
        console.log('The profile was deleted or auth0_user_id is wrong.');
        console.log('Run: node ./check-profile-state.js');
      } else {
        console.log('✅ Profile exists but has no role!');
        console.log('');
        console.log('Profile details:');
        console.log(JSON.stringify(checkProfile.rows[0], null, 2));
        console.log('');
        console.log('🔧 FIX: Update the role in database');
      }
    }

    // Also check all profiles for this email
    console.log('\n🔍 Checking all profiles for adamrossgreene@gmail.com...');
    const emailCheck = await client.query(
      'SELECT id, auth0_user_id, email, role, username FROM user_profiles WHERE email = $1',
      ['adamrossgreene@gmail.com']
    );

    console.log(`\nFound ${emailCheck.rows.length} profile(s):\n`);
    emailCheck.rows.forEach((row, i) => {
      console.log(`Profile ${i + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Auth0 ID: ${row.auth0_user_id}`);
      console.log(`  Email: ${row.email}`);
      console.log(`  Role: ${row.role}`);
      console.log(`  Username: ${row.username}`);
      console.log('');
    });

    await client.end();
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    console.error('Full error:', error);
    await client.end();
    process.exit(1);
  }
}

testUserRoleQuery();
