#!/usr/bin/env node

/**
 * Truly Imagined v3 - Ed25519 Issuer Key Generator
 * 
 * Generates an Ed25519 keypair for signing W3C Verifiable Credentials.
 * 
 * Usage:
 *   cd apps/web
 *   node scripts/generate-issuer-keys.js
 * 
 * Output:
 *   - Public/Private key in multibase format
 *   - Add to .env.local:
 *       ISSUER_ED25519_PUBLIC_KEY=z...
 *       ISSUER_ED25519_PRIVATE_KEY=z...
 *   - Public key will be published in DID document at /.well-known/did.json
 */

const { Ed25519VerificationKey2020 } = require('@digitalbazaar/ed25519-verification-key-2020');

async function generateIssuerKeys() {
  console.log('🔑 Generating Ed25519 Issuer Keypair for W3C Verifiable Credentials...\n');

  try {
    // Generate new Ed25519 keypair
    const keyPair = await Ed25519VerificationKey2020.generate({
      id: 'did:web:trulyimagined.com#key-1',
      controller: 'did:web:trulyimagined.com'
    });

    // Export keys in multibase format (z-prefixed base58-btc encoding)
    const publicKeyMultibase = keyPair.publicKeyMultibase;
    const privateKeyMultibase = keyPair.privateKeyMultibase;

    console.log('✅ Keypair Generated Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Add these environment variables to apps/web/.env.local:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`ISSUER_ED25519_PUBLIC_KEY=${publicKeyMultibase}`);
    console.log(`ISSUER_ED25519_PRIVATE_KEY=${privateKeyMultibase}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  SECURITY WARNING:');
    console.log('   - Keep PRIVATE KEY secret! Never commit to Git!');
    console.log('   - For production: Use AWS Secrets Manager or similar');
    console.log('   - Public key will be published in DID document\n');
    console.log('📖 Key Details:');
    console.log(`   - Key ID: ${keyPair.id}`);
    console.log(`   - Controller: ${keyPair.controller}`);
    console.log(`   - Type: ${keyPair.type}`);
    console.log(`   - Suite: Ed25519Signature2020\n`);

  } catch (error) {
    console.error('❌ Error generating keypair:', error);
    process.exit(1);
  }
}

// Run the generator
generateIssuerKeys();
