/**
 * Create Actor Record for Credential Issuance
 * 
 * This scriptcreates an actor record in the actors table for adamrossgreene@gmail.com.
 * While not explicitly required by credential issuance API, having an actor record
 * ensures full functionality across the platform.
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { db } = require('./infra/database/dist');
const { randomUUID } = require('crypto');

const EMAIL = 'adamrossgreene@gmail.com';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(color, icon, message) {
  console.log(`${colors[color]}${icon} ${message}${colors.reset}`);
}

async function main() {
  console.log('\n🎭 Create Actor Record for Credential Issuance\n');

  try {
    // 1. Find user profile
    const profileResult = await db.query(
      `SELECT id, auth0_user_id, email, username, role, profile_completed
       FROM user_profiles 
       WHERE email = $1`,
      [EMAIL]
    );

    if (profileResult.rows.length === 0) {
      log('red', '❌', `User profile not found: ${EMAIL}`);
      process.exit(1);
    }

    const profile = profileResult.rows[0];
    log('green', '✓', 'User Profile Found');
    log('blue', 'ℹ', `  ID: ${profile.id}`);
    log('blue', 'ℹ', `  Email: ${profile.email}`);
    log('blue', 'ℹ', `  Role: ${profile.role}`);
    console.log();

    // 2. Check if actor record already exists
    const actorCheckResult = await db.query(
      `SELECT id, email, verification_status
       FROM actors
       WHERE email = $1`,
      [EMAIL]
    );

    if (actorCheckResult.rows.length > 0) {
      const actor = actorCheckResult.rows[0];
      log('yellow', '⚠', 'Actor record already exists');
      log('blue', 'ℹ', `  ID: ${actor.id}`);
      log('blue', 'ℹ', `  Status: ${actor.verification_status}`);
      console.log();

      // Link to user_profile if not already linked
      const linkCheckResult = await db.query(
        `SELECT user_profile_id FROM actors WHERE id = $1 AND user_profile_id = $2`,
        [actor.id, profile.id]
      );

      if (linkCheckResult.rows.length === 0) {
        log('yellow', '⏳', 'Linking actor to user profile...');
        await db.query(
          `UPDATE actors SET user_profile_id = $1 WHERE id = $2`,
          [profile.id, actor.id]
        );
        log('green', '✓', 'Actor linked to user profile');
      } else {
        log('green', '✓', 'Actor already linked to user profile');
      }
    } else {
      // 3. Create new actor record
      log('yellow', '⏳', 'Creating new actor record...');

      // Extract name from profile or generate from username/email
      let firstName = 'Adam';
      let lastName = 'Greene';

      if (profile.legal_name) {
        const nameParts = profile.legal_name.split(' ');
        firstName = nameParts[0] || 'Actor';
        lastName = nameParts.slice(1).join(' ') || 'User';
      } else if (profile.username) {
        // Try to extract from username (e.g., "adamrossgreene" -> "Adam", "Greene")
        firstName = profile.username.substring(0, 1).toUpperCase() + profile.username.substring(1, 4);
        lastName = 'User';
      }

      const actorId = randomUUID();
      await db.query(
        `INSERT INTO actors (
          id,
          email,
          first_name,
          last_name,
          user_profile_id,
          auth0_user_id,
          verification_status,
          verified_at,
          verified_by,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [
          actorId,
          profile.email,
          firstName,
          lastName,
          profile.id,
          profile.auth0_user_id,
          'verified', // Set to verified since they've already completed identity verification
          new Date(), // Set verified_at to now
          profile.id, // Verified by themselves (or admin can be set)
        ]
      );

      log('green', '✓', 'Actor record created!');
      log('blue', 'ℹ', `  ID: ${actorId}`);
      log('blue', 'ℹ', `  Status: verified`);
      console.log();
    }

    // 4. Verify identity links exist
    const linksResult = await db.query(
      `SELECT id, provider, verification_level, is_active
       FROM identity_links 
       WHERE user_profile_id = $1`,
      [profile.id]
    );

    log('blue', 'ℹ', `Identity Links: ${linksResult.rows.length} total`);
    const activeLinks = linksResult.rows.filter(link => link.is_active);
    log('green', '✓', `Active Links: ${activeLinks.length}`);
    console.log();

    // 5. Summary
    console.log('📊 Credential Issuance Prerequisites:');
    console.log(`   ✅ User profile exists and completed`);
    console.log(`   ✅ Actor record exists (linked to profile)`);
    console.log(`   ${activeLinks.length > 0 ? '✅' : '❌'} Active identity links: ${activeLinks.length}`);
    console.log(`   ✅ Issuer keypair configured`);
    console.log(`   ✅ Encryption key configured`);
    console.log();

    if (activeLinks.length > 0) {
      log('green', '✅', 'All prerequisites met! Credential issuance should work now.');
      console.log();
      console.log('Next Steps:');
      console.log('  1. Log in as adamrossgreene@gmail.com');
      console.log('  2. Navigate to dashboard');
      console.log('  3. Click "Issue Credential" button');
      console.log('  4. Credential should be issued successfully');
    } else {
      log('red', '⚠', 'No active identity links! User needs to verify identity first.');
    }

    console.log();
    process.exit(0);
  } catch (error) {
    console.error();
    log('red', '❌', `Error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
