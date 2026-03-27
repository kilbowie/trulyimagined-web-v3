/**
 * Test Credential Issuance Directly
 *
 * Tests if the credential issuance library works without going through the API
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { issueCredential } = require('./services/identity-service/src/lib/verifiable-credentials');

async function testCredentialIssuance() {
  console.log('🧪 Testing Credential Issuance...\n');

  // Test profile data (matching Actor profile from check-user-profile.js)
  const testProfile = {
    id: '7145aebf-0af7-47c6-88dd-0938748c3918',
    email: 'adamrossgreene@gmail.com',
    username: 'adamrossgreene',
    legalName: 'Adam Ross Greene',
    professionalName: 'Adam Ross Greene',
    role: 'Actor',
  };

  const holderDid = `did:web:trulyimagined.com:users:${testProfile.id}`;

  const claims = {
    email: testProfile.email,
    username: testProfile.username,
    legalName: testProfile.legalName,
    professionalName: testProfile.professionalName,
    role: testProfile.role,
    verificationLevel: 'high',
    identityProviders: [
      {
        provider: 'Mock KYC',
        verificationLevel: 'high',
        assuranceLevel: 'high',
        verifiedAt: new Date().toISOString(),
      },
    ],
    issuedFor: 'Truly Imagined Identity Orchestration',
  };

  try {
    console.log('📝 Issuing credential with:');
    console.log('  - Credential Type: ActorCredential');
    console.log('  - Holder DID:', holderDid);
    console.log('  - Claims:', JSON.stringify(claims, null, 2));
    console.log();

    // Test without status (simpler)
    const credential = await issueCredential({
      credentialType: 'ActorCredential',
      holderDid,
      holderProfileId: testProfile.id,
      claims,
      expiresInDays: 365,
    });

    console.log('✅ SUCCESS! Credential issued:');
    console.log(JSON.stringify(credential, null, 2));
    console.log();
    console.log('✅ Credential ID:', credential.id);
    console.log('✅ Issuer:', credential.issuer);
    console.log('✅ Type:', credential.type);
    console.log('✅ Issued:', credential.validFrom);
    console.log('✅ Expires:', credential.validUntil);

    return true;
  } catch (error) {
    console.error('❌ FAILED to issue credential:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run test
testCredentialIssuance()
  .then((success) => {
    if (success) {
      console.log('\n✅ Test passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
