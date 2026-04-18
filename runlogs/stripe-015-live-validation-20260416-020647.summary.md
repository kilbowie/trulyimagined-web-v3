# STRIPE-015 Live Validation Evidence

- Date: 2026-04-16
- Command: `pnpm check:stripe-production:live`
- Raw log: `runlogs/stripe-015-live-validation-20260416-020647.log`
- Validator script: `scripts/validate-stripe-production.mjs`

## Runtime Inputs

- Credential mode: `STRIPE_TEST_SECRET_KEY` (generated for this run)
- Price env vars: all 13 provided values were injected into session env
- Connect URLs injected:
  - `STRIPE_CONNECT_RETURN_URL=https://trulyimagined.com/api/stripe/connect/return`
  - `STRIPE_CONNECT_REFRESH_URL=https://trulyimagined.com/api/stripe/connect/refresh`

## Result

- PASS: required environment variables are present (16)
- PASS: webhook endpoint reachable and rejecting unsigned requests
- FAIL: `POST /v1/accounts` returned 400
  - Message: `You can only create new accounts if you've signed up for Connect, which you can do at https://dashboard.stripe.com/connect.`

## Summary

- PASS: 2
- WARN: 0
- FAIL: 1
- Exit: non-zero (validator failed)

## Interpretation

The STRIPE-015 run is blocked by Stripe account configuration (Connect not enabled), not by local validator code or missing env vars.
