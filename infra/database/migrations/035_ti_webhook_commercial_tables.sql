-- TABLE OWNER: TI
-- Migration 035: TI webhook and commercial operations tables
-- Date: 2026-04-14
-- Purpose:
--   1) Add TI-owned persistence for Stripe webhook replay/idempotency.
--   2) Add explicit KYC transition audit history in TI.
--   3) Add TI-owned commercial licensing, wallet, payout, and withdrawal tables.
--
-- Notes:
-- - Non-destructive: CREATE TABLE IF NOT EXISTS only.
-- - Keeps split-domain ownership (does not replace HDICR domain tables).

BEGIN;

-- ===========================================
-- STRIPE EVENTS (raw webhook event persistence)
-- ===========================================
CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_tenant_pending
  ON stripe_events(tenant_id, received_at ASC) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_stripe_events_type
  ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_received_at
  ON stripe_events(received_at DESC);

COMMENT ON TABLE stripe_events IS 'TI raw Stripe webhook events for idempotency, replay, and debugging.';
COMMENT ON COLUMN stripe_events.stripe_event_id IS 'Stripe event.id, unique across retries.';

-- ===========================================
-- KYC STATUS TRANSITIONS (immutable-ish append log)
-- ===========================================
CREATE TABLE IF NOT EXISTS kyc_status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL
    CHECK (new_status IN ('unverified', 'pending', 'awaiting_input', 'verified', 'failed', 'abandoned', 'rejected')),
  stripe_session_id TEXT,
  trigger_event TEXT,
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_status_transitions_user_changed
  ON kyc_status_transitions(user_profile_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_status_transitions_new_status
  ON kyc_status_transitions(new_status);
CREATE INDEX IF NOT EXISTS idx_kyc_status_transitions_session
  ON kyc_status_transitions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

COMMENT ON TABLE kyc_status_transitions IS 'TI KYC transition ledger derived from Stripe identity webhook handling.';

-- ===========================================
-- COMMERCIAL LICENSES (TI payment licensing domain)
-- ===========================================
CREATE TABLE IF NOT EXISTS commercial_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',

  studio_user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  actor_user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  agent_user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  stripe_charge_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(16) NOT NULL DEFAULT 'gbp',

  use_case TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'disputed', 'refunded', 'canceled')),

  disputed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_licenses_tenant_created
  ON commercial_licenses(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_licenses_actor_status
  ON commercial_licenses(actor_user_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_commercial_licenses_studio_status
  ON commercial_licenses(studio_user_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_commercial_licenses_agent_status
  ON commercial_licenses(agent_user_profile_id, status) WHERE agent_user_profile_id IS NOT NULL;

COMMENT ON TABLE commercial_licenses IS 'TI commercial payment licenses (distinct from HDICR consent/API licenses).';

-- ===========================================
-- WALLET BALANCES
-- ===========================================
CREATE TABLE IF NOT EXISTS wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',
  user_profile_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(16) NOT NULL DEFAULT 'gbp',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_balances_tenant_user
  ON wallet_balances(tenant_id, user_profile_id);

COMMENT ON TABLE wallet_balances IS 'TI escrow wallet balances for payout/withdrawal workflows.';

-- ===========================================
-- PAYOUT REQUESTS (agent to actor transfer flow)
-- ===========================================
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',

  agent_user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  actor_user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  commercial_license_id UUID NOT NULL REFERENCES commercial_licenses(id) ON DELETE CASCADE,

  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'released', 'cancelled')),

  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  created_by VARCHAR(50),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_tenant_status_requested
  ON payout_requests(tenant_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_requests_agent
  ON payout_requests(agent_user_profile_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_actor
  ON payout_requests(actor_user_profile_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_license
  ON payout_requests(commercial_license_id);

COMMENT ON TABLE payout_requests IS 'TI payout release workflow rows linked to commercial licenses.';

-- ===========================================
-- WITHDRAWALS (user to bank payout lifecycle)
-- ===========================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL DEFAULT 'trulyimagined',

  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(16) NOT NULL DEFAULT 'gbp',

  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  stripe_payout_id TEXT UNIQUE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_tenant_status_requested
  ON withdrawals(tenant_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user
  ON withdrawals(user_profile_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_payout_id
  ON withdrawals(stripe_payout_id) WHERE stripe_payout_id IS NOT NULL;

COMMENT ON TABLE withdrawals IS 'TI withdrawal lifecycle rows for actor/agent disbursements.';

-- ===========================================
-- UPDATED_AT TRIGGERS
-- ===========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_commercial_licenses_updated_at') THEN
    CREATE TRIGGER update_commercial_licenses_updated_at
      BEFORE UPDATE ON commercial_licenses
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wallet_balances_updated_at') THEN
    CREATE TRIGGER update_wallet_balances_updated_at
      BEFORE UPDATE ON wallet_balances
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMIT;
