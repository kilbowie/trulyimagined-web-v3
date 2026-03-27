/**
 * Fix Duplicate User Profile - Force Delete with Dependencies
 *
 * This version handles the case where the duplicate profile has dependencies
 * (identity_links, verifiable_credentials, etc.) and moves them to the primary profile.
 */

const { Client } = require('pg');
const { URL } = require('url');

// Database connection (from .env.local)
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://trimg_admin:%5D0W%26%21%3DUewTBq-eo05%2B8pd5%3D%23N3eav%251t@trimg-db-001.cb6wqc8y2yr8.eu-west-1.rds.amazonaws.com:5432/trulyimagined_v3?sslmode=require';

async function main() {
  // Parse connection string to remove sslmode parameter
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

    // Get both profiles
    const profiles = await client.query(`
      SELECT id, auth0_user_id, role, username, professional_name
      FROM user_profiles
      WHERE email = 'adamrossgreene@gmail.com'
      ORDER BY created_at ASC
    `);

    if (profiles.rows.length !== 2) {
      console.log('❌ Expected 2 profiles, found', profiles.rows.length);
      return;
    }

    const actorProfile = profiles.rows.find((p) => p.role === 'Actor');
    const agentProfile = profiles.rows.find((p) => p.role === 'Agent');

    console.log('🎯 Merging Agent profile into Actor profile\n');
    console.log('Actor Profile (PRIMARY - KEEP):');
    console.log(`  ID: ${actorProfile.id}`);
    console.log(`  Username: ${actorProfile.username}\n`);

    console.log('Agent Profile (DUPLICATE - DELETE):');
    console.log(`  ID: ${agentProfile.id}`);
    console.log(`  Username: ${agentProfile.username}\n`);

    // Check dependencies
    const identityLinks = await client.query(
      'SELECT id, provider, verification_level FROM identity_links WHERE user_profile_id = $1',
      [agentProfile.id]
    );

    const credentials = await client.query(
      'SELECT id FROM verifiable_credentials WHERE user_profile_id = $1',
      [agentProfile.id]
    );

    const consents = await client.query('SELECT id FROM consent_ledger WHERE actor_id = $1', [
      agentProfile.id,
    ]);

    console.log('📊 Dependencies found:');
    console.log(`  - Identity Links: ${identityLinks.rows.length}`);
    console.log(`  - Verifiable Credentials: ${credentials.rows.length}`);
    console.log(`  - Consent Records: ${consents.rows.length}\n`);

    if (identityLinks.rows.length > 0) {
      console.log('Identity Links to move:');
      identityLinks.rows.forEach((link) => {
        console.log(`  - ${link.provider} (${link.verification_level})`);
      });
      console.log('');
    }

    // Confirm action
    if (!process.argv.includes('--force')) {
      console.log('⚠️  This will:');
      console.log('  1. Move all identity_links from Agent → Actor profile');
      console.log('  2. Move all verifiable_credentials from Agent → Actor profile');
      console.log('  3. Update all consent_ledger records to use Actor profile');
      console.log('  4. Delete the Agent profile\n');
      console.log('To proceed, run: node fix-duplicate-profile-force.js --force\n');
      return;
    }

    // Start transaction
    await client.query('BEGIN');

    try {
      console.log('🔄 Starting migration...\n');

      // 1. Move identity_links
      if (identityLinks.rows.length > 0) {
        const updateLinks = await client.query(
          `UPDATE identity_links 
           SET user_profile_id = $1 
           WHERE user_profile_id = $2
           RETURNING id`,
          [actorProfile.id, agentProfile.id]
        );
        console.log(`✅ Moved ${updateLinks.rows.length} identity link(s)`);
      }

      // 2. Move verifiable_credentials
      if (credentials.rows.length > 0) {
        const updateCreds = await client.query(
          `UPDATE verifiable_credentials 
           SET user_profile_id = $1 
           WHERE user_profile_id = $2
           RETURNING id`,
          [actorProfile.id, agentProfile.id]
        );
        console.log(`✅ Moved ${updateCreds.rows.length} verifiable credential(s)`);
      }

      // 3. Update consent_ledger (actor_id references user_profiles)
      if (consents.rows.length > 0) {
        const updateConsents = await client.query(
          `UPDATE consent_ledger 
           SET actor_id = $1 
           WHERE actor_id = $2
           RETURNING id`,
          [actorProfile.id, agentProfile.id]
        );
        console.log(`✅ Updated ${updateConsents.rows.length} consent record(s)`);
      }

      // 4. Delete the duplicate profile
      const deleteResult = await client.query(
        'DELETE FROM user_profiles WHERE id = $1 RETURNING username',
        [agentProfile.id]
      );

      console.log(`✅ Deleted profile: ${deleteResult.rows[0].username}\n`);

      // Commit transaction
      await client.query('COMMIT');

      console.log('✅ SUCCESS! Duplicate profile deleted and data merged.\n');
      console.log('📋 Next Steps:');
      console.log('  1. Clear browser cookies/session');
      console.log('  2. Log in using Email/Password (NOT Google)');
      console.log('  3. Verify Actor dashboard loads correctly');
      console.log('  4. Check identity verification status');
      console.log('');
      console.log('⚠️  IMPORTANT: Always use Email/Password login');
      console.log('   Do NOT use "Continue with Google" to avoid duplicates.\n');

      // Show final state
      const finalCheck = await client.query(
        `SELECT auth0_user_id, role, username 
         FROM user_profiles 
         WHERE email = 'adamrossgreene@gmail.com'`
      );

      console.log('✅ Final Profile State:');
      finalCheck.rows.forEach((p) => {
        console.log(`   ${p.role}: ${p.username} (${p.auth0_user_id})`);
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Transaction failed, rolled back:', error.message);
      throw error;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
