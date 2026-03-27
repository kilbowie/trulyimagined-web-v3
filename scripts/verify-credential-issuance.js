/**
 * Verify Credential Issuance - End-to-End Test
 *
 * This script verifies that credential issuance will work for adamrossgreene@gmail.com
 * by checking all prerequisites and simulating the issuance logic.
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { db } = require('./infra/database/dist');

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

async function verifyIssuance() {
  console.log('\n🧪 Verifying Credential Issuance End-to-End\n');

  let allChecksPassed = true;

  try {
    // ===========================================
    // 1. USER AUTHENTICATION CHECK
    // ===========================================
    log('blue', '📋', 'Step 1: User Authentication');
    console.log('   • Requires Auth0 JWT token (handled by frontend)');
    log('green', '✓', 'Authentication: Will be checked at runtime');
    console.log();

    // ===========================================
    // 2. USER PROFILE CHECK
    // ===========================================
    log('blue', '📋', 'Step 2: User Profile');
    const profileResult = await db.query(
      `SELECT 
        id, 
        auth0_user_id, 
        email, 
        username, 
        legal_name, 
        professional_name, 
        role,
        profile_completed
      FROM user_profiles 
      WHERE email = $1`,
      [EMAIL]
    );

    if (profileResult.rows.length === 0) {
      log('red', '❌', 'User profile not found');
      allChecksPassed = false;
    } else {
      const profile = profileResult.rows[0];
      log('green', '✓', `User profile found: ${profile.email}`);
      log('blue', 'ℹ', `  Role: ${profile.role}`);
      log('blue', 'ℹ', `  Profile Completed: ${profile.profile_completed ? 'Yes' : 'No'}`);

      if (!profile.profile_completed) {
        log('red', '❌', 'Profile not completed');
        allChecksPassed = false;
      } else {
        log('green', '✓', 'Profile completed');
      }
    }
    console.log();

    // ===========================================
    // 3. IDENTITY LINKS CHECK
    // ===========================================
    log('blue', '📋', 'Step 3: Identity Links (Verified Identity)');
    const linksResult = await db.query(
      `SELECT 
        provider, 
        verification_level, 
        assurance_level,
        verified_at,
        is_active
      FROM identity_links 
      WHERE user_profile_id = $1 
        AND is_active = TRUE
      ORDER BY verified_at DESC`,
      [profileResult.rows[0].id]
    );

    if (linksResult.rows.length === 0) {
      log('red', '❌', 'No active identity links found');
      log('yellow', '⚠', '  User needs to complete identity verification');
      allChecksPassed = false;
    } else {
      log('green', '✓', `Found ${linksResult.rows.length} active identity link(s)`);
      linksResult.rows.forEach((link, idx) => {
        log(
          'blue',
          'ℹ',
          `  ${idx + 1}. ${link.provider} - ${link.verification_level} - ${link.assurance_level}`
        );
      });

      // Find highest verification level
      const verificationLevels = ['low', 'medium', 'high', 'very-high'];
      const highestLevel = linksResult.rows.reduce((max, link) => {
        const currentIndex = verificationLevels.indexOf(link.verification_level || 'low');
        const maxIndex = verificationLevels.indexOf(max);
        return currentIndex > maxIndex ? link.verification_level : max;
      }, 'low');
      log('green', '✓', `Highest verification level: ${highestLevel}`);
    }
    console.log();

    // ===========================================
    // 4. ACTOR RECORD CHECK
    // ===========================================
    log('blue', '📋', 'Step 4: Actor Record (Optional but Recommended)');
    const actorResult = await db.query(
      `SELECT id, email, first_name, last_name, verification_status, user_profile_id
       FROM actors
       WHERE email = $1`,
      [EMAIL]
    );

    if (actorResult.rows.length === 0) {
      log('yellow', '⚠', 'No actor record found (not required for credential issuance)');
    } else {
      const actor = actorResult.rows[0];
      log('green', '✓', `Actor record found`);
      log('blue', 'ℹ', `  ID: ${actor.id}`);
      log('blue', 'ℹ', `  Name: ${actor.first_name} ${actor.last_name}`);
      log('blue', 'ℹ', `  Status: ${actor.verification_status}`);
      log('blue', 'ℹ', `  Linked to Profile: ${actor.user_profile_id ? 'Yes' : 'No'}`);
    }
    console.log();

    // ===========================================
    // 5. ISSUER KEYPAIR CHECK
    // ===========================================
    log('blue', '📋', 'Step 5: W3C Issuer Keypair');
    const publicKey = process.env.ISSUER_ED25519_PUBLIC_KEY;
    const privateKey = process.env.ISSUER_ED25519_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      log('red', '❌', 'Issuer keypair not configured');
      log('yellow', '⚠', '  Run: node scripts/generate-issuer-keys.js');
      allChecksPassed = false;
    } else {
      log('green', '✓', 'Issuer keypair configured');
      log('blue', 'ℹ', `  Public Key: ${publicKey.substring(0, 20)}...`);
    }
    console.log();

    // ===========================================
    // 6. ENCRYPTION KEY CHECK
    // ===========================================
    log('blue', '📋', 'Step 6: Database Encryption Key');
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!encryptionKey) {
      log('yellow', '⚠', 'ENCRYPTION_KEY not in .env.local (will fetch from AWS)');
      log('blue', 'ℹ', '  Ensure AWS credentials are configured');
    } else {
      log('green', '✓', 'ENCRYPTION_KEY configured in .env.local');
    }
    console.log();

    // ===========================================
    // 7. CREDENTIAL TYPE CHECK
    // ===========================================
    log('blue', '📋', 'Step 7: Credential Type Determination');
    if (profileResult.rows.length > 0) {
      const role = profileResult.rows[0].role;
      const credentialTypeMap = {
        Actor: 'ActorCredential',
        Agent: 'AgentCredential',
        Enterprise: 'EnterpriseCredential',
        Admin: 'IdentityCredential',
      };
      const credentialType = credentialTypeMap[role] || 'IdentityCredential';
      log('green', '✓', `Credential type for role "${role}": ${credentialType}`);
    }
    console.log();

    // ===========================================
    // FINAL SUMMARY
    // ===========================================
    console.log('═'.repeat(60));
    console.log();
    if (allChecksPassed && linksResult.rows.length > 0) {
      log('green', '✅', 'ALL CHECKS PASSED! Credential issuance should work.');
      console.log();
      console.log('📝 How to Issue Credential:');
      console.log('   1. Start dev server: pnpm dev');
      console.log('   2. Log in as: adamrossgreene@gmail.com');
      console.log('   3. Navigate to: http://localhost:3000/dashboard');
      console.log('   4. Scroll to "Verifiable Credentials" section');
      console.log('   5. Click "Issue Credential" button');
      console.log();
      console.log('Expected Result:');
      console.log('   ✅ Success message: "Credential issued successfully!"');
      console.log('   ✅ New credential appears in the list');
      console.log('   ✅ Can download credential as JSON-LD file');
      console.log();
      console.log("If There's Still an Error:");
      console.log('   • Check browser console for detailed error messages');
      console.log('   • Check server logs for API errors');
      console.log('   • Verify Auth0 session is valid');
      console.log('   • Check network tab for API response details');
    } else {
      log('red', '❌', 'SOME CHECKS FAILED! Fix the issues above.');
      console.log();
      console.log('Common Issues:');
      console.log('   • Profile not completed: Complete onboarding');
      console.log('   • No identity links: Run identity verification');
      console.log('   • Missing keypair: Run scripts/generate-issuer-keys.js');
    }
    console.log();
    console.log('═'.repeat(60));
    console.log();

    process.exit(allChecksPassed ? 0 : 1);
  } catch (error) {
    console.error();
    log('red', '❌', `Error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

verifyIssuance();
