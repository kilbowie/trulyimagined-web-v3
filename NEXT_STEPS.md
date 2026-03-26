# 🚀 Next Steps: Launch Checklist

This document guides you through testing and deploying the newly implemented MCP infrastructure.

---

## 📍 Current Status

✅ **Completed (Ready to Test)**
- Support ticket system (database schema + API + UI)
- Sentry error tracking (client/server/edge configs)
- GitHub Actions CI/CD pipeline
- Snyk + Dependabot security scanning
- Resend email service (SDK + templates)
- shadcn/ui components (select, skeleton, alert)

🔄 **Needs Configuration**
- Database migration (support tickets schema)
- Sentry DSN and authentication
- GitHub Actions secrets
- Resend API key and domain verification
- Email template testing

⏳ **Pending Implementation** (from V4 Bible)
- AWS MCP infrastructure management
- Vercel MCP deployment automation
- PostHog analytics
- Notion documentation workspace
- Full shadcn styling audit

---

## 🔧 Immediate Actions (Do These Now)

### 1. Database Migration: Support Tickets ⏱️ 2 minutes

Run the migration to create support ticket tables:

```powershell
# Connect to your database and run the migration
psql $env:DATABASE_URL -f infra/database/migrations/008_support_tickets.sql

# Or if you have the connection string in .env.local:
$env:DATABASE_URL = (Get-Content .env.local | Select-String "DATABASE_URL").ToString().Split('=')[1].Trim()
psql $env:DATABASE_URL -f infra/database/migrations/008_support_tickets.sql
```

**Verify migration:**
```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'support_%';

-- Expected output:
-- support_tickets
-- support_ticket_messages
-- support_tickets_with_user (view)
```

### 2. Install shadcn Components (if not working) ⏱️ 1 minute

If the support pages show errors about missing components:

```powershell
cd apps/web
npx shadcn@latest add select skeleton alert badge card button dialog input textarea separator avatar
```

This will install all required shadcn/ui components.

### 3. Test Support System ⏱️ 5 minutes

Start the dev server and test the support ticket flow:

```powershell
pnpm dev
```

**Test as User:**
1. Navigate to http://localhost:3000/dashboard/support
2. Click "Create New Ticket"
3. Fill in subject, select priority, add message
4. Submit ticket
5. Verify ticket appears in list
6. Click ticket to view detail page
7. Add a reply
8. Verify reply appears in conversation

**Test as Admin:**
1. Ensure your Auth0 user has "Admin" role (see `GRANT_ADMIN_ACCESS.md`)
2. Navigate to /dashboard/support
3. Verify you see all tickets (not just yours)
4. Verify you see user emails on each ticket
5. Open a ticket
6. Change status (use dropdown at top)
7. Change priority
8. Add a reply
9. Try adding an internal note (check the box)
10. Verify internal note has yellow badge

**Expected Results:**
- ✅ Tickets create successfully
- ✅ Messages post correctly
- ✅ Status updates work
- ✅ Role-based access enforced (users see own, admins see all)
- ✅ Internal notes only visible to admins
- ✅ Timestamps display correctly
- ❌ Emails not sent yet (need Resend configuration)

---

## 🔐 Service Configuration (Do These Next)

### 1. Sentry Error Tracking ⏱️ 10 minutes

**Setup:**
1. Create account: https://sentry.io/signup/
2. Create new project:
   - Platform: **Next.js**
   - Project name: **trulyimagined-web**
   - Alert frequency: **On every new issue**
3. Copy the DSN from project settings

**Add to `.env.local`:**
```bash
SENTRY_DSN=https://xxxxxxxxx@oxxxxxxxxxx.ingest.sentry.io/xxxxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxx@oxxxxxxxxxx.ingest.sentry.io/xxxxxxx
SENTRY_ENABLED=true
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=trulyimagined-web
```

**Test:**
```powershell
# Start dev server
pnpm dev

# Visit test endpoint
# http://localhost:3000/api/sentry-test

# Check Sentry dashboard for error
# Should see: "This is a test error from API route"
```

**Production (Vercel):**
Add the same environment variables in Vercel dashboard:
- Settings → Environment Variables → Add each variable
- Apply to: Production, Preview, Development

**Documentation:** See [SENTRY_SETUP.md](./SENTRY_SETUP.md) for full details.

---

### 2. Resend Email Service ⏱️ 15 minutes

**Setup:**
1. Create account: https://resend.com/signup
2. Generate API key:
   - Dashboard → API Keys → Create API Key
   - Name: `trulyimagined-production`
   - Permission: **Sending access**
3. (Optional) Add custom domain:
   - Dashboard → Domains → Add Domain
   - Enter: `trulyimagined.com`
   - Configure DNS records (SPF, DKIM, MX)

**Add to `.env.local`:**
```bash
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev  # Use for testing
RESEND_FROM_NAME="Truly Imagined"

# Admin Notifications
ADMIN_EMAILS=your-email@example.com

# Mock Mode (development only)
USE_MOCK_EMAILS=true  # Set to false to send real emails

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Test with Mock Mode:**
```powershell
# Enable mock mode in .env.local
USE_MOCK_EMAILS=true

# Create a support ticket or trigger welcome email
# Check terminal console for email content
```

**Test with Real Emails:**
```bash
# Disable mock mode
USE_MOCK_EMAILS=false

# Create support ticket
# Check your inbox (admin email) for notification
```

**Production Configuration:**
1. Add custom domain in Resend (required for good deliverability)
2. Update environment variables:
   ```bash
   RESEND_FROM_EMAIL=notifications@trulyimagined.com
   USE_MOCK_EMAILS=false
   NEXT_PUBLIC_APP_URL=https://trulyimagined.com
   ```
3. Add to Vercel environment variables

**Email Templates Included:**
- Welcome email (new user registration)
- Identity verification complete
- Credential issued
- Support ticket created (to admins)
- Support ticket response (to user)

**Documentation:** See [RESEND_SETUP.md](./RESEND_SETUP.md) for full details.

---

### 3. GitHub Actions Secrets ⏱️ 20 minutes

GitHub Actions workflows are ready but need secrets to run.

**Add in GitHub:**
Repository → Settings → Secrets and variables → Actions → New repository secret

**Required Secrets:**

#### **Vercel Deployment**
Get these from Vercel CLI or dashboard:
```powershell
# Install Vercel CLI
pnpm add -g vercel

# Link project
cd apps/web
vercel link

# Get credentials
vercel whoami  # Get your Vercel org
# Project ID is in .vercel/project.json after linking
```

Add to GitHub:
- `VERCEL_TOKEN`: Personal access token from Vercel dashboard → Settings → Tokens
- `VERCEL_ORG_ID`: Team/org slug from Vercel (e.g., `kilbowie-consulting`)
- `VERCEL_PROJECT_ID`: Project ID from `.vercel/project.json`

#### **Sentry Release Tracking**
```bash
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=trulyimagined-web
```

Get auth token: Sentry dashboard → Settings → Auth Tokens → Create New Token
- Scopes: `project:read`, `project:releases`, `org:read`

#### **Snyk Security Scanning**
```bash
SNYK_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Get token:
1. Create account: https://snyk.io/signup
2. Dashboard → Settings → General → API Token

**Test Workflows:**
```powershell
# Make a small change and push to develop branch
git checkout -b test/ci-pipeline
echo "# Test" >> README.md
git add README.md
git commit -m "test: trigger CI pipeline"
git push origin test/ci-pipeline

# Create PR to main
# Check Actions tab in GitHub for workflow runs
```

---

### 4. shadcn Styling Audit ⏱️ 30 minutes

Ensure consistent design across all dashboard pages.

**Pages to Check:**
- `/dashboard` - Overview
- `/dashboard/profile` - User profile
- `/dashboard/verifiable-credentials` - Credentials list
- `/dashboard/consent` - Consent management  
- `/dashboard/usage` - Usage tracking (if exists)
- `/dashboard/support` - Support tickets ✅ (NEW - already using shadcn)
- `/dashboard/admin` - Admin panel (if exists)

**Checklist for Each Page:**
- [ ] Uses shadcn components (Button, Card, Input, etc.)
- [ ] Color scheme matches slate theme
- [ ] Spacing consistent (p-6, gap-4 patterns)
- [ ] Typography hierarchy correct (text-2xl, text-sm, etc.)
- [ ] Loading states use Skeleton components
- [ ] Error states use Alert components
- [ ] No raw HTML buttons or inputs
- [ ] Mobile responsive (test at 375px, 768px, 1024px widths)

**Fix Non-Compliant Pages:**
Replace raw HTML with shadcn components:
```tsx
// ❌ Before
<button className="px-4 py-2 bg-blue-500">Click</button>

// ✅ After  
<Button>Click</Button>
```

---

## 🚀 AWS MCP Setup (Deferred)

Required for infrastructure management via MCP server.

**What It Enables:**
- Query RDS database status from Claude Desktop
- Check Lambda function logs
- List S3 objects
- Monitor CloudWatch alarms
- Manage AWS resources programmatically

**Setup Steps:** (Do Later)
1. Create IAM user: `trulyimagined-mcp`
2. Create least-privilege policy (see V4_IMPLEMENTATION_BIBLE.md)
3. Generate access keys
4. Add to `.env.local`:
   ```bash
   AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
   AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AWS_REGION=us-east-1
   ```
5. Create MCP server script: `scripts/mcp-servers/aws.ts`
6. Test with Claude Desktop

**Priority:** Medium (useful but not critical for MVP launch)

---

## 🚀 Vercel MCP Setup (Deferred)

Required for deployment automation via MCP server.

**What It Enables:**
- Deploy from Claude Desktop
- Check deployment status
- Manage environment variables
- View build logs
- Roll back deployments

**Setup Steps:** (Do Later)
1. Generate Vercel API token: https://vercel.com/account/tokens
2. Link project: `npx vercel link` in apps/web
3. Add to `.env.local`:
   ```bash
   VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   VERCEL_ORG_ID=team_xxxxxxxxxxxxxxxx
   VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxxxxx
   ```
4. Create MCP server script: `scripts/mcp-servers/vercel.ts`
5. Test with Claude Desktop

**Priority:** Medium (CI/CD already handles deployments)

---

## 📊 PostHog Analytics Setup (Deferred)

Required for product analytics and feature flags.

**What It Enables:**
- User behavior tracking
- Feature usage analytics
- A/B testing
- Session recording
- Funnel analysis

**Setup Steps:** (Do Later)
1. Create account: https://app.posthog.com/signup
2. Create project
3. Install SDK:
   ```bash
   pnpm add posthog-js posthog-node
   ```
4. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   ```
5. Create `apps/web/src/lib/posthog.ts`
6. Add PostHog provider to layout

**Priority:** Low (analytics not critical for initial launch)

---

## ✅ Pre-Launch Checklist

Before deploying to production:

### Infrastructure
- [ ] Database migration run successfully
- [ ] All tables and indexes created
- [ ] SSL certificate installed (if custom domain)
- [ ] Environment variables set in Vercel
- [ ] Domain DNS configured

### Services
- [ ] Sentry DSN configured and tested
- [ ] Resend API key configured
- [ ] Custom email domain verified (or using onboarding@resend.dev)
- [ ] Admin emails configured
- [ ] GitHub Actions secrets added
- [ ] All CI/CD tests passing

### Testing
- [ ] Support ticket creation works
- [ ] Support ticket messages post correctly
- [ ] Role-based access verified (user vs admin)
- [ ] Email notifications sending (or mocked)
- [ ] Error tracking capturing errors
- [ ] Security scans passing (Snyk, npm audit)

### Monitoring
- [ ] Sentry alerts configured
- [ ] GitHub Actions notifications enabled
- [ ] Resend bounce rate < 2%
- [ ] Database backup strategy confirmed

### Documentation
- [ ] SENTRY_SETUP.md reviewed
- [ ] RESEND_SETUP.md reviewed
- [ ] V4_IMPLEMENTATION_BIBLE.md familiar
- [ ] NEXT_STEPS.md (this file) completed

---

## 🐛 Troubleshooting

### Support Tickets Not Showing
- **Check**: Database migration ran? Run query: `SELECT * FROM support_tickets;`
- **Check**: User has profile? Run query: `SELECT * FROM user_profiles WHERE auth0_user_id = 'auth0|xxx';`
- **Check**: Browser console for errors?

### Emails Not Sending  
- **Check**: `RESEND_API_KEY` set in environment?
- **Check**: `USE_MOCK_EMAILS=false` in production?
- **Check**: Admin emails configured?
- **Check**: Resend dashboard for errors?

### Sentry Not Capturing Errors
- **Check**: `SENTRY_DSN` set in environment?
- **Check**: `SENTRY_ENABLED=true`?
- **Check**: Visit `/api/sentry-test` to trigger test error?
- **Check**: Sentry project DSN matches environment variable?

### GitHub Actions Failing
- **Check**: All secrets added to repository?
- **Check**: Vercel project linked correctly?
- **Check**: Snyk token has correct permissions?
- **Check**: Actions tab for detailed error logs?

### shadcn Components Not Found
- **Run**: `cd apps/web && npx shadcn@latest add select skeleton alert badge card`
- **Check**: Files exist in `apps/web/src/components/ui/`?
- **Check**: `components.json` exists in `apps/web/`?

---

## 📚 Reference Documentation

- [V4 Implementation Bible](./V4_IMPLEMENTATION_BIBLE.md) - Complete service reference
- [Sentry Setup Guide](./SENTRY_SETUP.md) - Error tracking configuration
- [Resend Setup Guide](./RESEND_SETUP.md) - Email service configuration
- [Auth0 Setup](./docs/AUTH0_SETUP.md) - Authentication configuration
- [Database Setup](./SETUP_POSTGRESQL.md) - PostgreSQL configuration

---

## 🎯 Recommended Order

**This Week:**
1. ✅ Run database migration (2 min)
2. ✅ Test support system (5 min)
3. ✅ Configure Sentry (10 min)
4. ✅ Configure Resend (15 min)
5. ✅ Test email notifications (5 min)

**Next Week:**
6. ✅ Add GitHub Actions secrets (20 min)
7. ✅ Test CI/CD pipeline (10 min)
8. ✅ Audit shadcn styling (30 min)
9. ✅ Fix any style inconsistencies (varies)

**Future:**
10. AWS MCP setup (when needed for infrastructure management)
11. Vercel MCP setup (when needed for deployment automation)
12. PostHog analytics (when ready for usage tracking)

---

## 💡 Questions or Issues?

If you encounter any problems:

1. **Check Documentation**: Review relevant setup guide
2. **Check Logs**: Browser console, terminal output, Sentry dashboard
3. **Check Environment**: Ensure all variables set correctly
4. **Test Isolation**: Try in incognito/private window
5. **Ask for Help**: Create support ticket in your own system! 😄

---

**Status**: 🟢 Ready for Testing  
**Updated**: ${new Date().toISOString().split('T')[0]}  
**Next Milestone**: Production deployment with all services configured
