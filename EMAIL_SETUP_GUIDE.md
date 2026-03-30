# Email Setup Guide: Resend + Cloudflare

## 📧 Configuration Summary

**Domain:** `updates.kilbowieconsulting.com`  
**Provider:** Resend (via AWS SES)  
**DNS:** Cloudflare  
**Region:** eu-west-1 (Ireland)

---

## ✅ Setup Checklist

### Phase 1: Domain Verification (15 minutes)

- [ ] Add domain in Resend dashboard
- [ ] Add 3 DNS records to Cloudflare (TXT verification, MX, DKIM)
- [ ] Wait 5 minutes for propagation
- [ ] Verify domain in Resend
- [ ] Send test email

### Phase 2: Security Records (10 minutes)

- [ ] Add SPF record (if not auto-added)
- [ ] Add DMARC record (start with `p=none`)
- [ ] Monitor DMARC reports for 1 week
- [ ] Upgrade to `p=quarantine` after testing

### Phase 3: Production Configuration (5 minutes)

- [ ] Update .env.local with sending addresses
- [ ] Test all email types in production
- [ ] Monitor Resend dashboard for bounces/complaints

---

## 🎯 Recommended Sending Addresses

| Address                                        | Purpose              | Reply Expected? | ENV Variable    |
| ---------------------------------------------- | -------------------- | --------------- | --------------- |
| `noreply@updates.kilbowieconsulting.com`       | System notifications | ❌ No           | `EMAIL_NOREPLY` |
| `support@updates.kilbowieconsulting.com`       | Support & feedback   | ✅ Yes          | `EMAIL_SUPPORT` |
| `notifications@updates.kilbowieconsulting.com` | Admin alerts         | ✅ Yes          | `EMAIL_ADMIN`   |

---

## 🔧 Cloudflare DNS Records

### Required Records for Resend

Add these to Cloudflare DNS (updates.kilbowieconsulting.com subdomain):

```dns
# 1. Domain Verification (get from Resend dashboard)
Type: TXT
Name: updates
Content: [Resend verification string]
Proxy: DNS only (grey cloud)

# 2. MX Record for Receiving
Type: MX
Name: updates
Mail server: feedback-smtp.eu-west-1.amazonses.com
Priority: 10
Proxy: DNS only

# 3. DKIM Key (get from Resend dashboard)
Type: TXT
Name: resend._domainkey.updates
Content: [DKIM public key from Resend]
Proxy: DNS only

# 4. SPF Record (prevents spoofing)
Type: TXT
Name: updates
Content: v=spf1 include:amazonses.com ~all
Proxy: DNS only

# 5. DMARC Policy (start with monitoring)
Type: TXT
Name: _dmarc.updates
Content: v=DMARC1; p=none; rua=mailto:dmarc@kilbowieconsulting.com; pct=100
Proxy: DNS only
```

---

## 🔒 DMARC Policy Progression

### Week 1-2: Monitor Mode

```
v=DMARC1; p=none; rua=mailto:dmarc@kilbowieconsulting.com; ruf=mailto:dmarc@kilbowieconsulting.com; pct=100
```

- Collect data, no enforcement
- Review aggregate reports

### Week 3-4: Quarantine Mode

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@kilbowieconsulting.com; pct=100; adkim=s; aspf=s
```

- Failed emails go to spam
- Most recommended for production

### Optional: Reject Mode (Strictest)

```
v=DMARC1; p=reject; rua=mailto:dmarc@kilbowieconsulting.com; pct=100; adkim=s; aspf=s
```

- Failed emails blocked entirely
- Use only if 99%+ pass rate

---

## 🎨 BIMI (Optional - Requires Trademark)

**Cost:** $1,500-2,000/year for Verified Mark Certificate  
**Benefit:** Logo shows in Gmail/Apple Mail inbox

**Requirements:**

- DMARC policy = `quarantine` or `reject`
- Registered trademark (USPTO/EUIPO)
- VMC from DigiCert or Entrust
- SVG logo meeting BIMI specs

**DNS Record:**

```dns
Type: TXT
Name: default._bimi.updates
Content: v=BIMI1; l=https://kilbowieconsulting.com/bimi/logo.svg; a=https://kilbowieconsulting.com/bimi/vmc.pem
```

**Recommendation:** ⏸️ Skip for now unless budget allows. BIMI is not critical for deliverability.

---

## 📝 Environment Variables

Update your `.env.local`:

```bash
# Resend Configuration
RESEND_API_KEY=re_JnatiBy1_9M4kqtTXn1F2nCyKtn9zGj4s
RESEND_FROM_EMAIL=noreply@updates.kilbowieconsulting.com
RESEND_FROM_NAME="Truly Imagined"

# Support Email (with reply capability)
RESEND_SUPPORT_EMAIL=support@updates.kilbowieconsulting.com

# Admin Notifications
RESEND_ADMIN_EMAIL=notifications@updates.kilbowieconsulting.com

# Testing
USE_MOCK_EMAILS=false
```

Also add to **Vercel** → Project Settings → Environment Variables.

---

## 🧪 Testing Checklist

After setup, test each email type:

```bash
# Test from your app or via API
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"type": "welcome", "email": "your-email@gmail.com"}'
```

**Test these scenarios:**

- [ ] Welcome email → Check inbox
- [ ] Verification complete → Check inbox
- [ ] Credential issued → Check inbox
- [ ] Support ticket created → Check inbox + Reply-To header
- [ ] Support ticket response → Check inbox + Reply-To header
- [ ] Feedback response → Check inbox
- [ ] Admin feedback notification → Check inbox

---

## 📊 Monitoring & Deliverability

### Resend Dashboard

- Track sent/delivered/bounced/complained
- Monitor sending limits (100 emails/day on free tier)

### DMARC Reports

- Sign up for free DMARC monitoring: https://dmarc.postmarkapp.com
- Analyze weekly reports
- Fix any failures before moving to `p=quarantine`

### Email Testing Tools

- https://www.mail-tester.com (spam score)
- https://mxtoolbox.com/SuperTool.aspx (DNS health)
- https://www.learndmarc.com (DMARC validator)

---

## 🚨 Troubleshooting

### Issue: Emails not delivered

1. Check Resend dashboard for errors
2. Verify DNS records: `nslookup -type=TXT updates.kilbowieconsulting.com`
3. Check spam folder
4. Review DMARC reports for failures

### Issue: "Domain not verified"

1. Wait 5-10 minutes after adding DNS records
2. Clear DNS cache: `ipconfig /flushdns` (Windows)
3. Verify records with MXToolbox
4. Try verify again in Resend

### Issue: High spam score

1. Run email through mail-tester.com
2. Ensure DKIM, SPF, DMARC all pass
3. Check content for spam triggers
4. Add unsubscribe link for marketing emails

---

## 📚 Additional Resources

- **Resend Docs:** https://resend.com/docs
- **DMARC Guide:** https://dmarc.org/overview/
- **Cloudflare DNS:** https://developers.cloudflare.com/dns/
- **Email Best Practices:** https://www.sparkpost.com/resources/email-explained/

---

## 💡 Pro Tips

1. **Start with monitoring DMARC** (`p=none`) for at least a week
2. **Use separate addresses** for different email types (improves organization and tracking)
3. **Always include unsubscribe** for marketing/newsletter content (not needed for transactional)
4. **Monitor bounce rates** - keep under 5% for good reputation
5. **Warm up sending** - gradually increase volume if sending bulk
6. **Test on multiple clients** - Gmail, Outlook, Apple Mail
7. **Keep HTML simple** - complex CSS can trigger spam filters

---

**Questions?** Check Resend's documentation or their support team for domain-specific issues.
