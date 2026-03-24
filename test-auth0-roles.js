/**
 * Test Auth0 Roles
 *
 * This script helps verify that Auth0 roles are properly configured
 * and appearing in JWT tokens.
 *
 * Run after logging into the app:
 *   node test-auth0-roles.js
 */

// This is a simple check script - in a real scenario you'd:
// 1. Make an authenticated request to /api/auth/me
// 2. Check if roles are present in the response
// 3. Verify the Admin role is assigned

console.log('\n===========================================');
console.log('Auth0 Role Configuration Test');
console.log('===========================================\n');

console.log('📋 Manual Verification Steps:\n');

console.log('1. Open your browser and navigate to:');
console.log('   http://localhost:3000/api/auth/me\n');

console.log('2. Check if you see this structure:');
console.log('   {');
console.log('     "sub": "auth0|...",');
console.log('     "email": "adam@kilbowieconsulting.com",');
console.log('     "https://trulyimagined.com/roles": ["Admin"]');
console.log('   }\n');

console.log('3. If roles are MISSING:');
console.log('   → Go to Auth0 Dashboard');
console.log('   → Actions → Flows → Login');
console.log('   → Verify "Add Roles to Token" is in the flow');
console.log('   → Log out and back in\n');

console.log('4. If roles are PRESENT:');
console.log('   → Navigate to http://localhost:3000/usage');
console.log('   → You should see the dashboard (no 403 error)\n');

console.log('===========================================');
console.log('Auth0 Dashboard Quick Links:');
console.log('===========================================\n');

console.log('Users:    https://manage.auth0.com/dashboard/us/<tenant>/users');
console.log('Roles:    https://manage.auth0.com/dashboard/us/<tenant>/roles');
console.log('Actions:  https://manage.auth0.com/dashboard/us/<tenant>/actions/library');
console.log('Logs:     https://manage.auth0.com/dashboard/us/<tenant>/logs\n');

console.log('===========================================\n');

// Exit
process.exit(0);
