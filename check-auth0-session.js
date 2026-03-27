/**
 * Quick verification script to check if you're logged in with the correct Auth0 account
 *
 * HOW TO USE:
 * 1. Log in to http://localhost:3000
 * 2. Open browser DevTools (F12) → Console tab
 * 3. Paste this entire script and press Enter
 * 4. Look at the output to see if you're using the correct Auth0 ID
 */

(async function checkAuth0Session() {
  console.log(
    '\n%c🔍 Auth0 Session Checker',
    'font-size: 16px; font-weight: bold; color: #0066cc;'
  );
  console.log('═══════════════════════════\n');

  try {
    // Fetch current user profile from Auth0
    const response = await fetch('/auth/profile');

    if (!response.ok) {
      console.log('%c❌ NOT LOGGED IN', 'color: red; font-weight: bold;');
      console.log('\nPlease log in first at: http://localhost:3000/auth/login');
      return;
    }

    const profile = await response.json();

    console.log('%c✅ LOGGED IN', 'color: green; font-weight: bold;');
    console.log('\n📋 Your Auth0 Session:');
    console.log('─────────────────────');
    console.log('Email:', profile.email);
    console.log('Auth0 User ID:', profile.sub);
    console.log('Name:', profile.name);
    console.log('\n🎯 Profile Status:');
    console.log('─────────────────────');

    // Check which login method was used
    const loginMethod = profile.sub.split('|')[0];
    const expectedId = 'auth0|69c0a8726e8cd2f46877d134';

    switch (loginMethod) {
      case 'auth0':
        console.log('%c✅ Login Method: Email/Password', 'color: green; font-weight: bold;');
        if (profile.sub === expectedId) {
          console.log('%c✅ CORRECT ACCOUNT!', 'color: green; font-size: 14px; font-weight: bold;');
          console.log('\nYou should be able to access the dashboard.');
          console.log('If you see role selection, there may be a database issue.');
        } else {
          console.log('%c⚠️  WRONG EMAIL/PASSWORD ACCOUNT', 'color: orange; font-weight: bold;');
          console.log(`\nExpected: ${expectedId}`);
          console.log(`Got: ${profile.sub}`);
          console.log('\nYou logged in with email/password, but NOT adamrossgreene@gmail.com');
        }
        break;

      case 'google-oauth2':
        console.log('%c❌ Login Method: Google OAuth', 'color: red; font-weight: bold;');
        console.log('%c❌ WRONG LOGIN METHOD!', 'color: red; font-size: 14px; font-weight: bold;');
        console.log('\n🔧 FIX REQUIRED:');
        console.log('1. Log out: http://localhost:3000/auth/logout');
        console.log('2. Clear cookies (F12 → Application → Cookies → Clear All)');
        console.log('3. Log in with Email + Password (NOT Google button)');
        console.log(`4. Use: adamrossgreene@gmail.com`);
        break;

      case 'facebook':
        console.log('%c❌ Login Method: Facebook', 'color: red; font-weight: bold;');
        console.log('%c❌ WRONG LOGIN METHOD!', 'color: red; font-size: 14px; font-weight: bold;');
        console.log('\nYou must use Email/Password login, not Facebook.');
        break;

      case 'github':
        console.log('%c❌ Login Method: GitHub', 'color: red; font-weight: bold;');
        console.log('%c❌ WRONG LOGIN METHOD!', 'color: red; font-size: 14px; font-weight: bold;');
        console.log('\nYou must use Email/Password login, not GitHub.');
        break;

      default:
        console.log(`⚠️  Unknown login method: ${loginMethod}`);
    }

    console.log('\n📚 More Info:');
    console.log('─────────────────────');
    console.log('• Troubleshooting: See URGENT_LOGIN_FIX.md');
    console.log('• Account Linking: See AUTH0_ACCOUNT_LINKING_GUIDE.md');
    console.log('• Database Status: Run node ./check-profile-state.js');
  } catch (error) {
    console.error('%c❌ ERROR', 'color: red; font-weight: bold;');
    console.error('Failed to check session:', error.message);
    console.log('\nMake sure the dev server is running: pnpm dev');
  }

  console.log('\n═══════════════════════════\n');
})();
