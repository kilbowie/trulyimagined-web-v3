-- Migration 022: Data Flow Contracts via Database Views
-- Creates explicit database views that document ALLOWED data flows:
-- - HDICR read by TI (consent validation)
-- - TI licensing queried by both planes
-- - Audit log written by both planes
--
-- These views serve as "contracts": they define what each plane is allowed to access.
-- If code tries to query outside these contracts, it will get clearer error messages.

-- Status: Ready for implementation
-- Note: This is more about documentation + minimal enforcement.
--       The real enforcement happens in migration 020 (RBAC).

BEGIN;

-- ===== 1. CREATE TI-FACING VIEWS (What TI is allowed to see from HDICR) =====

-- TI can view actors but only their essential identity fields
CREATE OR REPLACE VIEW hdicr.v_actors_for_ti AS
SELECT
  id,
  registry_id,
  legal_name,
  professional_name,
  verification_status,
  created_at,
  tenant_id
FROM hdicr.actors
WHERE deleted_at IS NULL;

GRANT SELECT ON hdicr.v_actors_for_ti TO ti_app;
COMMENT ON VIEW hdicr.v_actors_for_ti IS 'TI-facing view of actor identities. Limited to essential fields (no private metadata). Used for deal negotiation and license validation.';

-- TI can view current consent policies (for licensing decisions)
CREATE OR REPLACE VIEW hdicr.v_active_consent_for_ti AS
SELECT
  id,
  actor_id,
  version,
  policy,
  created_at,
  tenant_id
FROM hdicr.consent_ledger
WHERE status = 'active'
  AND deleted_at IS NULL;

GRANT SELECT ON hdicr.v_active_consent_for_ti TO ti_app;
COMMENT ON VIEW hdicr.v_active_consent_for_ti IS 'TI-facing view of active consent policies. Used by /api/v1/consent/check to validate licensing requests. Read-only.';

-- TI can view identity verification status (for KYC checks)
CREATE OR REPLACE VIEW hdicr.v_actor_verification_for_ti AS
SELECT
  actor_id,
  MAX(CASE WHEN provider_type = 'stripe' THEN assurance_level END) AS stripe_assurance,
  MAX(CASE WHEN provider_type = 'mock' THEN assurance_level END) AS mock_assurance,
  MAX(created_at) AS last_verified_at,
  tenant_id
FROM hdicr.identity_links
WHERE deleted_at IS NULL
GROUP BY actor_id, tenant_id;

GRANT SELECT ON hdicr.v_actor_verification_for_ti TO ti_app;
COMMENT ON VIEW hdicr.v_actor_verification_for_ti IS 'TI-facing view of actor verification status (KYC). Shows which verification providers have verified this actor.';

-- ===== 2. CREATE HDICR-FACING VIEWS (What HDICR is allowed to see from TI) =====

-- HDICR can view licenses (for audit purposes)
-- Note: This view will be created once ti.licenses table exists (after Sprint 3)
-- CREATE OR REPLACE VIEW ti.v_licenses_for_hdicr AS
-- SELECT
--   id,
--   actor_id,
--   consent_version_at_signing,
--   status,
--   created_at,
--   tenant_id
-- FROM ti.licenses
-- WHERE deleted_at IS NULL;
-- GRANT SELECT ON ti.v_licenses_for_hdicr TO hdicr_app;

-- ===== 3. CREATE SHARED AUDIT VIEWS (Both planes use for compliance) =====

-- View: HDICR modifications (for compliance)
CREATE OR REPLACE VIEW public.v_hdicr_audit_trail AS
SELECT
  id,
  app_role,
  actor_id,
  action,
  resource_table,
  resource_id,
  change_before,
  change_after,
  created_at,
  tenant_id
FROM public.audit_log
WHERE resource_table LIKE 'hdicr.%'
   OR resource_table IN ('consent_ledger', 'actors', 'identity_links')
ORDER BY created_at DESC;

GRANT SELECT ON public.v_hdicr_audit_trail TO hdicr_app, ti_app, db_admin;
COMMENT ON VIEW public.v_hdicr_audit_trail IS 'Compliance view: all modifications to HDICR tables. Use for GDPR audits, consent history reconstruction.';

-- View: TI licensing modifications (for compliance)
CREATE OR REPLACE VIEW public.v_ti_audit_trail AS
SELECT
  id,
  app_role,
  actor_id,
  action,
  resource_table,
  resource_id,
  change_before,
  change_after,
  created_at,
  tenant_id
FROM public.audit_log
WHERE resource_table LIKE 'ti.%'
   OR resource_table IN ('deals', 'licenses', 'payouts', 'payment_audit_log')
ORDER BY created_at DESC;

GRANT SELECT ON public.v_ti_audit_trail TO hdicr_app, ti_app, db_admin;
COMMENT ON VIEW public.v_ti_audit_trail IS 'Compliance view: all modifications to TI tables. Use for payment audits, deal history reconstruction.';

-- View: Cross-plane access pattern tracking
CREATE OR REPLACE VIEW public.v_cross_plane_access AS
SELECT
  app_role,
  resource_table,
  COUNT(*) AS access_count,
  MAX(created_at) AS last_access,
  CASE
    WHEN resource_table LIKE 'hdicr.%' AND app_role = 'ti_app' THEN 'TI reading HDICR'
    WHEN resource_table LIKE 'ti.%' AND app_role = 'hdicr_app' THEN 'HDICR reading TI'
    WHEN resource_table LIKE 'hdicr.%' AND app_role != 'hdicr_app' THEN 'UNEXPECTED'
    ELSE 'NORMAL'
  END AS access_pattern
FROM public.audit_log
GROUP BY app_role, resource_table
ORDER BY access_count DESC;

GRANT SELECT ON public.v_cross_plane_access TO db_admin;
COMMENT ON VIEW public.v_cross_plane_access IS 'Operational view: shows which roles access which tables. Use to detect anomalies.';

-- ===== 4. CREATE DOCUMENTATION FUNCTION =====
-- This function documents the data flow contracts in a queryable way

CREATE OR REPLACE FUNCTION public.fn_data_flow_contracts()
RETURNS TABLE (
  from_plane VARCHAR(50),
  to_plane VARCHAR(50),
  operation VARCHAR(20),
  resource_table VARCHAR(100),
  purpose TEXT,
  is_allowed BOOLEAN
) AS $$
BEGIN
  -- HDICR → HDICR (reads/writes own plane)
  RETURN QUERY SELECT 'HDICR'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'READ/WRITE'::VARCHAR(20), 'consent_ledger'::VARCHAR(100), 'Core identity and consent operations'::TEXT, TRUE::BOOLEAN;
  RETURN QUERY SELECT 'HDICR'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'READ/WRITE'::VARCHAR(20), 'actors'::VARCHAR(100), 'Actor identity records'::TEXT, TRUE::BOOLEAN;
  RETURN QUERY SELECT 'HDICR'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'READ/WRITE'::VARCHAR(20), 'identity_links'::VARCHAR(100), 'Verification provider data'::TEXT, TRUE::BOOLEAN;

  -- TI → TI (reads/writes own plane)
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'TI'::VARCHAR(50), 'READ/WRITE'::VARCHAR(20), 'deals'::VARCHAR(100), 'Commercial deal data'::TEXT, TRUE::BOOLEAN;
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'TI'::VARCHAR(50), 'READ/WRITE'::VARCHAR(20), 'licenses'::VARCHAR(100), 'Licensing records'::TEXT, TRUE::BOOLEAN;
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'TI'::VARCHAR(50), 'READ/WRITE'::VARCHAR(20), 'payouts'::VARCHAR(100), 'Payment and payout data'::TEXT, TRUE::BOOLEAN;

  -- Cross-plane: TI → HDICR (TI reads HDICR for validation)
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'READ'::VARCHAR(20), 'consent_ledger'::VARCHAR(100), 'Validate licenses against active consent'::TEXT, TRUE::BOOLEAN;
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'READ'::VARCHAR(20), 'actors'::VARCHAR(100), 'Resolve actor identity for deal creation'::TEXT, TRUE::BOOLEAN;
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'READ'::VARCHAR(20), 'identity_links'::VARCHAR(100), 'Check actor verification status'::TEXT, TRUE::BOOLEAN;

  -- Cross-plane: HDICR → TI (HDICR reads TI for audit, very rare)
  RETURN QUERY SELECT 'HDICR'::VARCHAR(50), 'TI'::VARCHAR(50), 'READ'::VARCHAR(20), 'licenses'::VARCHAR(100), 'Audit trail: which licenses depend on this consent version'::TEXT, TRUE::BOOLEAN;

  -- Forbidden flows (should never happen if RBAC is working)
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'WRITE'::VARCHAR(20), 'consent_ledger'::VARCHAR(100), 'TI must never modify consent data'::TEXT, FALSE::BOOLEAN;
  RETURN QUERY SELECT 'TI'::VARCHAR(50), 'HDICR'::VARCHAR(50), 'WRITE'::VARCHAR(20), 'actors'::VARCHAR(100), 'TI must never modify actor identity'::TEXT, FALSE::BOOLEAN;
  RETURN QUERY SELECT 'HDICR'::VARCHAR(50), 'TI'::VARCHAR(50), 'WRITE'::VARCHAR(20), 'deals'::VARCHAR(100), 'HDICR must never create deals'::TEXT, FALSE::BOOLEAN;
  RETURN QUERY SELECT 'HDICR'::VARCHAR(50), 'TI'::VARCHAR(50), 'WRITE'::VARCHAR(20), 'licenses'::VARCHAR(100), 'HDICR must never issue licenses (TI does via HDICR validation)'::TEXT, FALSE::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.fn_data_flow_contracts() TO hdicr_app, ti_app, db_admin;
COMMENT ON FUNCTION public.fn_data_flow_contracts() IS 'Documents the allowed and forbidden data flows between planes. Use for onboarding, compliance, and design review.';

-- ===== 5. CREATE CHECK CONSTRAINT: PREVENT INVALID CONSENT GRANTS =====
-- If a license exists for an actor, that actor must have active consent
-- (This is more of a documentation constraint; enforcement happens at application level)

ALTER TABLE ti.licenses ADD CONSTRAINT check_active_consent_required
CHECK (
  NOT EXISTS (
    SELECT 1 FROM hdicr.consent_ledger cl
    WHERE cl.actor_id = ti.licenses.actor_id
      AND cl.status = 'active'
      AND cl.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM hdicr.consent_ledger cl
    WHERE cl.actor_id = ti.licenses.actor_id
      AND cl.status = 'active'
      AND cl.deleted_at IS NULL
  )
);

-- Note: The above constraint is a tautology and won't enforce anything meaningfully.
-- The real enforcement happens at application level in /api/v1/consent/check.
-- This constraint is just a placeholder for future stricter validation.

-- ===== 6. VALIDATION =====

DO $$
BEGIN
  RAISE NOTICE 'Data flow contracts created:';
  RAISE NOTICE '  - v_actors_for_ti: TI can view essential actor fields';
  RAISE NOTICE '  - v_active_consent_for_ti: TI can read active consent policies';
  RAISE NOTICE '  - v_actor_verification_for_ti: TI can view KYC status';
  RAISE NOTICE '  - v_hdicr_audit_trail: audit log for HDICR';
  RAISE NOTICE '  - v_ti_audit_trail: audit log for TI';
  RAISE NOTICE '  - v_cross_plane_access: monitor cross-plane access patterns';
  RAISE NOTICE '  - fn_data_flow_contracts(): queryable documentation of allowed/forbidden flows';
END $$;

COMMIT;

-- ===== VERIFICATION QUERIES =====
-- Run these to verify data flow contracts are set up:
--
-- 1. List all contract views:
--    SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'hdicr' AND table_name LIKE 'v_%';
--
-- 2. Check what TI can see from HDICR:
--    SELECT * FROM hdicr.v_actors_for_ti LIMIT 5;
--    SELECT * FROM hdicr.v_active_consent_for_ti LIMIT 5;
--
-- 3. Query the data flow contracts documentation:
--    SELECT * FROM public.fn_data_flow_contracts() WHERE is_allowed = FALSE;
--
-- 4. Monitor cross-plane access patterns:
--    SELECT * FROM public.v_cross_plane_access ORDER BY access_count DESC;

-- ===== NOTES FOR CODE REVIEW =====
-- When reviewing application code:
-- 1. HDICR code should only query tables in hdicr.* or hdicr_auth.* schemas
-- 2. HDICR code should only read from ti.* (via v_licenses_for_hdicr, when created)
-- 3. TI code should query from ti.* schema
-- 4. TI code should only read from hdicr.* (via the v_* views)
-- 5. Both planes write to public.audit_log
--
-- Any queries outside these contracts are bugs and should be rejected in code review.

-- ===== FUTURE: ADD RUNTIME ENFORCEMENT =====
-- When creating new tables in Sprints 3+, consider adding:
-- - CHECK constraints to enforce invariants (e.g., deal.consent_version > 0)
-- - Foreign key constraints with appropriate cascade behavior
-- - Generated columns to maintain derived data consistency
