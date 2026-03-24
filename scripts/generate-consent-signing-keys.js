/**
 * Generate RSA Keypair for JWT Consent Proof Signing
 *
 * This script generates an RSA-2048 keypair for signing JWT consent proofs.
 * External consumers can verify these proofs using the public key published at
 * /.well-known/jwks.json
 *
 * Usage:
 *   node scripts/generate-consent-signing-keys.js
 *
 * Output:
 *   - CONSENT_SIGNING_PRIVATE_KEY (Base64-encoded PEM)
 *   - CONSENT_SIGNING_PUBLIC_KEY (Base64-encoded PEM)
 *   - CONSENT_SIGNING_KEY_ID (unique identifier for key rotation)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating RSA Keypair for JWT Consent Proof Signing...\n');

// Generate RSA-2048 keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Generate unique Key ID (kid) for JWKS
const keyId = `consent-key-${Date.now()}`;

// Base64 encode for environment variables
const privateKeyBase64 = Buffer.from(privateKey).toString('base64');
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

console.log('✅ RSA Keypair Generated Successfully!\n');
console.log('📋 Add these to your .env.local file:\n');
console.log('─────────────────────────────────────────────────────────────');
console.log(`CONSENT_SIGNING_PRIVATE_KEY="${privateKeyBase64}"`);
console.log(`CONSENT_SIGNING_PUBLIC_KEY="${publicKeyBase64}"`);
console.log(`CONSENT_SIGNING_KEY_ID="${keyId}"`);
console.log('─────────────────────────────────────────────────────────────\n');

// Also save to a file for reference
const outputPath = path.join(__dirname, '..', '.consent-keys.local');
const output = `# RSA Keypair for JWT Consent Proof Signing
# Generated: ${new Date().toISOString()}
# DO NOT COMMIT THIS FILE TO GIT

CONSENT_SIGNING_PRIVATE_KEY="${privateKeyBase64}"
CONSENT_SIGNING_PUBLIC_KEY="${publicKeyBase64}"
CONSENT_SIGNING_KEY_ID="${keyId}"
`;

fs.writeFileSync(outputPath, output);
console.log(`💾 Keys also saved to: ${outputPath}`);
console.log('⚠️  Keep your private key secure! Never commit to Git.\n');

// Output public key in JWKS format for reference
const publicKeyBuffer = crypto.createPublicKey(publicKey);
const jwk = publicKeyBuffer.export({ format: 'jwk' });

console.log('📄 JWKS Format (for /.well-known/jwks.json):\n');
console.log(
  JSON.stringify(
    {
      keys: [
        {
          ...jwk,
          kid: keyId,
          use: 'sig',
          alg: 'RS256',
        },
      ],
    },
    null,
    2
  )
);
console.log('\n✨ Done!\n');
