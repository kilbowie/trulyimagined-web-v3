-- Migration 021: Immutability Enforcement + Audit Logging
-- Enforces that HDICR consent_ledger is append-only (immutable).
-- Any attempt to UPDATE or DELETE a consent record is rejected at the database level.
-- Creates a cross-plane audit log so both HDICR and TI can track who changed what.

-- Status: Ready for implementation
-- Rollback: DROP TRIGGER IF EXISTS consent_mutation_guard ON hdicr.consent_ledger; DROP FUNCTION IF EXISTS hdicr.fn_prevent_consent_mutation();

BEGIN;

-- ===== 1. CREATE CROSS-PLANE AUDIT LOG TABLE =====
-- Both HDICR and TI applications write to this table.
-- This allows us to detect if TI code accidentally modified HDICR tables.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  
  -- Who did it
  app_role VARCHAR(50) NOT NULL,           -- 'hdicr_app', 'ti_app', etc.
  actor_id BIGINT,                         -- The actor affected (if applicable)
  user_id VARCHAR(255),                    -- Auth0 sub (if applicable)
  
  -- What happened
  action VARCHAR(100) NOT NULL,            -- 'consent.granted', 'license.created', etc.
  resource_table VARCHAR(100) NOT NULL,    -- 'consent_ledger', 'licenses', etc.
  resource_id BIGINT NOT NULL,             -- The PK of the modified record
  
  -- What changed
  change_before JSONB,                     -- Previous state (for UPDATE)
  change_after JSONB,                      -- New state (for INSERT/UPDATE)
  
  -- When and where
  created_at TIMESTAMP DEFAULT NOW(),
  app_version VARCHAR(50),                 -- e.g., '1.2.3'
  ip_address INET,
  user_agent TEXT,
  
  -- Multi-tenant support
  tenant_id VARCHAR(255),
  
  INDEX idx_audit_log_actor (actor_id),
  INDEX idx_audit_log_action (action),
  INDEX idx_audit_log_created_at (created_at DESC),
  INDEX idx_audit_log_resource (resource_table, resource_id)
);

GRANT SELECT, INSERT ON public.audit_log TO hdicr_app, ti_app;

COMMENT ON TABLE public.audit_log IS 'Cross-plane audit trail. Both HDICR and TI applications write to this. Use to detect unauthorized modifications.';
COMMENT ON COLUMN public.audit_log.app_role IS 'The database role that performed the action (hdicr_app, ti_app). Critical for compliance.';
COMMENT ON COLUMN public.audit_log.resource_table IS 'Which table was modified. If ti_app modifies hdicr.consent_ledger, this will show "consent_ledger".';

-- ===== 2. CREATE IMMUTABILITY TRIGGER FOR CONSENT_LEDGER =====
-- HDICR consent_ledger is append-only: new entries can be INSERTed,
-- but UPDATEs and DELETEs are rejected.
-- The only way to change consent is to INSERT a new version.

CREATE OR REPLACE FUNCTION hdicr.fn_prevent_consent_mutation()
RETURNS TRIGGER AS $$
DECLARE
  app_role VARCHAR(50) := current_user;
  error_msg TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    error_msg := format(
      'Consent ledger is immutable. Cannot UPDATE consent_ledger.id=%L. Create a new version instead (version=%L).',
      OLD.id,
      OLD.version + 1
    );
    
    -- Log the attempted mutation to audit_log
    INSERT INTO public.audit_log (app_role, actor_id, action, resource_table, resource_id, change_before, change_after)
    VALUES (app_role, OLD.actor_id, 'consent.unauthorized_update_attempted', 'consent_ledger', OLD.id, to_jsonb(OLD), to_jsonb(NEW));
    
    RAISE EXCEPTION '%', error_msg;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    error_msg := format(
      'Consent ledger is immutable. Cannot DELETE consent_ledger.id=%L. Use soft-delete (UPDATE deleted_at) instead.',
      OLD.id
    );
    
    INSERT INTO public.audit_log (app_role, actor_id, action, resource_table, resource_id, change_before)
    VALUES (app_role, OLD.actor_id, 'consent.unauthorized_delete_attempted', 'consent_ledger', OLD.id, to_jsonb(OLD));
    
    RAISE EXCEPTION '%', error_msg;
  END IF;
  
  -- INSERTS are allowed; just log them
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (app_role, actor_id, action, resource_table, resource_id, change_after)
    VALUES (app_role, NEW.actor_id, 'consent.created', 'consent_ledger', NEW.id, to_jsonb(NEW));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the immutability trigger to consent_ledger
CREATE TRIGGER consent_mutation_guard
BEFORE UPDATE OR DELETE ON hdicr.consent_ledger
FOR EACH ROW
EXECUTE FUNCTION hdicr.fn_prevent_consent_mutation();

COMMENT ON FUNCTION hdicr.fn_prevent_consent_mutation() IS 'Enforces immutability of consent_ledger. UPDATEs and DELETEs are rejected. New versions must be INSERTed.';

-- ===== 3. CREATE AUDIT TRIGGER FOR ALL HDICR TABLES =====
-- Logs every INSERT/UPDATE/DELETE on HDICR tables so we can detect mutations

CREATE OR REPLACE FUNCTION hdicr.fn_audit_hdicr_change()
RETURNS TRIGGER AS $$
DECLARE
  app_role VARCHAR(50) := current_user;
  action_name VARCHAR(50);
BEGIN
  -- Map operation to action name
  action_name := CASE TG_OP
    WHEN 'INSERT' THEN TG_TABLE_NAME || '.created'
    WHEN 'UPDATE' THEN TG_TABLE_NAME || '.updated'
    WHEN 'DELETE' THEN TG_TABLE_NAME || '.deleted'
  END;
  
  -- Log to audit_log
  INSERT INTO public.audit_log (
    app_role, actor_id, action, resource_table, resource_id,
    change_before, change_after, tenant_id
  ) VALUES (
    app_role,
    COALESCE(NEW.actor_id, OLD.actor_id),
    action_name,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    COALESCE(NEW.tenant_id, OLD.tenant_id)
  );
  
  -- Return the appropriate value
  RETURN CASE TG_OP
    WHEN 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;

-- Attach audit triggers to core HDICR tables
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'hdicr'
      AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT LIKE 'pg_%'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER audit_%s_change
       AFTER INSERT OR UPDATE OR DELETE ON hdicr.%I
       FOR EACH ROW
       EXECUTE FUNCTION hdicr.fn_audit_hdicr_change()',
      table_name, table_name
    );
    RAISE NOTICE 'Created audit trigger for hdicr.%', table_name;
  END LOOP;
END $$;

-- ===== 4. CREATE AUDIT TRIGGER FOR TI TABLES =====
-- Logs every INSERT/UPDATE/DELETE on TI tables for compliance

CREATE OR REPLACE FUNCTION ti.fn_audit_ti_change()
RETURNS TRIGGER AS $$
DECLARE
  app_role VARCHAR(50) := current_user;
  action_name VARCHAR(50);
BEGIN
  action_name := CASE TG_OP
    WHEN 'INSERT' THEN TG_TABLE_NAME || '.created'
    WHEN 'UPDATE' THEN TG_TABLE_NAME || '.updated'
    WHEN 'DELETE' THEN TG_TABLE_NAME || '.deleted'
  END;
  
  INSERT INTO public.audit_log (
    app_role, actor_id, action, resource_table, resource_id,
    change_before, change_after, tenant_id
  ) VALUES (
    app_role,
    COALESCE(NEW.actor_id, OLD.actor_id),
    action_name,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
    COALESCE(NEW.tenant_id, OLD.tenant_id)
  );
  
  RETURN CASE TG_OP
    WHEN 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql;

-- Note: Audit triggers for TI tables will be created when those tables are created
-- (migration 024+, after deals/licenses/payouts are added)

-- ===== 5. CREATE HELPER FUNCTION: DETECT UNAUTHORIZED CROSS-PLANE WRITES =====
-- Query this function periodically to find instances where TI code modified HDICR tables

CREATE OR REPLACE FUNCTION public.fn_detect_cross_plane_violations()
RETURNS TABLE (
  violation_id BIGINT,
  app_role VARCHAR(50),
  action VARCHAR(100),
  resource_table VARCHAR(100),
  resource_id BIGINT,
  severity VARCHAR(20),
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.app_role,
    al.action,
    al.resource_table,
    al.resource_id,
    CASE
      WHEN al.resource_table LIKE 'consent_%' AND al.app_role != 'hdicr_app' THEN 'CRITICAL'
      WHEN al.resource_table = 'actors' AND al.app_role != 'hdicr_app' THEN 'CRITICAL'
      WHEN al.resource_table = 'identity_links' AND al.app_role != 'hdicr_app' THEN 'HIGH'
      ELSE 'MEDIUM'
    END AS severity,
    al.created_at
  FROM public.audit_log al
  WHERE (al.resource_table LIKE 'consent_%' OR al.resource_table LIKE 'actors' OR al.resource_table LIKE 'identity_%')
    AND al.app_role NOT IN ('hdicr_app', 'db_admin', 'postgres');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.fn_detect_cross_plane_violations() TO hdicr_app, ti_app, db_admin;

COMMENT ON FUNCTION public.fn_detect_cross_plane_violations() IS 'Returns all cross-plane violations. Run this periodically to detect unauthorized modifications.';

-- ===== 6. VALIDATION =====

DO $$
BEGIN
  RAISE NOTICE 'Immutability and audit logging configured:';
  RAISE NOTICE '  - consent_ledger is now immutable (INSERT only)';
  RAISE NOTICE '  - All HDICR tables have audit triggers';
  RAISE NOTICE '  - audit_log table created for cross-plane tracking';
  RAISE NOTICE '  - fn_detect_cross_plane_violations() available for compliance monitoring';
END $$;

COMMIT;

-- ===== VERIFICATION QUERIES =====
-- Run these to verify immutability is working:
--
-- 1. Check that immutability trigger exists:
--    SELECT trigger_name FROM information_schema.triggers WHERE trigger_name LIKE 'consent%';
--
-- 2. Test that UPDATE is rejected (should fail with error):
--    UPDATE hdicr.consent_ledger SET policy = '{}'::jsonb WHERE id = 1;
--    Expected: ERROR: Consent ledger is immutable.
--
-- 3. Verify audit log captured the attempt:
--    SELECT action, resource_table FROM public.audit_log WHERE action LIKE '%unauthorized%' ORDER BY created_at DESC LIMIT 5;
--
-- 4. Test that INSERT works (appending new version):
--    INSERT INTO hdicr.consent_ledger (actor_id, version, policy, status, created_by) VALUES (1, 2, '{}'::jsonb, 'active', 1);
--    Expected: INSERT succeeds
--
-- 5. Check for cross-plane violations:
--    SELECT * FROM public.fn_detect_cross_plane_violations();
--    Expected: (empty if no violations)

-- ===== NOTES FOR ONGOING OPERATIONS =====
-- - Monitor audit_log for attempts to UPDATE consent_ledger
-- - Set up alerts for any writes to HDICR tables from ti_app role
-- - Archive audit_log periodically (older than 90 days → cold storage)
-- - For GDPR deletion: delete from audit_log, then from actual tables via soft-delete
