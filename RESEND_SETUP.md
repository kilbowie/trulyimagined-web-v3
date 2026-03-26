# Resend Email Service Setup

Resend is configured for all transactional emails in the Truly Imagined platform.

## 📋 Prerequisites

**Free Tier Includes:**
- 3,000 emails/month
- 100 emails/day
- Custom domain support
- API access
- No credit card required for signup

## 🔧 1. Create Resend Account

1. Go to https://resend.com/signup
2. Sign up with GitHub or email
3. Verify your email address
4. Complete onboarding

## 🔑 2. Generate API Key

1. Navigate to **API Keys** in the dashboard
2. Click **Create API Key**
3. Name: `trulyimagined-production`
4. Permission: **Sending access**
5. Copy the API key (shown only once)
6. Save to environment variables:

```bash
# .env.local (development)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Also set in Vercel dashboard for production
```

## 📧 3. Configure Sending Domain

### Option A: Use Resend's Domain (Testing Only)
For development and testing, you can use `onboarding@resend.dev`:

```bash
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME="Truly Imagined"
```

⚠️ **Important**: Resend's domain has limited delivery and is only for testing.

### Option B: Add Your Own Domain (Production)

1. **Add Domain in Resend:**
   - Go to **Domains** in Resend dashboard
   - Click **Add Domain**
   - Enter: `trulyimagined.com`
   - Click **Add**

2. **Configure DNS Records:**
   Add these records in your DNS provider (e.g., Cloudflare, GoDaddy):

   ```
   Type: TXT
   Name: @ (or trulyimagined.com)
   Value: [Resend provides this]
   
   Type: TXT
   Name: resend._domainkey
   Value: [Resend provides DKIM key]
   
   Type: MX
   Name: @ (or trulyimagined.com)
   Priority: 10
   Value: feedback-smtp.us-east-1.amazonses.com
   ```

3. **Wait for Verification:**
   - DNS propagation takes 15 minutes to 48 hours
   - Resend will automatically verify
   - You'll see a green checkmark when verified

4. **Set Environment Variables:**
   ```bash
   RESEND_FROM_EMAIL=notifications@trulyimagined.com
   RESEND_FROM_NAME="Truly Imagined"
   ```

## 🎯 4. Configure Admin Emails

Set the email addresses that should receive admin notifications (new tickets, user replies):

```bash
# Single admin
ADMIN_EMAILS=adam@kilbowieconsulting.com

# Multiple admins (comma-separated)
ADMIN_EMAILS=adam@kilbowieconsulting.com,support@trulyimagined.com
```

## 🧪 5. Enable Mock Mode (Development)

To test email functionality without sending real emails:

```bash
USE_MOCK_EMAILS=true
```

This will log email content to the console instead of sending via Resend.

## 📝 Complete Environment Variables

Add these to your `.env.local` file:

```bash
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=notifications@trulyimagined.com
RESEND_FROM_NAME="Truly Imagined"

# Admin Notifications
ADMIN_EMAILS=adam@kilbowieconsulting.com

# Mock Mode (development only)
USE_MOCK_EMAILS=true

# App URL (for email links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production (Vercel):

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=notifications@trulyimagined.com
RESEND_FROM_NAME="Truly Imagined"
ADMIN_EMAILS=adam@kilbowieconsulting.com,support@trulyimagined.com
USE_MOCK_EMAILS=false
NEXT_PUBLIC_APP_URL=https://trulyimagined.com
```

## 📬 Email Templates

The following emails are configured:

### 1. **Welcome Email** (`sendWelcomeEmail`)
- **Trigger**: New user registration
- **Recipients**: New user
- **Content**: Welcome message, role-specific guidance, dashboard link

### 2. **Identity Verification Complete** (`sendVerificationCompleteEmail`)
- **Trigger**: Stripe Identity verification success
- **Recipients**: Verified user
- **Content**: Verification level, credential issuance access

### 3. **Credential Issued** (`sendCredentialIssuedEmail`)
- **Trigger**: W3C credential created
- **Recipients**: Credential holder
- **Content**: Credential type, ID, download link

### 4. **Support Ticket Created** (`sendSupportTicketCreatedEmail`)
- **Trigger**: User creates new support ticket
- **Recipients**: Admin(s)
- **Content**: Ticket number, priority, subject, user email
- **Reply-To**: User's email

### 5. **Support Ticket Response** (`sendSupportTicketResponseEmail`)
- **Trigger**: Admin responds to ticket
- **Recipients**: Ticket creator
- **Content**: Ticket number, admin message preview, link to view

## 🔨 Usage Examples

### Send Welcome Email
```typescript
import { sendWelcomeEmail } from '@/lib/email';

await sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'Actor'
);
```

### Send Verification Complete
```typescript
import { sendVerificationCompleteEmail } from '@/lib/email';

await sendVerificationCompleteEmail(
  'user@example.com',
  'John Doe',
  'document' // or 'biometric'
);
```

### Send Credential Issued
```typescript
import { sendCredentialIssuedEmail } from '@/lib/email';

await sendCredentialIssuedEmail(
  'user@example.com',
  'John Doe',
  'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  'PerformerCredential'
);
```

### Support Ticket Notifications
These are automatically sent by the support ticket APIs:
- `/api/support/tickets` (POST) → Sends `sendSupportTicketCreatedEmail` to admins
- `/api/support/tickets/[id]/messages` (POST) → Sends `sendSupportTicketResponseEmail` to user

## 🧪 Testing

### 1. Test with Mock Mode
```bash
# Enable mock mode
USE_MOCK_EMAILS=true

# Create a support ticket or trigger any email
# Check terminal console for email output
```

### 2. Test with Resend's Test Domain
```bash
# Use Resend's onboarding domain
RESEND_FROM_EMAIL=onboarding@resend.dev
USE_MOCK_EMAILS=false

# Trigger an email - it will be sent to your inbox
```

### 3. Check Resend Dashboard
1. Go to https://resend.com/emails
2. View all sent emails
3. Check delivery status, bounce rate, opens (if enabled)

### 4. Test Email Deliverability
Send a test email to multiple providers:
- Gmail
- Outlook
- Yahoo
- Custom domain

Check:
- ✅ Arrives in inbox (not spam)
- ✅ Correct sender name/email
- ✅ Links work correctly
- ✅ Formatting renders properly

## 📊 Monitoring

### Resend Dashboard Metrics
- **Sent**: Total emails sent
- **Delivered**: Successfully delivered
- **Bounced**: Failed deliveries
- **Complained**: Spam reports
- **Opened** (if tracked): Email opens
- **Clicked** (if tracked): Link clicks

### Free Tier Limits
- **3,000 emails/month**
- **100 emails/day**

If you exceed these:
- Upgrade to **Pro Plan**: $20/month for 50,000 emails
- Or batch notifications to reduce volume

## 🔐 Best Practices

### 1. **Protect Your API Key**
- Never commit to Git
- Use environment variables
- Rotate periodically

### 2. **Use Real Domain**
- Resend's domain has poor deliverability
- Custom domain improves inbox placement
- Required for production

### 3. **Handle Failures Gracefully**
All email functions are wrapped in try-catch:
```typescript
try {
  await sendSupportTicketCreatedEmail(...);
} catch (emailError) {
  console.error('[EMAIL_ERROR]', emailError);
  // Don't fail the main request
}
```

### 4. **Monitor Bounce Rate**
- High bounce rate = bad sender reputation
- Validate email addresses before sending
- Remove invalid addresses from list

### 5. **Include Unsubscribe Link** (Future)
For marketing emails (not transactional):
- Required by CAN-SPAM Act
- Use Resend's built-in unsubscribe

## 🚀 Production Deployment

### Vercel Environment Variables
Add these in Vercel dashboard (Settings → Environment Variables):

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=notifications@trulyimagined.com
RESEND_FROM_NAME=Truly Imagined
ADMIN_EMAILS=adam@kilbowieconsulting.com
USE_MOCK_EMAILS=false
NEXT_PUBLIC_APP_URL=https://trulyimagined.com
```

### DNS Configuration
Ensure your domain DNS records are configured:
1. SPF record (TXT): Authorizes Resend to send on your behalf
2. DKIM record (TXT): Signs emails for authenticity
3. MX record (optional): Handles bounces

### Domain Verification
Before going live:
- ✅ Domain verified in Resend
- ✅ DNS records propagated (check with `dig` or `nslookup`)
- ✅ Test email sent and received
- ✅ Check spam score (use mail-tester.com)

## 🐛 Troubleshooting

### Emails Not Sending
1. **Check API key**: Correct key in environment variables?
2. **Check domain**: Verified in Resend dashboard?
3. **Check logs**: Any errors in console or Resend dashboard?
4. **Check mock mode**: `USE_MOCK_EMAILS` should be `false` in production

### Emails Going to Spam
1. **Verify domain**: DKIM and SPF records configured?
2. **Check content**: Avoid spam trigger words
3. **Warm up domain**: Start with low volume, gradually increase
4. **Test spam score**: Use mail-tester.com

### Rate Limit Exceeded
1. **Check usage**: Resend dashboard shows current usage
2. **Reduce volume**: Batch notifications or upgrade plan
3. **Upgrade**: Pro plan ($20/month) for 50,000 emails

### API Key Invalid
1. **Regenerate key**: Create new key in Resend dashboard
2. **Update everywhere**: .env.local AND Vercel dashboard
3. **Wait 1-2 minutes**: API keys take time to propagate

## 📚 Resources

- **Resend Docs**: https://resend.com/docs
- **API Reference**: https://resend.com/docs/api-reference
- **Dashboard**: https://resend.com/emails
- **Status Page**: https://status.resend.com

## ✅ Checklist

Before going live:

- [ ] Resend account created
- [ ] API key generated and saved to environment variables
- [ ] Domain added and verified in Resend
- [ ] DNS records configured (SPF, DKIM, MX)
- [ ] Admin emails configured
- [ ] Test email sent and received successfully
- [ ] Mock mode disabled in production
- [ ] Environment variables added to Vercel
- [ ] All email templates tested
- [ ] Bounce/spam rates monitored

---

**Cost**: FREE (up to 3,000 emails/month)  
**Upgrade**: $20/month for 50,000 emails (if needed later)
