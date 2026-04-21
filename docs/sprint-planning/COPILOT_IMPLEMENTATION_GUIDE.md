# VS Code Copilot Implementation Guide

## Quick Start: Using Copilot to Build Stories

This guide helps you (or a contractor) use VS Code Copilot to implement stories from the 6-sprint MVP while maintaining codebase consistency.

---

## How to Use This Guide

1. **Pick a story** from `sprint-breakdown-stories-acceptance.md`
2. **Check critical path** in `CODEBASE_ALIGNMENT_AND_GAPS.md` (Section 6)
3. **Copy the story prompt** below and customize with story details
4. **Paste into VS Code Copilot Chat** (Cmd/Ctrl + Shift + I)
5. **Review output** against acceptance criteria
6. **Run the alignment checklist** (Section 9 of alignment doc)

---

## Story Prompt Template

Copy this and fill in the bracketed sections:

```
I'm implementing Story [#] from the Truly Imagined MVP sprint breakdown.

PROJECT CONTEXT:
- pnpm monorepo: apps/web (Next.js), services/* (Lambda), infra/database (PostgreSQL migrations)
- Auth: Auth0 session-based; all routes require auth check
- Multi-tenant: All queries use db.queryWithTenant(tenantId, sql, params)
- Audit: Every action logged (who, what, when, resource, result)
- Consent: Immutable ledger (consent_ledger table), versioned policies

STORY DETAILS:
[Paste acceptance criteria from sprint-breakdown-stories-acceptance.md]

ACCEPTANCE CRITERIA CHECKLIST:
[Copy the bullet list from story]

IMPLEMENTATION REQUIREMENTS:
1. New database table/migration (if applicable) → infra/database/migrations/0XX_[name].sql
2. API endpoint → apps/web/src/app/api/[resource]/[action]/route.ts
3. Business logic handler → services/[service-name]/src/handlers/[name].ts
4. Type definitions → shared/types/src/index.ts (Zod schemas)
5. Audit logging → call auditLog.record() before response
6. Error handling → catch errors, log to Sentry, return user-friendly message
7. Unit tests (optional, but recommended)

PATTERNS TO FOLLOW:
- Auth0 session check (see COPILOT_IMPLEMENTATION_GUIDE.md Section 2.1)
- Multi-tenant query pattern (see Section 2.2)
- API response format (see Section 2.3)
- Audit logging (see Section 2.4)

GUARDRAILS:
- NO PCI-DSS violations: Never log card numbers, bank details, CVV, etc.
- NO hardcoded values: Use environment variables (process.env.*)
- NO direct DB queries: Use db.queryWithTenant() always
- NO sensitive data in responses: Return IDs, not full details
- Include tenant_id on all new tables for multi-tenancy

OUTPUT EXPECTED:
1. Full migration SQL (if new table)
2. Complete API route handler
3. Handler service function (if complex)
4. Zod schema for input validation
5. Brief unit test outline
6. Audit log entry example

Reference codebase: apps/web/src/app/api/[resource]/route.ts, services/consent-service/src/handlers/*.ts
```

---

## Section 2: Code Patterns (Copy & Modify)

### 2.1 Auth0 Session Check + Role Authorization

**Use this at the start of every API route:**

```typescript
// apps/web/src/app/api/[resource]/[action]/route.ts

import { auth0 } from '@/lib/auth';
import { getUserRoles } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // 1. Get session
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get roles (if needed)
  const roles = await getUserRoles();
  if (!roles.includes('Agent') && !roles.includes('Actor')) {
    return NextResponse.json(
      { error: 'Forbidden: Only agents and actors can perform this action' },
      { status: 403 }
    );
  }

  // 3. Parse tenant context (always do this for multi-tenant)
  const { tenantId } = await getTenantContext();

  // 4. Parse body
  const body = await request.json();

  // Continue with story logic...
}
```

---

### 2.2 Multi-Tenant Database Query Pattern

**Use for all database queries:**

```typescript
import db from '@/infra/database';
import { z } from 'zod';

// Define validation schema
const CreateResourceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

type CreateResourceInput = z.infer<typeof CreateResourceSchema>;

export async function createResource(
  input: CreateResourceInput,
  context: { tenantId: string; userId: string }
) {
  const { tenantId, userId } = context;

  // Always validate input
  const parsed = CreateResourceSchema.parse(input);

  // Query with tenant awareness
  const result = await db.queryWithTenant(
    tenantId,
    `INSERT INTO resources (tenant_id, created_by, name, description, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, name, created_at`,
    [tenantId, userId, parsed.name, parsed.description]
  );

  if (result.rows.length === 0) {
    throw new Error('Failed to create resource');
  }

  return result.rows[0];
}
```

---

### 2.3 API Response Format (Normalized)

**Always return responses in this format:**

```typescript
// Success (2xx)
return NextResponse.json(
  {
    success: true,
    data: { id: '123', name: 'Resource', createdAt: '2024-02-16T10:00:00Z' },
    message: 'Resource created successfully'
  },
  { status: 201 }
);

// Client error (4xx)
return NextResponse.json(
  {
    success: false,
    error: 'INVALID_INPUT',
    message: 'Name is required',
    code: 400
  },
  { status: 400 }
);

// Server error (5xx)
return NextResponse.json(
  {
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again later.',
    code: 500,
    requestId: context.requestId // For debugging
  },
  { status: 500 }
);
```

---

### 2.4 Audit Logging (Always Include)

**Log every action:**

```typescript
import { auditLog } from '@/lib/audit';

// Inside your handler
await auditLog.record({
  action: 'resource.created',         // what happened
  tenantId,                           // which tenant
  userId: session.user.sub,           // who did it
  resourceId: resource.id,            // what was affected
  metadata: {                         // additional context
    name: parsed.name,
    description: parsed.description
  },
  result: 'success',                  // success | failure
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent')
});

// For sensitive actions (consent changes, payments, etc.):
await auditLog.record({
  action: 'consent.revoked',
  tenantId,
  userId,
  resourceId: actor.id,
  metadata: {
    workTypesRemoved: ['Political'],
    territoriesRemoved: ['CN'],
    version: { old: 3, new: 4 }
  },
  result: 'success',
  sensitivity: 'high'  // Flag sensitive actions
});
```

---

### 2.5 Error Handling + Sentry

**Always wrap in try-catch:**

```typescript
import * as Sentry from '@sentry/nextjs';

export async function POST(request: Request) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ... business logic ...

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    // Log to Sentry
    Sentry.captureException(error, {
      tags: {
        action: 'resource.create',
        userId: session?.user?.sub || 'unknown'
      }
    });

    // Return user-friendly error (NEVER expose stack trace)
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Something went wrong. Our team has been notified.',
        requestId: generateRequestId() // For support lookup
      },
      { status: 500 }
    );
  }
}
```

---

### 2.6 Consent Ledger Query Pattern

**When reading/querying consent:**

```typescript
import db from '@/infra/database';

export async function getActorConsent(actorId: number, tenantId: string) {
  const result = await db.queryWithTenant(
    tenantId,
    `SELECT
       id,
       version,
       policy,
       status,
       created_at,
       signature
     FROM consent_ledger
     WHERE actor_id = $1
       AND status = 'active'
       AND deleted_at IS NULL
     ORDER BY version DESC
     LIMIT 1`,
    [actorId]
  );

  if (result.rows.length === 0) {
    return null; // No active consent
  }

  return result.rows[0];
}

// When writing new consent version:
export async function grantConsent(
  actorId: number,
  policy: Record<string, any>,
  context: { tenantId: string; userId: string }
) {
  const { tenantId, userId } = context;

  // Get current version
  const currentConsent = await getActorConsent(actorId, tenantId);
  const newVersion = (currentConsent?.version || 0) + 1;

  // Insert new version (immutable)
  const result = await db.queryWithTenant(
    tenantId,
    `INSERT INTO consent_ledger
       (actor_id, version, policy, status, created_by, reason, created_at)
     VALUES ($1, $2, $3, 'active', $4, $5, NOW())
     RETURNING *`,
    [actorId, newVersion, JSON.stringify(policy), userId, 'actor granted consent']
  );

  return result.rows[0];
}
```

---

### 2.7 Migration Template

**When creating a new table:**

```sql
-- infra/database/migrations/019_deals_table.sql
-- Story 3.2: Deal creation endpoint

BEGIN;

CREATE TABLE deals (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  studio_user_id BIGINT NOT NULL REFERENCES user_profiles(id),
  actor_id BIGINT NOT NULL REFERENCES actors(id),
  agent_id BIGINT REFERENCES agents(id),
  deal_template_id BIGINT REFERENCES deal_templates(id),
  
  -- Descriptive fields
  project_name VARCHAR(255) NOT NULL,
  work_type VARCHAR(50) NOT NULL,  -- Film, TV, Commercial, etc.
  usage_types TEXT[] NOT NULL,      -- ['online', 'broadcast', etc.]
  territory VARCHAR(100) NOT NULL,  -- GB, US, WORLD
  duration_days INTEGER NOT NULL,
  first_usage_date DATE NOT NULL,
  
  -- Commercial terms (JSON for flexibility)
  commercial_terms JSONB NOT NULL,
  -- Example: {
  --   "recording_fee": 5000,
  --   "usage_fee_percentage": 10,
  --   "agent_percentage": 15,
  --   "ti_percentage": 12,
  --   "payment_due_date": "2024-03-15",
  --   "payment_terms": "net 30"
  -- }
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft, proposed, approved, signed, active, expired, terminated
  signed_at TIMESTAMP,
  
  -- Audit
  created_by BIGINT NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMP,
  
  CONSTRAINT unique_deal_per_actor UNIQUE(tenant_id, actor_id, studio_user_id, deal_template_id)
);

CREATE INDEX idx_deals_tenant_id ON deals(tenant_id);
CREATE INDEX idx_deals_studio_user_id ON deals(studio_user_id);
CREATE INDEX idx_deals_actor_id ON deals(actor_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

COMMIT;
```

---

## Section 3: Story-Specific Copilot Prompts

### Story 3.1: Deal Templates

```
I'm implementing Story 3.1: Deal templates based on Equity suggested terms.

REQUIREMENTS:
1. Seed 3 predefined templates (Performance, Synthetic Media, Voice)
2. Each template includes Equity-aligned fields:
   - Remuneration structure (recording fee + usage-based)
   - Territory options
   - Duration limits
   - Moral rights clauses
   - Dispute resolution terms
3. GET /api/deal-templates endpoint to list all
4. GET /api/deal-templates/[id] endpoint for details

EQUITY REFERENCE:
- Section 2 (Licensing): Remuneration must be "fair and proportionate"
- Section 3 (Moral rights): Attribution, integrity, withdrawal, first publication
- Section 5 (Disputes): 15-day negotiation → 30-day mediation
- AI training: Explicitly excluded by default, requires express written consent

DATABASE:
Create deal_templates table with:
- name (e.g., "Standard Film License")
- base_remuneration_rules (JSONB)
- moral_rights_rules (JSONB)
- usage_restrictions (JSONB)

OUTPUT:
1. Migration for deal_templates table
2. Seed script with 3 templates
3. GET endpoint for /api/deal-templates
4. Zod schema for template structure
```

---

### Story 3.2: Deal Creation

```
I'm implementing Story 3.2: Studio proposes deal.

REQUIREMENTS:
1. Studio creates deal by specifying:
   - Template ID
   - Actor ID (searchable)
   - Project details
   - Territory, duration, remuneration
2. Deal inserted with status='draft'
3. Email sent to agent + actor
4. Returns deal ID + share link
5. Authorization: studio user only

DATABASE:
Insert into deals table with:
- studio_user_id
- actor_id (auto-resolve agent_id from active representation)
- commercial_terms (calculated from template + custom inputs)
- status = 'draft'

API:
POST /api/deals/create
Input: { template_id, actor_id, project_name, work_type, territory, duration_days, first_usage_date, remuneration: { recording_fee, usage_fee_percentage, agent_percentage, ti_percentage } }
Output: { deal_id, share_link }

VALIDATION:
- Actor exists and verified
- Actor has active agent (if agent_percentage > 0)
- Remuneration > 0
- Future dates only
- Territory is valid ISO code

OUTPUT:
1. POST /api/deals/create route
2. dealService.createDeal() handler
3. Email template for agent/actor notification
4. Zod schema for input
```

---

### Story 6.4: Payout Split Logic

```
I'm implementing Story 6.4: Calculate and distribute payouts.

REQUIREMENTS:
1. When payment succeeds, split into:
   - Actor net = actor_gross_fee - (actor_gross_fee * agent_percentage / 100)
   - Agent fee = actor_gross_fee * (agent_percentage / 100)
   - TI fee = studio_payable * (ti_percentage / 100)
2. Create Stripe transfers for actor + agent
3. TI keeps its fee (no transfer)
4. Create payout records in database
5. Send notifications to all parties
6. Audit log with split amounts

STRIPE INTEGRATION:
- Use stripe.transfers.create() to move funds
- Destination: actor/agent bank account tokens (stored in payment_methods table)
- Include metadata (license_id, recipient_type, recipient_id)
- Handle transfer failures (retry logic)

AMOUNTS:
- All amounts in pence (integers, no floats)
- Example: £5,000 = 500000 pence

OUTPUT:
1. PayoutService.processPayout() function (50–100 lines)
2. Stripe transfer creation with error handling
3. Payout record insertion
4. Audit logging
5. Notification dispatch
6. Sample test cases (3 scenarios: with agent, without agent, failure)
```

---

## Section 4: Testing Checklist for Each Story

Before marking a story "Done", verify:

```
ACCEPTANCE CRITERIA:
- [ ] All bullet points checked

CODE QUALITY:
- [ ] No PCI-DSS violations (if payment-related)
- [ ] No hardcoded secrets/API keys
- [ ] No console.log (use Sentry/audit logs)
- [ ] Error messages are user-friendly
- [ ] Sensitive data never logged

DATABASE:
- [ ] Migration file created (infra/database/migrations/0XX_*.sql)
- [ ] All tables include tenant_id for multi-tenancy
- [ ] Proper indexes on foreign keys + filter columns
- [ ] Audit columns present (created_at, created_by, updated_at)

API:
- [ ] Auth check present (Auth0 session or API key)
- [ ] Authorization check present (roles or permissions)
- [ ] Input validation present (Zod schema)
- [ ] Audit logging present
- [ ] Error handling (try-catch + Sentry)
- [ ] Response format normalized (success/error structure)
- [ ] HTTP status codes correct (201 create, 200 ok, 400 bad, 403 forbidden, 500 error)

TESTING:
- [ ] Unit test outline provided
- [ ] Happy path tested (normal flow works)
- [ ] Sad path tested (error conditions)
- [ ] Edge cases tested (boundary conditions)
- [ ] Authorization tested (wrong role denied)
- [ ] Audit trail verified (action logged correctly)

DOCUMENTATION:
- [ ] Code comments explain "why", not "what"
- [ ] Type definitions clear
- [ ] Error codes documented
- [ ] API endpoint added to Section 5 of CLAUDE_CONTEXT.md
```

---

## Section 5: Common Pitfalls & How to Avoid Them

| Pitfall | Why It's Bad | How to Avoid |
|---------|-------------|-------------|
| Hardcoded Stripe API key | Exposes secret in code | Always use `process.env.STRIPE_SECRET_KEY` |
| Logging full card number | PCI-DSS violation | Only log transaction ID, not payment data |
| Forgetting tenant_id in query | Multi-tenant data leak | Always use `db.queryWithTenant(tenantId, ...)` |
| No error handling | Crashes break user experience | Wrap in try-catch, return 500 with message |
| No audit log | Compliance violation + debugging nightmare | Call `auditLog.record()` before response |
| Direct DB query (no Zod) | SQL injection risk + bad data | Always validate with Zod first |
| Returning full user details | Privacy leak | Return only ID + non-sensitive fields |
| Forgetting consent version | Old deals break when consent changes | Always pin consent version at deal signing |
| No duplicate check on Stripe webhook | Double-process payment | Check `stripe_event_id` in audit log first |
| Blocking payment on consent query | Usage pauses during arbitration | Status check: if `arbitration_pending`, deny |

---

## Section 6: Performance Checklist

Before going to production:

- [ ] Database indexes on all foreign keys ✓
- [ ] Database indexes on status/filtering columns ✓
- [ ] Stripe webhook deduplication working ✓
- [ ] RDS connection pool sized correctly (t3.micro → 5–10 connections)
- [ ] N+1 query problem fixed (batch queries when possible)
- [ ] Slow queries identified + optimized (> 100ms = investigate)
- [ ] Pagination on list endpoints (default 20 per page)
- [ ] Caching on static data (deal templates, content restrictions)
- [ ] Rate limiting on payment endpoints (max 10 requests/minute)
- [ ] Monitoring alerts set up (payment failures, DB connection issues)

---

## Section 7: Security Checklist (Payment-Related)

Before implementing any payment feature:

- [ ] No card data stored anywhere on TI infrastructure ✓
- [ ] Bank account numbers tokenized via Stripe ✓
- [ ] CVV/CVC never stored or logged ✓
- [ ] Webhook signature verification enabled ✓
- [ ] Webhook deduplication enabled (prevent double-processing) ✓
- [ ] Rate limiting on payment endpoints ✓
- [ ] Stripe API calls use environment variables for keys ✓
- [ ] Error messages don't expose internal details ✓
- [ ] PII (email, phone) logged only for audit, not in response ✓
- [ ] Payout amounts logged as decimal, never raw pence ✓
- [ ] Refund reasons don't include sensitive data ✓
- [ ] RDS encrypted (rds.force_ssl=1 + storage_encrypted=true) ✓

---

## Section 8: Deployment Checklist

Before moving to production:

- [ ] All migrations applied to production DB
- [ ] Environment variables set (Stripe keys, webhook secret, auth0 config)
- [ ] Stripe webhook endpoint configured in dashboard
- [ ] Test payments processed successfully (use test cards)
- [ ] Refund flow tested
- [ ] Payout split verified (actor net, agent cut, TI fee sum correctly)
- [ ] Monitoring + alerting configured (Sentry, PagerDuty)
- [ ] Backup strategy in place (daily RDS snapshots)
- [ ] GDPR deletion flows tested
- [ ] RDS encryption enabled (if payment processing)
- [ ] Rate limiting tested
- [ ] Error handling tested (network failures, API timeouts)

---

## Getting Help

**If Copilot produces code that:**
- Doesn't match patterns → Ask for revision: "Use the pattern from apps/web/src/app/api/agent/roster/route.ts"
- Lacks audit logging → Ask for addition: "Add audit logging as shown in COPILOT_IMPLEMENTATION_GUIDE.md Section 2.4"
- Has PCI-DSS issues → Ask for fix: "Remove logging of bank account number; use token ID instead"
- Missing tests → Ask for outline: "Provide unit test outline for all acceptance criteria"

**Critical blockers to flag:**
- Any payment implementation without Stripe SDK usage
- Any query without multi-tenant awareness (db.queryWithTenant)
- Any API endpoint without Auth0 session check
- Any sensitive data in logs or error messages

---

**Last Updated:** April 10, 2026  
**Version:** 1.0  
**For use with:** 6-Sprint MVP breakdown + codebase alignment document
