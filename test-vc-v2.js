/**
 * Test W3C Verifiable Credentials Data Model 2.0 Implementation
 *
 * This script tests the v2.0 upgrade:
 * - Context: https://www.w3.org/ns/credentials/v2
 * - Date fields: validFrom, validUntil (not issuanceDate, expirationDate)
 * - Proof generation and verification
 */

const {
  issueCredential,
  verifyCredential,
} = require('./apps/web/src/lib/verifiable-credentials.ts');

async function testV2Credential() {
  console.log('🧪 Testing W3C VC Data Model v2.0 Implementation\n');
  console.log('='.repeat(60));

  try {
    // Test credential issuance
    console.log('\n✅ Step 1: Issue credential with v2.0 format...');
    const credential = await issueCredential({
      credentialType: 'IdentityCredential',
      holderDid: 'did:web:trulyimagined.com:users:test-123',
      holderProfileId: 'test-123',
      claims: {
        legalName: 'Test User',
        verificationLevel: 'high',
        verifiedAt: new Date().toISOString(),
      },
      expiresInDays: 365,
    });

    console.log('\n📄 Issued Credential:');
    console.log(JSON.stringify(credential, null, 2));

    // Validate v2.0 format
    console.log('\n✅ Step 2: Validate v2.0 format...');

    const hasV2Context = credential['@context'].includes('https://www.w3.org/ns/credentials/v2');
    const hasV1Context = credential['@context'].includes('https://www.w3.org/2018/credentials/v1');
    const hasValidFrom = 'validFrom' in credential;
    const hasValidUntil = 'validUntil' in credential;
    const hasIssuanceDate = 'issuanceDate' in credential;
    const hasExpirationDate = 'expirationDate' in credential;

    console.log(`  ✓ Has v2.0 context: ${hasV2Context ? '✅' : '❌'}`);
    console.log(`  ✓ Does NOT have v1.1 context: ${!hasV1Context ? '✅' : '❌'}`);
    console.log(`  ✓ Has validFrom field: ${hasValidFrom ? '✅' : '❌'}`);
    console.log(`  ✓ Has validUntil field: ${hasValidUntil ? '✅' : '❌'}`);
    console.log(`  ✓ Does NOT have issuanceDate: ${!hasIssuanceDate ? '✅' : '❌'}`);
    console.log(`  ✓ Does NOT have expirationDate: ${!hasExpirationDate ? '✅' : '❌'}`);

    if (!hasV2Context || hasV1Context || !hasValidFrom || hasIssuanceDate) {
      throw new Error('❌ Credential is not in v2.0 format!');
    }

    // Verify credential
    console.log('\n✅ Step 3: Verify credential signature...');
    const verificationResult = await verifyCredential(credential);

    if (verificationResult.verified) {
      console.log('  ✓ Signature verification: ✅ PASSED');
    } else {
      console.log('  ✓ Signature verification: ❌ FAILED');
      console.log('  Error:', verificationResult.error);
      throw new Error('Credential verification failed');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 SUCCESS! W3C VC Data Model v2.0 implementation is working!\n');
    console.log('Summary:');
    console.log(`  - Context: ${credential['@context'][0]}`);
    console.log(`  - Type: ${credential.type.join(', ')}`);
    console.log(`  - Issuer: ${credential.issuer}`);
    console.log(`  - Valid From: ${credential.validFrom}`);
    console.log(`  - Valid Until: ${credential.validUntil || 'No expiration'}`);
    console.log(`  - Credential Subject: ${credential.credentialSubject.id}`);
    console.log(`  - Proof Type: ${credential.proof?.type || 'Unknown'}`);

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nFull error:', error);
    return false;
  }
}

// Run test
testV2Credential().then((success) => {
  process.exit(success ? 0 : 1);
});
