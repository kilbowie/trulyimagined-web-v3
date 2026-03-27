/**
 * Check Database State for User Profiles
 * Verifies:
 * 1. Database connection to trimg-db-001
 * 2. User profiles exist for adamrossgreene@gmail.com (Actor) and adam@kilbowieconsulting.com (Admin)
 * 3. Schema integrity
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { Pool } = require('pg');
const { URL } = require('url');

// Parse DATABASE_URL and remove sslmode parameter
let connectionString = process.env.DATABASE_URL;
if (connectionString.includes('?sslmode=')) {
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

async function checkDatabaseState() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking Database State on trimg-db-001...\n');

    // 1. Check database connection
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database_name,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as postgres_version
    `);

    console.log('✅ Database Connection:');
    console.log(`   Database: ${dbInfo.rows[0].database_name}`);
    console.log(`   Server: ${dbInfo.rows[0].server_ip}:${dbInfo.rows[0].server_port}`);
    console.log(`   Version: ${dbInfo.rows[0].postgres_version.split(',')[0]}\n`);

    // 2. Check user_profiles table exists and structure
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles'
      ) as table_exists
    `);

    if (!tableCheck.rows[0].table_exists) {
      console.log('❌ user_profiles table does NOT exist!');
      console.log('   Run migrations: infra/database/migrations/002_user_profiles.sql\n');
      return;
    }

    console.log('✅ user_profiles table exists\n');

    // 3. Check for specific user profiles
    console.log('👤 Checking User Profiles:\n');

    // Check adamrossgreene@gmail.com
    const adamRoss = await client.query(`
      SELECT id, auth0_user_id, email, username, professional_name, role, profile_completed, created_at
      FROM user_profiles
      WHERE email = 'adamrossgreene@gmail.com'
      ORDER BY created_at DESC
    `);

    console.log('📧 adamrossgreene@gmail.com:');
    if (adamRoss.rows.length === 0) {
      console.log('   ❌ NO PROFILE FOUND - This is the problem!');
      console.log('   User needs to be created in database\n');
    } else {
      adamRoss.rows.forEach((profile, idx) => {
        console.log(`   ${idx + 1}. Profile ID: ${profile.id}`);
        console.log(`      Auth0 User ID: ${profile.auth0_user_id}`);
        console.log(`      Username: ${profile.username || '(not set)'}`);
        console.log(`      Professional Name: ${profile.professional_name || '(not set)'}`);
        console.log(`      Role: ${profile.role}`);
        console.log(`      Profile Completed: ${profile.profile_completed ? '✅ YES' : '❌ NO'}`);
        console.log(`      Created: ${profile.created_at}`);
        if (idx < adamRoss.rows.length - 1) console.log('');
      });
      console.log('');
    }

    // Check adam@kilbowieconsulting.com
    const adamKilbowie = await client.query(`
      SELECT id, auth0_user_id, email, username, professional_name, role, profile_completed, created_at
      FROM user_profiles
      WHERE email = 'adam@kilbowieconsulting.com'
      ORDER BY created_at DESC
    `);

    console.log('📧 adam@kilbowieconsulting.com:');
    if (adamKilbowie.rows.length === 0) {
      console.log('   ❌ NO PROFILE FOUND');
      console.log('   Admin user needs to be created\n');
    } else {
      adamKilbowie.rows.forEach((profile, idx) => {
        console.log(`   ${idx + 1}. Profile ID: ${profile.id}`);
        console.log(`      Auth0 User ID: ${profile.auth0_user_id}`);
        console.log(`      Username: ${profile.username || '(not set)'}`);
        console.log(`      Professional Name: ${profile.professional_name || '(not set)'}`);
        console.log(`      Role: ${profile.role}`);
        console.log(`      Profile Completed: ${profile.profile_completed ? '✅ YES' : '❌ NO'}`);
        console.log(`      Created: ${profile.created_at}`);
        if (idx < adamKilbowie.rows.length - 1) console.log('');
      });
      console.log('');
    }

    // 4. Check all profiles
    const allProfiles = await client.query(`
      SELECT email, role, auth0_user_id, profile_completed
      FROM user_profiles
      ORDER BY created_at DESC
    `);

    console.log(`📊 Total User Profiles in Database: ${allProfiles.rows.length}\n`);
    if (allProfiles.rows.length > 0) {
      console.log('All Profiles:');
      allProfiles.rows.forEach((profile, idx) => {
        console.log(
          `   ${idx + 1}. ${profile.email} - ${profile.role} (${profile.auth0_user_id.substring(0, 20)}...)`
        );
      });
      console.log('');
    }

    // 5. Check actors table
    const actorsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'actors'
      ) as table_exists
    `);

    if (actorsCheck.rows[0].table_exists) {
      const actors = await client.query(`
        SELECT COUNT(*) as actor_count FROM actors
      `);
      console.log(`✅ actors table exists with ${actors.rows[0].actor_count} records\n`);
    } else {
      console.log('⚠️  actors table does not exist\n');
    }

    // 6. Summary and recommendations
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SUMMARY & RECOMMENDATIONS:\n');

    if (adamRoss.rows.length === 0) {
      console.log('🔧 ISSUE: adamrossgreene@gmail.com has NO profile in database');
      console.log('   This explains why login redirects to /select-role');
      console.log('   Recommendation: Check Auth0 for correct user ID and create profile\n');
    } else if (adamRoss.rows.length > 1) {
      console.log('⚠️  WARNING: Multiple profiles found for adamrossgreene@gmail.com');
      console.log('   This can cause login issues');
      console.log('   Recommendation: Consolidate to single profile\n');
    } else {
      console.log('✅ adamrossgreene@gmail.com profile exists');
    }

    if (adamKilbowie.rows.length === 0) {
      console.log('🔧 TODO: Create admin profile for adam@kilbowieconsulting.com\n');
    } else {
      console.log('✅ adam@kilbowieconsulting.com profile exists');
    }
  } catch (error) {
    console.error('❌ Database Error:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabaseState();
