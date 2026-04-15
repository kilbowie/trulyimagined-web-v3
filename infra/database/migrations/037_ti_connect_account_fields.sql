-- TABLE OWNER: TI
-- Migration 037: Add Stripe Connect account fields to actors
-- Date: 2026-04-15
-- Purpose:
--   Persist Stripe Connect account linkage and onboarding status for actor payouts.

BEGIN;

ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_stripe_account_id_unique
  ON actors(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actors_stripe_onboarding_complete
  ON actors(stripe_onboarding_complete);

COMMENT ON COLUMN actors.stripe_account_id IS 'Stripe Connect Express account id (acct_*)';
COMMENT ON COLUMN actors.stripe_account_status IS 'Connect lifecycle status: pending|active|restricted';
COMMENT ON COLUMN actors.stripe_onboarding_complete IS 'TRUE when account details are submitted and payouts/charges are enabled.';

COMMIT;
