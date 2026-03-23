// Quick Auth0 Configuration Test Script
// Run with: node test-auth.js

const config = {
  domain: 'kilbowieconsulting.uk.auth0.com',
  clientId: 'WBTni4zvVbapAMw0qm9ViccWqoj6AJ1e',
  baseUrl: 'http://localhost:3000',
  audience: 'https://api.trulyimagined.com',
};

console.log('🔍 Testing Auth0 Configuration\n');
console.log('Configuration:');
console.log('  Domain:', config.domain);
console.log('  Client ID:', config.clientId);
console.log('  Base URL:', config.baseUrl);
console.log('  Audience:', config.audience);
console.log('\n✅ Expected Callback URL:', `${config.baseUrl}/api/auth/callback`);
console.log('✅ Expected Login URL:', `${config.baseUrl}/api/auth/login`);
console.log('✅ Expected Logout URL:', `${config.baseUrl}/api/auth/logout`);
console.log('\n🔗 Testing endpoints...\n');

async function testEndpoint(url, name) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Auth0-Test-Script',
      },
    });

    console.log(`${name}:`);
    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Location: ${response.headers.get('location') || 'N/A'}`);

    if (response.status >= 400) {
      const body = await response.text();
      console.log(`  Error: ${body.substring(0, 200)}`);
    }
    console.log('');

    return response.status;
  } catch (error) {
    console.log(`${name}: ❌ FAILED`);
    console.log(`  Error: ${error.message}\n`);
    return null;
  }
}

async function runTests() {
  const healthStatus = await testEndpoint('http://localhost:3000/api/health', 'Health Check');
  const loginStatus = await testEndpoint('http://localhost:3000/api/auth/login', 'Login Endpoint');

  console.log('\n📊 Test Results:');
  console.log(`  Health: ${healthStatus === 200 ? '✅ OK' : '❌ FAILED'}`);
  console.log(
    `  Login: ${loginStatus === 302 || loginStatus === 307 ? '✅ OK (Redirect)' : '❌ FAILED'}`
  );

  console.log('\n' + '='.repeat(60));
  console.log('⚠️  IMPORTANT: Production App Sharing Issue');
  console.log('='.repeat(60));
  console.log('\nYou mentioned production is using the same Auth0 app.');
  console.log('\n🚨 This CAN cause issues if:');
  console.log("  1. Callback URLs don't include localhost:3000/api/auth/callback");
  console.log('  2. Production uses different callback routes (e.g., /auth vs /api/auth)');
  console.log('  3. Session secrets differ between environments');
  console.log('\n✅ RECOMMENDED SOLUTION:');
  console.log('  Create a SEPARATE Auth0 Application for development:');
  console.log('  • Name: "Truly Imagined - Development"');
  console.log('  • Type: Regular Web Application');
  console.log('  • Callback: http://localhost:3000/api/auth/callback');
  console.log('  • Logout URL: http://localhost:3000');
  console.log('  • Same API (https://api.trulyimagined.com) - this can be shared');
  console.log('\nThis prevents dev/prod conflicts and allows different configurations.');
}

runTests();
