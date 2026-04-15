-- TABLE OWNER: TI
-- Migration 036: Add connect_account_id to stripe_events
-- Date: 2026-04-15
-- Purpose:
--   Prepare stripe_events for Stripe Connect event routing (Phase B).
--   Stripe Connect events carry an event.account field (the connected account ID).
--   Storing it here enables filtering, auditing, and routing Connect vs. platform events.
--
-- Notes:
-- - Non-destructive: ALTER TABLE ... ADD COLUMN IF NOT EXISTS only.
-- - Nullable: platform events have no account; only Connect events populate this field.

BEGIN;

ALTER TABLE stripe_events
  ADD COLUMN IF NOT EXISTS connect_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stripe_events_connect_account
  ON stripe_events(connect_account_id)
  WHERE connect_account_id IS NOT NULL;

COMMENT ON COLUMN stripe_events.connect_account_id IS
  'Stripe connected account ID (event.account). NULL for platform events; populated for Connect events.';

COMMIT;
