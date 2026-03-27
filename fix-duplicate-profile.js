/**
 * Fix Duplicate User Profile Issue
 *
 * Problem: adamrossgreene@gmail.com has TWO profiles due to different login methods:
 * 1. Auth0 Database (email/password): auth0|69c0a8726e8cd2f46877d134 → Actor
 * 2. Google OAuth: google-oauth2|102864749045087165048 → Agent
 *
 * This causes 500 errors on login because the system tries to create a new profile
 * but email/username constraints are violated.
 *
 * Solution: Delete the duplicate profile and use consistent login method.
 */

const { Client } = require('pg');
const { URL } = require('url');

// Database connection (from .env.local)
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://trimg_admin:%5D0W%26%21%3DUewTBq-eo05%2B8pd5%3D%23N3eav%251t@trimg-db-001.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com:5432/trulyimagined_v3?sslmode=require';

async function main() {
  // Parse connection string to remove sslmode parameter
  // Then add our own SSL config that accepts AWS RDS certificates
  const dbUrl = new URL(connectionString.replace('postgresql://', 'postgres://'));

  const client = new Client({
    host: dbUrl.hostname,
    port: dbUrl.port || 5432,
    database: dbUrl.pathname.split('/')[1],
    user: dbUrl.username,
    password: decodeURIComponent(dbUrl.password),
    ssl: {
      rejectUnauthorized: false, // Accept AWS RDS self-signed certs
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Show current profiles
    console.log('📋 Current profiles for adamrossgreene@gmail.com:\n');
    const profiles = await client.query(`
      SELECT 
        id,
        auth0_user_id,
        email,
        role,
        username,
        professional_name,
        profile_completed,
        created_at
      FROM user_profiles
      WHERE email = 'adamrossgreene@gmail.com'
      ORDER BY created_at ASC
    `);

    profiles.rows.forEach((profile, index) => {
      console.log(`Profile ${index + 1}:`);
      console.log(`  ID: ${profile.id}`);
      console.log(`  Auth0 User ID: ${profile.auth0_user_id}`);
      console.log(`  Role: ${profile.role}`);
      console.log(`  Username: ${profile.username}`);
      console.log(`  Professional Name: ${profile.professional_name}`);
      console.log(`  Created: ${profile.created_at}`);
      console.log('');
    });

    if (profiles.rows.length !== 2) {
      console.log('❌ Expected 2 profiles, but found', profiles.rows.length);
      return;
    }

    // Identify which profile to keep and which to delete
    const actorProfile = profiles.rows.find((p) => p.role === 'Actor');
    const agentProfile = profiles.rows.find((p) => p.role === 'Agent');

    console.log('🎯 Recommended Action: Keep Actor profile, delete Agent profile\n');
    console.log('Actor Profile (KEEP):');
    console.log(`  Auth0 ID: ${actorProfile.auth0_user_id}`);
    console.log(`  Username: ${actorProfile.username}`);
    console.log(`  Login Method: Auth0 Database (Email/Password)`);
    console.log('');
    console.log('Agent Profile (DELETE):');
    console.log(`  Auth0 ID: ${agentProfile.auth0_user_id}`);
    console.log(`  Username: ${agentProfile.username}`);
    console.log(`  Login Method: Google OAuth ("Continue with Google")`);
    console.log('');

    // Check if Agent profile has any dependencies
    console.log('🔍 Checking for dependencies...\n');

    const dependencies = {
      identity_links: await client.query(
        'SELECT COUNT(*) FROM identity_links WHERE user_profile_id = $1',
        [agentProfile.id]
      ),
      verifiable_credentials: await client.query(
        'SELECT COUNT(*) FROM verifiable_credentials WHERE user_profile_id = $1',
        [agentProfile.id]
      ),
      consent_ledger: await client.query(
        'SELECT COUNT(*) FROM consent_ledger WHERE actor_id = $1',
        [agentProfile.id]
      ),
    };

    const hasDependencies = Object.values(dependencies).some(
      (result) => parseInt(result.rows[0].count) > 0
    );

    if (hasDependencies) {
      console.log('⚠️  Agent profile has dependencies:');
      for (const [table, result] of Object.entries(dependencies)) {
        const count = parseInt(result.rows[0].count);
        if (count > 0) {
          console.log(`  - ${table}: ${count} record(s)`);
        }
      }
      console.log('\n❌ Cannot safely delete. Manual intervention required.');
      console.log('   Contact database administrator to merge profiles.');
      return;
    }

    console.log('✅ Agent profile has no dependencies. Safe to delete.\n');

    // Confirm deletion
    console.log('⚠️  WARNING: This will DELETE the Agent profile permanently!\n');
    console.log('To proceed, run this script with: node fix-duplicate-profile.js --confirm\n');

    if (process.argv.includes('--confirm')) {
      console.log('🗑️  Deleting Agent profile...\n');

      // Delete the duplicate profile
      const deleteResult = await client.query(
        'DELETE FROM user_profiles WHERE id = $1 RETURNING *',
        [agentProfile.id]
      );

      if (deleteResult.rowCount === 1) {
        console.log('✅ Successfully deleted Agent profile');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('  1. Clear your browser cookies/session');
        console.log('  2. Log out of Auth0');
        console.log('  3. Log back in using Email/Password (NOT Google)');
        console.log('  4. You should now see the Actor dashboard');
        console.log('');
        console.log('⚠️  IMPORTANT: Always use Email/Password login for adamrossgreene@gmail.com');
        console.log('   Do NOT use "Continue with Google" to avoid creating duplicates again.');
      } else {
        console.log('❌ Delete failed');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
