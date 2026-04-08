# SEP-042 Cutover Runbook

This runbook covers removal of DATABASE_URL from TI runtime after HDICR access is fully remote.

## Pre-cutover checks

Run locally:

```bash
pnpm check:sep042-readiness
pnpm check:hdicr-db-coimport
pnpm check:hdicr-owned-table-access
```

Confirm expected behavior:

- TI web code uses TI_DATABASE_URL for TI-owned tables.
- No direct SQL references to HDICR-owned tables in apps/web runtime source.
- No Local adapter paths remain in apps/web/src/lib/hdicr.

## Environment cutover (Vercel)

1. Inspect current env values:

```bash
vercel env ls
```

2. Remove DATABASE_URL from TI project environments (preview + production):

```bash
vercel env rm DATABASE_URL production
vercel env rm DATABASE_URL preview
```

3. Ensure TI_DATABASE_URL remains present (if TI-owned tables are still local):

```bash
vercel env add TI_DATABASE_URL production
vercel env add TI_DATABASE_URL preview
```

## Deploy and verify

1. Trigger TI deploy from main branch.
2. Run smoke checks on core user flows:
   - Profile read/update
   - Agent roster
   - Notifications counts
   - Support tickets
3. Verify HDICR flows still succeed through remote APIs:
   - Identity status and resolution
   - Consent checks
   - Representation requests

## Post-cutover checks

- No runtime SQL errors in Vercel logs.
- No missing env var errors related to DATABASE_URL.
- No auth or API routing regressions.

## Evidence to capture for backlog closure

- Timestamped output of `pnpm check:sep042-readiness`
- Vercel env command outputs showing DATABASE_URL removed
- Deployment URL and smoke test result summary
- Screenshot/log snippet proving zero SQL runtime errors
