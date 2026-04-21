# Database Guardrails: Integration Checklist

## ✅ What You've Been Delivered

### 4 Production-Ready Migrations
```
019_schema_ownership_boundaries.sql     (Schema: HDICR, HDICR_AUTH, TI)
020_rbac_roles.sql                      (Roles: hdicr_app, ti_app, db_admin)
021_immutability_and_audit.sql          (Triggers, audit_log table, immutability enforcement)
022_data_flow_contracts.sql             (Views, data flow documentation)
```

### 1 Implementation Guide
```
DATABASE_GUARDRAILS_GUIDE.md            (Full context, step-by-step, troubleshooting)
```

---

## 🎯 What These Do (in 30 seconds)

**Single RDS instance, but with 4 layers of defense:**

| Layer | Mechanism | Prevents |
|-------|-----------|----------|
| 1 | Schema separation (hdicr vs. ti) | Accidental table access across planes |
| 2 | Database roles (hdicr_app vs. ti_app) | TI code modifying HDICR data if wrong credentials |
| 3 | Immutability triggers | HDICR consent data being UPDATEd/DELETEd by mistake |
| 4 | Audit logging + views | Silent data corruption (everything is logged & queryable) |

**Bottom line:** Even if a bug sneaks through, the database catches it.

---

## 📋 Quick Integration Steps

### Step 1: Copy Migrations to Your Codebase
```bash
cp 019_*.sql /path/to/your/repo/infra/database/migrations/
cp 020_*.sql /path/to/your/repo/infra/database/migrations/
cp 021_*.sql /path/to/your/repo/infra/database/migrations/
cp 022_*.sql /path/to/your/repo/infra/database/migrations/
```

### Step 2: Backup Your Database
```bash
# RDS snapshot
aws rds create-db-snapshot --db-instance-identifier trulyimagined-db --db-snapshot-identifier pre-guardrails-backup
```

### Step 3: Apply Migrations (in order, on staging first)
```bash
# Test environment
DATABASE_URL=postgres://postgres:password@localhost/trulyimagined_staging \
npm run migrate:run

# Production (after testing)
DATABASE_URL=postgres://db_admin:password@rds.amazonaws.com/trulyimagined \
npm run migrate:run
```

### Step 4: Update Your Application Code

**Update connection pools to use separate credentials:**

```typescript
// apps/web/src/lib/db.ts (or wherever you create DB clients)

// HDICR service
const hdicrDb = new Pool({
  connectionString: process.env.HDICR_DATABASE_URL,
  // postgres://hdicr_app:password@rds.amazonaws.com/trulyimagined
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// TI service  
const tiDb = new Pool({
  connectionString: process.env.TI_DATABASE_URL,
  // postgres://ti_app:password@rds.amazonaws.com/trulyimagined
  max: 20,  // TI handles more concurrent queries
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default {
  hdicr: hdicrDb,
  ti: tiDb,
};
```

### Step 5: Set Environment Variables

**In AWS Secrets Manager (or .env for local dev):**
```
HDICR_DATABASE_URL=postgres://hdicr_app:{generated_password}@rds-endpoint:5432/trulyimagined
TI_DATABASE_URL=postgres://ti_app:{generated_password}@rds-endpoint:5432/trulyimagined
DB_ADMIN_URL=postgres://db_admin:{generated_password}@rds-endpoint:5432/trulyimagined (migrations only)
```

### Step 6: Test in Staging
```bash
# Verify RBAC works: ti_app should be denied access to HDICR tables
psql -U ti_app -h your-rds-endpoint.amazonaws.com trulyimagined \
  -c "SELECT * FROM hdicr.consent_ledger LIMIT 1"
# Expected: ERROR: permission denied for schema hdicr

# Verify immutability works: UPDATE should be rejected
psql -U hdicr_app -h your-rds-endpoint.amazonaws.com trulyimagined \
  -c "UPDATE hdicr.consent_ledger SET policy = '{}' WHERE id = 1"
# Expected: ERROR: Consent ledger is immutable.
```

### Step 7: Deploy to Production
- Use the same migration commands as staging
- Monitor `public.audit_log` for any violations
- Keep the RDS snapshot as a safety net for 2 weeks

---

## 🔍 Verification Queries (Run After Applying)

```sql
-- 1. Check schemas exist
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('hdicr', 'hdicr_auth', 'ti');
-- Expected: 3 rows

-- 2. Check roles exist
SELECT rolname FROM pg_roles 
WHERE rolname IN ('hdicr_app', 'ti_app', 'db_admin');
-- Expected: 3 rows

-- 3. Verify RBAC: ti_app cannot read HDICR
\c trulyimagined ti_app
SELECT * FROM hdicr.consent_ledger;
-- Expected: ERROR: permission denied for schema hdicr

-- 4. Verify immutability: UPDATE should fail
\c trulyimagined hdicr_app
UPDATE hdicr.consent_ledger SET policy = '{}' WHERE id = 1;
-- Expected: ERROR: Consent ledger is immutable

-- 5. Check audit log exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'audit_log';
-- Expected: 1 row

-- 6. List all views created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'hdicr' AND table_type = 'VIEW';
-- Expected: 3 rows (v_actors_for_ti, v_active_consent_for_ti, v_actor_verification_for_ti)
```

---

## 📊 What Changes in Your Code

### BEFORE (Single Connection)
```typescript
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Both services use same connection
const actor = await db.query('SELECT * FROM actors WHERE id = $1', [actorId]);
const license = await db.query('SELECT * FROM licenses WHERE id = $1', [licenseId]);
```

### AFTER (Separate Connections)
```typescript
const hdicrDb = new Pool({
  connectionString: process.env.HDICR_DATABASE_URL,  // hdicr_app role
});
const tiDb = new Pool({
  connectionString: process.env.TI_DATABASE_URL,    // ti_app role
});

// HDICR services use hdicrDb
const actor = await hdicrDb.query('SELECT * FROM hdicr.actors WHERE id = $1', [actorId]);

// TI services use tiDb
const license = await tiDb.query('SELECT * FROM ti.licenses WHERE id = $1', [licenseId]);

// TI reads HDICR via views (read-only)
const consent = await tiDb.query('SELECT * FROM hdicr.v_active_consent_for_ti WHERE actor_id = $1', [actorId]);
```

---

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `ERROR: permission denied for schema hdicr` | Using wrong connection (TI connecting as hdicr_app) | Check DATABASE_URL, HDICR_DATABASE_URL, TI_DATABASE_URL |
| `ERROR: Consent ledger is immutable` | Code tried to UPDATE consent_ledger | This is expected! Use INSERT new version instead |
| `ERROR: role "hdicr_app" does not exist` | Migration 020 didn't run | Verify migrations applied: `SELECT * FROM public.schema_version;` |
| Queries working in dev but failing in prod | Passwords don't match | Regenerate in AWS Secrets Manager, redeploy env vars |

---

## 📅 Timeline

- **Now:** Copy migrations to codebase
- **Today:** Apply to staging database
- **Tomorrow:** Test RBAC + immutability with verification queries
- **Next day:** Update application code + environment variables
- **1 week later:** Deploy to production
- **Ongoing:** Monitor `public.fn_detect_cross_plane_violations()` weekly

---

## ✋ When You're Ready to Add New Tables (Sprint 3+)

When creating `deals`, `licenses`, `payouts` tables in Sprint 3+:

1. **Put them in the right schema:**
   ```sql
   CREATE TABLE ti.deals (
     id BIGSERIAL PRIMARY KEY,
     ...
   );
   ```

2. **Audit triggers are automatic** (migration 021 covers this)

3. **Update data_flow_contracts:**
   ```sql
   -- In migration 022 or later
   CREATE VIEW ti.v_licenses_for_hdicr AS ...
   ```

4. **Test RBAC:**
   ```bash
   psql -U ti_app -h rds.amazonaws.com trulyimagined \
     -c "SELECT * FROM ti.deals LIMIT 1"
   # Should work
   ```

---

## 💾 Backup & Recovery

**If something goes wrong:**

```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier trulyimagined-rollback \
  --db-snapshot-identifier pre-guardrails-backup

# Then point your app to the rollback instance
# and investigate what failed
```

---

## 📚 Further Reading

- **Full context:** See DATABASE_GUARDRAILS_GUIDE.md
- **Each migration:** Read the comments in the .sql files (heavily documented)
- **Architecture:** See CODEBASE_ALIGNMENT_AND_GAPS.md (Section 2.4 on RLS)

---

## ✅ Sign-Off Checklist

Before deploying to production:

- [ ] All 4 migrations copied to infra/database/migrations/
- [ ] Database backed up (RDS snapshot created)
- [ ] Migrations applied to staging
- [ ] All 6 verification queries passed on staging
- [ ] Application code updated to use HDICR_DATABASE_URL + TI_DATABASE_URL
- [ ] Environment variables set in AWS Secrets Manager
- [ ] RBAC tested: ti_app denied, hdicr_app allowed
- [ ] Immutability tested: UPDATE rejected
- [ ] Staging tested end-to-end (API calls work)
- [ ] Staging monitored for 24 hours (no unexpected audit_log entries)
- [ ] Migrations applied to production
- [ ] Production monitored for 1 week (fn_detect_cross_plane_violations returns 0)
- [ ] RDS snapshot kept as safety net for 2 weeks

---

**You're ready to apply!** 🚀

Next: Copy these migrations to your repo and apply them to staging.
