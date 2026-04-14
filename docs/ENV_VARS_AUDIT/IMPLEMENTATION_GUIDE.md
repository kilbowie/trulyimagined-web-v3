# Production Readiness Review & Secrets Rotation
## Executive Summary & Implementation Guide

---

## What You Have

Three interconnected documents designed to prepare HDICR and TI for production:

### 1. **Copilot Production Review Prompt** (`copilot_production_review_prompt.md`)
A comprehensive GitHub Copilot prompt for VS Code that reviews both repos across 9 dimensions:
- Security & secrets management
- Error handling & observability
- Data integrity & consistency
- API design & contract stability
- Scalability & performance
- Deployment & rollback procedures
- Testing & quality assurance
- Operational readiness
- **Architectural blindspots & assumptions to challenge**

**Use this to:** Get a detailed production readiness assessment before deploying to AWS/Vercel. The prompt is designed to surface edge cases, race conditions, and failure modes you may not have considered.

**How to use:** Copy the entire prompt into a new VS Code chat with GitHub Copilot, then add the path to each repo and let Copilot scan both codebases. Output will be a detailed risk matrix.

---

### 2. **Environment Variable Audit & Rotation Framework** (`env_variable_audit_and_rotation.md`)
A complete inventory of every environment variable across HDICR and TI:
- Where each variable lives (Secrets Manager, Parameter Store, Vercel, etc.)
- How to update it
- Data classification (public, sensitive, secret)
- Rotation frequency and strategy

**Use this to:**
1. Identify which env vars are still hardcoded or in `.env.local`
2. Plan migration to secure storage (AWS Secrets Manager, Vercel env, etc.)
3. Understand the data flow between systems (which vars are shared, which are system-specific)

**Key findings from the audit:**
- **HDICR:** Database credentials, Auth0 secrets, Stripe Identity keys, JWT signing key
- **TI:** Database credentials, Auth0 secrets (different client ID/secret), Stripe Payments keys, Resend API key, AWS S3 credentials, JWT verification key
- **Shared:** Auth0 domain, JWT public key (HDICR → TI), HDICR API endpoint and M2M credentials (TI → HDICR)

---

### 3. **Secret Rotation Schedule & Calendar** (`secret_rotation_schedule.md`)
A ready-to-implement quarterly rotation calendar:
- 90-day cycle: RDS passwords, Auth0 secrets, AWS access keys, M2M credentials
- 180-day cycle: JWT signing keys, Stripe API keys, Resend API key
- Pre-rotation, during-rotation, and post-rotation checklists
- Emergency rotation procedures
- Quick reference commands (AWS CLI, Vercel CLI, etc.)

**Use this to:**
1. Schedule rotations on your calendar (quarterly starting with your prod launch date)
2. Brief your team on the rotation procedure
3. Execute rotations with confidence (step-by-step checklists)

---

## Your Next Steps (In Order)

### Phase 1: Inventory & Audit (This Week)
**Goal:** Understand your current secrets state and identify gaps

1. **Review the Environment Variable Audit** (`env_variable_audit_and_rotation.md`), Section 3
   - Go through each variable in the summary table
   - Identify which ones are still hardcoded or in `.env.local`
   - Prioritize the **Critical** items (marked in red)

2. **Run the Copilot Production Review**
   - Copy the prompt from `copilot_production_review_prompt.md`
   - Open GitHub Copilot in VS Code
   - Paste the prompt and provide paths to both repos
   - Let Copilot scan and analyze
   - Review findings and note any blockers for production

3. **Document Current State**
   - Create a spreadsheet with columns: Variable | Current Location | Target Location | Status
   - Mark each variable as:
     - ✅ Already secure (in Secrets Manager / Parameter Store / Vercel env)
     - 🟡 Partially secure (in code comments, .env.local, etc.)
     - ❌ Hardcoded or in version control

### Phase 2: Migrate to Secure Storage (1-2 Weeks)
**Goal:** Move all secrets out of code and into secure storage

1. **For HDICR (AWS Secrets Manager + Parameter Store):**
   - Create all non-secret parameters in AWS Systems Manager Parameter Store
     - Paths: `/hdicr/prod/{db,auth0,stripe,jwt}/{host,domain,client_id,publishable_key,public_key}`
   - Create all secrets in AWS Secrets Manager
     - Paths: `/hdicr/prod/{db,auth0,stripe,jwt}/{password,client_secret,secret_key,webhook_secret,signing_key}`
   - Update `template.yaml` (SAM) to reference these at deployment time
   - Test deployment in a dev environment first

2. **For TI (Vercel Environment Variables + AWS for S3 creds):**
   - Add all variables to Vercel Project Settings → Environment Variables
   - For sensitive ones (API keys, passwords), use Vercel's encrypted secrets
   - Test in a staging environment first
   - Redeploy to production once confirmed working

3. **Create `.env.example` files** (for documentation, not secrets)
   - `HDICR/.env.example` with placeholder values
   - `TI/.env.example` with placeholder values
   - These go in version control; actual secrets do not

### Phase 3: Establish Rotation Process (Before Production)
**Goal:** Set up automated or manual rotation cadence

1. **Choose rotation cadence:**
   - **Option A:** Manual rotation quarterly (pick one day per quarter, batch all rotations)
   - **Option B:** Staggered rotation (spread rotations across the quarter to reduce blast radius)
   - **Option C:** Automated rotation (use AWS Secrets Manager auto-rotation, Stripe API rotation webhooks, etc.)

2. **Assign owners:**
   - Who is responsible for each secret type? (database, Auth0, Stripe, etc.)
   - Who approves rotations?
   - Who monitors for errors post-rotation?

3. **Add to your calendar:**
   - Use the rotation schedule from `secret_rotation_schedule.md`
   - Example: Q2 2024 rotation on June 28, Q3 on September 28, etc.
   - Add reminders 1 week before (preparation), 24 hours before (final checks)

4. **Prepare runbooks:**
   - Copy relevant sections from `secret_rotation_schedule.md` (Step 1-5 checklists)
   - Add to your wiki or README
   - Test the rotation procedure in dev/staging first

### Phase 4: Production Deployment (When Ready)
**Goal:** Deploy with confidence that all security practices are in place

1. **Pre-deployment checklist:**
   - [ ] All hardcoded secrets removed from version control
   - [ ] All secrets stored in Secrets Manager or Vercel env
   - [ ] `.env.example` files in place with placeholders
   - [ ] Environment variable references in code point to secure storage
   - [ ] HDICR SAM template tested with Parameter Store/Secrets Manager references
   - [ ] TI Vercel settings verified for all environment variables
   - [ ] Copilot review completed, critical findings addressed
   - [ ] Rotation schedule in place and team briefed
   - [ ] Emergency rotation procedure documented

2. **First rotation (immediately after production deployment):**
   - Rotate all secrets to new values generated specifically for production
   - This ensures dev/staging secrets are not used in production
   - Document the rotation dates as your "baseline" for future cycles

---

## Key Architectural Challenges to Discuss

The Copilot prompt will surface these, but here's what to think about upfront:

1. **HDICR as a single point of failure:**
   - If HDICR is down, TI cannot verify actors or check consent
   - **Question:** What's your graceful degradation strategy for TI?
   - **Mitigation:** Cache consent checks, multi-region HDICR, circuit breaker in TI

2. **Consent revocation race condition:**
   - Actor revokes consent in HDICR; does TI learn about it immediately?
   - **Question:** Is cached consent state safe, or could you issue a credential after revocation?
   - **Mitigation:** Event-driven updates, webhook from HDICR → TI on consent change, or polling

3. **W3C Credentials are immutable but based on mutable state:**
   - Actor changes consent rules; old credentials remain valid
   - **Question:** Should credentials expire, or should consent revocation invalidate them?
   - **Mitigation:** Add expiry to credentials, add revocation mechanism to TI

4. **JWT key rotation without breaking existing tokens:**
   - Rotating signing keys invalidates old tokens
   - **Question:** How long do tokens need to live? Can you support two keys simultaneously?
   - **Mitigation:** Key versioning strategy (see Section 4.4 in audit doc)

5. **Database per service, but no distributed transactions:**
   - If HDICR updates consent and TI tries to issue a credential, race condition is possible
   - **Question:** Is application-level consistency sufficient, or do you need transactions?
   - **Mitigation:** Saga pattern, event-driven architecture, or API-level ordering

6. **Stripe Identity → HDICR state changes:**
   - If Stripe rejects or disputes an actor's KYC, can you revoke their existing credentials?
   - **Question:** Is there a webhook from Stripe to HDICR to notify of KYC status changes?
   - **Mitigation:** Webhook listener, status check on each TI → HDICR call, or polling

---

## Risks to Monitor

These are **not blockers**, but things to watch as you scale:

| Risk | Impact | Mitigation |
|------|--------|-----------|
| HDICR Lambda cold starts | Slow consent checks from TI | Provisioned concurrency, or cache consent locally |
| RDS connection pooling (Lambda is ephemeral) | Connection limit exhaustion | Use connection pool library (e.g., `pg-pool`), set max to 5-10 |
| Auth0 outage | Both HDICR and TI down | Cache auth tokens locally, implement fallback auth |
| Stripe Identity slow KYC processing | Actors blocked from using platform | Async KYC with status polling, or graceful degradation |
| Cross-region secrets sync | Secrets out of sync between regions | Use centralized secrets (Secrets Manager), not replication |
| Storage encryption disabled on HDICR RDS | Data at rest not encrypted | Snapshot & restore with encryption enabled (pre-prod) |

---

## Files Checklist

Before you start, ensure you have:

- [ ] `copilot_production_review_prompt.md` — Ready to copy into Copilot
- [ ] `env_variable_audit_and_rotation.md` — Reference for inventory and migration
- [ ] `secret_rotation_schedule.md` — Ready to add to your calendar
- [ ] Both repo paths ready to provide to Copilot
- [ ] Access to AWS (for Parameter Store, Secrets Manager)
- [ ] Access to Vercel (for environment variables)
- [ ] Access to Auth0, Stripe, Resend dashboards

---

## Timeline Estimate

| Phase | Effort | Timeline |
|-------|--------|----------|
| Phase 1: Inventory & Audit | 4-8 hours | 1 week |
| Phase 2: Migrate to Secure Storage | 8-16 hours | 1-2 weeks |
| Phase 3: Establish Rotation Process | 2-4 hours | 1-2 days |
| Phase 4: Production Deployment | Depends on Copilot findings | Variable |
| **Total** | **18-32 hours** | **3-5 weeks** |

---

## Questions Before You Begin?

Before diving in, consider:

1. **Copilot review scope:** Should the prompt also review infrastructure-as-code (SAM template, Vercel config files)? Or just application code?

2. **Existing tech debt:** Are there any known production issues or security gaps you want the review to focus on specifically?

3. **Rotation frequency:** Do you want quarterly rotations, or more/less frequent?

4. **Key escrow:** Should rotating keys ever be synced to a secondary location (e.g., backup or disaster recovery)?

5. **Audit requirements:** Do you need SOC 2, ISO 27001, GDPR compliance? This affects what gets logged and for how long.

---

## Next Action

**Pick one of these:**

- **A:** Review the Environment Variable Audit (Section 1-3) and create your inventory spreadsheet
- **B:** Copy the Copilot Prompt into VS Code and run the review
- **C:** Read through the Rotation Schedule to understand the cadence
- **D:** Ask me any clarifying questions about the approach

Which would be most valuable to tackle first?

---

## Document Version & Maintenance

| Document | Version | Date | Status |
|----------|---------|------|--------|
| Copilot Production Review Prompt | 1.0 | 2024-04-13 | Ready for use |
| Environment Variable Audit & Rotation | 1.0 | 2024-04-13 | Ready for use |
| Secret Rotation Schedule | 1.0 | 2024-04-13 | Ready for use |
| This Summary | 1.0 | 2024-04-13 | Ready for use |

**All documents assume:**
- HDICR: AWS Lambda, SAM, RDS PostgreSQL, Auth0, Stripe Identity
- TI: Vercel, Next.js, RDS PostgreSQL, Auth0, Stripe Payments, Resend, AWS S3
- Both systems share Auth0 tenant, separate RDS instances, separate S3 buckets
- W3C Verifiable Credentials issued by TI (signed with TI's JWT key)
- HDICR as authoritative source of identity verification and consent rules

**If your architecture changes, update these documents accordingly.**

---

**Last reviewed:** 2024-04-13  
**Prepared for:** Adam Greene, Truly Imagined Studios  
**Questions or updates?** Reach out and these can be revised.
