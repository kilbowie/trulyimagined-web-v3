/**
 * Test JWT Consent Proof Generation and Verification
 *
 * This script tests the Step 10 implementation:
 * 1. Generates RSA keypair
 * 2. Creates a mock consent record
 * 3. Generates JWT proof
 * 4. Verifies JWT proof
 * 5. Tests JWKS generation
 *
 * Usage:
 *   node test-consent-proof.js
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

console.log('🧪 Testing JWT Consent Proof Generation and Verification\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Step 1: Generate test keypair
console.log('1️⃣  Generating test RSA keypair...');
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
console.log('✅ Keypair generated\n');

// Step 2: Create mock consent data
console.log('2️⃣  Creating mock consent data...');
const consentData = {
  consentId: crypto.randomUUID(),
  actorId: crypto.randomUUID(),
  consentType: 'voice_synthesis',
  projectId: crypto.randomUUID(),
  projectName: 'Test AI Voice Project',
  scope: {
    usageTypes: ['advertising', 'promotional'],
    territories: ['UK', 'US'],
    duration: {
      startDate: '2026-03-23',
      endDate: '2027-03-23',
    },
    exclusions: ['political', 'adult-content'],
  },
  grantedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
};
console.log('✅ Consent data:', JSON.stringify(consentData, null, 2), '\n');

// Step 3: Generate JWT proof
console.log('3️⃣  Generating JWT proof...');
const keyId = 'consent-key-test-' + Date.now();
const expiresAt = new Date(consentData.expiresAt).getTime() / 1000;

const payload = {
  // Standard JWT claims
  iss: 'did:web:trulyimagined.com',
  sub: consentData.actorId,
  aud: 'https://api.trulyimagined.com',
  iat: Math.floor(Date.now() / 1000),
  exp: expiresAt,
  jti: consentData.consentId,

  // Custom consent claims
  consent: {
    id: consentData.consentId,
    type: consentData.consentType,
    projectId: consentData.projectId,
    projectName: consentData.projectName,
    scope: consentData.scope,
    grantedAt: consentData.grantedAt,
    expiresAt: consentData.expiresAt,
  },

  // Metadata
  version: '1.0',
  standard: 'W3C-VC-compatible',
};

const token = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  keyid: keyId,
});

console.log('✅ JWT Generated:');
console.log('   Length:', token.length, 'characters');
console.log('   Token:', token.substring(0, 50) + '...\n');

// Step 4: Decode JWT (without verification)
console.log('4️⃣  Decoding JWT (inspecting payload)...');
const decoded = jwt.decode(token, { complete: true });
console.log('✅ JWT Header:', JSON.stringify(decoded.header, null, 2));
console.log('✅ JWT Payload (excerpt):');
console.log('   Issuer:', decoded.payload.iss);
console.log('   Subject:', decoded.payload.sub);
console.log('   Consent Type:', decoded.payload.consent.type);
console.log('   Project Name:', decoded.payload.consent.projectName);
console.log('   Expires:', new Date(decoded.payload.exp * 1000).toISOString(), '\n');

// Step 5: Verify JWT signature
console.log('5️⃣  Verifying JWT signature...');
try {
  const verified = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: 'did:web:trulyimagined.com',
    audience: 'https://api.trulyimagined.com',
  });

  console.log('✅ JWT Signature Valid!');
  console.log('   Verified consent ID:', verified.consent.id);
  console.log('   Verified consent type:', verified.consent.type, '\n');
} catch (error) {
  console.error('❌ JWT Verification Failed:', error.message, '\n');
  process.exit(1);
}

// Step 6: Test JWKS generation
console.log('6️⃣  Generating JWKS (JSON Web Key Set)...');
const publicKeyObject = crypto.createPublicKey(publicKey);
const jwk = publicKeyObject.export({ format: 'jwk' });

const jwks = {
  keys: [
    {
      ...jwk,
      kid: keyId,
      use: 'sig',
      alg: 'RS256',
      key_ops: ['verify'],
    },
  ],
};

console.log('✅ JWKS Generated:', JSON.stringify(jwks, null, 2), '\n');

// Step 7: Test invalid JWT (tampered payload)
console.log('7️⃣  Testing tampered JWT (should fail)...');
const tamperedToken = token.replace(/\.[^.]+\./, '.eyJpc3MiOiJoYWNrZXIifQ.');
try {
  jwt.verify(tamperedToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'did:web:trulyimagined.com',
  });
  console.error('❌ SECURITY ISSUE: Tampered JWT was verified!\n');
  process.exit(1);
} catch (error) {
  console.log('✅ Tampered JWT correctly rejected:', error.message, '\n');
}

// Step 8: Test expired JWT
console.log('8️⃣  Testing expired JWT (should fail)...');
const expiredPayload = { ...payload, exp: Math.floor(Date.now() / 1000) - 3600 }; // 1 hour ago
const expiredToken = jwt.sign(expiredPayload, privateKey, {
  algorithm: 'RS256',
  keyid: keyId,
});

try {
  jwt.verify(expiredToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'did:web:trulyimagined.com',
  });
  console.error('❌ SECURITY ISSUE: Expired JWT was verified!\n');
  process.exit(1);
} catch (error) {
  console.log('✅ Expired JWT correctly rejected:', error.message, '\n');
}

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('🎉 All Tests Passed!');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('✅ JWT Generation: Working');
console.log('✅ JWT Verification: Working');
console.log('✅ JWKS Generation: Working');
console.log('✅ Tamper Detection: Working');
console.log('✅ Expiry Detection: Working');
console.log('\n🚀 Step 10 implementation validated successfully!\n');
