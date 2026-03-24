#!/usr/bin/env node

/**
 * Generate Encryption Key for Database Field Encryption
 *
 * This script generates an AES-256 encryption key for encrypting sensitive
 * database fields at the application level (Step 11).
 *
 * Encrypted Fields:
 * - identity_links.credential_data
 * - verifiable_credentials.credential_json
 *
 * Standards:
 * - AES-256-GCM (NIST approved)
 * - 256-bit key (32 bytes)
 *
 * Usage:
 *   node scripts/generate-encryption-key.js
 *
 * Output:
 *   ENCRYPTION_KEY environment variable to add to .env.local
 *
 * Security:
 * - DO NOT commit this key to Git
 * - For production: Store in AWS Secrets Manager
 * - Rotate annually or if compromised
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating AES-256 Encryption Key for Database Encryption (Step 11)\n');
console.log('═══════════════════════════════════════════════════════════════════════\n');

// Generate 256-bit (32-byte) encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated AES-256 encryption key\n');

// Display environment variable
console.log('📋 Add this to your .env.local file:\n');
console.log('─────────────────────────────────────────────────────────────────────');
console.log(`ENCRYPTION_KEY="${encryptionKey}"`);
console.log('─────────────────────────────────────────────────────────────────────\n');

// Save to file for reference (DO NOT COMMIT)
const keyFile = path.join(__dirname, '..', '.encryption-key.local');
const keyContent = `# AES-256 Encryption Key - DO NOT COMMIT
# Generated: ${new Date().toISOString()}
# Purpose: Database field encryption (Step 11)

ENCRYPTION_KEY="${encryptionKey}"

# ⚠️  SECURITY WARNINGS:
# - This file is in .gitignore - DO NOT commit to Git
# - For production: Store in AWS Secrets Manager
# - Rotate annually or if compromised
# - If key is lost, encrypted data cannot be recovered

# AWS Secrets Manager (Production):
# aws secretsmanager create-secret \\
#   --name trulyimagined/encryption-key \\
#   --secret-string "${encryptionKey}" \\
#   --region eu-west-2
`;

fs.writeFileSync(keyFile, keyContent);
console.log(`💾 Key also saved to: ${keyFile}`);
console.log('   (This file is in .gitignore)\n');

// Instructions
console.log('📖 Next Steps:\n');
console.log('1. Copy the ENCRYPTION_KEY to apps/web/.env.local');
console.log('2. Restart your dev server (pnpm dev)');
console.log('3. Test encryption with: node test-encryption.js\n');

console.log('🔒 Security Reminders:\n');
console.log('✅ .encryption-key.local is in .gitignore');
console.log('✅ Never commit encryption keys to Git');
console.log('✅ For production: Use AWS Secrets Manager');
console.log('✅ Rotate keys annually\n');

console.log('📚 Documentation:\n');
console.log('- Full implementation: STEP11_COMPLETE.md');
console.log('- Encryption utilities: shared/utils/src/crypto.ts');
console.log('- Production setup: See AWS Secrets Manager section\n');

console.log('✨ Done! Encryption key generated successfully.\n');
