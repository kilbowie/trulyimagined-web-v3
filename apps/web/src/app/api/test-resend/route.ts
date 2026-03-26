/**
 * Resend Test API Route
 *
 * Test Resend email integration by visiting:
 * http://localhost:3000/api/test-resend
 *
 * This will send a test email using your Resend API key.
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// ⚠️ IMPORTANT: Your actual API key should be in .env.local as RESEND_API_KEY
// The key in .env.local was exposed in chat and should be regenerated at https://resend.com/api-keys
const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    // Send test email (matches your example code)
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'adam@kilbowieconsulting.com',
      subject: 'Hello World',
      html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
    });

    if (error) {
      console.error('[RESEND_TEST_ERROR]', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          hint: 'Check that RESEND_API_KEY is set in .env.local',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully! Check adam@kilbowieconsulting.com',
      emailId: data?.id,
      data,
    });
  } catch (error) {
    console.error('[RESEND_TEST_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Make sure RESEND_API_KEY is set in apps/web/.env.local',
      },
      { status: 500 }
    );
  }
}
