# Local TI -> HDICR Smoke Prerequisites

Use this before running local TI -> HDICR smoke checks.

## Required local services

1. HDICR API is running and reachable at HDICR_API_URL (for example http://localhost:4001).
2. TI app environment is configured in apps/web/.env.local or repo .env.local.
3. Auth0 M2M credentials are valid for AUTH0_M2M_AUDIENCE.

## Required environment variables

- HDICR_API_URL
- AUTH0_DOMAIN
- AUTH0_M2M_CLIENT_ID
- AUTH0_M2M_CLIENT_SECRET
- AUTH0_M2M_AUDIENCE

## Automated prerequisite check

Run:

```bash
pnpm check:local-ti-hdicr-smoke-prereqs
```

What it verifies:

1. Required env vars are present.
2. HDICR health endpoint responds successfully.
3. Auth0 M2M token retrieval succeeds.
4. A protected HDICR endpoint is reachable with the M2M token.

The command exits non-zero on failure and prints the first failing prerequisite.
