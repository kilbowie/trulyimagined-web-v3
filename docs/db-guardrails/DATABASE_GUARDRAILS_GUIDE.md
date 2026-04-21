# Database Guardrails: Migrations 019–022

**Status:** Ready for integration into your codebase  
**Purpose:** Enforce HDICR & TI separation at the database level  
**Impact:** Prevents accidental data corruption; enables compliance auditing  
**Timeline:** Apply before Sprint 3 (before deal/payment tables are created)

---

## Overview: What These Migrations Do

These four migrations implement defense-in-depth guardrails to keep HDICR (identity/consent) separate from TI (marketplace) in a single RDS instance:

| Migration | Purpose | Enforcement |
|-----------|---------|-------------|
| **019** | Schema ownership (HDICR vs. TI vs. Auth) | Logical separation + naming convention |
| **020** | Role-based access control (RBAC) | Database-level permissions |
| **021** | Immutability enforcement + audit logging | Triggers + constraints |
| **022** | Data flow contracts (views as documentation) | Views + queryable contracts |

Together, they create a layered security model:

```
Layer 1: Schema (logical grouping)
  ↓
Layer 2: RBAC (database roles can only access their schema)
  ↓
Layer 3: Triggers (immutability, audit logging)
  ↓
Layer 4: Views (document allowed cross-plane queries)
  ↓
→ If any layer is breached, the next layer catches it
```

---

## Migration 019: Schema Ownership Boundaries

**File:** `019_schema_ownership_boundaries.sql`  
**What it does:**
- Creates three schemas: `hdicr`, `hdicr_auth`, `ti`
- Moves existing tables into the appropriate schemas
- Makes it visually obvious which plane owns what

**Why it matters:**
- A developer or code reviewer can immediately see if a query tries to access the wrong schema
- `SELECT * FROM ti.licenses` is valid; `SELECT * FROM hdicr.consent_ledger` from TI code is a red flag

**When to apply:**
- Before any new tables are created (so they go into the right schema immediately)

**Manual steps if tables are already created:**
```sql
-- If tables exist in 'public' schema, move them:
ALTER TABLE public.consent_ledger SET SCHEMA hdicr;
ALTER TABLE public.actors SET SCHEMA hdicr;
-- (etc.)
```

---

## Migration 020: Role-Based Access Control (RBAC)

**File:** `020_rbac_roles.sql`  
**What it does:**
- Creates three database roles: `hdicr_app`, `ti_app`, `db_admin`
- Assigns permissions:
  - **hdicr_app**: read/write HDICR tables, read-only TI/AUTH tables
  - **ti_app**: read/write TI tables, read-only HDICR/AUTH tables
  - **db_admin**: full access (for migrations only)
- Creates an `access_denied_log` table to track unauthorized access attempts
- Creates a function to detect violations automatically

**Why it matters:**
- Even if a bug causes TI code to connect with the right password, PostgreSQL will reject writes to HDICR tables
- Example: A Lambda function accidentally uses the wrong connection string → PostgreSQL blocks it

**How to use:**
In your application code, use **different database connection strings** for each plane:

```typescript
// HDICR service
const db = new Pool({
  connectionString: process.env.HDICR_DATABASE_URL,
  // Resolves to: postgres://hdicr_app:password@rds.amazonaws.com/trulyimagined
});

// TI service
const db = new Pool({
  connectionString: process.env.TI_DATABASE_URL,
  // Resolves to: postgres://ti_app:password@rds.amazonaws.com/trulyimagined
});
```

**Environment variables to set (in AWS Secrets Manager or .env):**
```
HDICR_DATABASE_URL=postgres://hdicr_app:{password}@{rds-endpoint}:5432/trulyimagined
TI_DATABASE_URL=postgres://ti_app:{password}@{rds-endpoint}:5432/trulyimagined
DB_ADMIN_URL=postgres://db_admin:{password}@{rds-endpoint}:5432/trulyimagined  (migrations only)
```

**Verification:**
```sql
-- Check that ti_app cannot INSERT into HDICR tables:
$ psql -U ti_app -h rds.amazonaws.com trulyimagined -c \
  "INSERT INTO hdicr.consent_ledger (...) VALUES (...)"

-- Expected output: ERROR: permission denied for schema hdicr
```

---

## Migration 021: Immutability Enforcement + Audit Logging

**File:** `021_immutability_and_audit.sql`  
**What it does:**
- Creates a `public.audit_log` table (written to by both planes)
- Adds triggers to `hdicr.consent_ledger` to:
  - Block any UPDATE or DELETE attempts
  - Log all INSERT operations
  - Reject mutations with a clear error message
- Adds audit triggers to all HDICR tables
- Creates a helper function `fn_detect_cross_plane_violations()` to find unauthorized writes

**Why it matters:**
- Consent data is immutable by design: you can only append new versions, never modify old ones
- If a bug causes TI code to try `UPDATE hdicr.consent_ledger...`, the database rejects it with a clear error message before data corruption happens

**Example: What happens if someone tries to UPDATE**
```sql
UPDATE hdicr.consent_ledger SET policy = '{"bad": "data"}' WHERE id = 1;

-- PostgreSQL rejects it:
-- ERROR: Consent ledger is immutable. Cannot UPDATE consent_ledger.id=1.
--        Create a new version instead (version=2).

-- The audit_log automatically captures this attempt:
-- SELECT * FROM public.audit_log WHERE action LIKE '%unauthorized%';
```

**How to query the audit trail:**
```sql
-- See all modifications to HDICR tables:
SELECT * FROM public.v_hdicr_audit_trail ORDER BY created_at DESC LIMIT 20;

-- Detect unauthorized access (ti_app trying to write to HDICR):
SELECT * FROM public.fn_detect_cross_plane_violations() WHERE severity = 'CRITICAL';

-- Track which app made which change (for compliance):
SELECT app_role, action, COUNT(*) FROM public.audit_log GROUP BY app_role, action;
```

---

## Migration 022: Data Flow Contracts

**File:** `022_data_flow_contracts.sql`  
**What it does:**
- Creates views that document which queries are allowed:
  - `hdicr.v_actors_for_ti`: TI can see actor identity (no private fields)
  - `hdicr.v_active_consent_for_ti`: TI can read active consent policies
  - `hdicr.v_actor_verification_for_ti`: TI can see KYC status
  - `public.v_hdicr_audit_trail`: compliance view of HDICR changes
  - `public.v_ti_audit_trail`: compliance view of TI changes
  - `public.v_cross_plane_access`: monitor who accesses what
- Creates a function `fn_data_flow_contracts()` that documents allowed & forbidden flows

**Why it matters:**
- These views serve as "contracts": they define what each plane is allowed to access
- If code tries to query outside the contracts (e.g., `SELECT * FROM hdicr.identity_links` from TI), it should be rejected in code review
- They make it easy to understand which queries are expected vs. anomalous

**How to use in code review:**
When reviewing PR code, check that:
- HDICR code only queries `hdicr.*`, `hdicr_auth.*`, or the views `ti.v_*`
- TI code only queries `ti.*` or the views `hdicr.v_*`
- Both planes write to `public.audit_log`
- Cross-plane queries go through the documented views, not direct table access

**Example: Allowed query (TI reading consent for validation)**
```typescript
// apps/web/src/lib/hdicr/consent-client.ts
const result = await db.query(
  `SELECT policy FROM hdicr.v_active_consent_for_ti WHERE actor_id = $1`,
  [actorId]
);
// ✓ This is allowed (goes through the view)
```

**Example: Forbidden query (TI trying to update consent)**
```typescript
// DON'T DO THIS:
await db.query(
  `UPDATE hdicr.consent_ledger SET policy = $1 WHERE actor_id = $2`,
  [newPolicy, actorId]
);
// ✗ This is forbidden (direct table access, no RBAC permission, would fail)
```

---

## Integration Checklist

Before applying these migrations:

- [ ] **Backup your database** (these are irreversible without a restore)
- [ ] **Review the migrations** for any table names that differ from your schema
- [ ] **Choose environment variable names** for HDICR_DATABASE_URL and TI_DATABASE_URL
- [ ] **Update your application code** to use separate connection pools (see examples above)
- [ ] **Test in dev/staging first** (apply migrations, verify RBAC works)

**Apply in this order:**
1. Migration 019 (schema ownership)
2. Migration 020 (RBAC)
3. Migration 021 (immutability + audit)
4. Migration 022 (data flow contracts)

**Expected runtime:**
- Each migration should execute in < 1 second
- No downtime required (RDS can handle concurrent queries)
- Safe to apply during business hours

---

## Post-Application: Environment Setup

After applying, you need to set environment variables for your applications:

### For HDICR services (Lambda, or wherever consent-service runs):
```bash
export HDICR_DATABASE_URL=postgres://hdicr_app:${HDICR_APP_PASSWORD}@${RDS_ENDPOINT}:5432/trulyimagined
```

### For TI services (Next.js API routes, licensing Lambda):
```bash
export TI_DATABASE_URL=postgres://ti_app:${TI_APP_PASSWORD}@${RDS_ENDPOINT}:5432/trulyimagined
```

### For migrations/admin (one-time, for running future migrations):
```bash
export DB_ADMIN_URL=postgres://db_admin:${DB_ADMIN_PASSWORD}@${RDS_ENDPOINT}:5432/trulyimagined
```

**Store passwords securely:**
- AWS Secrets Manager
- Environment variables (CI/CD)
- .env.local (dev only, never commit)
- NOT in code

---

## Monitoring & Maintenance

**Weekly:**
- Check audit_log for any violations: `SELECT * FROM public.fn_detect_cross_plane_violations();`
- Monitor access patterns: `SELECT * FROM public.v_cross_plane_access;`

**Monthly:**
- Archive old audit logs (> 90 days) to cold storage
- Review RBAC permissions: `SELECT grantee, privilege_type FROM role_table_grants;`

**Before adding new tables:**
- Assign to the correct schema (hdicr.* vs. ti.*)
- Add appropriate audit triggers (migration 021 should handle this automatically)
- Add views if cross-plane access is needed (migration 022)
- Document in fn_data_flow_contracts()

---

## What If Something Goes Wrong?

**If RBAC blocks a legitimate query:**
- This means your application code is connecting with the wrong database credentials
- Check that HDICR services use HDICR_DATABASE_URL, TI services use TI_DATABASE_URL
- The error message will be clear: "permission denied for schema X"

**If you need to change RBAC permissions:**
- Edit migration 020 and reapply (in a fresh database)
- Or manually: `GRANT SELECT ON TABLE hdicr.actors TO ti_app;`
- Document the change so future migrations reflect it

**If you need to disable immutability (e.g., to fix corrupt data):**
```sql
DROP TRIGGER consent_mutation_guard ON hdicr.consent_ledger;
-- Make your fix
UPDATE hdicr.consent_ledger SET policy = ... WHERE id = ...;
-- Recreate the trigger
CREATE TRIGGER consent_mutation_guard BEFORE UPDATE OR DELETE ON hdicr.consent_ledger FOR EACH ROW EXECUTE FUNCTION hdicr.fn_prevent_consent_mutation();
```

---

## Rollback

If you need to undo these migrations:

```sql
-- Rollback in REVERSE order:

-- 022: Drop views
DROP VIEW IF EXISTS public.v_cross_plane_access;
DROP VIEW IF EXISTS public.v_ti_audit_trail;
DROP VIEW IF EXISTS public.v_hdicr_audit_trail;
DROP FUNCTION IF EXISTS public.fn_data_flow_contracts();

-- 021: Drop triggers and functions
DROP TRIGGER IF EXISTS consent_mutation_guard ON hdicr.consent_ledger;
DROP FUNCTION IF EXISTS hdicr.fn_prevent_consent_mutation();
DROP FUNCTION IF EXISTS hdicr.fn_audit_hdicr_change();
DROP FUNCTION IF EXISTS ti.fn_audit_ti_change();
DROP TABLE IF EXISTS public.audit_log;

-- 020: Drop roles
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA hdicr FROM hdicr_app;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ti FROM ti_app;
DROP ROLE IF EXISTS hdicr_app, ti_app, db_admin;

-- 019: Move tables back to public schema (optional)
ALTER TABLE hdicr.* SET SCHEMA public;
DROP SCHEMA IF EXISTS hdicr, hdicr_auth, ti;
```

---

## Questions?

If you encounter issues:
1. Check the verification queries in each migration file
2. Review RBAC error messages (they're descriptive)
3. Query the audit log to see what actually happened
4. Compare your table names/schemas against CLAUDE_CONTEXT.md

---

**Next steps:**
1. Copy these migrations to `infra/database/migrations/` in your codebase
2. Apply them in order (019 → 020 → 021 → 022)
3. Update your application code to use separate connection strings
4. Test in staging first
5. Set environment variables in production
6. Monitor audit_log for the first week to catch any issues

Good luck! 🚀
