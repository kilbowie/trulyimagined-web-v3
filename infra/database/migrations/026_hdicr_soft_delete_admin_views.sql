-- TABLE OWNER: HDICR
-- Migration 026: HDICR admin audit views (soft-delete visibility)
-- Date: 2026-04-11
-- Purpose: Create hdicr_admin schema with views that include soft-deleted rows
--          so admin queries can audit full record lifecycle without bypassing RLS.

-- ===========================================
-- ADMIN SCHEMA
-- ===========================================
CREATE SCHEMA IF NOT EXISTS hdicr_admin;

COMMENT ON SCHEMA hdicr_admin IS 'Admin-only views of HDICR tables including soft-deleted records';

-- ===========================================
-- ADMIN VIEWS (include deleted rows)
-- ===========================================
CREATE OR REPLACE VIEW hdicr_admin.v_user_profiles_all AS
  SELECT *, deleted_at IS NOT NULL AS is_deleted
  FROM public.user_profiles;

COMMENT ON VIEW hdicr_admin.v_user_profiles_all IS 'All user profiles including soft-deleted; admin use only';

CREATE OR REPLACE VIEW hdicr_admin.v_actors_all AS
  SELECT *, deleted_at IS NOT NULL AS is_deleted
  FROM public.actors;

COMMENT ON VIEW hdicr_admin.v_actors_all IS 'All actors including soft-deleted; admin use only';

CREATE OR REPLACE VIEW hdicr_admin.v_identity_links_all AS
  SELECT *, deleted_at IS NOT NULL AS is_deleted
  FROM public.identity_links;

COMMENT ON VIEW hdicr_admin.v_identity_links_all IS 'All identity links including soft-deleted; admin use only';

CREATE OR REPLACE VIEW hdicr_admin.v_verifiable_credentials_all AS
  SELECT *, revoked_at IS NOT NULL AS is_revoked
  FROM public.verifiable_credentials;

COMMENT ON VIEW hdicr_admin.v_verifiable_credentials_all IS 'All verifiable credentials including revoked; admin use only';

CREATE OR REPLACE VIEW hdicr_admin.v_consent_ledger_all AS
  SELECT *
  FROM public.consent_ledger;

COMMENT ON VIEW hdicr_admin.v_consent_ledger_all IS 'Full consent ledger (append-only, no deletes); admin use only';

CREATE OR REPLACE VIEW hdicr_admin.v_licenses_all AS
  SELECT *, deleted_at IS NOT NULL AS is_deleted
  FROM public.licenses;

COMMENT ON VIEW hdicr_admin.v_licenses_all IS 'All licenses including soft-deleted; admin use only';

CREATE OR REPLACE VIEW hdicr_admin.v_manual_verification_sessions_all AS
  SELECT *, deleted_at IS NOT NULL AS is_deleted
  FROM public.manual_verification_sessions;

COMMENT ON VIEW hdicr_admin.v_manual_verification_sessions_all IS 'All verification sessions including soft-deleted; admin use only';

CREATE OR REPLACE VIEW hdicr_admin.v_audit_log_all AS
  SELECT *
  FROM public.audit_log;

COMMENT ON VIEW hdicr_admin.v_audit_log_all IS 'Full audit log (immutable, no deletes); admin use only';

-- ===========================================
-- GRANT ACCESS TO ADMIN ROLE
-- The hdicr_admin role is created by migration 020 (guardrails).
-- Use DO block for idempotency in case role was not created yet.
-- ===========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hdicr_admin') THEN
    GRANT USAGE ON SCHEMA hdicr_admin TO hdicr_admin;
    GRANT SELECT ON ALL TABLES IN SCHEMA hdicr_admin TO hdicr_admin;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hdicr_owner') THEN
    GRANT USAGE ON SCHEMA hdicr_admin TO hdicr_owner;
    GRANT SELECT ON ALL TABLES IN SCHEMA hdicr_admin TO hdicr_owner;
  END IF;
END $$;
