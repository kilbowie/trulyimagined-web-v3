/**
 * Check User Profile and Identity Links for Credential Issuance
 * Helps diagnose why credential issuance might be failing
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkUserProfile() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking user profile and identity links...\n');

    // 1. Get all user profiles
    const profilesResult = await client.query(`
      SELECT 
        id, 
        auth0_user_id, 
        email, 
        username, 
        legal_name, 
        professional_name, 
        role,
        profile_completed,
        created_at
      FROM user_profiles 
      ORDER BY created_at DESC
    `);

    if (profilesResult.rows.length === 0) {
      console.log('❌ No user profiles found in database.');
      console.log('\n💡 To issue credentials, you need:');
      console.log('   1. A user_profiles record with profile_completed = TRUE');
      console.log('   2. At least one identity_link record with is_active = TRUE');
      return;
    }

    console.log(`📊 Found ${profilesResult.rows.length} user profile(s):\n`);

    for (const profile of profilesResult.rows) {
      console.log(`👤 Profile ID: ${profile.id}`);
      console.log(`   Auth0 User ID: ${profile.auth0_user_id}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Username: ${profile.username || '(not set)'}`);
      console.log(`   Legal Name: ${profile.legal_name || '(not set)'}`);
      console.log(`   Professional Name: ${profile.professional_name || '(not set)'}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Profile Completed: ${profile.profile_completed ? '✅ YES' : '❌ NO'}`);

      // Check identity links for this profile
      const linksResult = await client.query(
        `SELECT 
          provider, 
          verification_level, 
          assurance_level,
          verified_at,
          is_active
        FROM identity_links 
        WHERE user_profile_id = $1 
        ORDER BY verified_at DESC`,
        [profile.id]
      );

      console.log(`   Identity Links: ${linksResult.rows.length}`);

      if (linksResult.rows.length === 0) {
        console.log('      ❌ No identity links found');
      } else {
        linksResult.rows.forEach((link, idx) => {
          console.log(`      ${idx + 1}. ${link.provider} - Level: ${link.verification_level} - Active: ${link.is_active ? '✅' : '❌'}`);
        });
      }

      // Check if this profile can issue credentials
      const canIssue = profile.profile_completed && linksResult.rows.some(link => link.is_active);
      console.log(`   Can Issue Credentials: ${canIssue ? '✅ YES' : '❌ NO'}`);

      if (!canIssue) {
        console.log('\n   ⚠️  To enable credential issuance:');
        if (!profile.profile_completed) {
          console.log('      • Set profile_completed = TRUE');
          console.log(`        UPDATE user_profiles SET profile_completed = TRUE WHERE id = '${profile.id}';`);
        }
        if (!linksResult.rows.some(link => link.is_active)) {
          console.log('      • Add an active identity link:');
          console.log(`        INSERT INTO identity_links (user_profile_id, provider, verification_level, assurance_level, is_active, verified_at)`);
          console.log(`        VALUES ('${profile.id}', 'Stripe Identity', 'high', 'high', TRUE, NOW());`);
        }
      }

      console.log('');
    }

    // Check verifiable_credentials table
    const credentialsResult = await client.query(`
      SELECT COUNT(*) as count, credential_type
      FROM verifiable_credentials
      WHERE is_revoked = FALSE
      GROUP BY credential_type
    `);

    console.log('\n📜 Existing Credentials:');
    if (credentialsResult.rows.length === 0) {
      console.log('   (none)');
    } else {
      credentialsResult.rows.forEach(row => {
        console.log(`   ${row.credential_type}: ${row.count}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the check
checkUserProfile().catch(console.error);
