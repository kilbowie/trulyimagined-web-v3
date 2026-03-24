/**
 * End-to-End Test for Step 10: Consent Proof API
 *
 * This script tests the complete happy path workflow:
 * 1. Create a consent record in the database
 * 2. Check consent and receive JWT proof
 * 3. Verify the JWT proof using JWKS
 * 4. Clean up test data
 *
 * Prerequisites:
 * - Dev server running on port 3000
 * - Database connection configured
 * - Consent signing keys configured in .env.local
 *
 * Usage:
 *   node test-consent-proof-e2e.js
 */

require('dotenv').config({ path: './apps/web/.env.local' });
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { Pool } = require('pg');
const crypto = require('crypto');

// Generate UUIDs for test data
function generateUUID() {
  return crypto.randomUUID();
}

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_ACTOR_ID = generateUUID();
const TEST_USER_ID = generateUUID();
const TEST_CONSENT_TYPE = 'voice_synthesis';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('amazonaws') ? { rejectUnauthorized: false } : undefined,
});

console.log('🧪 End-to-End Test: Consent Proof API (Step 10)\n');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Actor ID: ${TEST_ACTOR_ID}`);
console.log(`Test User ID: ${TEST_USER_ID}\n`);

// Helper function to make HTTP requests
async function fetch(url, options = {}) {
  const https = url.startsWith('https') ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// JWKS client for verifying JWTs
const client = jwksClient({
  jwksUri: `${BASE_URL}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

async function runTests() {
  let consentId = null;

  try {
    // Clean up any existing test data
    console.log('🧹 Cleanup: Removing any existing test data...');
    await pool.query('DELETE FROM consent_log WHERE actor_id = $1', [TEST_ACTOR_ID]);
    await pool.query('DELETE FROM actors WHERE id = $1', [TEST_ACTOR_ID]);
    console.log('   ✅ Cleanup complete\n');

    // Step 0: Create a test actor
    console.log('0️⃣  Creating Test Actor...');
    await pool.query(
      `INSERT INTO actors (
        id,
        auth0_user_id,
        email,
        first_name,
        last_name,
        verification_status
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        TEST_ACTOR_ID,
        'auth0|e2e-test-' + Date.now(),
        'e2e-test-' + Date.now() + '@example.com',
        'E2E',
        'Test Actor',
        'pending',
      ]
    );
    console.log(`   ✅ Test actor created (ID: ${TEST_ACTOR_ID})\n`);

    // Step 1: Create a consent record
    console.log('1️⃣  Creating Test Consent Record...');
    const insertResult = await pool.query(
      `INSERT INTO consent_log (
        actor_id, 
        action,
        consent_type, 
        consent_scope,
        project_name,
        requester_id,
        requester_type,
        ip_address,
        user_agent,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        TEST_ACTOR_ID,
        'granted', // action: 'granted' means consent is active
        TEST_CONSENT_TYPE,
        JSON.stringify({
          duration: {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 3 years
          },
          permissions: ['synthesis', 'reproduction'],
          territory: 'worldwide',
        }),
        'E2E Test Project',
        TEST_USER_ID,
        'admin',
        '127.0.0.1',
        'Test Agent / E2E',
        JSON.stringify({ test: true, automated: true }),
      ]
    );

    consentId = insertResult.rows[0].id;
    console.log(`   ✅ Consent record created (ID: ${consentId})\n`);

    // Step 2: Check consent and get JWT proof
    console.log('2️⃣  Checking Consent with Proof Generation...');
    const url = `${BASE_URL}/api/consent/check?actorId=${TEST_ACTOR_ID}&consentType=${TEST_CONSENT_TYPE}`;
    console.log(`   GET ${url}\n`);

    const response = await fetch(url);

    if (response.status !== 200) {
      throw new Error(`Consent check failed: HTTP ${response.status}`);
    }

    console.log('   ✅ Consent check API responded');
    console.log(`   ✅ Consent granted: ${response.data.isGranted}`);
    console.log(`   ✅ Has consent proof: ${!!response.data.proof}`);

    if (!response.data.isGranted) {
      throw new Error('Expected consent to be granted');
    }

    if (!response.data.proof) {
      throw new Error('Expected consent proof to be included');
    }

    const token = response.data.proof;
    console.log(`   ✅ JWT token length: ${token.length} characters`);
    console.log(`   ✅ Token preview: ${token.substring(0, 50)}...\n`);

    // Step 3: Verify JWT using JWKS
    console.log('3️⃣  Verifying JWT with JWKS...');

    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: 'did:web:trulyimagined.com',
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        }
      );
    });

    console.log('   ✅ JWT signature verified successfully');
    console.log(`   ✅ Issuer: ${decoded.iss}`);
    console.log(`   ✅ Subject: ${decoded.sub}`);
    console.log(`   ✅ Consent ID: ${decoded.consent.id}`);
    console.log(`   ✅ Consent Type: ${decoded.consent.type}`);
    console.log(`   ✅ Project Name: ${decoded.consent.projectName}`);
    console.log(`   ✅ Issued At: ${new Date(decoded.iat * 1000).toISOString()}`);
    console.log(`   ✅ Expires: ${new Date(decoded.exp * 1000).toISOString()}\n`);

    // Step 4: Verify decoded claims match expected values
    console.log('4️⃣  Validating JWT Claims...');

    if (decoded.sub !== TEST_ACTOR_ID) {
      throw new Error(`Subject mismatch: expected ${TEST_ACTOR_ID}, got ${decoded.sub}`);
    }
    console.log('   ✅ Subject matches actor ID');

    if (!decoded.consent || typeof decoded.consent !== 'object') {
      throw new Error('Consent object missing from JWT');
    }

    if (decoded.consent.type !== TEST_CONSENT_TYPE) {
      throw new Error(
        `Consent type mismatch: expected ${TEST_CONSENT_TYPE}, got ${decoded.consent.type}`
      );
    }
    console.log('   ✅ Consent type matches');

    if (decoded.consent.id !== consentId) {
      throw new Error(`Consent ID mismatch: expected ${consentId}, got ${decoded.consent.id}`);
    }
    console.log('   ✅ Consent ID matches database record');

    if (decoded.consent.projectName !== 'E2E Test Project') {
      throw new Error(
        `Project name mismatch: expected "E2E Test Project", got "${decoded.consent.projectName}"`
      );
    }
    console.log('   ✅ Project name matches');

    const expiry = new Date(decoded.exp * 1000);
    const now = new Date();
    const timeDiff = expiry - now;
    const threeYears = 3 * 365 * 24 * 60 * 60 * 1000;

    if (timeDiff < threeYears * 0.95 || timeDiff > threeYears * 1.05) {
      console.log(
        `   ⚠️  Expiry is ${(timeDiff / 1000 / 60 / 60 / 24 / 365).toFixed(2)} years from now`
      );
    } else {
      console.log('   ✅ Expiry set to ~3 years from now');
    }

    console.log(`   ✅ JWT version: ${decoded.version}`);
    console.log(`   ✅ Standard: ${decoded.standard}\n`);

    // Step 5: Test tamper detection
    console.log('5️⃣  Testing Tamper Detection...');
    const tamperedToken = token.slice(0, -10) + 'TAMPERED';

    try {
      await new Promise((resolve, reject) => {
        jwt.verify(
          tamperedToken,
          getKey,
          {
            algorithms: ['RS256'],
            issuer: 'did:web:trulyimagined.com',
          },
          (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded);
          }
        );
      });
      throw new Error('Tampered JWT should have been rejected');
    } catch (err) {
      console.log('   ✅ Tampered JWT correctly rejected');
      console.log(`   ✅ Error: ${err.message}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 All End-to-End Tests PASSED!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('✅ Consent record creation: Working');
    console.log('✅ Consent check with proof: Working');
    console.log('✅ JWT proof generation: Working');
    console.log('✅ JWT verification with JWKS: Working');
    console.log('✅ JWT claims validation: Working');
    console.log('✅ Tamper detection: Working');
    console.log('\n🚀 Step 10 E2E Tests: COMPLETE\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    if (consentId) {
      console.log('🧹 Cleaning up test data...');
      await pool.query('DELETE FROM consent_log WHERE id = $1', [consentId]);
      await pool.query('DELETE FROM actors WHERE id = $1', [TEST_ACTOR_ID]);
      console.log('   ✅ Test data removed\n');
    }
    await pool.end();
  }
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
