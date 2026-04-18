# WS2-04, WS9-01, WS6-05 Delivery Notes

Date: 2026-04-18

## WS2-04 Completed

Agency seat allocation and enforcement are now implemented and validated:

- Seat limits enforced on:
  - invite creation
  - invite resend
  - invite acceptance
  - member status transitions
- Seat capacity source: `user_subscriptions.seat_count` for active agency-tier subscriptions
- Occupied seat states: invited + active members
- Tests added for seat boundary conditions in `apps/web/src/lib/agency-seat-limits.test.ts`

## WS9-01 Completed

Launch pricing catalog documented in:

- `docs/LAUNCH_PRICING_CATALOG.md`

Includes canonical tier IDs, env keys, role applicability, interval model, seat add-on model, and Sprint 3 integration contract.

## WS6-05 Completed

Launch-scope dead-end behavior removed/stubbed for license revocation action:

- `apps/web/src/app/dashboard/licenses/page.tsx`

The previous TODO/alert path has been replaced with an explicit disabled post-launch stub and user-facing explanatory text.
