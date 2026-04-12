# SUPERSEDED DOCUMENT

This guide is superseded for the implementation phase.

Use these files instead:
- `docs/PRE_DEPLOYMENT_VALIDATION/00-START-HERE.md`
- `docs/PRE_DEPLOYMENT_VALIDATION/FINAL-DEPLOYMENT-CHECKLIST.md`
- `PRODUCTION_READINESS_PLAN.md`

Reason: this guide references a validation workflow that is not the active operator handoff path.

---

# How to Use the Pre-Deployment Validation Prompt

## Quick Start

1. **Open GitHub Copilot Chat** in VS Code
   - Mac: `Cmd + Shift + I`
   - Windows: `Ctrl + Shift + I`

2. **Copy the entire prompt** from `copilot-final-pre-deployment-validation.md`

3. **Paste into Copilot Chat**
   - Copilot will ask clarifying questions (answer them)
   - Copilot will review your codebase
   - Copilot will provide detailed findings

4. **Share the findings** with me (paste the Copilot response)

---

## What the Prompt Validates

### ✅ Code Isolation (Section 1)
- TI doesn't directly query HDICR database
- All TI → HDICR communication goes through HTTP with Bearer tokens
- HDICR services are not imported in TI

### ✅ Environment Configuration (Section 2)
- ENV vars are standardized (AUTH0_M2M_*, HDICR_API_URL, etc.)
- No hardcoded values
- Vercel projects have all required env vars

### ✅ Authentication & Authorization (Section 3)
- M2M token fetching works correctly
- Tokens are cached with 5-minute refresh buffer
- HDICR validates tokens (401 vs 403)
- Correlation IDs are propagated

### ✅ HTTP Communication (Section 4)
- Requests have proper headers and timeouts
- Error handling is fail-closed
- Sensitive data is never logged

### ✅ Database Configuration (Section 5)
- TI uses TI_DATABASE_URL
- HDICR uses HDICR_DATABASE_URL
- Both RDS instances have encryption and SSL enabled

### ✅ Vercel Configuration (Section 6)
- Two separate Vercel projects configured
- Environment variables set correctly
- Custom domains configured
- No secrets in git history

### ✅ Security Review (Section 8)
- No hardcoded secrets
- API requires authentication
- CORS is configured correctly
- Data is encrypted in transit and at rest

### ✅ Pre-Deployment Checklist (Section 10)
- Code quality verified
- Infrastructure ready
- Documentation complete

---

## Expected Outcome

Copilot will respond with:

1. **Summary of what's working** ✅
   - "M2M token fetching is correctly implemented"
   - "Database separation is properly configured"
   - etc.

2. **List of any issues found** (if any)
   - Severity: CRITICAL, HIGH, MEDIUM, LOW
   - Description of the issue
   - Recommendation for fix
   - Estimated time to fix

3. **GO / NO-GO Decision**
   - **GO**: You can proceed to Vercel deployment
   - **NO-GO**: You need to fix issues first
   - **CONDITIONAL GO**: Deploy now, fix minor issues later

---

## If Copilot Finds Issues

### Critical Issues (Blocks Deployment)
- Stop, don't deploy yet
- Fix the issue
- Re-run the validation prompt
- Proceed only after GO decision

### High Issues (Should Fix)
- Recommend fixing before deployment
- Can proceed if fixes are quick (< 1 hour)
- Fix immediately after deployment if necessary

### Medium/Low Issues (Can Fix Later)
- Deploy now
- Fix after deployment is live
- Monitor logs to ensure they don't impact users

---

## Timeline Estimate

- **Validation run**: 5-10 minutes (Copilot reviews your code)
- **Fixing critical issues** (if any): 1-4 hours
- **Re-validation** (if fixes were needed): 5-10 minutes
- **Final deployment**: 10-15 minutes (mostly waiting for Vercel to build)

---

## After Copilot Validation

### If GO Decision:
1. Push both repos to GitHub (if not already)
2. Go to Vercel dashboard
3. Create new projects for HDICR and TI (if not already created)
4. Set environment variables in each project
5. Connect repos to projects
6. Click "Deploy" for each

### If NO-GO Decision:
1. Review Copilot's findings
2. Fix the critical/high issues
3. Commit changes
4. Re-run this validation prompt
5. Get GO decision
6. Then proceed to Vercel deployment

---

## Questions to Ask Copilot If Issues Arise

- "How do I fix this?" → Copilot will provide exact steps
- "Is this critical?" → Copilot will explain severity
- "How long will this take?" → Copilot will estimate
- "Can I deploy anyway?" → Copilot will advise based on issue severity

---

## Checklist Before Running Validation

- [ ] Both HDICR and TI repos are on your machine (or accessible)
- [ ] Both repos are committed and pushed to GitHub
- [ ] You have Vercel projects created (or know you'll create them)
- [ ] You have Auth0 M2M credentials ready
- [ ] You have database connection strings ready
- [ ] You've made all the critical/high fixes from the backlog
- [ ] You're ready to answer clarifying questions about your setup

---

## Key Things Copilot Will Check

### Most Important:
1. ✅ TI doesn't directly query HDICR database
2. ✅ All communication is HTTP with Bearer tokens
3. ✅ Environment variables are standardized
4. ✅ Token validation works correctly
5. ✅ Database separation is correct
6. ✅ No secrets in git history
7. ✅ Vercel projects are configured

### If Any of These Fail:
- Recommendation: DO NOT DEPLOY
- Fix the issue first
- Re-validate before deploying

---

## After Deployment

Once you get GO and deploy to Vercel:

1. **Monitor logs** for 24 hours
2. **Test end-to-end** from production URLs
3. **Check error rates** in Vercel dashboard
4. **Watch response times** (should be <1s)
5. **Be ready to rollback** if issues appear

If production works well, celebrate! 🎉 You've successfully deployed two independent microservices with M2M authentication.
