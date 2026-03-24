/**
 * Test Database Role Verification
 *
 * This script verifies that database-based role checking is working correctly
 * for adam@kilbowieconsulting.com.
 *
 * Usage:
 *   node test-database-roles.js
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { db } = require('./infra/database/dist');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(message, colors.blue);
  log('='.repeat(60), colors.blue);
}

const TARGET_EMAIL = 'adam@kilbowieconsulting.com';

async function testDatabaseRoles() {
  logHeader('Database Role Verification Tests');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Verify user_profiles entry exists
    logInfo('Test 1: Check user_profiles entry exists');
    const profileResult = await db.query('SELECT * FROM user_profiles WHERE email = $1', [
      TARGET_EMAIL,
    ]);

    if (profileResult.rows.length === 0) {
      logError('User profile not found');
      testsFailed++;
    } else {
      logSuccess('User profile found');
      testsPassed++;
    }

    const profile = profileResult.rows[0];

    // Test 2: Verify role is Admin
    logInfo('Test 2: Check role is Admin');
    if (profile?.role === 'Admin') {
      logSuccess(`Role is 'Admin' ✓`);
      testsPassed++;
    } else {
      logError(`Role is '${profile?.role}' (expected 'Admin')`);
      testsFailed++;
    }

    // Test 3: Verify auth0_user_id is set
    logInfo('Test 3: Check auth0_user_id is set');
    if (profile?.auth0_user_id) {
      logSuccess(`Auth0 User ID: ${profile.auth0_user_id}`);
      testsPassed++;
    } else {
      logError('Auth0 User ID not set');
      testsFailed++;
    }

    // Test 4: Simulate role check query (what isAdmin() does)
    logInfo('Test 4: Simulate isAdmin() function query');
    const roleCheckResult = await db.query(
      'SELECT role FROM user_profiles WHERE auth0_user_id = $1',
      [profile.auth0_user_id]
    );

    if (roleCheckResult.rows.length > 0 && roleCheckResult.rows[0].role === 'Admin') {
      logSuccess('isAdmin() would return true ✓');
      testsPassed++;
    } else {
      logError('isAdmin() would return false');
      testsFailed++;
    }

    // Test 5: List all users with Admin role
    logInfo('Test 5: List all Admin users');
    const adminUsersResult = await db.query(
      'SELECT email, username, role, created_at FROM user_profiles WHERE role = $1',
      ['Admin']
    );

    if (adminUsersResult.rows.length > 0) {
      logSuccess(`Found ${adminUsersResult.rows.length} admin user(s):`);
      adminUsersResult.rows.forEach((admin, index) => {
        console.log(`  ${index + 1}. ${admin.email} (${admin.username})`);
      });
      testsPassed++;
    } else {
      logError('No admin users found');
      testsFailed++;
    }

    // Test 6: Verify profile_completed flag
    logInfo('Test 6: Check profile_completed flag');
    if (profile?.profile_completed === true) {
      logSuccess('Profile is marked as completed');
      testsPassed++;
    } else {
      logError('Profile not marked as completed');
      testsFailed++;
    }

    // Summary
    logHeader('Test Results');
    log(`Passed: ${testsPassed}`, colors.green);
    log(`Failed: ${testsFailed}`, colors.red);
    log(`Total:  ${testsPassed + testsFailed}\n`);

    if (testsFailed === 0) {
      logSuccess('✓ All tests passed!');
      logInfo('');
      logInfo('Database role verification is working correctly.');
      logInfo('');
      logInfo('To test the /usage dashboard:');
      logInfo('  1. Ensure dev server is running: pnpm dev');
      logInfo('  2. Navigate to: http://localhost:3000/usage');
      logInfo('  3. You should see the dashboard (no 403 error)');
      logInfo('');
      logInfo('If you get 403 Forbidden:');
      logInfo('  - Check browser console for errors');
      logInfo('  - Verify you are logged in as adam@kilbowieconsulting.com');
      logInfo('  - Check Next.js terminal for API route errors');
      process.exit(0);
    } else {
      logError(`✗ ${testsFailed} test(s) failed`);
      process.exit(1);
    }
  } catch (error) {
    logError(`Test error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testDatabaseRoles().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
