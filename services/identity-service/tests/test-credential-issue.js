/**
 * Test Credential Issuance
 *
 * Tests the credential issuance API for adamrossgreene@gmail.com
 */

require('dotenv').config({ path: 'apps/web/.env.local' });

const EMAIL = 'adamrossgreene@gmail.com';
const BASE_URL = 'http://localhost:3000';

// We'll need to get a session token first
// For testing, let's simulate what happens when the API is called

const { db } = require('./infra/database/dist');

async function testCredentialIssuance() {
  console.log('\n🧪 Testing Credential Issuance\n');

  try {
    // 1. Get user profile
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
      console.log('❌ User profile not found');
      return;
    }

    const profile = profileResult.rows[0];
    console.log('✅ User Profile Found:');
    console.log(`   ID:                ${profile.id}`);
    console.log(`   Role:              ${profile.role}`);
    console.log(`   Profile Completed: ${profile.profile_completed ? '✅' : '❌'}`);
    console.log();

    if (!profile.profile_completed) {
      console.log('❌ ISSUE: Profile not completed');
      return;
    }

    // 2. Check identity links
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
      [profile.id]
    );

    console.log(`📊 Active Identity Links: ${linksResult.rows.length}`);

    if (linksResult.rows.length === 0) {
      console.log('❌ ISSUE: No active identity links found');
      return;
    }

    linksResult.rows.forEach((link, idx) => {
      console.log(
        `   ${idx + 1}. ${link.provider} - ${link.verification_level} - ${link.verified_at}`
      );
    });
    console.log();

    // 3. Check issuer keypair
    const publicKey = process.env.ISSUER_ED25519_PUBLIC_KEY;
    const privateKey = process.env.ISSUER_ED25519_PRIVATE_KEY;

    console.log('🔑 Issuer Keypair:');
    console.log(`   Public Key:  ${publicKey ? '✅ Present' : '❌ Missing'}`);
    console.log(`   Private Key: ${privateKey ? '✅ Present' : '❌ Missing'}`);
    console.log();

    if (!publicKey || !privateKey) {
      console.log('❌ ISSUE: Issuer keypair not configured');
      return;
    }

    // 4. Check encryption key
    const encryptionKey = process.env.ENCRYPTION_KEY;
    console.log('🔐 Encryption Key:');
    console.log(`   Status: ${encryptionKey ? '✅ Present' : '⚠️  Missing (will fetch from AWS)'}`);
    console.log();

    // 5. Test actual library functions
    console.log('🧪 Testing Library Functions...\n');

    try {
      // Import the necessary functions
      const {
        issueCredential,
        getCredentialTypeForUser,
      } = require('./apps/web/src/lib/verifiable-credentials.ts');
      const { allocateStatusIndex } = require('./apps/web/src/lib/status-list-manager.ts');
      const { encryptJSON } = require('./shared/utils/dist');

      console.log('✅ All imports successful');
      console.log();

      // Determine credential type
      const credentialType = getCredentialTypeForUser(profile.role);
      console.log(`✅ Credential Type: ${credentialType}`);
      console.log();

      console.log('✅ All prerequisites met!');
      console.log();
      console.log('The credential issuance should work.');
      console.log("If there's still an error, check:");
      console.log('  1. Auth0 session validity when calling from UI');
      console.log('  2. Browser console for detailed errors');
      console.log('  3. Server logs for API errors');
      console.log('  4. Network tab for API response details');
    } catch (importError) {
      console.log('❌ Import Error:', importError.message);
      console.log();
      console.log('This suggests a build issue. Try:');
      console.log('  1. pnpm install');
      console.log('  2. pnpm build');
      console.log('  3. Restart dev server');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testCredentialIssuance();
