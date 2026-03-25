/**
 * Fix User Profiles for Credential Issuance
 * Adds identity links for profiles that don't have them
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function fixUserProfiles() {
  const client = await pool.connect();

  try {
    console.log('🔧 Fixing user profiles for credential issuance...\n');

    // Get all profiles that need identity links
    const profilesResult = await client.query(`
      SELECT 
        id, 
        email, 
        username, 
        role,
        profile_completed
      FROM user_profiles 
      WHERE profile_completed = TRUE
    `);

    console.log(`Found ${profilesResult.rows.length} completed profiles\n`);

    for (const profile of profilesResult.rows) {
      // Check if profile already has active identity links
      const linksResult = await client.query(
        `SELECT COUNT(*) as count 
         FROM identity_links 
         WHERE user_profile_id = $1 AND is_active = TRUE`,
        [profile.id]
      );

      const hasActiveLink = linksResult.rows[0].count > 0;

      if (!hasActiveLink) {
        console.log(`➕ Adding identity link for: ${profile.email} (${profile.role})`);

        // Insert identity link
        await client.query(
          `INSERT INTO identity_links (
            user_profile_id, 
            provider, 
            provider_user_id,
            provider_type,
            verification_level, 
            assurance_level,
            is_active, 
            verified_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            profile.id,
            'Mock KYC',
            `mock-${profile.id}`,
            'kyc',
            'high',
            'high',
            true,
            new Date(),
          ]
        );

        console.log(`   ✅ Identity link added for ${profile.username || profile.email}`);
      } else {
        console.log(`⏭️  Skipping ${profile.email} - already has active link`);
      }
    }

    console.log('\n✅ All profiles fixed!');
    console.log('\n💡 All completed profiles can now issue credentials.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixUserProfiles().catch(console.error);
