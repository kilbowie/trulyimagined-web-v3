# Email Configuration Updates Needed

## 🎯 Recommended Changes to email.ts

Update your email configuration to use multiple sending addresses:

### 1. Environment Variables

Add to `.env.local`:

```bash
# Primary sending addresses
RESEND_FROM_EMAIL=noreply@updates.kilbowieconsulting.com
RESEND_SUPPORT_EMAIL=support@updates.kilbowieconsulting.com
RESEND_ADMIN_EMAIL=notifications@updates.kilbowieconsulting.com
RESEND_FROM_NAME="Truly Imagined"

# Keep your API key
RESEND_API_KEY=re_JnatiBy1_9M4kqtTXn1F2nCyKtn9zGj4s

# App URL
NEXT_PUBLIC_APP_URL=https://trulyimagined.com

# Disable mocks in production
USE_MOCK_EMAILS=false
```

---

### 2. Update apps/web/src/lib/email.ts

**Current setup:**

```typescript
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@trulyimagined.com';
```

**Recommended update:**

```typescript
// Email addresses for different purposes
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@updates.kilbowieconsulting.com';
const SUPPORT_EMAIL = process.env.RESEND_SUPPORT_EMAIL || 'support@updates.kilbowieconsulting.com';
const ADMIN_EMAIL =
  process.env.RESEND_ADMIN_EMAIL || 'notifications@updates.kilbowieconsulting.com';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Truly Imagined';
```

---

### 3. Apply Correct Sending Addresses

#### System/Automated Emails (use FROM_EMAIL - noreply)

✅ **sendWelcomeEmail** - Keep as is
✅ **sendVerificationCompleteEmail** - Keep as is  
✅ **sendCredentialIssuedEmail** - Keep as is

#### Support-Related Emails (use SUPPORT_EMAIL with replyTo)

Update these functions:

**sendSupportTicketCreatedEmail:**

```typescript
export async function sendSupportTicketCreatedEmail(
  recipientEmail: string,
  recipientName: string,
  ticketNumber: string,
  ticketSubject: string
) {
  // ... existing code ...

  return await sendEmail({
    to: recipientEmail,
    subject,
    html,
    replyTo: SUPPORT_EMAIL, // Allow user replies
  });
}
```

**sendSupportTicketResponseEmail:**

```typescript
export async function sendSupportTicketResponseEmail(
  userEmail: string,
  userName: string,
  ticketNumber: number,
  ticketSubject: string,
  adminMessage: string
) {
  // ... existing code ...

  return await sendEmail({
    to: userEmail,
    subject,
    html,
    replyTo: SUPPORT_EMAIL, // Allow user replies
  });
}
```

**sendFeedbackResponseEmail:**

```typescript
export async function sendFeedbackResponseEmail(
  userEmail: string,
  userName: string,
  feedbackTopic: string
) {
  // ... existing code ...

  return await sendEmail({
    to: userEmail,
    subject,
    html,
    replyTo: SUPPORT_EMAIL, // Allow user replies to feedback
  });
}
```

#### Admin Notifications (use ADMIN_EMAIL)

**sendFeedbackNotificationEmail:**

```typescript
export async function sendFeedbackNotificationEmail(
  userEmail: string,
  userName: string,
  topic: string,
  feedbackText: string,
  sentiment: string | null
) {
  // ... existing code ...

  // Send to admins
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['admin@trulyimagined.com'];

  return await sendEmail({
    to: adminEmails,
    subject: emailSubject,
    html,
    replyTo: userEmail, // Admin can reply directly to user
  });
}
```

---

### 4. Update sendEmail Function

Add FROM address selection based on email type:

```typescript
async function sendEmail(
  options: SendEmailOptions & { fromType?: 'noreply' | 'support' | 'admin' }
) {
  const { to, subject, html, text, replyTo, cc, bcc, fromType = 'noreply' } = options;

  // Select appropriate FROM address
  let fromEmail = FROM_EMAIL;
  if (fromType === 'support') fromEmail = SUPPORT_EMAIL;
  if (fromType === 'admin') fromEmail = ADMIN_EMAIL;

  if (USE_MOCK) {
    console.log('\n📧 ========== MOCK EMAIL ==========');
    console.log(`From: ${FROM_NAME} <${fromEmail}>`);
    console.log(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
    if (cc) console.log(`CC: ${cc.join(', ')}`);
    if (bcc) console.log(`BCC: ${bcc.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reply-To: ${replyTo || 'N/A'}`);
    console.log('===================================\n');
    return { id: `mock-${Date.now()}` };
  }

  try {
    const data = await resend.emails.send({
      from: `${FROM_NAME} <${fromEmail}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
    });

    console.log(`📧 Email sent from ${fromEmail}: ${subject}`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    throw error;
  }
}
```

---

## 📋 Summary: Email Address Strategy

| Email Type                    | From Address   | Reply-To     | User Can Reply?                |
| ----------------------------- | -------------- | ------------ | ------------------------------ |
| Welcome                       | noreply@       | -            | ❌ No                          |
| Verification Complete         | noreply@       | -            | ❌ No                          |
| Credential Issued             | noreply@       | -            | ❌ No                          |
| Support Ticket Created        | support@       | support@     | ✅ Yes                         |
| Support Ticket Response       | support@       | support@     | ✅ Yes                         |
| Feedback Response             | support@       | support@     | ✅ Yes                         |
| Admin Notification (Feedback) | notifications@ | user's email | ✅ Yes (admin replies to user) |

---

## 🚀 Benefits of This Approach

1. **Better Organization:** Easy to filter emails by source
2. **User Experience:** Clear which emails expect replies
3. **Compliance:** noreply@ signals "don't reply" (follows best practices)
4. **Tracking:** Separate addresses make analytics easier
5. **Deliverability:** Different addresses for different purposes improves reputation
6. **Flexibility:** Can route support@ to different systems (Zendesk, etc.)

---

## 🔍 Single Address vs. Multiple Addresses

### Single Address (Not Recommended)

❌ All emails from one address  
❌ Harder to filter/organize  
❌ Mixing transactional and support  
❌ Less professional appearance  
❌ All bounces hit one address

### Multiple Addresses (Recommended) ✅

✅ Clear separation of concerns  
✅ Professional appearance  
✅ Better email client filtering  
✅ Isolated bounce/complaint rates  
✅ Easier to add functionality (like support ticketing)  
✅ Industry best practice

**Verdict:** Use **3 addresses** minimum for your use case.

---

## ⚡ Quick Implementation

You can implement this gradually:

1. **Week 1:** Set up noreply@ and support@ in Resend
2. **Week 2:** Update env vars and deploy
3. **Week 3:** Add notifications@ for admin emails
4. **Week 4:** Monitor deliverability and adjust DMARC to quarantine

**No rush** - your current setup works, this just makes it more scalable and professional.
