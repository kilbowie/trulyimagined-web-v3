-- Migration 019: Explicit Schema Ownership Boundaries
-- Separates HDICR (identity/consent) from TI (marketplace) at the schema level
-- This creates defense-in-depth: a bug in TI code trying to modify HDICR tables
-- will be caught immediately at the schema level, not silently.

-- Status: Ready for implementation
-- Applied: [check if already applied below]
-- Rollback: DROP SCHEMA IF EXISTS hdicr CASCADE; DROP SCHEMA IF EXISTS hdicr_auth CASCADE; DROP SCHEMA IF EXISTS ti CASCADE;

BEGIN;

-- ===== 1. CREATE HDICR SCHEMA (Identity & Consent Plane) =====
-- This schema owns all identity, consent, and verification-related tables

CREATE SCHEMA IF NOT EXISTS hdicr AUTHORIZATION postgres;
COMMENT ON SCHEMA hdicr IS 'HDICR (Human Digital Identity Consent Registry) - source of truth for identity, consent policies, and audit trails. Read-only for TI; HDICR-only for modifications.';

-- ===== 2. CREATE HDICR_AUTH SCHEMA (Auth-specific tables) =====
-- Separate schema for Auth0 user profiles and user/role mappings
-- Keeps auth concerns isolated from identity concerns

CREATE SCHEMA IF NOT EXISTS hdicr_auth AUTHORIZATION postgres;
COMMENT ON SCHEMA hdicr_auth IS 'HDICR auth layer - Auth0 user profiles, role mappings, session data. Separates auth from identity.';

-- ===== 3. CREATE TI SCHEMA (Truly Imagined - Marketplace Plane) =====
-- This schema owns all commercial, deal, and licensing tables

CREATE SCHEMA IF NOT EXISTS ti AUTHORIZATION postgres;
COMMENT ON SCHEMA ti IS 'Truly Imagined (marketplace) - commercial deals, licenses, payouts, agent representations. Reads from HDICR; TI-only for modifications.';

-- ===== 4. MOVE EXISTING TABLES TO APPROPRIATE SCHEMAS =====
-- This assumes migrations 001-018 created tables in public schema
-- If tables already exist elsewhere, adjust the ALTER TABLE commands accordingly

-- HDICR plane tables
ALTER TABLE IF EXISTS public.consent_ledger SET SCHEMA hdicr;
ALTER TABLE IF EXISTS public.actors SET SCHEMA hdicr;
ALTER TABLE IF EXISTS public.identity_links SET SCHEMA hdicr;
ALTER TABLE IF EXISTS public.actor_media SET SCHEMA hdicr;
ALTER TABLE IF EXISTS public.verifiable_credentials SET SCHEMA hdicr;
ALTER TABLE IF EXISTS public.bitstring_status_lists SET SCHEMA hdicr;
ALTER TABLE IF EXISTS public.credential_status_entries SET SCHEMA hdicr;
ALTER TABLE IF EXISTS public.api_clients SET SCHEMA hdicr;

-- HDICR_AUTH plane tables
ALTER TABLE IF EXISTS public.user_profiles SET SCHEMA hdicr_auth;

-- TI plane tables (when they exist post-Sprint 3)
-- Uncomment/activate as Deal/Payment tables are created:
-- ALTER TABLE IF EXISTS public.deals SET SCHEMA ti;
-- ALTER TABLE IF EXISTS public.deal_approvals SET SCHEMA ti;
-- ALTER TABLE IF EXISTS public.deal_edits SET SCHEMA ti;
-- ALTER TABLE IF EXISTS public.licenses SET SCHEMA ti;
-- ALTER TABLE IF EXISTS public.license_usage_log SET SCHEMA ti;
-- ALTER TABLE IF EXISTS public.payouts SET SCHEMA ti;
-- ALTER TABLE IF EXISTS public.payment_methods SET SCHEMA ti;
-- ALTER TABLE IF EXISTS public.payment_audit_log SET SCHEMA ti;

-- Shared audit/logging tables (accessible by both planes, written to by both)
-- These stay in public schema since they're cross-cutting concerns:
-- - audit_log (new, will be created in migration 021)
-- - support_tickets, support_ticket_messages, user_feedback (shared operations)

-- ===== 5. SET SCHEMA SEARCH PATH FOR CLARITY =====
-- This ensures new tables created without explicit schema go to the right place
-- (Default: public, but explicit is better than implicit)

ALTER DATABASE postgres SET search_path TO hdicr, hdicr_auth, ti, public;

-- ===== 6. VALIDATE SCHEMA CREATION =====
-- Quick sanity check: schema should exist
DO $$
DECLARE
  schema_count INT;
BEGIN
  SELECT COUNT(*) INTO schema_count
  FROM information_schema.schemata
  WHERE schema_name IN ('hdicr', 'hdicr_auth', 'ti');
  
  IF schema_count < 3 THEN
    RAISE EXCEPTION 'Schema creation failed. Expected 3 schemas (hdicr, hdicr_auth, ti), found %', schema_count;
  END IF;
  
  RAISE NOTICE 'Schema ownership boundaries created successfully. HDICR, HDICR_AUTH, TI schemas now isolated.';
END $$;

COMMIT;

-- ===== NOTES FOR FUTURE MIGRATIONS =====
-- - When creating new tables in Sprint 3+ (deals, payouts, etc.), explicitly specify schema:
--   CREATE TABLE ti.deals (...) 
--   CREATE TABLE ti.licenses (...)
--
-- - When creating tables in 020_rbac.sql, specify schema for role-based access:
--   GRANT SELECT ON ALL TABLES IN SCHEMA hdicr TO ti_app;
--
-- - Audit trail tables (migration 021) should live in their own schema or public,
--   since both planes write to them.
--
-- ===== VALIDATION QUERIES =====
-- Run these after applying to verify:
-- SELECT * FROM information_schema.schemata WHERE schema_name LIKE 'hdicr%' OR schema_name = 'ti';
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('hdicr', 'hdicr_auth', 'ti') ORDER BY table_schema, table_name;
