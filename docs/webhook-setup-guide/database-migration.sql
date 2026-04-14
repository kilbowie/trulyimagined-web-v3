-- Truly Imagined: KYC + Payment Architecture Database Migration
-- Run this on your TI RDS instance in production

-- =====================================================
-- USERS TABLE (with KYC status)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL,
    -- actor | agent | studio
    CONSTRAINT valid_user_type CHECK (user_type IN ('actor', 'agent', 'studio')),
  
  -- Authentication & Profile
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  
  -- KYC & Verification
  kyc_status TEXT NOT NULL DEFAULT 'unverified',
    -- unverified | pending | awaiting_input | verified | failed | abandoned
    CONSTRAINT valid_kyc_status CHECK (kyc_status IN (
      'unverified', 'pending', 'awaiting_input', 'verified', 'failed', 'abandoned'
    )),
  kyc_session_id TEXT UNIQUE,
    -- Stripe identity.verification_session.id
  identity_verified_at TIMESTAMP,
  
  -- Stripe Integration
  stripe_customer_id TEXT UNIQUE,
    -- For subscriptions
  stripe_connected_account_id TEXT UNIQUE,
    -- For agents (to receive payouts to bank)
  
  -- Agent-specific
  agent_commission_pct INT,
    -- e.g., 25 means agent takes 25% of license fee
    CONSTRAINT valid_commission CHECK (agent_commission_pct IS NULL OR (agent_commission_pct > 0 AND agent_commission_pct < 100)),
  
  -- Address
  country TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure agent-specific fields are only for agents
  CONSTRAINT agent_fields_only_for_agents CHECK (
    (user_type = 'agent') OR
    (stripe_connected_account_id IS NULL AND agent_commission_pct IS NULL)
  )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX idx_users_stripe_connected_account_id ON users(stripe_connected_account_id);

-- =====================================================
-- SUBSCRIPTIONS TABLE (monthly membership)
-- =====================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL,
    -- actor_basic | agent_pro | studio_starter (customize as needed)
  
  status TEXT NOT NULL,
    -- active | past_due | cancelled | ended
    CONSTRAINT valid_subscription_status CHECK (status IN ('active', 'past_due', 'cancelled', 'ended')),
  
  amount_monthly_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  
  billing_cycle_anchor TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMP,
  
  -- KYC gate: user must be verified to have active subscription
  CONSTRAINT subscription_requires_verified_user CHECK (
    (SELECT kyc_status FROM users WHERE id = user_id) = 'verified'
  )
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- LICENSES TABLE (one-time purchases)
-- =====================================================

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who purchased and what was licensed
  studio_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- NULL if actor is unrepresented
  
  -- Payment reference
  stripe_charge_id TEXT UNIQUE NOT NULL,
  amount_cents INT NOT NULL,
  
  -- License details
  use_case TEXT,
    -- e.g., 'film', 'commercial', 'social', 'theater'
  status TEXT NOT NULL DEFAULT 'active',
    -- active | expired | disputed | refunded
    CONSTRAINT valid_license_status CHECK (status IN ('active', 'expired', 'disputed', 'refunded')),
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  disputed_at TIMESTAMP,
  refunded_at TIMESTAMP,
  refund_reason TEXT,
  
  -- KYC gates: both studio and actor must be verified
  CONSTRAINT license_requires_verified_studio CHECK (
    (SELECT kyc_status FROM users WHERE id = studio_id) = 'verified'
  ),
  CONSTRAINT license_requires_verified_actor CHECK (
    (SELECT kyc_status FROM users WHERE id = actor_id) = 'verified'
  ),
  -- If agent is set, agent must also be verified
  CONSTRAINT license_requires_verified_agent CHECK (
    agent_id IS NULL OR (SELECT kyc_status FROM users WHERE id = agent_id) = 'verified'
  )
);

CREATE INDEX idx_licenses_studio_id ON licenses(studio_id);
CREATE INDEX idx_licenses_actor_id ON licenses(actor_id);
CREATE INDEX idx_licenses_agent_id ON licenses(agent_id);
CREATE INDEX idx_licenses_stripe_charge_id ON licenses(stripe_charge_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_created_at ON licenses(created_at);

-- =====================================================
-- WALLET_BALANCES TABLE (escrow wallets)
-- =====================================================

CREATE TABLE IF NOT EXISTS wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  balance_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'gbp',
  
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Wallet only exists for verified users
  CONSTRAINT wallet_requires_verified_user CHECK (
    (SELECT kyc_status FROM users WHERE id = user_id) = 'verified'
  )
);

CREATE INDEX idx_wallet_balances_user_id ON wallet_balances(user_id);

-- =====================================================
-- PAYOUT_REQUESTS TABLE (agent → actor per license)
-- =====================================================

CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  
  amount_cents INT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | released | cancelled
    CONSTRAINT valid_payout_status CHECK (status IN ('pending', 'released', 'cancelled')),
  
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP,
    -- Once released, immutable (no update after this)
  
  created_by TEXT,
    -- 'agent' or 'system'
  notes TEXT,
  
  -- Both agent and actor must be verified
  CONSTRAINT payout_requires_verified_agent CHECK (
    (SELECT kyc_status FROM users WHERE id = agent_id) = 'verified'
  ),
  CONSTRAINT payout_requires_verified_actor CHECK (
    (SELECT kyc_status FROM users WHERE id = actor_id) = 'verified'
  )
);

CREATE INDEX idx_payout_requests_agent_id ON payout_requests(agent_id);
CREATE INDEX idx_payout_requests_actor_id ON payout_requests(actor_id);
CREATE INDEX idx_payout_requests_license_id ON payout_requests(license_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);

-- =====================================================
-- WITHDRAWALS TABLE (actor/agent → bank)
-- =====================================================

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | processing | completed | failed
    CONSTRAINT valid_withdrawal_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  stripe_payout_id TEXT UNIQUE,
    -- payout.id from Stripe
  
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  failure_reason TEXT,
  
  -- User must be verified to withdraw
  CONSTRAINT withdrawal_requires_verified_user CHECK (
    (SELECT kyc_status FROM users WHERE id = user_id) = 'verified'
  ),
  -- Agent must have connected account to withdraw
  CONSTRAINT agent_withdrawal_requires_connected_account CHECK (
    (SELECT user_type FROM users WHERE id = user_id) != 'agent' OR
    (SELECT stripe_connected_account_id FROM users WHERE id = user_id) IS NOT NULL
  )
);

CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX idx_withdrawals_stripe_payout_id ON withdrawals(stripe_payout_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
CREATE INDEX idx_withdrawals_requested_at ON withdrawals(requested_at);

-- =====================================================
-- AUDIT_EVENTS TABLE (immutable compliance log)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  event_type TEXT NOT NULL,
    -- kyc.verified, kyc.failed, charge.succeeded, payout.requested, withdrawal.completed, etc.
  entity_type TEXT NOT NULL,
    -- user, license, subscription, withdrawal, payout_request
  entity_id UUID NOT NULL,
  
  -- References (optional)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  studio_id UUID REFERENCES users(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  amount_cents INT,
  
  outcome TEXT NOT NULL,
    -- success, failed, blocked, pending
    CONSTRAINT valid_audit_outcome CHECK (outcome IN ('success', 'failed', 'blocked', 'pending')),
  
  reason TEXT,
  metadata JSONB,
    -- Additional context (e.g., { "agent_share": 1250, "actor_share": 3750 })
  
  -- IMMUTABLE: no updates after creation
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Audit events can only be inserted, never updated or deleted
  CONSTRAINT no_update_allowed CHECK (true)
);

-- Prevent updates to audit_events
CREATE OR REPLACE FUNCTION prevent_audit_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable and cannot be updated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_update();

CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_entity_id ON audit_events(entity_id);
CREATE INDEX idx_audit_events_outcome ON audit_events(outcome);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX idx_audit_events_studio_id ON audit_events(studio_id);
CREATE INDEX idx_audit_events_agent_id ON audit_events(agent_id);
CREATE INDEX idx_audit_events_actor_id ON audit_events(actor_id);

-- =====================================================
-- KYC_AUDIT TABLE (immutable KYC status change history)
-- =====================================================

CREATE TABLE IF NOT EXISTS kyc_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  old_status TEXT,
  new_status TEXT NOT NULL,
    CONSTRAINT valid_kyc_audit_status CHECK (new_status IN (
      'unverified', 'pending', 'awaiting_input', 'verified', 'failed', 'abandoned'
    )),
  
  stripe_session_id TEXT,
  trigger_event TEXT,
    -- identity.verification_session.verified, identity.verification_session.redacted, etc.
  reason TEXT,
  
  -- IMMUTABLE
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_audit_user_id ON kyc_audit(user_id);
CREATE INDEX idx_kyc_audit_new_status ON kyc_audit(new_status);
CREATE INDEX idx_kyc_audit_changed_at ON kyc_audit(changed_at);

-- =====================================================
-- STRIPE_EVENTS TABLE (raw webhook log for debugging)
-- =====================================================

CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
    -- Full Stripe event payload for debugging
  
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
    -- Error message if processing failed
  
  received_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_events_stripe_event_id ON stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_event_type ON stripe_events(event_type);
CREATE INDEX idx_stripe_events_processed ON stripe_events(processed);
CREATE INDEX idx_stripe_events_received_at ON stripe_events(received_at);

-- =====================================================
-- VIEWS (for easier querying)
-- =====================================================

CREATE OR REPLACE VIEW v_verified_users AS
  SELECT * FROM users WHERE kyc_status = 'verified';

CREATE OR REPLACE VIEW v_active_licenses AS
  SELECT * FROM licenses WHERE status = 'active';

CREATE OR REPLACE VIEW v_pending_payouts AS
  SELECT * FROM payout_requests WHERE status = 'pending';

CREATE OR REPLACE VIEW v_recent_audit_events AS
  SELECT * FROM audit_events
  WHERE created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

-- Verify tables were created:
-- \dt; -- in psql to list all tables
