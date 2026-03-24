/**
 * Step 11: Database Encryption Tests
 *
 * Test suite for AES-256-GCM encryption/decryption functionality
 *
 * Tests:
 * 1. Basic encryption/decryption round-trip
 * 2. JSON encryption/decryption
 * 3. Tamper detection (authentication tag validation)
 * 4. Different data types
 * 5. isEncrypted() detection
 * 6. Key rotation
 * 7. Error handling
 */

// Load environment variables from .env.local
require('dotenv').config({ path: 'apps/web/.env.local' });

const {
  encryptField,
  decryptField,
  encryptJSON,
  decryptJSON,
  isEncrypted,
  rotateKey,
  generateEncryptionKey,
} = require('./shared/utils/dist');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let testsPassed = 0;
let testsFailed = 0;

/**
 * Test helper function
 */
function test(name, fn) {
  try {
    fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} ${name}`);
    console.error(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    testsFailed++;
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Assert throws helper
 */
function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw');
  }
}

console.log(`${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.cyan}Step 11: Database Encryption Tests${colors.reset}`);
console.log(`${colors.cyan}========================================${colors.reset}\n`);

// ===========================================
// Test 1: Basic Encryption/Decryption
// ===========================================
console.log(`${colors.blue}1. Basic Encryption/Decryption${colors.reset}`);

test('Should encrypt and decrypt plaintext string', () => {
  const plaintext = 'Hello, World!';
  const encrypted = encryptField(plaintext);
  const decrypted = decryptField(encrypted);

  assert(encrypted !== plaintext, 'Encrypted should not equal plaintext');
  assert(decrypted === plaintext, 'Decrypted should equal original plaintext');
  assert(encrypted.includes(':'), 'Encrypted format should contain colons');
});

test('Should generate different ciphertext for same plaintext (random IV)', () => {
  const plaintext = 'Same message';
  const encrypted1 = encryptField(plaintext);
  const encrypted2 = encryptField(plaintext);

  assert(encrypted1 !== encrypted2, 'Encrypted values should differ due to random IV');
  assert(decryptField(encrypted1) === plaintext, 'First encryption should decrypt correctly');
  assert(decryptField(encrypted2) === plaintext, 'Second encryption should decrypt correctly');
});

test('Should handle empty strings', () => {
  const plaintext = '';
  const encrypted = encryptField(plaintext);
  const decrypted = decryptField(encrypted);

  assert(decrypted === plaintext, 'Empty string should round-trip correctly');
});

test('Should handle Unicode characters', () => {
  const plaintext = '🔐 Encryption 中文 العربية';
  const encrypted = encryptField(plaintext);
  const decrypted = decryptField(encrypted);

  assert(decrypted === plaintext, 'Unicode should round-trip correctly');
});

// ===========================================
// Test 2: JSON Encryption/Decryption
// ===========================================
console.log(`\n${colors.blue}2. JSON Encryption/Decryption${colors.reset}`);

test('Should encrypt and decrypt JSON objects', () => {
  const data = {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    verified: true,
  };

  const encrypted = encryptJSON(data);
  const decrypted = decryptJSON(encrypted);

  assert(typeof encrypted === 'string', 'Encrypted JSON should be string');
  assert(
    JSON.stringify(decrypted) === JSON.stringify(data),
    'Decrypted JSON should match original'
  );
});

test('Should handle nested JSON objects', () => {
  const data = {
    user: {
      profile: {
        name: 'Jane Doe',
        contact: {
          email: 'jane@example.com',
          phone: '+1234567890',
        },
      },
    },
    metadata: {
      createdAt: '2024-01-15T10:30:00Z',
      verified: true,
    },
  };

  const encrypted = encryptJSON(data);
  const decrypted = decryptJSON(encrypted);

  assert(JSON.stringify(decrypted) === JSON.stringify(data), 'Nested JSON should match');
});

test('Should handle JSON arrays', () => {
  const data = [1, 2, 3, 'four', { five: 5 }];

  const encrypted = encryptJSON(data);
  const decrypted = decryptJSON(encrypted);

  assert(JSON.stringify(decrypted) === JSON.stringify(data), 'Array should match');
});

test('Should handle credential_data structure (Stripe Identity)', () => {
  const credentialData = {
    legalName: 'John Smith',
    documentType: 'passport',
    documentNumber: 'P1234567',
    documentVerified: true,
    livenessCheck: true,
    verifiedAt: '2024-01-15T10:30:00Z',
    provider: 'stripe-identity',
    sessionId: 'vs_1234567890',
  };

  const encrypted = encryptJSON(credentialData);
  const decrypted = decryptJSON(encrypted);

  assert(
    JSON.stringify(decrypted) === JSON.stringify(credentialData),
    'Credential data should match'
  );
});

test('Should handle W3C Verifiable Credential structure', () => {
  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    type: ['VerifiableCredential', 'IdentityCredential'],
    issuer: 'did:web:trulyimagined.com',
    issuanceDate: '2024-01-15T10:30:00Z',
    credentialSubject: {
      id: 'did:web:trulyimagined.com:users:123',
      email: 'user@example.com',
      verificationLevel: 'high',
    },
    proof: {
      type: 'Ed25519Signature2020',
      created: '2024-01-15T10:30:00Z',
      verificationMethod: 'did:web:trulyimagined.com#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: 'z58DAdFfa9SkqZMVPxAQpR...',
    },
  };

  const encrypted = encryptJSON(credential);
  const decrypted = decryptJSON(encrypted);

  assert(JSON.stringify(decrypted) === JSON.stringify(credential), 'VC should match');
  assert(
    decrypted.credentialSubject.email === credential.credentialSubject.email,
    'VC claims should be intact'
  );
});

// ===========================================
// Test 3: Tamper Detection
// ===========================================
console.log(`\n${colors.blue}3. Tamper Detection (GCM Authentication)${colors.reset}`);

test('Should detect tampered ciphertext', () => {
  const plaintext = 'Sensitive data';
  const encrypted = encryptField(plaintext);

  // Tamper with ciphertext (change last character)
  const parts = encrypted.split(':');
  const tamperedCiphertext = parts[2].slice(0, -1) + 'X';
  const tampered = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

  assertThrows(() => {
    decryptField(tampered);
  }, 'Should throw on tampered ciphertext');
});

test('Should detect tampered authentication tag', () => {
  const plaintext = 'Sensitive data';
  const encrypted = encryptField(plaintext);

  // Tamper with auth tag (flip first byte)
  const parts = encrypted.split(':');
  const authTagBuffer = Buffer.from(parts[1], 'base64');
  authTagBuffer[0] = authTagBuffer[0] ^ 0xff; // Flip all bits in first byte
  const tamperedTag = authTagBuffer.toString('base64');
  const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;

  assertThrows(() => {
    decryptField(tampered);
  }, 'Should throw on tampered auth tag');
});

test('Should detect tampered IV', () => {
  const plaintext = 'Sensitive data';
  const encrypted = encryptField(plaintext);

  // Tamper with IV
  const parts = encrypted.split(':');
  const tamperedIV = parts[0].slice(0, -1) + 'X';
  const tampered = `${tamperedIV}:${parts[1]}:${parts[2]}`;

  assertThrows(() => {
    decryptField(tampered);
  }, 'Should throw on tampered IV');
});

// ===========================================
// Test 4: isEncrypted() Detection
// ===========================================
console.log(`\n${colors.blue}4. Encryption Detection${colors.reset}`);

test('Should detect encrypted data', () => {
  const encrypted = encryptField('test data');
  assert(isEncrypted(encrypted) === true, 'Should recognize encrypted format');
});

test('Should recognize plaintext as not encrypted', () => {
  const plaintext = 'This is not encrypted';
  assert(isEncrypted(plaintext) === false, 'Should recognize plaintext');
});

test('Should handle invalid formats', () => {
  assert(isEncrypted('invalid:format') === false, 'Two-part format should not be encrypted');
  assert(isEncrypted('not:base64:data!') === false, 'Invalid base64 should not be encrypted');
});

// ===========================================
// Test 5: Key Rotation
// ===========================================
console.log(`\n${colors.blue}5. Key Rotation${colors.reset}`);

test('Should rotate encryption keys', () => {
  // Generate two different keys
  const oldKey = generateEncryptionKey();
  const newKey = generateEncryptionKey();

  const plaintext = 'Data to migrate';
  const encryptedWithOldKey = encryptField(plaintext, oldKey);

  // Rotate key
  const encryptedWithNewKey = rotateKey(encryptedWithOldKey, oldKey, newKey);

  // Should be able to decrypt with new key only
  const decrypted = decryptField(encryptedWithNewKey, newKey);
  assert(decrypted === plaintext, 'Rotated data should decrypt with new key');

  // Should NOT decrypt with old key
  assertThrows(() => {
    decryptField(encryptedWithNewKey, oldKey);
  }, 'Rotated data should not decrypt with old key');
});

test('Should handle JSON key rotation', () => {
  const oldKey = generateEncryptionKey();
  const newKey = generateEncryptionKey();

  const data = { name: 'John', email: 'john@example.com' };
  const encrypted = encryptJSON(data, oldKey);
  const rotated = rotateKey(encrypted, oldKey, newKey);
  const decrypted = decryptJSON(rotated, newKey);

  assert(JSON.stringify(decrypted) === JSON.stringify(data), 'JSON rotation should preserve data');
});

// ===========================================
// Test 6: Error Handling
// ===========================================
console.log(`\n${colors.blue}6. Error Handling${colors.reset}`);

test('Should throw on invalid encrypted format', () => {
  assertThrows(() => {
    decryptField('invalid-format');
  }, 'Should throw on invalid format');
});

test('Should throw on missing ENCRYPTION_KEY environment variable', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;

  assertThrows(() => {
    encryptField('test');
  }, 'Should throw when ENCRYPTION_KEY not set');

  process.env.ENCRYPTION_KEY = originalKey;
});

test('Should throw on null/undefined inputs', () => {
  assertThrows(() => {
    encryptField(null);
  }, 'Should throw on null input');

  assertThrows(() => {
    encryptField(undefined);
  }, 'Should throw on undefined input');
});

// ===========================================
// Test Summary
// ===========================================
console.log(`\n${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.cyan}Test Results${colors.reset}`);
console.log(`${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
console.log(`${colors.cyan}Total:  ${testsPassed + testsFailed}${colors.reset}`);

if (testsFailed === 0) {
  console.log(`\n${colors.green}✓ All tests passed!${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}✗ Some tests failed${colors.reset}\n`);
  process.exit(1);
}
