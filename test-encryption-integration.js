/**
 * Step 11: Database Encryption Integration Test
 *
 * Tests encryption with actual API data structures to ensure compatibility
 * with identity_links.credential_data and verifiable_credentials.credential_json
 */

// Load environment variables
require('dotenv').config({ path: 'apps/web/.env.local' });

const { encryptJSON, decryptJSON } = require('./shared/utils/dist');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

let testsPassed = 0;
let testsFailed = 0;

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log(`${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.cyan}Step 11: Integration Tests${colors.reset}`);
console.log(`${colors.cyan}========================================${colors.reset}\n`);

// ===========================================
// Test 1: Stripe Identity Verification Data
// ===========================================
console.log(`${colors.blue}1. Stripe Identity credential_data${colors.reset}`);

test('Should encrypt/decrypt Stripe verification session data', () => {
  const stripeCredentialData = {
    legalName: 'John Michael Smith',
    professionalName: 'John Smith',
    email: 'john.smith@example.com',
    documentType: 'passport',
    documentNumber: 'P12345678',
    documentCountry: 'US',
    documentIssueDate: '2020-01-15',
    documentExpiryDate: '2030-01-15',
    documentVerified: true,
    livenessCheck: true,
    faceMatch: true,
    verifiedAt: '2024-01-15T10:30:00Z',
    provider: 'stripe-identity',
    sessionId: 'vs_1234567890abcdef',
    verificationReport: {
      documentAuthenticity: 'pass',
      livenessScore: 0.99,
      faceMatchScore: 0.96,
    },
  };

  const encrypted = encryptJSON(stripeCredentialData);
  const decrypted = decryptJSON(encrypted);

  assert(encrypted !== JSON.stringify(stripeCredentialData), 'Data should be encrypted');
  assert(encrypted.includes(':'), 'Should have IV:tag:ciphertext format');
  assert(decrypted.legalName === stripeCredentialData.legalName, 'Legal name should match');
  assert(
    decrypted.documentNumber === stripeCredentialData.documentNumber,
    'Document number should match'
  );
  assert(decrypted.verificationReport.livenessScore === 0.99, 'Nested data should match');
});

test('Should encrypt/decrypt Stripe requires_input data', () => {
  const requiresInputData = {
    status: 'requires_input',
    last_error: 'document_expired',
    sessionId: 'vs_9876543210',
    attemptCount: 1,
    lastAttemptAt: '2024-01-15T09:00:00Z',
  };

  const encrypted = encryptJSON(requiresInputData);
  const decrypted = decryptJSON(encrypted);

  assert(
    JSON.stringify(decrypted) === JSON.stringify(requiresInputData),
    'Data should match exactly'
  );
});

test('Should handle null/empty credential_data fields', () => {
  const emptyData = {};
  const encrypted = encryptJSON(emptyData);
  const decrypted = decryptJSON(encrypted);

  assert(JSON.stringify(decrypted) === '{}', 'Empty object should round-trip');
});

// ===========================================
// Test 2: W3C Verifiable Credentials
// ===========================================
console.log(`\n${colors.blue}2. W3C Verifiable Credentials credential_json${colors.reset}`);

test('Should encrypt/decrypt IdentityCredential', () => {
  const identityCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    type: ['VerifiableCredential', 'IdentityCredential'],
    id: 'urn:uuid:12345678-1234-1234-1234-123456789012',
    issuer: {
      id: 'did:web:trulyimagined.com',
      name: 'Truly Imagined Identity Orchestration',
    },
    issuanceDate: '2024-01-15T10:30:00Z',
    validFrom: '2024-01-15T10:30:00Z',
    validUntil: '2025-01-15T10:30:00Z',
    credentialSubject: {
      id: 'did:web:trulyimagined.com:users:abc123',
      email: 'user@example.com',
      username: 'john_smith',
      legalName: 'John Michael Smith',
      professionalName: 'John Smith',
      role: 'Actor',
      verificationLevel: 'high',
      identityProviders: [
        {
          provider: 'stripe-identity',
          verificationLevel: 'high',
          assuranceLevel: 'substantial',
          verifiedAt: '2024-01-15T10:00:00Z',
        },
      ],
    },
    credentialStatus: {
      id: 'https://trulyimagined.com/api/credentials/status/1#94567',
      type: 'BitstringStatusListEntry',
      statusPurpose: 'revocation',
      statusListIndex: '94567',
      statusListCredential: 'https://trulyimagined.com/api/credentials/status/1',
    },
    proof: {
      type: 'Ed25519Signature2020',
      created: '2024-01-15T10:30:00Z',
      verificationMethod: 'did:web:trulyimagined.com#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: 'z58DAdFfa9SkqZMVPxAQpR1ijluhnyQQgbxdKzVbKJq4iJGtLg7jV5Fz5pN3zGz5rKGzGGzGzGz...',
    },
  };

  const encrypted = encryptJSON(identityCredential);
  const decrypted = decryptJSON(encrypted);

  assert(encrypted.length > 500, 'Encrypted VC should be substantial size');
  assert(
    decrypted['@context'][0] === 'https://www.w3.org/2018/credentials/v1',
    'Context should match'
  );
  assert(decrypted.type.includes('IdentityCredential'), 'Type should be preserved');
  assert(decrypted.credentialSubject.email === 'user@example.com', 'Email should match');
  assert(
    decrypted.credentialSubject.verificationLevel === 'high',
    'Verification level should match'
  );
  assert(decrypted.proof.type === 'Ed25519Signature2020', 'Proof type should match');
  assert(decrypted.credentialStatus.statusListIndex === '94567', 'Status index should match');
});

test('Should encrypt/decrypt ActorCredential with extended claims', () => {
  const actorCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    type: ['VerifiableCredential', 'ActorCredential'],
    id: 'urn:uuid:actor-credential-001',
    issuer: 'did:web:trulyimagined.com',
    issuanceDate: '2024-01-15T11:00:00Z',
    credentialSubject: {
      id: 'did:web:trulyimagined.com:users:actor789',
      email: 'actor@talent-agency.com',
      legalName: 'Sarah Jane Williams',
      professionalName: 'Sarah Williams',
      role: 'Actor',
      stageName: 'Sarah J.',
      portfolioUrl: 'https://sarahjwilliams.com',
      skills: ['Drama', 'Comedy', 'Voice Acting'],
      verificationLevel: 'high',
      identityProviders: [
        {
          provider: 'stripe-identity',
          verificationLevel: 'high',
          assuranceLevel: 'high',
          verifiedAt: '2024-01-15T10:30:00Z',
        },
      ],
    },
    proof: {
      type: 'Ed25519Signature2020',
      created: '2024-01-15T11:00:00Z',
      verificationMethod: 'did:web:trulyimagined.com#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: 'z3MvYMPGH7FqPsGJ9aLPz...',
    },
  };

  const encrypted = encryptJSON(actorCredential);
  const decrypted = decryptJSON(encrypted);

  assert(decrypted.credentialSubject.stageName === 'Sarah J.', 'Stage name should be preserved');
  assert(decrypted.credentialSubject.skills.length === 3, 'Skills array should be preserved');
  assert(decrypted.credentialSubject.skills.includes('Voice Acting'), 'Skills should match');
});

test('Should handle very large credentials (with extensive metadata)', () => {
  const largeCredential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'IdentityCredential'],
    id: 'urn:uuid:large-credential',
    issuer: 'did:web:trulyimagined.com',
    issuanceDate: '2024-01-15T10:30:00Z',
    credentialSubject: {
      id: 'did:web:trulyimagined.com:users:user123',
      // Large metadata object
      metadata: {
        verificationHistory: Array.from({ length: 50 }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          provider: 'stripe-identity',
          result: 'success',
          sessionId: `vs_${i}`,
        })),
      },
    },
    proof: {
      type: 'Ed25519Signature2020',
      proofValue: 'z' + 'a'.repeat(100),
    },
  };

  const encrypted = encryptJSON(largeCredential);
  const decrypted = decryptJSON(encrypted);

  assert(
    decrypted.credentialSubject.metadata.verificationHistory.length === 50,
    'Large array should be preserved'
  );
  assert(encrypted.length > 1000, 'Large credential should encrypt to substantial size');
});

// ===========================================
// Test 3: Mock Verification Data
// ===========================================
console.log(`\n${colors.blue}3. Mock Verification Data${colors.reset}`);

test('Should encrypt/decrypt mock KYC credential data', () => {
  const mockCredentialData = {
    legalName: 'Test User',
    professionalName: 'Test User Pro',
    email: 'test@example.com',
    documentType: 'passport',
    documentNumber: 'MOCK1234567',
    documentVerified: true,
    livenessCheck: true,
    verifiedAt: '2024-01-15T10:30:00Z',
  };

  const encrypted = encryptJSON(mockCredentialData);
  const decrypted = decryptJSON(encrypted);

  assert(decrypted.documentNumber === 'MOCK1234567', 'Mock document number should match');
  assert(decrypted.documentVerified === true, 'Verification status should be preserved');
});

// ===========================================
// Test 4: Database Storage Simulation
// ===========================================
console.log(`\n${colors.blue}4. Database Storage Simulation${colors.reset}`);

test('Should simulate INSERT → SELECT → DECRYPT flow', () => {
  // Simulate API receiving data
  const incomingData = {
    legalName: 'Database Test User',
    email: 'db-test@example.com',
    documentType: 'passport',
    documentNumber: 'DB123456',
    documentVerified: true,
  };

  // Simulate encryption before database INSERT
  const encryptedForStorage = encryptJSON(incomingData);

  // Simulate storing in database (just a variable here)
  const databaseRecord = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_profile_id: '123e4567-e89b-12d3-a456-426614174000',
    provider: 'stripe-identity',
    credential_data: encryptedForStorage, // ENCRYPTED TEXT FIELD
    created_at: new Date().toISOString(),
  };

  // Simulate SELECT from database
  const retrievedFromDb = databaseRecord.credential_data;

  // Simulate decryption after SELECT
  const decryptedData = decryptJSON(retrievedFromDb);

  assert(decryptedData.documentNumber === 'DB123456', 'Data should survive database round-trip');
  assert(
    typeof databaseRecord.credential_data === 'string',
    'Encrypted data should be string for TEXT column'
  );
  assert(databaseRecord.credential_data.includes(':'), 'Stored data should be in encrypted format');
});

test('Should handle multiple records with different IVs', () => {
  const records = [
    { name: 'User 1', ssn: '123-45-6789' },
    { name: 'User 2', ssn: '987-65-4321' },
    { name: 'User 3', ssn: '555-55-5555' },
  ];

  const encryptedRecords = records.map((record) => encryptJSON(record));

  // All encrypted values should be different (random IVs)
  const uniqueValues = new Set(encryptedRecords);
  assert(uniqueValues.size === 3, 'Each record should have unique encryption');

  // All should decrypt correctly
  const decryptedRecords = encryptedRecords.map((enc) => decryptJSON(enc));
  decryptedRecords.forEach((decrypted, index) => {
    assert(decrypted.name === records[index].name, `Record ${index + 1} name should match`);
    assert(decrypted.ssn === records[index].ssn, `Record ${index + 1} SSN should match`);
  });
});

// ===========================================
// Test 5: Real-World Edge Cases
// ===========================================
console.log(`\n${colors.blue}5. Real-World Edge Cases${colors.reset}`);

test('Should handle credentials with special characters', () => {
  const specialCharsData = {
    name: "O'Brien-Jones",
    address: '123 Main St., Apt #4B',
    notes: 'User said: "Everything looks good!" 👍',
    unicode: '中文 العربية Ελληνικά',
  };

  const encrypted = encryptJSON(specialCharsData);
  const decrypted = decryptJSON(encrypted);

  assert(decrypted.name === "O'Brien-Jones", 'Apostrophes should be preserved');
  assert(decrypted.notes.includes('👍'), 'Emojis should be preserved');
  assert(decrypted.unicode === '中文 العربية Ελληνικά', 'Unicode should be preserved');
});

test('Should handle credentials with null/undefined fields', () => {
  const dataWithNulls = {
    name: 'User',
    middleName: null,
    suffix: undefined, // Will be omitted in JSON.stringify
    verified: true,
  };

  const encrypted = encryptJSON(dataWithNulls);
  const decrypted = decryptJSON(encrypted);

  assert(decrypted.name === 'User', 'Name should be preserved');
  assert(decrypted.middleName === null, 'Null should be preserved');
  assert(!('suffix' in decrypted), 'Undefined should be omitted');
  assert(decrypted.verified === true, 'Boolean should be preserved');
});

test('Should handle credentials with date objects (serialized as strings)', () => {
  const dataWithDates = {
    name: 'User',
    verifiedAt: new Date('2024-01-15T10:30:00Z').toISOString(),
    expiresAt: new Date('2025-01-15T10:30:00Z').toISOString(),
  };

  const encrypted = encryptJSON(dataWithDates);
  const decrypted = decryptJSON(encrypted);

  assert(
    decrypted.verifiedAt === '2024-01-15T10:30:00.000Z',
    'Date should be preserved as ISO string'
  );
  assert(decrypted.expiresAt === '2025-01-15T10:30:00.000Z', 'Expiry date should be preserved');
});

// ===========================================
// Test Summary
// ===========================================
console.log(`\n${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.cyan}Integration Test Results${colors.reset}`);
console.log(`${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
console.log(`${colors.cyan}Total:  ${testsPassed + testsFailed}${colors.reset}`);

if (testsFailed === 0) {
  console.log(`\n${colors.green}✓ All integration tests passed!${colors.reset}`);
  console.log(
    `${colors.green}✓ Encryption verified for production data structures${colors.reset}\n`
  );
  process.exit(0);
} else {
  console.log(`\n${colors.red}✗ Some integration tests failed${colors.reset}\n`);
  process.exit(1);
}
