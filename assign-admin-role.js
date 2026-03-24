/**
 * Assign Admin Role to adam@kilbowieconsulting.com
 * 
 * This script creates or updates the user_profiles entry to grant Admin role.
 * 
 * Usage:
 *   node assign-admin-role.js
 */

require('dotenv').config({ path: 'apps/web/.env.local' });
const { db } = require('./infra/database/dist');
const { randomUUID } = require('crypto');

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

async function assignAdminRole() {
  logHeader('Assign Admin Role to User');
  
  try {
    // 1. Find user by email in Auth0 users (check if they've logged in)
    logInfo(`Looking for user with email: ${TARGET_EMAIL}`);
    
    // First, let's check if they have a user_profiles entry
    const profileCheck = await db.query(
      'SELECT * FROM user_profiles WHERE email = $1',
      [TARGET_EMAIL]
    );

    if (profileCheck.rows.length > 0) {
      const profile = profileCheck.rows[0];
      logInfo(`Found existing user_profiles entry for ${TARGET_EMAIL}`);
      logInfo(`Current role: ${profile.role || 'None'}`);
      logInfo(`Auth0 User ID: ${profile.auth0_user_id}`);
      
      // Update to Admin role
      if (profile.role === 'Admin') {
        logSuccess('User already has Admin role!');
      } else {
        await db.query(
          'UPDATE user_profiles SET role = $1, updated_at = NOW() WHERE email = $2',
          ['Admin', TARGET_EMAIL]
        );
        logSuccess(`Updated role from '${profile.role}' to 'Admin'`);
      }
    } else {
      logInfo('No user_profiles entry found');
      logInfo('Checking if user exists in any table...');
      
      // Check actors table (they might have been registered as an actor)
      const actorCheck = await db.query(
        'SELECT * FROM actors WHERE email = $1',
        [TARGET_EMAIL]
      );
      
      if (actorCheck.rows.length > 0) {
        const actor = actorCheck.rows[0];
        logInfo(`Found user in actors table`);
        logInfo(`Auth0 User ID: ${actor.auth0_user_id}`);
        
        // Create user_profiles entry with Admin role
        await db.query(
          `INSERT INTO user_profiles (
            auth0_user_id, email, username, role, profile_completed, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [
            actor.auth0_user_id,
            TARGET_EMAIL,
            'adam_admin', // Default username
            'Admin',
            true
          ]
        );
        logSuccess('Created user_profiles entry with Admin role');
      } else {
        logError('User not found in any table');
        logInfo('');
        logInfo('The user needs to log in at least once before we can assign a role.');
        logInfo('Please:');
        logInfo('  1. Go to http://localhost:3000/api/auth/login');
        logInfo('  2. Log in with adam@kilbowieconsulting.com');
        logInfo('  3. Complete the profile setup (select any role for now)');
        logInfo('  4. Run this script again to update to Admin role');
        process.exit(1);
      }
    }

    // 2. Verify the role assignment
    logHeader('Verification');
    
    const verifyResult = await db.query(
      'SELECT * FROM user_profiles WHERE email = $1',
      [TARGET_EMAIL]
    );

    if (verifyResult.rows.length > 0) {
      const profile = verifyResult.rows[0];
      logInfo('User Profile:');
      console.log(`  Email:          ${profile.email}`);
      console.log(`  Username:       ${profile.username || 'Not set'}`);
      console.log(`  Role:           ${profile.role}`);
      console.log(`  Auth0 User ID:  ${profile.auth0_user_id}`);
      console.log(`  Profile Done:   ${profile.profile_completed}`);
      console.log('');

      if (profile.role === 'Admin') {
        logSuccess('✓ Admin role confirmed!');
        logInfo('');
        logInfo('Next Steps:');
        logInfo('  1. Navigate to http://localhost:3000/api/auth/logout');
        logInfo('  2. Log back in: http://localhost:3000/api/auth/login');
        logInfo('  3. Go to: http://localhost:3000/usage');
        logInfo('  4. You should now have access to the dashboard!');
      } else {
        logError(`Role is '${profile.role}' instead of 'Admin'`);
      }
    } else {
      logError('Failed to verify - user_profiles entry not found');
    }

  } catch (error) {
    logError(`Error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
assignAdminRole().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
