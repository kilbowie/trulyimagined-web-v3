/**
 * Verify Email in Auth0
 *
 * This script verifies an email address in Auth0 using the Management API.
 * Email verification is required for consent onboarding and other features.
 *
 * Usage: node verify-email-auth0.js
 */

require('dotenv').config({ path: 'apps/web/.env.local' });

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
const AUTH0_CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;

const EMAIL_TO_VERIFY = 'adamrossgreene@gmail.com';

/**
 * Colors for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(color, icon, message) {
  console.log(`${colors[color]}${icon} ${message}${colors.reset}`);
}

/**
 * Get Auth0 Management API token
 */
async function getManagementToken() {
  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: `https://${AUTH0_DOMAIN}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get management token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Find user by email
 */
async function findUserByEmail(token, email) {
  const encodedEmail = encodeURIComponent(email);
  const response = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodedEmail}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to find user: ${error}`);
  }

  const users = await response.json();
  return users[0]; // Return first matching user
}

/**
 * Update user to mark email as verified
 */
async function verifyEmailForUser(token, userId) {
  const response = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users/${userId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_verified: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to verify email: ${error}`);
  }

  return await response.json();
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🔐 Auth0 Email Verification Script\n');

  // Validate environment variables
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
    log('red', '❌', 'Missing required Auth0 environment variables');
    console.log('\nRequired in apps/web/.env.local:');
    console.log('  - AUTH0_DOMAIN');
    console.log('  - AUTH0_M2M_CLIENT_ID (or AUTH0_CLIENT_ID)');
    console.log('  - AUTH0_M2M_CLIENT_SECRET (or AUTH0_CLIENT_SECRET)');
    process.exit(1);
  }

  log('blue', 'ℹ', `Domain: ${AUTH0_DOMAIN}`);
  log('blue', 'ℹ', `Email to verify: ${EMAIL_TO_VERIFY}`);
  console.log();

  try {
    // Step 1: Get Management API token
    log('yellow', '⏳', 'Getting Auth0 Management API token...');
    const token = await getManagementToken();
    log('green', '✓', 'Management API token obtained');
    console.log();

    // Step 2: Find user by email
    log('yellow', '⏳', `Finding user: ${EMAIL_TO_VERIFY}...`);
    const user = await findUserByEmail(token, EMAIL_TO_VERIFY);

    if (!user) {
      log('red', '❌', `User not found: ${EMAIL_TO_VERIFY}`);
      console.log('\nℹ Make sure the user has logged in at least once.');
      process.exit(1);
    }

    log('green', '✓', `User found: ${user.user_id}`);
    log('blue', 'ℹ', `Name: ${user.name || 'N/A'}`);
    log('blue', 'ℹ', `Current email_verified: ${user.email_verified ? '✅ Yes' : '❌ No'}`);
    console.log();

    // Step 3: Check if already verified
    if (user.email_verified) {
      log('green', '✓', 'Email is already verified!');
      console.log();
      return;
    }

    // Step 4: Verify email
    log('yellow', '⏳', 'Marking email as verified...');
    const updatedUser = await verifyEmailForUser(token, user.user_id);
    log('green', '✓', 'Email successfully verified!');
    console.log();

    // Step 5: Confirmation
    console.log('Verification Summary:');
    console.log(`  User ID:        ${updatedUser.user_id}`);
    console.log(`  Email:          ${updatedUser.email}`);
    console.log(`  Email Verified: ${updatedUser.email_verified ? '✅ Yes' : '❌ No'}`);
    console.log(`  Name:           ${updatedUser.name || 'N/A'}`);
    console.log();

    log('green', '✅', 'Email verification complete!');
    console.log();
    console.log('Next steps:');
    console.log('  1. User can now log in at: http://localhost:3000/auth/login');
    console.log('  2. Dashboard will show: Email Verified: ✅ Yes');
    console.log('  3. User can access consent onboarding and other features');
    console.log();
  } catch (error) {
    console.error();
    log('red', '❌', `Error: ${error.message}`);
    console.log();

    if (error.message.includes('credentials')) {
      console.log('Troubleshooting:');
      console.log('  - Check AUTH0_M2M_CLIENT_ID and AUTH0_M2M_CLIENT_SECRET in .env.local');
      console.log('  - Ensure the application has "Management API" access in Auth0 Dashboard');
      console.log('  - Required scopes: read:users, update:users');
    }

    process.exit(1);
  }
}

main();
