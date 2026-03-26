/**
 * Resend Email Service
 * 
 * Handles all transactional emails:
 * - Welcome emails
 * - Identity verification notifications
 * - Credential issuance alerts
 * - Support ticket notifications
 * - Consent request notifications
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@trulyimagined.com';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Truly Imagined';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trulyimagined.com';

// Mock email in development
const USE_MOCK = process.env.USE_MOCK_EMAILS === 'true';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

/**
 * Core email sending function
 */
async function sendEmail(options: SendEmailOptions) {
  const { to, subject, html, text, replyTo, cc, bcc } = options;

  if (USE_MOCK) {
    console.log('\n📧 ========== MOCK EMAIL ==========');
    console.log(`From: ${FROM_NAME} <${FROM_EMAIL}>`);
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
    if (cc) console.log(`CC: ${cc.join(', ')}`);
    if (bcc) console.log(`BCC: ${bcc.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reply-To: ${replyTo || 'N/A'}`);
    console.log(`\nHTML Body:\n${html.substring(0, 500)}...`);
    console.log('===================================\n');
    return { id: `mock-${Date.now()}` };
  }

  try {
    const data = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
    });

    console.log(`📧 Email sent successfully: ${subject} to ${Array.isArray(to) ? to.join(', ') : to}`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    throw error;
  }
}

/**
 * Welcome email after user registration
 */
export async function sendWelcomeEmail(userEmail: string, userName: string, role: string) {
  const subject = `Welcome to Truly Imagined! 🎭`;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .content p { margin: 0 0 16px; }
        .content ul { margin: 16px 0; padding-left: 20px; }
        .content li { margin: 8px 0; }
        .button { display: inline-block; padding: 14px 28px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 500; }
        .button:hover { background: #4338CA; }
        .footer { padding: 30px; text-align: center; font-size: 13px; color: #6b7280; background: #f9fafb; border-top: 1px solid #e5e7eb; }
        .footer a { color: #4F46E5; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎭 Welcome to Truly Imagined!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Thank you for joining Truly Imagined, the global performer digital identity registry. We're excited to have you as a <strong>${role}</strong> on our platform!</p>
          
          <p>Your account has been created successfully. You can now:</p>
          <ul>
            <li>Complete your ${role.toLowerCase()} profile</li>
            <li>Verify your identity with Stripe Identity</li>
            <li>Issue W3C verifiable credentials</li>
            <li>Manage consent preferences</li>
            ${role === 'Actor' ? '<li>Upload your media and headshots</li>' : ''}
            ${role === 'Agent' ? '<li>Manage your talent roster</li>' : ''}
          </ul>

          <center>
            <a href="${APP_URL}/dashboard" class="button">Go to Dashboard →</a>
          </center>

          <p>If you have any questions, simply reply to this email or visit our support center in the dashboard.</p>
          
          <p>Best regards,<br>The Truly Imagined Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Truly Imagined. All rights reserved.</p>
          <p>Kilbowie Consulting | Glasgow, UK</p>
          <p><a href="${APP_URL}/privacy">Privacy Policy</a> | <a href="${APP_URL}/terms">Terms of Service</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
}

/**
 * Identity verification completed notification
 */
export async function sendVerificationCompleteEmail(
  userEmail: string,
  userName: string,
  verificationLevel: string
) {
  const subject = '✅ Identity Verification Complete';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .badge { display: inline-block; padding: 8px 16px; background: #d1fae5; color: #065f46; border-radius: 6px; font-weight: 600; margin: 16px 0; }
        .button { display: inline-block; padding: 14px 28px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 500; }
        .footer { padding: 30px; text-align: center; font-size: 13px; color: #6b7280; background: #f9fafb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Identity Verification Complete!</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>Great news! Your identity verification has been successfully completed.</p>
          
          <p><strong>Verification Level:</strong> <span class="badge">${verificationLevel.toUpperCase()}</span></p>

          <p>You now have access to:</p>
          <ul>
            <li>Issue W3C verifiable credentials</li>
            <li>Full profile features</li>
            <li>Enhanced trust score</li>
            <li>Premium platform capabilities</li>
          </ul>

          <center>
            <a href="${APP_URL}/dashboard/verifiable-credentials" class="button">Issue Your First Credential →</a>
          </center>

          <p>Best regards,<br>The Truly Imagined Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Truly Imagined</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
}

/**
 * Credential issued notification
 */
export async function sendCredentialIssuedEmail(
  userEmail: string,
  userName: string,
  credentialId: string,
  credentialType: string
) {
  const subject = '🎫 Verifiable Credential Issued';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .code-block { background: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; margin: 16px 0; word-break: break-all; }
        .button { display: inline-block; padding: 14px 28px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 500; }
        .footer { padding: 30px; text-align: center; font-size: 13px; color: #6b7280; background: #f9fafb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎫 Verifiable Credential Issued</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          <p>A new W3C verifiable credential has been issued to your account.</p>
          
          <p><strong>Credential Type:</strong> ${credentialType}</p>
          <p><strong>Credential ID:</strong></p>
          <div class="code-block">${credentialId}</div>

          <p>You can now:</p>
          <ul>
            <li>Download this credential from your dashboard</li>
            <li>Share it with verifiers securely</li>
            <li>Present it for authentication</li>
            <li>Store it in your digital wallet</li>
          </ul>

          <center>
            <a href="${APP_URL}/dashboard/verifiable-credentials" class="button">View Credential →</a>
          </center>

          <p>Best regards,<br>The Truly Imagined Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Truly Imagined</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
}

/**
 * Support ticket created notification (to admins)
 */
export async function sendSupportTicketCreatedEmail(
  ticketNumber: number,
  userEmail: string,
  subject: string,
  priority: string
) {
  const emailSubject = `🎫 New Support Ticket #${ticketNumber} - ${priority.toUpperCase()}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: white; }
        .priority-${priority} { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 12px; }
        .priority-low { background: #e0f2fe; color: #0369a1; }
        .priority-medium { background: #dbeafe; color: #1e40af; }
        .priority-high { background: #fed7aa; color: #c2410c; }
        .priority-critical { background: #fee2e2; color: #b91c1c; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🎫 New Support Ticket</h2>
        <p><strong>Ticket #${ticketNumber}</strong> <span class="priority-${priority}">${priority.toUpperCase()}</span></p>
        <p><strong>From:</strong> ${userEmail}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <center>
          <a href="${APP_URL}/dashboard/support/${ticketNumber}" class="button">View Ticket →</a>
        </center>
      </div>
    </body>
    </html>
  `;

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['admin@trulyimagined.com'];

  return await sendEmail({
    to: adminEmails,
    subject: emailSubject,
    html,
    replyTo: userEmail,
  });
}

/**
 * Support ticket response notification (to user)
 */
export async function sendSupportTicketResponseEmail(
  userEmail: string,
  userName: string,
  ticketNumber: number,
  ticketSubject: string,
  adminMessage: string
) {
  const subject = `💬 Response to Support Ticket #${ticketNumber}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: white; }
        .message { background: #f9fafb; padding: 20px; border-left: 4px solid #4F46E5; margin: 20px 0; border-radius: 4px; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>💬 New Response to Your Support Ticket</h2>
        <p>Hi ${userName},</p>
        <p>Our support team has responded to your ticket <strong>#${ticketNumber}</strong>: "${ticketSubject}"</p>
        
        <div class="message">
          <p>${adminMessage.substring(0, 200)}${adminMessage.length > 200 ? '...' : ''}</p>
        </div>

        <center>
          <a href="${APP_URL}/dashboard/support/${ticketNumber}" class="button">View Full Response →</a>
        </center>

        <p>You can reply directly from the dashboard.</p>
        <p>Best regards,<br>Support Team</p>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({ to: userEmail, subject, html });
}

export { sendEmail };
