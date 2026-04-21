# Codebase Alignment & Sprint Planning Gap Analysis

**Status:** Alignment Review (Codebase CLAUDE CONTEXT vs. 6-Sprint MVP Breakdown)  
**Date:** April 10, 2026  
**Author:** Claude + Founder Review

---

## Executive Summary

Your codebase is **well-architected and production-ready for Sprints 1–2**. The foundation (identity verification, consent ledger, representation workflows) is solid. However, **key features from Sprints 3–6 (deal negotiation, payment processing, arbitration) do not yet exist in code**.

### Traffic Light Status:

- 🟢 **Green (Ready)**: Sprint 1–2 core (identity, consent, agents, representations)
- 🟡 **Yellow (Partial)**: Stripe Identity integration exists but payment flows don't
- 🔴 **Red (Not Started)**: Sprint 3–6 (deals, arbitration, payment splits, GDPR workflows)

---

## Section 1: What's Already Built (Codebase Strengths)

### 1.1 Identity & Verification (Sprint 1)

| Feature                     | Status       | Location                                  | Notes                                        |
| --------------------------- | ------------ | ----------------------------------------- | -------------------------------------------- |
| Stripe Identity integration | ✅ Built     | `apps/web/src/app/api/verification/start` | Session creation working                     |
| Stripe webhook handling     | ✅ Built     | `apps/web/src/app/api/webhooks/stripe`    | Signature verification in place              |
| Identity links storage      | ✅ Built     | `infra/database/migrations/001–018`       | `identity_links` table with assurance levels |
| Mock provider (dev/test)    | ✅ Built     | `services/identity-service/src/index.ts`  | Works for non-prod                           |
| Onfido/Yoti placeholders    | ⚠️ Stub      | `services/identity-service`               | Legacy placeholders, not functional          |
| Manual video verification   | ❌ Not built | –                                         | **Gap: No admin dashboard for scheduling**   |

**Assessment:** Stripe Identity is production-ready. Manual video verification requires Story 1.3 implementation (admin scheduling UI).

---

### 1.2 Actor Registration & Consent (Sprint 1)

| Feature                     | Status   | Location                        | Notes                                                |
| --------------------------- | -------- | ------------------------------- | ---------------------------------------------------- |
| Actor registration endpoint | ✅ Built | `/api/identity/register`        | Creates actors with legal/professional names         |
| Consent ledger (versioning) | ✅ Built | `consent_ledger` table          | Immutable, version-tracked                           |
| Consent grant endpoint      | ✅ Built | `/api/consent/grant`            | Stores work_types, content_restrictions, territories |
| Consent read endpoint       | ✅ Built | `/api/consent/check`            | Returns active policy                                |
| Consent revocation          | ✅ Built | `/api/consent/revoke`           | Updates ledger, creates new version                  |
| Territory granularity       | ✅ Built | `consent_ledger.policy` (JSONB) | Supports country/region level                        |
| AI training consent toggle  | ✅ Built | `consent_ledger.policy`         | `data_for_training` field present                    |
| Audit trail                 | ✅ Built | `consent_ledger`                | `created_at`, `created_by`, `reason` fields          |

**Assessment:** Consent core is complete. Stories 1.4–1.7 are substantially implemented. Story 1.8 (onboarding UI) needs to be evaluated.

---

### 1.3 Agent & Representation (Sprint 2)

| Feature                              | Status     | Location                                                               | Notes                                                           |
| ------------------------------------ | ---------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Agency profile creation              | ✅ Built   | `agents` table + `/api/agent/profile`                                  | Name, contact, website fields                                   |
| Representation request workflow      | ✅ Built   | `representation_requests` table                                        | pending → accepted → active states                              |
| Representation codes                 | ✅ Built   | `/api/agent/codes/generate`, `/api/agent/codes/list`                   | Story 2.2 delivered; telemetry hardening remains                |
| Actor roster dashboard               | ⚠️ Partial | `/api/agent/roster`                                                    | Endpoint exists, UI TBD                                         |
| Team member delegation               | ✅ Built   | `agency_team_members` table                                            | Permissions: canManageRoster, canViewConsent, canManageRequests |
| 30-day termination notice            | ✅ Built   | `/api/representation/terminate`, `/api/representation/terminate/sweep` | Story 2.7 delivered; lifecycle hardening remains                |
| Agent-actor relationship termination | ✅ Built   | termination workflow + sweep                                           | 30-day notice model is active                                   |

**Assessment:** Sprint 2 core is largely delivered. Remaining work is hardening and acceptance parity (telemetry, notifications, and lifecycle consistency).

---

### 1.4 HDICR Consent Query (Sprint 4)

| Feature                                          | Status   | Location                                                                         | Notes                             |
| ------------------------------------------------ | -------- | -------------------------------------------------------------------------------- | --------------------------------- |
| External consent check (`/api/v1/consent/check`) | ✅ Built | `services/consent-service/src/handlers/check-consent-enforcement.ts` (353 lines) | Full enforcement logic            |
| License validation                               | ✅ Built | License checks in consent handler                                                | Active license required for allow |
| Usage logging                                    | ✅ Built | `license_usage_log` table                                                        | Every query logged with decision  |
| Consent version pinning                          | ✅ Built | `licenses.consent_version_at_signing` field exists                               | Per-license version tracking      |
| API client verification                          | ✅ Built | `api_clients.credential_status` check                                            | External clients must be verified |
| Decision types (allow/deny/conditional)          | ✅ Built | Enforcer returns decision enum                                                   | Correct states                    |

**Assessment:** HDICR query logic (Story 4.1) is production-ready. License creation (Story 4.2) depends on deal flows (Sprint 3, not yet built).

---

### 1.5 Database & Infrastructure

| Component               | Status       | Location                                 | Notes                                                          |
| ----------------------- | ------------ | ---------------------------------------- | -------------------------------------------------------------- |
| PostgreSQL schema       | ✅ Built     | `infra/database/migrations/001–018`      | Migrations up to 018                                           |
| Multi-tenant support    | ✅ Built     | Migrations 016–018                       | Tenant isolation + RLS policies                                |
| Auth0 integration       | ✅ Built     | `apps/web/src/lib/auth.ts`               | Session + role resolution                                      |
| Stripe SDK              | ✅ Built     | `apps/web/src/lib/stripe.ts` (213 lines) | Payment utilities present                                      |
| RDS encryption          | ❌ Missing   | –                                        | **Gap: storage_encrypted=false (identified in earlier audit)** |
| GDPR deletion workflows | ❌ Not built | –                                        | **Gap: No soft-delete or anonymization**                       |

**Assessment:** Schema is solid, but RDS encryption must be remediated (Story 6.9) before production payment processing.

---

## Section 2: What's Missing (Critical Gaps for Sprint 3–6)

### 2.1 Deal Management (Sprint 3) — **NOT STARTED**

| Feature                       | Status | Required By         | Priority    |
| ----------------------------- | ------ | ------------------- | ----------- |
| Deal templates (Equity-based) | ❌     | Sprint 3, Story 3.1 | 🔴 Blocking |
| Deal creation endpoint        | ❌     | Sprint 3, Story 3.2 | 🔴 Blocking |
| Deal editing/counter-proposal | ❌     | Sprint 3, Story 3.3 | 🟡 High     |
| Deal approval & signing       | ❌     | Sprint 3, Story 3.4 | 🔴 Blocking |
| Studio profile creation       | ❌     | Sprint 3, Story 3.5 | 🟡 High     |
| Deal status tracking          | ❌     | Sprint 3, Story 3.6 | 🟡 Medium   |
| Deal negotiation UI           | ❌     | Sprint 3, Story 3.7 | 🔴 Blocking |
| `deals` table                 | ❌     | –                   | 🔴 Blocking |
| `deal_approvals` table        | ❌     | –                   | 🔴 Blocking |
| `deal_edits` table            | ❌     | –                   | 🔴 Blocking |

**Impact:** No deal creation = no commercial layer. This is the **critical path blocker** for MVP.

---

### 2.2 Payment Processing (Sprint 6) — **NOT STARTED**

| Feature                      | Status | Required By         | Priority    |
| ---------------------------- | ------ | ------------------- | ----------- |
| Stripe payment intents       | ❌     | Sprint 6, Story 6.2 | 🔴 Blocking |
| Invoice generation           | ❌     | Sprint 6, Story 6.2 | 🟡 High     |
| Webhook payment handlers     | ❌     | Sprint 6, Story 6.3 | 🔴 Blocking |
| Payout split logic           | ❌     | Sprint 6, Story 6.4 | 🔴 Blocking |
| Bank account management      | ❌     | Sprint 6, Story 6.5 | 🔴 Blocking |
| Refund workflows             | ❌     | Sprint 6, Story 6.6 | 🟡 High     |
| Payment audit trail          | ❌     | Sprint 6, Story 6.7 | 🟡 High     |
| `payouts` table              | ❌     | –                   | 🔴 Blocking |
| `payment_methods` table      | ❌     | –                   | 🔴 Blocking |
| `payment_audit_log` table    | ❌     | –                   | 🔴 Blocking |
| `arbitration_requests` table | ❌     | –                   | 🔴 Blocking |

**Impact:** No payments = no revenue model. **Critical path.**

---

### 2.3 Arbitration & Consent Revocation (Sprint 5) — **NOT STARTED**

| Feature                       | Status     | Required By         | Priority    |
| ----------------------------- | ---------- | ------------------- | ----------- |
| Consent revocation detection  | ⚠️ Partial | Sprint 5, Story 5.1 | 🟡 High     |
| Arbitration request creation  | ❌         | Sprint 5, Story 5.2 | 🔴 Blocking |
| Auto-dispute check (Day 0–5)  | ❌         | Sprint 5, Story 5.3 | 🟡 High     |
| Negotiation phase (Day 0–30)  | ❌         | Sprint 5, Story 5.4 | 🟡 High     |
| License agreement/update      | ❌         | Sprint 5, Story 5.5 | 🔴 Blocking |
| Usage pause enforcement       | ❌         | Sprint 5, Story 5.6 | 🔴 Blocking |
| Admin arbitration dashboard   | ❌         | Sprint 5, Story 5.7 | 🟡 High     |
| `arbitration_requests` table  | ❌         | –                   | 🔴 Blocking |
| `arbitration_proposals` table | ❌         | –                   | 🔴 Blocking |

**Impact:** Without arbitration, consent revocation breaks licensing. **Critical but lower priority than deals/payments.**

---

### 2.4 GDPR & Compliance (Sprint 6) — **NOT STARTED**

| Feature                            | Status | Required By          | Priority    |
| ---------------------------------- | ------ | -------------------- | ----------- |
| Soft-delete workflows              | ❌     | Sprint 6, Story 6.8  | 🟡 High     |
| Data anonymization                 | ❌     | Sprint 6, Story 6.8  | 🟡 High     |
| Right to erasure (consent history) | ❌     | Sprint 6, Story 6.8  | 🟡 High     |
| Full account deletion              | ❌     | Sprint 6, Story 6.8  | 🟡 High     |
| RDS encryption                     | ❌     | Sprint 6, Story 6.9  | 🔴 Blocking |
| Monitoring & alerting              | ❌     | Sprint 6, Story 6.10 | 🟡 High     |

**Impact:** GDPR compliance is **legal-critical** for UK/EU launch. RDS encryption is **blocking for production payment processing**.

---

## Section 3: Alignment Summary

### What's Ready to Execute (Next 2 Weeks)

✅ **Sprint 1 (Identity & Consent):** ~90% complete

- Stripe Identity working
- Consent registration & ledger operational
- Manual video verification UI needed (Story 1.3)

✅ **Sprint 2 (Agents & Representation):** ~85% complete

- Agency profiles, team permissions working
- Invitation code and redemption workflows delivered (Stories 2.2/2.3)
- 30-day termination workflow delivered (Story 2.7)
- Remaining: hardening and acceptance parity checks

### What Needs to Be Built (Sprints 3–6)

🔴 **Deal Negotiation (Sprint 3):** 0% — Complete blocker until started
🔴 **Payment Processing (Sprint 6):** 5% — Stripe SDK exists, but no payment flows
🔴 **Arbitration (Sprint 5):** 10% — Consent revocation exists, but no dispute resolution
🔴 **Compliance (Sprint 6):** 0% — RDS encryption + GDPR workflows

### Critical Path to MVP

```
Sprint 1 (Weeks 1–2): Identity + Consent ✅ [mostly done]
  ↓
Sprint 2 (Weeks 3–4): Agents + Representation ✅ [mostly done, fill gaps]
  ↓
Sprint 3 (Weeks 5–6): Deal Templates + Negotiation 🔴 [NOT STARTED — BLOCKING]
  ↓
Sprint 4 (Weeks 7–8): License Issuance 🟡 [HDICR query ready, licensing depends on Sprint 3]
  ↓
Sprint 6 (Weeks 9–10): Payment Processing + Arbitration 🔴 [NOT STARTED — BLOCKING REVENUE]
  ↓
LAUNCH

Note: Sprint 5 (Arbitration) can run in parallel with Sprint 6 but must be done before production.
```

---

## Section 4: Stories to Prioritize (Next 4 Weeks)

### Immediate (This Week)

1. **Story 2.3 hardening:** notification email + audit log completion
2. **Story 2.2 hardening:** telemetry/rate-limit and abuse monitoring
3. **Story 2.7 hardening:** lifecycle consistency + operational resilience checks
4. **Story 1.8 completion:** close remaining onboarding form/consent UI deltas (if still pending)

### Next 2 Weeks

5. **Story 3.1:** Deal templates (Equity doc structure)
6. **Story 3.2:** Deal creation endpoint
7. **Story 3.4:** Deal signing + approval workflow
8. **Story 3.7:** Deal negotiation UI

### Weeks 5–6 (Critical)

9. **Story 6.1:** Stripe payment infrastructure setup
10. **Story 6.2:** Invoice creation
11. **Story 6.4:** Payout split logic
12. **Story 6.9:** RDS encryption remediation

---

## Section 5: Implementation Notes for VS Code Copilot

### File Structure Mapping

When Copilot implements stories, it should follow this pattern:

```
apps/web/src/app/api/[resource]/[action]/route.ts
  → Story endpoint (e.g., /api/deals/create)

services/[service-name]/src/handlers/[handler-name].ts
  → Business logic (e.g., dealService.createDeal)

infra/database/migrations/019_[feature].sql
  → Schema changes (migrations are numbered sequentially)

shared/types/src/index.ts
  → Type definitions (Zod schemas, domain types)

apps/web/src/app/[resource]/page.tsx
  → UI pages (e.g., /deals page)
```

### Database Migration Checklist

For any new table (e.g., `deals`, `payouts`):

1. Create `infra/database/migrations/019_deals_table.sql`
2. Include tenant_id for multi-tenant support (matches existing pattern)
3. Add audit columns: created_at, updated_at, created_by
4. Include indexes on foreign keys and frequently-filtered columns
5. Document in this file (see Section 7 below)

### API Endpoint Checklist

For any new endpoint:

1. Auth check (Auth0 session or API key)
2. Authorization check (role or delegation permission)
3. Input validation (Zod schema)
4. Business logic (call handler service)
5. Audit logging (who, what, when)
6. Error handling (Sentry, user-facing message)
7. Return normalized response (HTTP status + JSON)

### Code Review Gates

Before marking a story "Done":

- [ ] No PCI-DSS violations (if payment-related)
- [ ] All acceptance criteria checked
- [ ] Unit tests passing
- [ ] Audit trail logged
- [ ] Error messages user-facing (no stack traces)
- [ ] No sensitive data in logs
- [ ] Database migration created (if applicable)

---

## Section 6: Recommended Execution Order

### Critical Path (Do First)

**Week 1 (Sprint 2 Hardening):**

- Story 2.3 residuals (notification + audit)
- Story 2.2 residuals (telemetry + abuse guardrails)
- Story 2.7 residuals (state-model and sweep observability)

**Week 2 (Close Remaining Sprint 1/2 Deltas):**

- Story 1.8 remaining onboarding UI acceptance items
- Story 2.9 dashboard parity/polish

**Week 3–4 (Sprint 3 — CRITICAL):**

- Story 3.1 (deal templates)
- Story 3.2 (deal creation)
- Story 3.4 (deal approval)
- Story 3.7 (deal UI)

**Week 5 (Sprint 6 — PAYMENT CRITICAL):**

- Story 6.9 (RDS encryption) ← Do this FIRST, blocks everything
- Story 6.1 (Stripe setup)
- Story 6.2 (invoices)

**Week 6 (Sprint 6 — PAYOUT):**

- Story 6.4 (payout splits)
- Story 6.5 (bank accounts)
- Story 6.11 (end-to-end testing)

### Parallel Work (Can Overlap)

- Sprint 5 (Arbitration) — Run in parallel with Sprint 6 after Week 4
- Sprint 4 (License Issuance) — Depends on Sprint 3, can start Week 4
- Documentation (Story 6.12) — Start Week 5

---

## Section 7: Database Schema Additions Required

### New Tables to Create

```sql
-- Sprint 3 (Deals)
deals
deal_approvals
deal_edits

-- Sprint 6 (Payments)
payouts
payment_methods
payment_audit_log

-- Sprint 5 (Arbitration)
arbitration_requests
arbitration_proposals

-- Sprint 6 (GDPR)
gdpr_deletions
```

Each should be created as a numbered migration (019, 020, etc.).

### Existing Tables with Schema Changes

```sql
-- licenses table
ADD COLUMN commercial_terms JSONB;
ADD COLUMN payment_status VARCHAR(20);
ADD COLUMN payment_intent_id VARCHAR(255);
ADD COLUMN paid_at TIMESTAMP;

-- user_profiles (if needed)
ADD COLUMN deleted_at TIMESTAMP;  -- For soft-delete
```

---

## Section 8: Copilot Reference Guide

When using VS Code Copilot to implement stories, provide this context:

### Prompt Template

```
I'm implementing [Story #] from the 6-sprint MVP for Truly Imagined (identity + licensing platform).

Context:
- Repository is a pnpm monorepo (Next.js + Lambda services + PostgreSQL)
- Auth via Auth0
- Multi-tenant support (all queries use queryWithTenant)
- Consent ledger is the source of truth (immutable, versioned)
- All endpoints require audit logging

Story: [Paste acceptance criteria from sprint-breakdown-stories-acceptance.md]

Expected:
- New tables/migrations (if applicable)
- API endpoint at /api/[resource]/[action]
- Handler service function
- Type definitions (Zod schemas)
- Unit tests
- Audit trail entry

Reference alignment: See CODEBASE_ALIGNMENT_AND_GAPS.md for existing patterns.
```

### Key Patterns to Reuse

**Auth pattern:**

```typescript
const session = await auth0.getSession();
if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**Handler pattern:**

```typescript
// apps/web/src/app/api/[resource]/[action]/route.ts
export async function POST(request: Request) {
  const { tenantId } = await getTenantContext();
  const { field1, field2 } = await request.json();

  // Validation
  const schema = z.object({ field1: z.string(), field2: z.number() });
  const parsed = schema.parse({ field1, field2 });

  // Business logic
  const result = await someService.action(parsed, { tenantId });

  // Audit
  await auditLog.record({ action: 'resource.action', tenantId, userId, result });

  return NextResponse.json(result, { status: 200 });
}
```

**Database pattern:**

```typescript
const result = await db.queryWithTenant(
  tenantId,
  `SELECT * FROM table WHERE id = $1 AND deleted_at IS NULL`,
  [id]
);
```

---

## Section 9: Alignment Checklist for Implementation

As each story is implemented, verify:

- [ ] Database migration created (migrations/0XX_feature.sql)
- [ ] API endpoint implemented (/api/[resource]/[action]/route.ts)
- [ ] Handler/service logic implemented (services/_/src/handlers/_.ts)
- [ ] Types defined (shared/types/src/index.ts + Zod schemas)
- [ ] Auth/authorization checks in place
- [ ] Audit logging added
- [ ] Error handling (Sentry + user message)
- [ ] Sensitive data never logged
- [ ] Acceptance criteria all checked
- [ ] Unit tests written
- [ ] Code reviewed against patterns
- [ ] No PCI-DSS violations (payment-related)
- [ ] Documented in code comments
- [ ] Story marked "Done" in sprint tracker

---

## Section 10: Notes for Future Handoff

**If a contractor/team member joins to help:**

1. Start with this document (CODEBASE_ALIGNMENT_AND_GAPS.md)
2. Reference the sprint-breakdown-stories-acceptance.md for story details
3. Use the Copilot prompt template (Section 8) for story implementation
4. Follow the file structure and patterns outlined above
5. Respect the critical path: Stories 3.1–3.7 must finish before Stories 6.1–6.6

**If you hit blockers:**

- Consent/identity questions → Refer to CLAUDE_CONTEXT.md (codebase foundation)
- Payment/arbitration questions → Refer to stripe-payment-architecture.md
- Sprint prioritization questions → Refer to this document (Section 6)

---

## Sign-Off

**Codebase Status:** Production-ready for Sprints 1–2, foundation complete  
**Missing for MVP:** Deal negotiation (Sprint 3), Payment processing (Sprint 6), Arbitration (Sprint 5)  
**Recommended Next Step:** Complete Sprint 1–2 gaps, then start Story 3.1 (deal templates)  
**Risk:** Payment processing (Sprint 6) is the longest pole in the tent; start early

---

**Document Version:** 1.0  
**Last Updated:** April 10, 2026  
**Next Review:** After Sprint 2 completion
