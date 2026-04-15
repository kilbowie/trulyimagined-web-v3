#!/usr/bin/env node

/**
 * Stripe webhook health check for TI-owned stripe_events table.
 *
 * Usage:
 *   node scripts/check-stripe-webhook-health.js
 *
 * Env:
 *   TI_DATABASE_URL (required)
 *   STRIPE_WEBHOOK_ALERT_THRESHOLD (default: 5)
 *   STRIPE_WEBHOOK_ALERT_WINDOW_MINUTES (default: 15)
 *   STRIPE_WEBHOOK_STUCK_MINUTES (default: 30)
 */

const { Pool } = require('pg');

const connectionString = process.env.TI_DATABASE_URL;
if (!connectionString) {
  console.error('[stripe-webhook-health] TI_DATABASE_URL is required');
  process.exit(2);
}

const threshold = parseInt(process.env.STRIPE_WEBHOOK_ALERT_THRESHOLD || '5', 10);
const windowMinutes = parseInt(process.env.STRIPE_WEBHOOK_ALERT_WINDOW_MINUTES || '15', 10);
const stuckMinutes = parseInt(process.env.STRIPE_WEBHOOK_STUCK_MINUTES || '30', 10);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();

  try {
    const summaryResult = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE processed = FALSE AND processing_error IS NULL) AS pending_events,
         COUNT(*) FILTER (WHERE processed = FALSE AND processing_error IS NOT NULL) AS failed_events,
         COUNT(*) FILTER (
           WHERE processed = FALSE
             AND processing_error IS NOT NULL
             AND received_at >= NOW() - ($1::int * INTERVAL '1 minute')
         ) AS failures_in_window,
         COUNT(*) FILTER (
           WHERE processed = FALSE
             AND received_at < NOW() - ($2::int * INTERVAL '1 minute')
         ) AS stale_unprocessed
       FROM stripe_events`,
      [windowMinutes, stuckMinutes]
    );

    const summary = summaryResult.rows[0] || {};
    const failedInWindow = Number(summary.failures_in_window || 0);
    const staleUnprocessed = Number(summary.stale_unprocessed || 0);

    const latestFailuresResult = await client.query(
      `SELECT stripe_event_id, event_type, received_at, processing_error
       FROM stripe_events
       WHERE processed = FALSE
         AND processing_error IS NOT NULL
       ORDER BY received_at DESC
       LIMIT 20`
    );

    console.log('[stripe-webhook-health] Summary', {
      pendingEvents: Number(summary.pending_events || 0),
      failedEvents: Number(summary.failed_events || 0),
      failuresInWindow: failedInWindow,
      staleUnprocessed,
      threshold,
      windowMinutes,
      stuckMinutes,
    });

    if (latestFailuresResult.rows.length > 0) {
      console.log('[stripe-webhook-health] Recent failed events', latestFailuresResult.rows);
    }

    const thresholdBreached = Number.isFinite(threshold) && threshold > 0 && failedInWindow >= threshold;
    const staleBreached = staleUnprocessed > 0;

    if (thresholdBreached || staleBreached) {
      console.error('[stripe-webhook-health] ALERT', {
        thresholdBreached,
        staleBreached,
      });
      process.exitCode = 2;
      return;
    }

    process.exitCode = 0;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('[stripe-webhook-health] Failed to run health check', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(2);
});
