# Vercel Environment Variables Setup

## 🚀 Update Vercel for Production

After updating your local `.env.local`, you need to update Vercel's environment variables for production deployment.

---

## 📝 Steps to Update

### Option 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project: **trulyimagined-web-v3**
3. Navigate to **Settings** → **Environment Variables**
4. Add/Update the following variables:

#### Required Email Variables:

```bash
# Resend API Key (⚠️ Generate new key - current one exposed)
RESEND_API_KEY=re_YOUR_NEW_KEY_HERE

# Three sending addresses
RESEND_NOREPLY_EMAIL=noreply@updates.trulyimagined.com
RESEND_SUPPORT_EMAIL=support@updates.trulyimagined.com
RESEND_ADMIN_EMAIL=notifications@updates.trulyimagined.com
RESEND_FROM_NAME=Truly Imagined

# Admin notifications recipient
ADMIN_EMAILS=admin@trulyimagined.com

# Disable mocks in production
USE_MOCK_EMAILS=false
```

5. Set each variable for **Production**, **Preview**, and **Development** environments
6. Click **Save** for each

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Set environment variables
vercel env add RESEND_API_KEY production
# (paste your new API key when prompted)

vercel env add RESEND_NOREPLY_EMAIL production
# noreply@updates.trulyimagined.com

vercel env add RESEND_SUPPORT_EMAIL production
# support@updates.trulyimagined.com

vercel env add RESEND_ADMIN_EMAIL production
# notifications@updates.trulyimagined.com

vercel env add RESEND_FROM_NAME production
# Truly Imagined

vercel env add ADMIN_EMAILS production
# adam@trulyimagined.com

vercel env add USE_MOCK_EMAILS production
# false
```

---

## 🔄 Redeploy After Updating

Environment variable changes require a redeploy to take effect:

```bash
# Via CLI
vercel --prod

# Or trigger via Dashboard
# Go to Deployments → Click "Redeploy" on latest deployment
```

---

## ⚠️ Security: Generate New API Key

Your Resend API key was exposed in our conversation. Generate a new one:

1. Go to https://resend.com/api-keys
2. Click **Create API Key**
3. Name: `trulyimagined-production`
4. Permission: **Sending access**
5. Copy the key (shown only once!)
6. Update in:
   - Local `.env.local`
   - Vercel environment variables
7. **Delete the old key** from Resend dashboard

---

## 🧪 Test Production Deployment

After redeploying with new environment variables:

1. **Create a test account** on production
2. **Verify welcome email** arrives from `noreply@updates.trulyimagined.com`
3. **Submit feedback** and check admin receives email from `notifications@updates.trulyimagined.com`
4. **Create support ticket** and verify responses come from `support@updates.trulyimagined.com`

---

## 📊 Monitor Email Deliverability

### In Resend Dashboard:

- Track sent/delivered/bounced emails
- Monitor bounce rate (keep < 5%)
- Check complaint rate (keep < 0.1%)
- Review DMARC alignment

### In Application Logs:

Look for these log messages:

```
📧 [NOREPLY] Email sent: Welcome to Truly Imagined! to user@example.com
📧 [SUPPORT] Email sent: Response to Support Ticket #123 to user@example.com
📧 [ADMIN] Email sent: New Support Ticket #123 to adam@trulyimagined.com
```

---

## 🔍 Troubleshooting

### Issue: Emails not sending in production

**Check:**

1. Environment variables are set correctly in Vercel
2. New deployment was triggered after setting variables
3. Resend API key is valid and not the exposed one
4. Domain verification in Resend dashboard shows ✅
5. Application logs show email attempts

**Fix:**

```bash
# View Vercel logs
vercel logs

# Check for email-related errors
vercel logs | grep EMAIL
```

### Issue: Emails go to spam

**Check:**

1. DMARC policy is active (see EMAIL_SETUP_GUIDE.md)
2. SPF record is correct
3. DKIM signature is verified
4. Email content isn't triggering spam filters
5. Bounce rate is low

**Test:**

- Use https://www.mail-tester.com
- Send test email and check spam score

### Issue: Wrong email address being used

**Check:**

1. `.env.local` has correct addresses
2. Vercel environment variables match
3. Code is using `type: 'noreply' | 'support' | 'admin'` correctly
4. Deployment used latest code

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] New Resend API key generated
- [ ] Old API key deleted from Resend
- [ ] All 6 email variables set in Vercel
- [ ] Variables set for Production environment
- [ ] Application redeployed
- [ ] Welcome email sends from `noreply@`
- [ ] Support emails send from `support@`
- [ ] Admin alerts send to `adam@trulyimagined.com` from `notifications@`
- [ ] Emails use correct branding and logo
- [ ] All templates display correctly
- [ ] Links in emails work
- [ ] No emails going to spam

---

## 📚 Reference

- **Resend Dashboard:** https://resend.com/emails
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Email Setup Guide:** See EMAIL_SETUP_GUIDE.md
- **Email System Docs:** See EMAIL_SYSTEM_COMPLETE.md

---

**Ready for production!** 🚀
