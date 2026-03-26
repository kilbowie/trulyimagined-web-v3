/**
 * Resend API Test Script
 *
 * Simple test to verify Resend email sending works.
 * Run this script to send a test email.
 *
 * Usage:
 *   node scripts/test-resend.js
 */

import { Resend } from 'resend';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from apps/web/.env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../apps/web/.env.local');
dotenv.config({ path: envPath });

// ⚠️ IMPORTANT: Replace 're_xxxxxxxxx' with your actual Resend API key
// Or set RESEND_API_KEY in apps/web/.env.local
const resend = new Resend(process.env.RESEND_API_KEY || 're_xxxxxxxxx');

async function sendTestEmail() {
  console.log('🚀 Sending test email via Resend...\n');

  try {
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'adam@kilbowieconsulting.com',
      subject: 'Hello World - Resend Test',
      html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
    });

    console.log('✅ Email sent successfully!');
    console.log('📧 Email ID:', result.data?.id);
    console.log('📊 Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Failed to send email:');
    console.error(error);

    if (error.message && error.message.includes('API key')) {
      console.error('\n⚠️  Make sure RESEND_API_KEY is set in apps/web/.env.local');
    }
  }
}

// Run the test
sendTestEmail();
