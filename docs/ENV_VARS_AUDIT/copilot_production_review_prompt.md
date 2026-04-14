# Production Readiness Review Prompt for GitHub Copilot

**Context:** You are reviewing two interconnected Node.js applications for production deployment:
- **HDICR** (Identity & Consent Truth Layer): AWS Lambda + API Gateway, Node.js, PostgreSQL, Auth0, Stripe Identity
- **TI** (Truly Imagined - Licensing & Marketplace): Vercel, Next.js frontend + backend, PostgreSQL, Auth0, Stripe Payments, Resend, Sentry

**Architecture Overview:**
- HDICR is a standalone API that TI depends on for identity verification and consent truth
- Both share Auth0 tenant but have separate RDS instances and S3 buckets
- Trust boundary: HDICR is authoritative for "what is allowed" (consent), TI is authoritative for "what is agreed" (licenses)
- W3C Verifiable Credentials issued by TI (using identity verified by HDICR)
- Critical flow: Actor registers with HDICR → HDICR runs Stripe Identity KYC/AML → TI queries HDICR for verification status and consent rules before issuing credentials or negotiating licenses

---

## Review Mandate

Evaluate **both repositories** for production readiness across these dimensions. For each dimension, assume nothing—challenge assumptions, surface hidden dependencies, and flag mismatches between the two systems.

### 1. **Security & Secrets Management**

**What to check:**
- Identify all hardcoded secrets, API keys, database credentials, JWT signing keys, or auth tokens in source code (including comments, config files, documentation examples)
- Verify that all secrets are externalized to environment variables or AWS Secrets Manager / Systems Manager Parameter Store
- Check that no secrets are logged, printed to stdout, or included in error messages
- Identify all places where secrets are *consumed* (Lambda env, Vercel env, at runtime from Parameter Store)
- Verify JWT signing keys are:
  - Generated securely (not hardcoded, not stored in version control)
  - Accessible to both HDICR (to sign) and TI (to verify) without duplication in repos
  - Rotated safely (can you rotate without downtime?)
- Check Auth0 integration: are credentials/client IDs/secrets properly scoped to Lambda and Vercel?
- Verify Stripe API keys (HDICR for Identity, TI for Payments) are not cross-contaminated
- Look for SQL injection, parameter injection, or unsanitized API inputs
- Check CORS configuration—is it overly permissive? Are cross-origin calls between HDICR and TI properly authenticated?
- Verify Rate Limiting: Does HDICR rate-limit API calls from TI? Are there per-IP, per-user, or per-API-key limits?
- Check for open security group rules, public S3 buckets, or publicly accessible RDS instances

**Specific to HDICR:**
- How is the Stripe Identity KYC/AML flow authenticated? Can anyone trigger it, or only verified users?
- Are consent preference updates (the core business logic) properly validated? Can a user set consent rules that contradict legal/contractual obligations?

**Specific to TI:**
- When TI queries HDICR for consent, how is that API call authenticated? Is there a service-to-service auth token?
- If HDICR is down, what's the fallback behavior in TI? (Deny all, allow all, cached response?)
- Are W3C Verifiable Credentials cryptographically signed? With what key? Can TI rotate the signing key without invalidating all issued credentials?

---

### 2. **Error Handling & Observability**

**What to check:**
- Are errors logged with consistent structure (JSON, stack traces, request IDs)?
- Do error messages expose internal details (stack traces, database schema, API paths) to clients?
- Is there a global error handler in both apps that catches unhandled rejections?
- How are errors propagated between HDICR and TI?
  - If HDICR returns a 500 error, does TI gracefully degrade or bubble it to the user?
  - Are HDICR errors translated into meaningful TI error responses?
- Are Lambda cold starts and timeouts handled? (SAM configuration, timeout values)
- Is Sentry (TI) also capturing errors from calls to HDICR, or just TI itself?
- Check request ID propagation: Can you trace a user action from TI → HDICR → database → back?
- Are there circuit breakers or timeouts on TI's HTTP calls to HDICR?
- How are Stripe Identity and Stripe Payments errors handled? Are there retries?

---

### 3. **Data Integrity & Consistency**

**What to check:**
- Trust boundary validation: When TI queries HDICR for consent, does TI re-verify the response, or blindly trust it?
- Consent revocation: If an actor revokes consent in HDICR while TI has an active license, what happens?
  - Does TI have a mechanism to detect revocation and notify the studio?
  - Is there a grace period, or is revocation immediate?
- Database consistency:
  - Are there foreign key constraints between HDICR DB and TI DB? (There shouldn't be, but verify the boundary is clean)
  - How is state synchronized? (Event-driven, polling, webhooks?)
- Stripe Identity → HDICR: If Stripe Identity verification fails mid-flow, can the actor re-trigger it without creating duplicate KYC records?
- W3C Credentials: If an actor's identity is later unverified (Stripe reject, dispute, etc.), what happens to credentials already issued by TI?
- Audit trail: Is every identity verification, consent change, and license agreement logged immutably?

---

### 4. **API Design & Contract Stability**

**What to check:**
- HDICR API contract:
  - Are endpoints versioned (e.g., `/v1/verify`, `/v2/verify`)? If you change the API later, can TI still work with an old version?
  - Is the response schema documented and stable? What happens if you add a new field?
  - Are there backward-compatibility guarantees?
- TI API contract:
  - If TI exposes an API (for studios to query licenses, for actors to manage credentials), is it versioned?
- Error response format: Is it consistent across both systems?
- Pagination: If HDICR or TI return lists (e.g., consent rules, licenses), how is pagination handled?

---

### 5. **Scalability & Performance**

**What to check:**
- Lambda (HDICR):
  - What's the memory allocation? Is it tuned, or default?
  - What's the timeout? Is it sufficient for the slowest request (e.g., Stripe Identity call)?
  - How many concurrent Lambdas can run? Is there a reserved concurrency?
  - Are cold starts a problem? (Check SAM config for provisioned concurrency)
  - Is the database connection pool sized correctly for Lambda's concurrency model? (Lambdas are ephemeral; pooling is tricky)
- RDS (both):
  - What's the instance size? Is it the right size for the workload?
  - Are there indexes on frequently queried columns (e.g., actor_id, consent_rule_id)?
  - Is connection pooling configured? (Especially critical for Lambda + RDS)
  - Are there long-running transactions that block other queries?
- Vercel (TI):
  - Are database queries batched or N+1 queries happening?
  - Is there caching of HDICR responses? (TI shouldn't trust stale consent data)
  - Are large media uploads (S3) streamed, or loaded into memory?
- S3:
  - Are media uploads/downloads optimized (multipart, CloudFront CDN)?
  - Are old/unused objects cleaned up, or does storage grow indefinitely?

---

### 6. **Deployment & Rollback**

**What to check:**
- Lambda (HDICR):
  - Is there a SAM build/deploy pipeline? Can you deploy without manual steps?
  - Are there deployment environments (dev, staging, prod)?
  - Can you rollback a bad deployment quickly?
  - Are database migrations handled? (Lambdas are immutable; you can't have schema drift)
- Vercel (TI):
  - Is there a staging environment to test against prod HDICR before deploying TI?
  - Can you rollback TI while keeping HDICR stable?
  - Are database migrations managed? (Next.js doesn't have a built-in migration tool)
- Blue-green or canary deployments?
- Are there manual approval gates before prod deployments?

---

### 7. **Testing & Quality**

**What to check:**
- Unit tests: What's the coverage %? Are critical paths covered? (e.g., consent verification, Stripe Identity integration)
- Integration tests: Are there tests that call HDICR from TI? Or is the boundary mocked?
- Contract tests: Do you have tests that verify HDICR's API contract won't break TI?
- End-to-end tests: Can you run a full flow (actor registers, gets verified, TI issues credential) in test?
- Load tests: Have you stress-tested the HDICR → TI flow?
- Security tests: Are there tests for SQL injection, CSRF, XSS, privilege escalation?

---

### 8. **Operational Readiness**

**What to check:**
- Monitoring & alerting:
  - Are Lambda invocations, errors, and durations monitored?
  - Are RDS CPU, connections, and query performance monitored?
  - Are there alerts for high error rates, slow responses, or failed deployments?
  - Is Sentry (TI) also monitoring HDICR errors?
- Documentation:
  - Is the HDICR API documented (OpenAPI/Swagger)?
  - Are there runbooks for common failures (e.g., "Stripe Identity is down")?
  - Are deployment and rollback procedures documented?
- Access control:
  - Who can deploy HDICR? TI?
  - Who can access production databases?
  - Are there audit logs for production changes?

---

### 9. **Architecture Blindspots & Assumptions to Challenge**

**These are the risky assumptions you should validate:**

1. **Single point of failure in HDICR:**
   - If HDICR is down, TI cannot verify actors or check consent.
   - Have you designed a graceful degradation mode for TI? (e.g., cache consent checks, disallow license creation, display a maintenance message?)
   - Should HDICR be replicated across availability zones or regions?

2. **Consent revocation is asynchronous:**
   - Actor revokes consent in HDICR; does TI learn about it immediately, or on next query?
   - If TI has cached the consent state, you might issue a credential after revocation.
   - How do you prevent this race condition?

3. **W3C Credentials are immutable but based on mutable state:**
   - TI issues a credential based on HDICR's consent rules at time T.
   - Actor changes consent rules at time T+1.
   - The credential is still valid but based on old consent.
   - Is this acceptable? Should credentials have an expiry?

4. **Stripe Identity is synchronous but unreliable:**
   - KYC/AML can take days or be rejected.
   - If Stripe rejects an actor, how does HDICR and TI handle it?
   - Can an actor re-apply, or are they permanently blocked?

5. **JWT signing keys are shared but key rotation is hard:**
   - If you rotate the signing key in TI, old credentials become unverifiable.
   - If you rotate the key in HDICR, TI might not be able to verify it.
   - How will you rotate keys without breaking the system?

6. **Auth0 is a shared single point of failure:**
   - Both HDICR and TI depend on Auth0.
   - If Auth0 is down, both systems are down.
   - Should you cache Auth tokens locally?

7. **Database per service, but no distributed transactions:**
   - HDICR DB and TI DB are separate.
   - If HDICR updates consent and TI tries to issue a credential, there's a race.
   - Are you relying on application-level consistency, or is there a mechanism to ensure both succeed or both fail?

8. **S3 buckets are not versioned or backup'd:**
   - If an actor's media is deleted or corrupted, can you recover it?
   - Are there lifecycle policies to archive old media?

9. **No mention of GDPR/data retention:**
   - How long do you retain KYC data after an actor deletes their account?
   - Can you do a GDPR deletion without breaking licenses already issued?

---

## Output Requirements

For each dimension (1-9 above), provide:
1. **Findings** — Specific issues or gaps found in the code
2. **Risk Level** — Critical, High, Medium, Low
3. **Recommendation** — How to fix or mitigate
4. **Effort** — Rough T-shirt size (XS, S, M, L, XL) to implement

---

## Tone & Approach

- Be direct and specific. Don't say "improve error handling"; say "Add a global error handler in Lambda that catches uncaught rejections and logs them with request ID."
- Assume the author is competent but hasn't thought about edge cases.
- Flag assumptions, not just code smells.
- For each finding, note whether it's a blocker for production (e.g., hardcoded secrets) or a post-launch improvement (e.g., load testing).

---

## Start your review here

Begin by scanning the HDICR repository root and listing:
1. The directory structure
2. All configuration files (SAM, package.json, .env.example, etc.)
3. All source files and their purpose
4. All npm dependencies (note any security concerns)

Then do the same for TI.

Then run through the 9 dimensions above, section by section, identifying findings.

Finally, summarize in a single table: **Risk | Finding | File(s) | Effort | Recommendation**
