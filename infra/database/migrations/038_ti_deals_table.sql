-- TABLE OWNER: TI
-- Migration 038: Add deals table for marketplace payment lifecycle
-- Date: 2026-04-15
-- Purpose:
--   Persist deal-level payment intent and transfer settlement state for Stripe Connect flow.

BEGIN;

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',

  studio_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,

  deal_value_cents INTEGER NOT NULL CHECK (deal_value_cents > 0),
  platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
  actor_payout_cents INTEGER NOT NULL CHECK (actor_payout_cents >= 0),

  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_transfer_id TEXT UNIQUE,

  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'reversed')),
  settled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_tenant_created
  ON deals(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_studio_status
  ON deals(studio_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_actor_status
  ON deals(actor_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_payment_intent
  ON deals(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_deals_transfer_id
  ON deals(stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_deals_updated_at') THEN
    CREATE TRIGGER update_deals_updated_at
      BEFORE UPDATE ON deals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE deals IS 'TI marketplace deal payment records across PaymentIntent and Transfer lifecycle.';
COMMENT ON COLUMN deals.stripe_payment_intent_id IS 'Stripe PaymentIntent id for studio payment capture.';
COMMENT ON COLUMN deals.stripe_transfer_id IS 'Stripe Transfer id to actor connected account after capture.';

COMMIT;
