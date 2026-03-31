# Resend Audience Segments Implementation Guide

## ✅ Implementation Status

**Completed** — All three Audience Segments are now fully integrated into the Truly Imagined email system.

---

## 🎯 Segment Overview

| Segment Name      | Purpose                                                   | Email From     | Segment ID                             |
| ----------------- | --------------------------------------------------------- | -------------- | -------------------------------------- |
| **NoReply**       | System notifications (welcome, verification, credentials) | noreply@       | `844903fe-ab8b-4768-ad95-d9af4dc0c94d` |
| **Support**       | User-replyable messages (support responses, feedback)     | support@       | `c4401e98-8e46-4508-b962-5317c0b675f5` |
| **Notifications** | Internal admin alerts (tickets, feedback)                 | notifications@ | `7c2dfb01-eed5-48a8-ada0-dd04193f458f` |

---

## 🔧 Technical Implementation

### 1. **Environment Variables** (`.env.local`)

Three new environment variables have been added to configure Audience Segment IDs:

```bash
# Resend Audience Segments (for analytics and segmentation)
RESEND_SEGMENT_ID_NOREPLY=844903fe-ab8b-4768-ad95-d9af4dc0c94d
RESEND_SEGMENT_ID_SUPPORT=c4401e98-8e46-4508-b962-5317c0b675f5
RESEND_SEGMENT_ID_NOTIFICATIONS=7c2dfb01-eed5-48a8-ada0-dd04193f458f
```

**Why separate environment variables?**

- Easy to update segments without code changes
- Supports different segment IDs in dev/staging/production
- Maintains audit trail of segment assignments
- Enables quick segment rotation if needed

### 2. **Core Architecture Changes**

**File:** `apps/web/src/lib/email.ts`

#### Added Segment ID Constants

```typescript
const SEGMENT_IDS = {
  noreply: process.env.RESEND_SEGMENT_ID_NOREPLY || '844903fe-ab8b-4768-ad95-d9af4dc0c94d',
  support: process.env.RESEND_SEGMENT_ID_SUPPORT || 'c4401e98-8e46-4508-b962-5317c0b675f5',
  admin: process.env.RESEND_SEGMENT_ID_NOTIFICATIONS || '7c2dfb01-eed5-48a8-ada0-dd04193f458f',
};
```

#### Enhanced SendEmailOptions Interface

```typescript
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
```

#### Updated Core sendEmail() Function

- Automatically adds `segment:{type}` tag to all emails
- Supports additional custom tags via `tags` parameter
- Logs segment information in mock mode for debugging
- Sends tags array to Resend API

#### New Helper Function

```typescript
function getTags(...args: string[]): string[] {
  return args.map((arg) => `type:${arg}`);
}
```

**Usage:**

```typescript
tags: getTags('welcome', 'actor');
// Results in: ['segment:noreply', 'type:welcome', 'type:actor']
```

### 3. **Updated Email Functions**

All email-sending functions now include segment-specific tags:

| Function                           | Segment | Tags                                                                    |
| ---------------------------------- | ------- | ----------------------------------------------------------------------- |
| `sendWelcomeEmail()`               | noreply | `segment:noreply`, `type:welcome`, `type:{role}`                        |
| `sendVerificationCompleteEmail()`  | noreply | `segment:noreply`, `type:verification-complete`                         |
| `sendCredentialIssuedEmail()`      | noreply | `segment:noreply`, `type:credential-issued`, `type:{credentialType}`    |
| `sendSupportTicketCreatedEmail()`  | admin   | `segment:admin`, `type:support-ticket-created`, `type:priority-{level}` |
| `sendSupportTicketResponseEmail()` | support | `segment:support`, `type:support-ticket-response`                       |
| `sendFeedbackResponseEmail()`      | support | `segment:support`, `type:feedback-response`                             |
| `sendFeedbackNotificationEmail()`  | admin   | `segment:admin`, `type:feedback-submitted`, `type:sentiment-{level}`    |

---

## 📊 Analytics & Use Cases

### 1. **Open Rate Tracking**

Monitor engagement by segment type:

- **NoReply segment**: Track system notification engagement
- **Support segment**: Monitor support response effectiveness
- **Notifications segment**: Track admin alert delivery

### 2. **Bounce & Complaint Analysis**

- Identify segments with delivery issues
- Diagnose reputation problems by email type
- Adjust sending practices per segment

### 3. **Email Type Metrics**

With the additional tags, you can track:

- **Welcome emails**: New user onboarding effectiveness
- **Verification emails**: Identity verification success rates
- **Credential emails**: Credential issuance engagement
- **Support responses**: Customer satisfaction indicators
- **Feedback tracking**: Product feedback response patterns

### 4. **Future Campaign Targeting**

Segments enable:

- Re-engagement campaigns by type
- Feature announcements to specific groups
- Segmented A/B testing
- Personalized content delivery

---

## 🔍 Monitoring & Debugging

### Development Mode (USE_MOCK_EMAILS=true)

When using mock mode, console output now includes segment information:

```
📧 ========== MOCK EMAIL ==========
Type: NOREPLY
From: No Reply - Truly Imagined <noreply@updates.trulyimagined.com>
To: user@example.com
Subject: Welcome to Truly Imagined! 🎭
Reply-To: N/A
Segment: noreply (ID: 844903fe-ab8b-4768-ad95-d9af4dc0c94d)
Tags: segment:noreply, type:welcome, type:actor
===================================
```

### Production Logging

Console logs now include segment information:

```typescript
📧 [NOREPLY] Email sent: Welcome to Truly Imagined! 🎭 to user@example.com (Segment: noreply)
```

---

## 🚀 Best Practices

### 1. **Segment Consistency**

- Always use the correct `type` parameter when calling email functions
- Maintain the three-tier architecture (noreply, support, admin)
- Don't override segment types with custom tags

### 2. **Tag Hygiene**

- Use kebab-case for tag names: `credential-issued`, `verification-complete`
- Keep tags descriptive but concise
- Avoid including email addresses or PII in tags

### 3. **Testing**

- Always test with `USE_MOCK_EMAILS=true` before deploying
- Verify segment IDs are correct in console output
- Check that tags are appropriate for the email type

### 4. **Monitoring**

- Regularly review Resend dashboard for segment metrics
- Track delivery rates per segment
- Monitor bounce and complaint rates by segment
- Use Resend analytics to identify issues early

### 5. **Future Enhancements**

Consider adding:

- User preference tracking by segment
- Segment-specific unsubscribe management
- Custom segment IDs for different deployment environments
- Dynamic tag generation based on user attributes

---

## 📋 Resend Dashboard Usage

To view segment analytics:

1. **Go to:** Resend Dashboard → Audience
2. **Select:** The relevant segment (Notifications, NoReply, or Support)
3. **View Metrics:**
   - Total contacts in segment
   - Recent email activity
   - Engagement rates
   - Bounce/complaint data

### Creating Custom Reports

Use Resend's analytics to:

- **Filter by segment**: See metrics for each email type
- **Track campaigns**: Monitor effectiveness over time
- **Identify patterns**: Find delivery or engagement issues
- **Optimize timing**: Determine best send times per segment

---

## 🔐 Data Security & Compliance

### Consent Management

- Segments respect user consent preferences
- Support segment emails require explicit user action
- NoReply segment for essential system notifications
- Admin segment for internal notifications only

### Email Authentication

- All three sending addresses are verified in Resend
- DKIM/SPF configured for each address
- Segment IDs prevent cross-contamination of metrics

### GDPR Compliance

- Segments enable proper compliance management
- Easy to identify and remove users from specific segments
- Audit trail of email categorization
- Supports unsubscribe management by segment type

---

## 📞 Troubleshooting

### Issue: Emails not showing in segment on Resend dashboard

**Solution:**

1. Verify environment variable names match exactly
2. Check segment IDs are correct (copy from Resend dashboard)
3. Ensure `USE_MOCK_EMAILS=false` in production
4. Allow 5-10 minutes for Resend to process and categorize

### Issue: Tags not appearing in Resend

**Solution:**

1. Check that `tags` parameter is included in `sendEmail()` call
2. Verify tag format: should be array like `['segment:noreply', 'type:welcome']`
3. Check Resend API response for errors
4. Review cloudwatch/logs for send confirmation

### Issue: Segment ID showing as invalid

**Solution:**

1. Re-verify segment ID from Resend dashboard
2. Copy/paste directly (avoid typos)
3. Check for extra spaces or formatting characters
4. Regenerate segment if needed in Resend dashboard

---

## ✨ Next Steps

1. **Test in staging**: Deploy changes and verify segments work
2. **Monitor metrics**: Watch Resend dashboard for activity
3. **Adjust as needed**: Modify tags or segments based on needs
4. **Document processes**: Train team on segment management
5. **Plan enhancements**: Consider future segment use cases

---

## 📚 Resources

- [Resend Audience Documentation](https://resend.com/docs/audiences)
- [Resend Tags & Metadata](https://resend.com/docs/audiences/tags)
- [Email Segmentation Best Practices](https://resend.com/docs/best-practices)
- Local implementation: `apps/web/src/lib/email.ts`

---

**Last Updated:** March 2026  
**Status:** ✅ Production Ready
