/**
 * Check Actor Identity Links
 * 
 * This script checks if adamrossgreene@gmail.com has any identity links
 * and whether they're active and verified.
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { db } = require('./infra/database/dist');

const EMAIL = 'adamrossgreene@gmail.com';

async function main() {
  console.log('\n🔍 Checking Identity Links for Actor Profile\n');

  try {
    // 1. Find user profile
    const profileResult = await db.query(
      `SELECT id, auth0_user_id, email, username, role, profile_completed
       FROM user_profiles 
       WHERE email = $1`,
      [EMAIL]
    );

    if (profileResult.rows.length === 0) {
      console.log(`❌ User profile not found: ${EMAIL}`);
      process.exit(1);
    }

    const profile = profileResult.rows[0];
    console.log('✅ User Profile Found:');
    console.log(`   ID:                ${profile.id}`);
    console.log(`   Auth0 User ID:     ${profile.auth0_user_id}`);
    console.log(`   Email:             ${profile.email}`);
    console.log(`   Username:          ${profile.username}`);
    console.log(`   Role:              ${profile.role}`);
    console.log(`   Profile Completed: ${profile.profile_completed ? '✅ Yes' : '❌ No'}`);
    console.log();

    // 2. Check identity links
    const linksResult = await db.query(
      `SELECT 
        id,
        provider,
        provider_user_id,
        verification_level,
        assurance_level,
        verified_at,
        is_active,
        created_at
      FROM identity_links 
      WHERE user_profile_id = $1
      ORDER BY created_at DESC`,
      [profile.id]
    );

    console.log(`📊 Identity Links: ${linksResult.rows.length} total`);
    console.log();

    if (linksResult.rows.length === 0) {
      console.log('❌ NO IDENTITY LINKS FOUND');
      console.log();
      console.log('This is the issue! Credential issuance requires at least one');
      console.log('verified identity link. The user needs to complete identity');
      console.log('verification first.');
      console.log();
      console.log('Solution: Create an identity link (e.g., Auth0 basic verification)');
    } else {
      linksResult.rows.forEach((link, index) => {
        console.log(`Identity Link #${index + 1}:`);
        console.log(`   ID:                ${link.id}`);
        console.log(`   Provider:          ${link.provider}`);
        console.log(`   Provider User ID:  ${link.provider_user_id || 'N/A'}`);
        console.log(`   Verification Level: ${link.verification_level || 'N/A'}`);
        console.log(`   Assurance Level:   ${link.assurance_level || 'N/A'}`);
        console.log(`   Verified At:       ${link.verified_at || 'N/A'}`);
        console.log(`   Active:            ${link.is_active ? '✅ Yes' : '❌ No'}`);
        console.log(`   Created:           ${link.created_at}`);
        console.log();
      });

      const activeLinks = linksResult.rows.filter(link => link.is_active);
      if (activeLinks.length === 0) {
        console.log('⚠️  No ACTIVE identity links found');
        console.log('Credential issuance requires at least one active identity link.');
      } else {
        console.log(`✅ ${activeLinks.length} active identity link(s) found`);
      }
    }

    // 3. Check actors table (if applicable)
    const actorResult = await db.query(
      `SELECT id, email, verification_status, verified_at
       FROM actors
       WHERE email = $1`,
      [EMAIL]
    );

    console.log();
    console.log(`🎭 Actor Record: ${actorResult.rows.length > 0 ? 'Found' : 'Not Found'}`);
    if (actorResult.rows.length > 0) {
      const actor = actorResult.rows[0];
      console.log(`   ID:                 ${actor.id}`);
      console.log(`   Email:              ${actor.email}`);
      console.log(`   Verification Status: ${actor.verification_status}`);
      console.log(`   Verified At:        ${actor.verified_at || 'N/A'}`);
    }

    await db.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
