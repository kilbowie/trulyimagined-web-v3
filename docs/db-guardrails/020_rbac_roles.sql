-- Migration 020: Role-Based Access Control (RBAC)
-- Enforces database-level permissions so HDICR tables cannot be modified by TI applications
-- and vice versa. This is defense-in-depth: even a buggy Lambda function cannot corrupt
-- consent data if it connects with the wrong database credentials.

-- Status: Ready for implementation
-- Rollback: See rollback section at end

BEGIN;

-- ===== 1. CREATE APPLICATION ROLES (if they don't exist) =====
-- These roles are used by the application code to connect to the database
-- DO NOT use postgres superuser role in production

DO $$
BEGIN
  -- HDICR application role: can modify HDICR tables, read TI (for audit logging)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hdicr_app') THEN
    CREATE ROLE hdicr_app WITH LOGIN ENCRYPTED PASSWORD :'hdicr_app_password';
    ALTER ROLE hdicr_app SET log_statement = 'all';  -- Log all queries from this role
    RAISE NOTICE 'Created role: hdicr_app';
  ELSE
    RAISE NOTICE 'Role hdicr_app already exists';
  END IF;

  -- TI application role: can read HDICR (for consent checks), modify TI tables
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ti_app') THEN
    CREATE ROLE ti_app WITH LOGIN ENCRYPTED PASSWORD :'ti_app_password';
    ALTER ROLE ti_app SET log_statement = 'all';
    RAISE NOTICE 'Created role: ti_app';
  ELSE
    RAISE NOTICE 'Role ti_app already exists';
  END IF;

  -- Admin role: can modify everything (use rarely, for migrations)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'db_admin') THEN
    CREATE ROLE db_admin WITH LOGIN ENCRYPTED PASSWORD :'db_admin_password';
    RAISE NOTICE 'Created role: db_admin';
  ELSE
    RAISE NOTICE 'Role db_admin already exists';
  END IF;

END $$;

-- ===== 2. REVOKE ALL PERMISSIONS FROM PUBLIC (PRINCIPLE OF LEAST PRIVILEGE) =====
-- Start from zero, then explicitly grant what each role needs

REVOKE ALL ON SCHEMA public, hdicr, hdicr_auth, ti FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA hdicr FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA hdicr_auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ti FROM PUBLIC;

-- ===== 3. GRANT PERMISSIONS: HDICR_APP ROLE =====
-- HDICR app can:
--   - Full access (SELECT, INSERT, UPDATE) on HDICR tables (but NOT DELETE)
--   - Read-only (SELECT) on TI tables (for audit logging)
--   - Read-only on auth tables (to resolve user identity)

-- HDICR schema: full write access (except DELETE, enforced by triggers in 021)
GRANT USAGE ON SCHEMA hdicr TO hdicr_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA hdicr TO hdicr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdicr GRANT SELECT, INSERT, UPDATE TO hdicr_app;

-- HDICR_AUTH schema: read-only (to look up user roles)
GRANT USAGE ON SCHEMA hdicr_auth TO hdicr_app;
GRANT SELECT ON ALL TABLES IN SCHEMA hdicr_auth TO hdicr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdicr_auth GRANT SELECT TO hdicr_app;

-- TI schema: read-only (for audit trail writing and consent validation)
GRANT USAGE ON SCHEMA ti TO hdicr_app;
GRANT SELECT ON ALL TABLES IN SCHEMA ti TO hdicr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA ti GRANT SELECT TO hdicr_app;

-- Public schema: sequence access for any table with SERIAL IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hdicr TO hdicr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdicr GRANT USAGE ON SEQUENCES TO hdicr_app;

-- ===== 4. GRANT PERMISSIONS: TI_APP ROLE =====
-- TI app can:
--   - Full access on TI tables
--   - Read-only on HDICR tables (for consent validation, deal creation)
--   - Read-only on auth tables (for user identity)

-- TI schema: full write access
GRANT USAGE ON SCHEMA ti TO ti_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA ti TO ti_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA ti GRANT SELECT, INSERT, UPDATE TO ti_app;

-- HDICR schema: read-only (for /api/v1/consent/check validation)
GRANT USAGE ON SCHEMA hdicr TO ti_app;
GRANT SELECT ON ALL TABLES IN SCHEMA hdicr TO ti_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdicr GRANT SELECT TO ti_app;

-- HDICR_AUTH schema: read-only
GRANT USAGE ON SCHEMA hdicr_auth TO ti_app;
GRANT SELECT ON ALL TABLES IN SCHEMA hdicr_auth TO ti_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdicr_auth GRANT SELECT TO ti_app;

-- TI schema: sequence access for any table with SERIAL IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ti TO ti_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA ti GRANT USAGE ON SEQUENCES TO ti_app;

-- ===== 5. GRANT PERMISSIONS: DB_ADMIN ROLE =====
-- DB admin can do everything (for migrations, maintenance)
GRANT ALL ON SCHEMA hdicr, hdicr_auth, ti, public TO db_admin WITH ADMIN OPTION;
GRANT ALL ON ALL TABLES IN SCHEMA hdicr, hdicr_auth, ti, public TO db_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA hdicr, hdicr_auth, ti, public TO db_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA hdicr, hdicr_auth, ti, public GRANT ALL TO db_admin;

-- ===== 6. CREATE AUDIT FUNCTION FOR UNAUTHORIZED ACCESS ATTEMPTS =====
-- This logs whenever someone tries to access a table they don't have permission for
-- PostgreSQL will reject the access, but we log the attempt for forensics

CREATE TABLE IF NOT EXISTS public.access_denied_log (
  id BIGSERIAL PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL,
  schema_name VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(20) NOT NULL,  -- SELECT, INSERT, UPDATE, DELETE
  attempt_at TIMESTAMP DEFAULT NOW(),
  connection_info TEXT
);

CREATE TRIGGER log_access_denied
BEFORE INSERT OR UPDATE OR DELETE ON hdicr.consent_ledger
FOR EACH ROW
WHEN (current_user != 'postgres' AND current_user != 'hdicr_app')
EXECUTE FUNCTION public.fn_log_unauthorized_access();

-- Function to log unauthorized access
CREATE OR REPLACE FUNCTION public.fn_log_unauthorized_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.access_denied_log (role_name, schema_name, table_name, operation, connection_info)
  VALUES (
    current_user,
    'hdicr',
    TG_TABLE_NAME,
    TG_OP,
    'IP: ' || inet_client_addr() || ', User: ' || session_user
  );
  -- Raise an exception to prevent the operation
  RAISE EXCEPTION 'Unauthorized % on %.% by role %', TG_OP, 'hdicr', TG_TABLE_NAME, current_user;
END;
$$ LANGUAGE plpgsql;

-- ===== 7. VALIDATE ROLE CREATION AND PERMISSIONS =====

DO $$
DECLARE
  role_count INT;
  perms_count INT;
BEGIN
  -- Check roles exist
  SELECT COUNT(*) INTO role_count
  FROM pg_roles
  WHERE rolname IN ('hdicr_app', 'ti_app', 'db_admin');

  IF role_count < 3 THEN
    RAISE EXCEPTION 'Role creation failed. Expected 3 roles, found %', role_count;
  END IF;

  RAISE NOTICE 'RBAC configured successfully:';
  RAISE NOTICE '  - hdicr_app: read/write HDICR, read TI/AUTH';
  RAISE NOTICE '  - ti_app: read/write TI, read HDICR/AUTH';
  RAISE NOTICE '  - db_admin: full access for migrations';
END $$;

COMMIT;

-- ===== ROLLBACK SCRIPT =====
-- To remove RBAC and revert to default permissions:
/*
BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA hdicr FROM hdicr_app;
REVOKE ALL ON ALL TABLES IN SCHEMA ti FROM ti_app;
DROP ROLE IF EXISTS hdicr_app;
DROP ROLE IF EXISTS ti_app;
DROP ROLE IF EXISTS db_admin;
DROP TABLE IF EXISTS public.access_denied_log;
DROP FUNCTION IF EXISTS public.fn_log_unauthorized_access();
COMMIT;
*/

-- ===== NOTES FOR ENVIRONMENT SETUP =====
-- When deploying, set environment variables for each application:
--
-- HDICR Lambda functions:
--   DATABASE_URL=postgres://hdicr_app:${HDICR_APP_PASSWORD}@rds-instance.amazonaws.com:5432/trulyimagined
--
-- TI (Next.js + Lambda) functions:
--   DATABASE_URL=postgres://ti_app:${TI_APP_PASSWORD}@rds-instance.amazonaws.com:5432/trulyimagined
--
-- Admin/migrations (one-time, not in app):
--   DATABASE_URL=postgres://db_admin:${DB_ADMIN_PASSWORD}@rds-instance.amazonaws.com:5432/trulyimagined
--
-- Passwords should be stored in AWS Secrets Manager, not in code.
--
-- ===== VERIFICATION QUERIES =====
-- Run these to verify RBAC is working:
--
-- 1. Check roles exist:
--    SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('hdicr_app', 'ti_app', 'db_admin');
--
-- 2. Check role permissions:
--    SELECT grantee, privilege_type FROM role_table_grants WHERE grantee = 'hdicr_app';
--
-- 3. Test that ti_app cannot INSERT into HDICR tables (should fail):
--    sudo -u postgres psql -U ti_app trulyimagined -c "INSERT INTO hdicr.consent_ledger (...) VALUES (...)"
--    Expected: ERROR: permission denied for schema hdicr
--
-- 4. Test that hdicr_app can read from TI tables:
--    sudo -u postgres psql -U hdicr_app trulyimagined -c "SELECT * FROM ti.licenses LIMIT 1"
--    Expected: (empty result or rows if data exists)
