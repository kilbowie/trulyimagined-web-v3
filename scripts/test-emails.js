#!/usr/bin/env node
/**
 * Email System Test Script
 *
 * Run this to test all email types in development:
 * node scripts/test-emails.js
 */

import {
  sendWelcomeEmail,
  sendVerificationCompleteEmail,
  sendCredentialIssuedEmail,
  sendSupportTicketCreatedEmail,
  sendSupportTicketResponseEmail,
  sendFeedbackResponseEmail,
  sendFeedbackNotificationEmail,
} from '../apps/web/src/lib/email.js';

const TEST_USER = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'Actor',
};

async function testAllEmails() {
  console.log('🧪 Testing Email System\n');
  console.log('='.repeat(50));

  try {
    // Test 1: NoReply - Welcome Email
    console.log('\n1️⃣ Testing Welcome Email (NoReply)');
    await sendWelcomeEmail(TEST_USER.email, TEST_USER.name, TEST_USER.role);
    console.log('✅ Welcome email sent\n');

    // Test 2: NoReply - Verification Complete
    console.log('2️⃣ Testing Verification Complete (NoReply)');
    await sendVerificationCompleteEmail(TEST_USER.email, TEST_USER.name, 'enhanced');
    console.log('✅ Verification email sent\n');

    // Test 3: NoReply - Credential Issued
    console.log('3️⃣ Testing Credential Issued (NoReply)');
    await sendCredentialIssuedEmail(
      TEST_USER.email,
      TEST_USER.name,
      'cred_test123xyz',
      'VerifiedPerformerCredential'
    );
    console.log('✅ Credential email sent\n');

    // Test 4: Support - Ticket Response
    console.log('4️⃣ Testing Support Ticket Response (Support)');
    await sendSupportTicketResponseEmail(
      TEST_USER.email,
      TEST_USER.name,
      12345,
      'Help with profile setup',
      'Thank you for reaching out. I have reviewed your profile and everything looks good. Let me know if you need further assistance!'
    );
    console.log('✅ Support response email sent\n');

    // Test 5: Support - Feedback Response
    console.log('5️⃣ Testing Feedback Response (Support)');
    await sendFeedbackResponseEmail(TEST_USER.email, TEST_USER.name, 'Feature Request');
    console.log('✅ Feedback response email sent\n');

    // Test 6: Admin - New Support Ticket
    console.log('6️⃣ Testing New Support Ticket Alert (Admin)');
    await sendSupportTicketCreatedEmail(
      12345,
      TEST_USER.email,
      'Help with profile setup',
      'medium'
    );
    console.log('✅ Admin ticket alert sent\n');

    // Test 7: Admin - New Feedback
    console.log('7️⃣ Testing New Feedback Alert (Admin)');
    await sendFeedbackNotificationEmail(
      TEST_USER.email,
      TEST_USER.name,
      'Feature Request',
      'I would love to see a dark mode option for the dashboard. It would be much easier on the eyes during late-night sessions!',
      'happy'
    );
    console.log('✅ Admin feedback alert sent\n');

    console.log('='.repeat(50));
    console.log('\n🎉 All email tests completed successfully!\n');
    console.log('📧 Check your email or console output (if USE_MOCK_EMAILS=true)\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testAllEmails();
