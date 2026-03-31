/**
 * Resend Email Service
 *
 * Handles all transactional emails with three sending addresses:
 * - noreply@updates.trulyimagined.com: System notifications (welcome, verification, credentials)
 * - support@updates.trulyimagined.com: Support tickets and user-replyable messages
 * - notifications@updates.trulyimagined.com: Internal admin notifications
 *
 * All emails are tagged with Resend Audience Segment IDs for analytics and segmentation.
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Three sending addresses for different email types
const NOREPLY_EMAIL = process.env.RESEND_NOREPLY_EMAIL || 'noreply@updates.trulyimagined.com';
const SUPPORT_EMAIL = process.env.RESEND_SUPPORT_EMAIL || 'support@updates.trulyimagined.com';
const ADMIN_EMAIL = process.env.RESEND_ADMIN_EMAIL || 'notifications@updates.trulyimagined.com';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Truly Imagined';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trulyimagined.com';
const LOGO_URL = 'https://assets.trulyimagined.com/logo.png';

// Resend Audience Segment IDs (for analytics and segmentation)
const SEGMENT_IDS = {
  noreply: process.env.RESEND_SEGMENT_ID_NOREPLY || '844903fe-ab8b-4768-ad95-d9af4dc0c94d',
  support: process.env.RESEND_SEGMENT_ID_SUPPORT || 'c4401e98-8e46-4508-b962-5317c0b675f5',
  admin: process.env.RESEND_SEGMENT_ID_NOTIFICATIONS || '7c2dfb01-eed5-48a8-ada0-dd04193f458f',
};

// Mock email in development
const USE_MOCK = process.env.USE_MOCK_EMAILS === 'true';

type EmailType = 'noreply' | 'support' | 'admin';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  type: EmailType;
  tags?: string[]; // Additional custom tags for Resend
}

/**
 * Core email sending function
 */
async function sendEmail(options: SendEmailOptions) {
  const { to, subject, html, text, replyTo, cc, bcc, type, tags: customTags } = options;

  // Select FROM address based on email type
  let fromEmail = NOREPLY_EMAIL;
  let fromLabel = `No Reply - ${FROM_NAME}`;
  let segmentId = SEGMENT_IDS.noreply;

  if (type === 'support') {
    fromEmail = SUPPORT_EMAIL;
    fromLabel = 'A. R. Greene'; // Support team name
    segmentId = SEGMENT_IDS.support;
  } else if (type === 'admin') {
    fromEmail = ADMIN_EMAIL;
    fromLabel = 'Admin Alerts';
    segmentId = SEGMENT_IDS.admin;
  }

  // Combine segment tag with custom tags
  const allTags = [`segment:${type}`, ...(customTags || [])];

  if (USE_MOCK) {
    console.log('\n📧 ========== MOCK EMAIL ==========');
    console.log(`Type: ${type.toUpperCase()}`);
    console.log(`From: ${fromLabel} <${fromEmail}>`);
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
    if (cc) console.log(`CC: ${cc.join(', ')}`);
    if (bcc) console.log(`BCC: ${bcc.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reply-To: ${replyTo || 'N/A'}`);
    console.log(`Segment: ${type} (ID: ${segmentId})`);
    if (customTags?.length) console.log(`Tags: ${allTags.join(', ')}`);
    console.log('===================================\n');
    return { id: `mock-${Date.now()}` };
  }

  try {
    // Note: Email segmentation is handled via Resend Audience Segments
    // (configured via environment variables) and logged for monitoring.
    // The tags array is maintained for logging and future extensibility.

    const data = await resend.emails.send({
      from: `${fromLabel} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
    });

    console.log(
      `📧 [${type.toUpperCase()}] Email sent: ${subject} to ${Array.isArray(to) ? to.join(', ') : to} (Segment: ${type})`
    );
    return data;
  } catch (error) {
    console.error(`[EMAIL ERROR - ${type.toUpperCase()}]`, error);
    throw error;
  }
}

/**
 * Helper function to create tags for email segmentation
 * Usage: getTags('welcome', 'actor') => ['type:welcome', 'role:actor']
 */
function getTags(...args: string[]): string[] {
  return args.map((arg) => `type:${arg}`);
}

/**
 * Template: NoReply Email Style
 * Used for system notifications where no reply is expected
 */
function createNoReplyTemplate(
  emailSubject: string,
  bodyContent: string,
  actionLabel: string,
  actionUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
        .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: #000000; padding: 30px; text-align: center; }
        .header img { max-width: 200px; height: auto; }
        .content { padding: 40px 30px; }
        .content h1 { margin: 0 0 20px; font-size: 24px; color: #1a1a1a; }
        .content p { margin: 0 0 16px; line-height: 1.6; color: #4a4a4a; }
        .button { display: inline-block; padding: 14px 28px; background: #000000; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 500; }
        .button:hover { background: #333333; }
        .fallback-link { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; font-size: 13px; color: #666; }
        .fallback-link a { color: #c9a05c; text-decoration: none; }
        .signature { margin: 30px 0 0; color: #666; }
        .footer { background: #000000; color: #999999; padding: 30px; text-align: center; font-size: 12px; }
        .footer p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <img src="${LOGO_URL}" alt="Truly Imagined" />
        </div>
        <div class="content">
          <h1>${emailSubject}</h1>
          ${bodyContent}
          <center>
            <a href="${actionUrl}" class="button">${actionLabel} →</a>
          </center>
          <div class="fallback-link">
            If the button above does not work, copy and paste the following link into your browser:<br>
            <a href="${actionUrl}">${actionUrl}</a>
          </div>
          <div class="signature">
            <p>Yours Truly,</p>
            <p><strong>Truly Imagined Studios</strong></p>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message — please do not reply to this address</p>
          <p>For assistance, contact <a href="mailto:support@trulyimagined.com" style="color: #c9a05c;">support@trulyimagined.com</a></p>
          <p>© ${new Date().getFullYear()} Truly Imagined Studios - Glasgow, Scotland, UK</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template: Support Update Style
 * Used for support tickets and feedback responses where replies are expected
 */
function createSupportTemplate(
  greeting: string,
  bodyContent: string,
  actionLabel: string,
  actionUrl: string,
  senderName: string = 'A. R. Greene',
  senderTitle: string = 'Founder - Truly Imagined Studios'
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
        .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: #000000; padding: 30px; text-align: center; }
        .header img { max-width: 200px; height: auto; }
        .content { padding: 40px 30px; }
        .content p { margin: 0 0 16px; line-height: 1.6; color: #4a4a4a; }
        .button { display: inline-block; padding: 14px 28px; background: #000000; color: #ffffff !important; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 500; }
        .fallback-link { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; font-size: 13px; color: #666; }
        .fallback-link a { color: #c9a05c; text-decoration: none; }
        .signature { margin: 30px 0 0; color: #4a4a4a; }
        .signature .name { font-weight: 600; color: #1a1a1a; margin: 5px 0; }
        .signature .title { font-size: 13px; color: #666; }
        .footer { background: #000000; color: #999999; padding: 30px; text-align: center; font-size: 11px; }
        .footer p { margin: 5px 0; }
        .footer a { color: #c9a05c; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <img src="${LOGO_URL}" alt="Truly Imagined" />
        </div>
        <div class="content">
          <p>${greeting}</p>
          ${bodyContent}
          <center>
            <a href="${actionUrl}" class="button">${actionLabel} →</a>
          </center>
          <div class="fallback-link">
            If the button above does not work, copy and paste the following link into your browser:<br>
            <a href="${actionUrl}">${actionUrl}</a>
          </div>
          <div class="signature">
            <p>Yours Very Truly,</p>
            <p class="name">${senderName}</p>
            <p class="title">${senderTitle}</p>
          </div>
        </div>
        <div class="footer">
          <p><a href="mailto:support@trulyimagined.com">support@trulyimagined.com</a> &nbsp;&nbsp;&nbsp; <a href="https://trulyimagined.com">trulyimagined.com</a></p>
          <p>© ${new Date().getFullYear()} Truly Imagined Studios - Glasgow, Scotland, UK</p>
          <p style="margin-top: 15px; font-size: 10px;">This email and any attachments are confidential and intended solely for the addressees. If you are not the intended recipient, please notify us immediately and delete this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template: Admin Notification Style
 * Used for internal system notifications and alerts
 */
function createAdminTemplate(
  eventTitle: string,
  eventSubtitle: string,
  bodyContent: string,
  metadata: { source: string; eventType: string; eventId: string; environment: string },
  actionLabel: string,
  actionUrl: string
): string {
  const timestamp = new Date().toISOString();
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Courier New', monospace; }
        .email-container { max-width: 650px; margin: 0 auto; background: #1a1a1a; color: #e0e0e0; }
        .header { background: #000000; padding: 20px 30px; border-bottom: 2px solid #c9a05c; }
        .header img { max-width: 180px; height: auto; }
        .header .notification-type { float: right; color: #c9a05c; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 10px; }
        .timestamp { background: #0a0a0a; padding: 10px 30px; text-align: right; font-size: 11px; color: #666; font-family: 'Courier New', monospace; }
        .content { padding: 30px; }
        .content h1 { margin: 0 0 5px; font-size: 26px; color: #ffffff; font-weight: 600; }
        .content .subtitle { margin: 0 0 20px; color: #999; font-size: 14px; }
        .content p { margin: 0 0 16px; line-height: 1.6; color: #cccccc; }
        .metadata { background: #0f0f0f; border: 1px solid #333; border-left: 3px solid #c9a05c; padding: 20px; margin: 25px 0; border-radius: 4px; font-size: 13px; }
        .metadata .row { margin: 8px 0; }
        .metadata .label { color: #999; display: inline-block; width: 140px; }
        .metadata .value { color: #c9a05c; font-family: 'Courier New', monospace; }
        .button { display: inline-block; padding: 12px 24px; background: #c9a05c; color: #000000 !important; text-decoration: none; border-radius: 3px; margin: 20px 0; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
        .footer { background: #000000; color: #666666; padding: 20px 30px; text-align: center; font-size: 11px; border-top: 1px solid #333; }
        .footer p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <img src="${LOGO_URL}" alt="Truly Imagined" />
          <div class="notification-type">SYSTEM NOTIFICATION</div>
          <div style="clear: both;"></div>
        </div>
        <div class="timestamp">${timestamp}</div>
        <div class="content">
          <h1>${eventTitle}</h1>
          <div class="subtitle">${eventSubtitle}</div>
          ${bodyContent}
          <div class="metadata">
            <div class="row"><span class="label">Source:</span> <span class="value">${metadata.source}</span></div>
            <div class="row"><span class="label">Event type:</span> <span class="value">${metadata.eventType}</span></div>
            <div class="row"><span class="label">Event ID:</span> <span class="value">${metadata.eventId}</span></div>
            <div class="row"><span class="label">Environment:</span> <span class="value">${metadata.environment}</span></div>
          </div>
          <center>
            <a href="${actionUrl}" class="button">${actionLabel} →</a>
          </center>
        </div>
        <div class="footer">
          <p>notifications@trulyimagined.com — Do not reply to this address</p>
          <p>© ${new Date().getFullYear()} Truly Imagined Studios - Glasgow, Scotland, UK</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Welcome email after user registration (NoReply)
 */
export async function sendWelcomeEmail(userEmail: string, userName: string, role: string) {
  const subject = `Welcome to Truly Imagined! 🎭`;

  const roleFeatures =
    {
      Actor: '<li>Upload your media and headshots</li><li>Manage your performance portfolio</li>',
      Agent: '<li>Manage your talent roster</li><li>Access casting opportunities</li>',
      Enterprise: '<li>Post casting calls</li><li>Search verified performers</li>',
    }[role] || '';

  const bodyContent = `
    <p>Hi ${userName},</p>
    <p>Thank you for joining <strong>Truly Imagined</strong>, the global performer digital identity registry. We're excited to have you as a <strong>${role}</strong> on our platform!</p>
    <p>Your account has been created successfully. You can now:</p>
    <ul style="line-height: 1.8; color: #4a4a4a;">
      <li>Complete your ${role.toLowerCase()} profile</li>
      <li>Verify your identity with Stripe Identity</li>
      <li>Issue W3C verifiable credentials</li>
      <li>Manage consent preferences</li>
      ${roleFeatures}
    </ul>
    <p>Get started by visiting your dashboard and completing your profile.</p>
  `;

  const html = createNoReplyTemplate(
    subject,
    bodyContent,
    'Go to Dashboard',
    `${APP_URL}/dashboard`
  );

  return await sendEmail({
    to: userEmail,
    subject,
    html,
    type: 'noreply',
    tags: getTags('welcome', role.toLowerCase()),
  });
}

/**
 * Identity verification completed notification (NoReply)
 */
export async function sendVerificationCompleteEmail(
  userEmail: string,
  userName: string,
  verificationLevel: string
) {
  const subject = '✅ Identity Verification Complete';

  const bodyContent = `
    <p>Hi ${userName},</p>
    <p>Great news! Your identity verification has been successfully completed.</p>
    <p><strong>Verification Level:</strong> <span style="display: inline-block; padding: 6px 14px; background: #d1fae5; color: #065f46; border-radius: 6px; font-weight: 600;">${verificationLevel.toUpperCase()}</span></p>
    <p>You now have access to:</p>
    <ul style="line-height: 1.8; color: #4a4a4a;">
      <li>Issue W3C verifiable credentials</li>
      <li>Full profile features</li>
      <li>Enhanced trust score</li>
      <li>Premium platform capabilities</li>
    </ul>
    <p>Start by issuing your first verifiable credential from your dashboard.</p>
  `;

  const html = createNoReplyTemplate(
    subject,
    bodyContent,
    'Issue Your First Credential',
    `${APP_URL}/dashboard/verifiable-credentials`
  );

  return await sendEmail({
    to: userEmail,
    subject,
    html,
    type: 'noreply',
    tags: getTags('verification-complete'),
  });
}

/**
 * Credential issued notification (NoReply)
 */
export async function sendCredentialIssuedEmail(
  userEmail: string,
  userName: string,
  credentialId: string,
  credentialType: string
) {
  const subject = '🎫 Verifiable Credential Issued';

  const bodyContent = `
    <p>Hi ${userName},</p>
    <p>A new <strong>W3C verifiable credential</strong> has been issued to your account.</p>
    <p><strong>Credential Type:</strong> ${credentialType}</p>
    <p><strong>Credential ID:</strong></p>
    <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; margin: 16px 0; word-break: break-all; color: #1a1a1a;">${credentialId}</div>
    <p>You can now:</p>
    <ul style="line-height: 1.8; color: #4a4a4a;">
      <li>Download this credential from your dashboard</li>
      <li>Share it with verifiers securely</li>
      <li>Present it for authentication</li>
      <li>Store it in your digital wallet</li>
    </ul>
  `;

  const html = createNoReplyTemplate(
    subject,
    bodyContent,
    'View Credential',
    `${APP_URL}/dashboard/verifiable-credentials`
  );

  return await sendEmail({
    to: userEmail,
    subject,
    html,
    type: 'noreply',
    tags: getTags('credential-issued', credentialType.toLowerCase()),
  });
}

/**
 * Support ticket created notification (Admin)
 * Sends to admin team when user creates a ticket
 */
export async function sendSupportTicketCreatedEmail(
  ticketNumber: number,
  userEmail: string,
  subject: string,
  priority: string
) {
  const emailSubject = `🎫 New Support Ticket #${ticketNumber}`;

  const priorityColors = {
    low: '#3b82f6',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  };

  const bodyContent = `
    <p>A new support ticket has been created and requires attention.</p>
    <p><strong>Ticket #${ticketNumber}</strong> <span style="display: inline-block; padding: 4px 12px; background: ${priorityColors[priority as keyof typeof priorityColors] || '#6b7280'}; color: white; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${priority}</span></p>
    <p><strong>From:</strong> ${userEmail}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p>Click below to view and respond to this ticket.</p>
  `;

  const html = createAdminTemplate(
    `New Support Ticket #${ticketNumber}`,
    `Priority: ${priority.toUpperCase()} | From: ${userEmail}`,
    bodyContent,
    {
      source: 'Support System',
      eventType: 'ticket.created',
      eventId: `ticket-${ticketNumber}`,
      environment: process.env.NODE_ENV || 'production',
    },
    'View Ticket',
    `${APP_URL}/dashboard/admin/support/${ticketNumber}`
  );

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['adam@trulyimagined.com'];

  return await sendEmail({
    to: adminEmails,
    subject: emailSubject,
    html,
    replyTo: userEmail,
    type: 'admin',
    tags: getTags('support-ticket-created', `priority-${priority.toLowerCase()}`),
  });
}

/**
 * Support ticket response notification (Support)
 * Sends to user when admin/agent responds to their ticket
 */
export async function sendSupportTicketResponseEmail(
  userEmail: string,
  userName: string,
  ticketNumber: number,
  ticketSubject: string,
  adminMessage: string
) {
  const subject = `💬 Response to Support Ticket #${ticketNumber}`;

  const messagePreview =
    adminMessage.length > 200 ? adminMessage.substring(0, 200) + '...' : adminMessage;

  const bodyContent = `
    <p>Our support team has responded to your ticket <strong>#${ticketNumber}</strong>: "${ticketSubject}"</p>
    <div style="background: #f9fafb; padding: 20px; border-left: 4px solid #c9a05c; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #4a4a4a;">${messagePreview}</p>
    </div>
    <p>Click below to view the full response and continue the conversation.</p>
  `;

  const html = createSupportTemplate(
    `Hi ${userName},`,
    bodyContent,
    'View Full Response',
    `${APP_URL}/dashboard/support/${ticketNumber}`
  );

  return await sendEmail({
    to: userEmail,
    subject,
    html,
    type: 'support',
    replyTo: SUPPORT_EMAIL,
    tags: getTags('support-ticket-response'),
  });
}

/**
 * Response to user feedback notification (Support)
 * Sent to user when admin replies to their feedback
 */
export async function sendFeedbackResponseEmail(
  userEmail: string,
  userName: string,
  feedbackTopic: string
) {
  const subject = `💬 Response to Your Feedback`;

  console.log('[EMAIL] Preparing feedback response email:', {
    to: userEmail,
    userName,
    feedbackTopic,
    fromEmail: SUPPORT_EMAIL,
    appUrl: APP_URL,
    useMock: USE_MOCK,
  });

  const bodyContent = `
    <p>Thank you for your feedback about <strong>"${feedbackTopic}"</strong>.</p>
    <div style="background: #f9fafb; padding: 20px; border-left: 4px solid #c9a05c; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #4a4a4a;"><strong>Our team has responded to your feedback and created a support ticket so we can continue the conversation.</strong></p>
    </div>
    <p>You can view the full response and reply directly from your support dashboard.</p>
  `;

  const html = createSupportTemplate(
    `Hi ${userName},`,
    bodyContent,
    'View Response in Dashboard',
    `${APP_URL}/dashboard/support`
  );

  return await sendEmail({
    to: userEmail,
    subject,
    html,
    type: 'support',
    replyTo: SUPPORT_EMAIL,
    tags: getTags('feedback-response'),
  });
}

/**
 * User feedback notification (Admin)
 * Sent to admins when user submits feedback
 */
export async function sendFeedbackNotificationEmail(
  userEmail: string,
  userName: string,
  topic: string,
  feedbackText: string,
  sentiment: string | null
) {
  const sentimentData = {
    angry: { emoji: '😠', label: 'Angry', color: '#ef4444' },
    sad: { emoji: '☹️', label: 'Sad', color: '#f97316' },
    neutral: { emoji: '😐', label: 'Neutral', color: '#eab308' },
    happy: { emoji: '😊', label: 'Happy', color: '#10b981' },
    love: { emoji: '❤️', label: 'Love', color: '#ec4899' },
  };

  const currentSentiment = sentiment
    ? sentimentData[sentiment as keyof typeof sentimentData]
    : sentimentData.neutral;
  const emailSubject = `${currentSentiment.emoji} New User Feedback: ${topic}`;

  const bodyContent = `
    <p>A user has submitted feedback through the dashboard feedback form.</p>
    <p><strong>From:</strong> ${userName} (${userEmail})</p>
    <p><strong>Topic:</strong> <span style="display: inline-block; padding: 4px 12px; background: #e0e7ff; color: #3730a3; border-radius: 4px; font-size: 12px; font-weight: 600;">${topic}</span></p>
    ${sentiment ? `<p><strong>Sentiment:</strong> <span style="display: inline-block; padding: 6px 14px; border-radius: 6px; font-weight: 600; background: ${currentSentiment.color}22; color: ${currentSentiment.color};">${currentSentiment.emoji} ${currentSentiment.label}</span></p>` : ''}
    <p><strong>Feedback:</strong></p>
    <div style="background: #f9fafb; padding: 20px; border-left: 4px solid #c9a05c; margin: 20px 0; border-radius: 4px; white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">${feedbackText}</div>
  `;

  const html = createAdminTemplate(
    'New User Feedback',
    `${topic} | Sentiment: ${currentSentiment.label}`,
    bodyContent,
    {
      source: 'Feedback System',
      eventType: 'feedback.submitted',
      eventId: `feedback-${Date.now()}`,
      environment: process.env.NODE_ENV || 'production',
    },
    'View All Feedback',
    `${APP_URL}/dashboard/admin/feedback`
  );

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['admin@trulyimagined.com'];

  return await sendEmail({
    to: adminEmails,
    subject: emailSubject,
    html,
    replyTo: userEmail,
    type: 'admin',
    tags: getTags('feedback-submitted', `sentiment-${sentiment?.toLowerCase() || 'unknown'}`),
  });
}

export { sendEmail };
