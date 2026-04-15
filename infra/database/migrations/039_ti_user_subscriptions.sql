-- TABLE OWNER: TI
-- Migration 039: Add user_subscriptions for Stripe subscription lifecycle state
-- Date: 2026-04-15
-- Purpose:
--   Persist subscription state changes from Stripe checkout + webhooks in TI-owned schema.

BEGIN;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',

  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,

  plan_key TEXT NOT NULL,
  interval VARCHAR(20) NOT NULL CHECK (interval IN ('monthly', 'yearly', 'unknown')),
  status VARCHAR(50) NOT NULL,

  current_period_end TIMESTAMPTZ,
  seat_count INTEGER NOT NULL DEFAULT 1 CHECK (seat_count > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON user_subscriptions(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_customer
  ON user_subscriptions(stripe_customer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan
  ON user_subscriptions(plan_key, interval, status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_subscriptions_updated_at') THEN
    CREATE TRIGGER update_user_subscriptions_updated_at
      BEFORE UPDATE ON user_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE user_subscriptions IS 'TI local mirror of Stripe subscription lifecycle for app entitlements and billing UX.';
COMMENT ON COLUMN user_subscriptions.plan_key IS 'Internal billing plan identifier from apps/web/src/lib/billing.ts';
COMMENT ON COLUMN user_subscriptions.interval IS 'Subscription interval mapped from Stripe recurring interval.';
COMMENT ON COLUMN user_subscriptions.seat_count IS 'Total seats provisioned (base seat + add-on seats where applicable).';

COMMIT;
