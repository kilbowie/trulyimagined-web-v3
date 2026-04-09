# Platform Audit Report

Date: 2026-04-09
Workspace root (absolute): C:/Users/adamr/OneDrive/Desktop/KilbowieConsulting/002-TrulyImagined/trulyimagined-web-v3/

## 1. Overall Architecture Assessment

Rating: Needs Work with Critical Issues

The platform has made strong progress on HDICR/TI separation (API clients, CI guardrails, RLS, split deploy workflows), but still has critical auth and secrets-risk items that block production-grade readiness for a security-sensitive multi-tenant SaaS.

## 2. HDICR vs Truly Imagined Separation

### What is correctly separated

- TI consumes HDICR through HTTP clients, not direct package imports.
- Evidence:
  - [apps/web/src/lib/hdicr/identity-client.ts](apps/web/src/lib/hdicr/identity-client.ts)
  - [apps/web/src/lib/hdicr/consent-client.ts](apps/web/src/lib/hdicr/consent-client.ts)
  - [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts)
- Remote-only/fail-closed behavior is enforced in production mode.
- Evidence:
  - [apps/web/src/lib/hdicr/flags.ts](apps/web/src/lib/hdicr/flags.ts)
- Split deployment workflows exist for TI web and HDICR services.
- Evidence:
  - [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  - [.github/workflows/hdicr-deploy.yml](.github/workflows/hdicr-deploy.yml)
- Tenant-aware DB controls and RLS are implemented.
- Evidence:
  - [infra/database/src/client.ts](infra/database/src/client.ts)
  - [infra/database/migrations/016_tenant_isolation.sql](infra/database/migrations/016_tenant_isolation.sql)
  - [infra/database/migrations/017_rls_policies.sql](infra/database/migrations/017_rls_policies.sql)

### What is still tightly coupled

- TI and HDICR still share the same physical PostgreSQL substrate.
- Evidence:
  - [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
- HDICR currently contains licensing/commercial policy logic, conflicting with the stated target where HDICR should be execution/processing-only.
- Evidence:
  - [services/licensing-service/src/handler.ts](services/licensing-service/src/handler.ts)
  - [services/consent-service/src/handlers/check-consent-enforcement.ts](services/consent-service/src/handlers/check-consent-enforcement.ts)
  - [infra/database/src/queries-v3.ts](infra/database/src/queries-v3.ts)

### Recommended boundary target

- TI control plane owns: users, artists, projects, licenses, commercial terms, billing.
- HDICR processing plane owns: model metadata, processing jobs, output references, execution telemetry.
- TI to HDICR requests must carry mandatory context: tenantId, projectId, licenseId, usageIntent, policyVersion, traceId.

## 3. Service Boundaries and API Design

### Good

- OpenAPI contracts exist across identity, consent, licensing, representation.
- Evidence:
  - [services/identity-service/openapi.yaml](services/identity-service/openapi.yaml)
  - [services/consent-service/openapi.yaml](services/consent-service/openapi.yaml)
  - [services/licensing-service/openapi.yaml](services/licensing-service/openapi.yaml)
  - [services/representation-service/openapi.yaml](services/representation-service/openapi.yaml)

### Gaps

- Critical TODO: external consent-check endpoint does not verify API key hash against api_clients; request trust is incomplete.
- Evidence:
  - [apps/web/src/app/api/v1/consent/check/route.ts](apps/web/src/app/api/v1/consent/check/route.ts)
- Representation service is missing scope authorization checks present in other services.
- Evidence:
  - [services/representation-service/src/index.ts](services/representation-service/src/index.ts)
  - [services/consent-service/src/index.ts](services/consent-service/src/index.ts)
  - [services/licensing-service/src/handler.ts](services/licensing-service/src/handler.ts)

## 4. Database Architecture (AWS Focus)

### Existing

- PostgreSQL on AWS RDS is the central transactional store.
- API services are Lambda behind API Gateway.
- S3 is used for media storage.
- Evidence:
  - [infra/api-gateway/template.yaml](infra/api-gateway/template.yaml)
  - [apps/web/src/lib/s3.ts](apps/web/src/lib/s3.ts)

### Missing against desired architecture

- No clearly separated HDICR processing datastore model (jobs/model registry/output lineage) independent of TI business-domain data.
- No active queue-backed processing boundary in deployed code path (mostly roadmap/docs references).
- No Redis/ElastiCache distributed control plane visible in active runtime implementation.

### Misplaced responsibilities

- Licensing and commercial checks are still coupled into HDICR-side consent enforcement flow.
- Evidence:
  - [services/consent-service/src/handlers/check-consent-enforcement.ts](services/consent-service/src/handlers/check-consent-enforcement.ts)

## 5. AWS Configuration Review

### Positive

- API key usage plan and throttling configured in API Gateway.
- Evidence:
  - [infra/api-gateway/template.yaml](infra/api-gateway/template.yaml)
- Secret-scanning in CI is present.
- Evidence:
  - [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

### Risks

- IAM policies are broad and include wildcard resources for privileged actions.
- Evidence:
  - [infra/iam/rds-service-policy.json](infra/iam/rds-service-policy.json)
  - [infra/iam/s3-service-policy.json](infra/iam/s3-service-policy.json)
  - [infra/iam/secrets-manager-readonly-policy.json](infra/iam/secrets-manager-readonly-policy.json)
- Runtime helpers still support static AWS access keys, instead of role-first runtime identity.
- Evidence:
  - [shared/utils/src/secrets.ts](shared/utils/src/secrets.ts)
  - [apps/web/src/lib/s3.ts](apps/web/src/lib/s3.ts)

## 6. Environment Variables and Secrets

### A. Detected variable groups

TI auth/runtime:

- AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_ISSUER_BASE_URL, AUTH0_SECRET, AUTH0_BASE_URL, AUTH0_AUDIENCE, AUTH0_POST_LOGIN_REDIRECT, AUTH0_ROLES_CLAIM_NAMESPACE

TI app/public:

- NEXT_PUBLIC_APP_NAME, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_API_URL, APP_BASE_URL, API_GATEWAY_URL, NODE_ENV, CI

TI DB:

- TI_DATABASE_URL, DATABASE_URL, DATABASE_HOST, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD, DATABASE_PORT, DATABASE_SSL

HDICR client vars in TI:

- HDICR_ADAPTER_MODE, HDICR_REMOTE_BASE_URL, HDICR_CLIENT_ID, HDICR_CLIENT_SECRET
- HDICR_IDENTITY_ADAPTER_MODE, HDICR_CONSENT_ADAPTER_MODE, HDICR_LICENSING_ADAPTER_MODE, HDICR_REPRESENTATION_ADAPTER_MODE, HDICR_USAGE_ADAPTER_MODE, HDICR_CREDENTIALS_ADAPTER_MODE, HDICR_BILLING_ADAPTER_MODE, HDICR_PAYMENTS_ADAPTER_MODE

AWS/media:

- AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME, USE_MOCK_S3

Payments/KYC:

- STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, ONFIDO_API_TOKEN, YOTI_CLIENT_SDK_ID

Crypto/trust:

- ENCRYPTION_KEY, ISSUER_ED25519_PUBLIC_KEY, ISSUER_ED25519_PRIVATE_KEY, CONSENT_SIGNING_PRIVATE_KEY, CONSENT_SIGNING_PUBLIC_KEY, CONSENT_SIGNING_KEY_ID

Email/monitoring:

- RESEND_API_KEY, RESEND_NOREPLY_EMAIL, RESEND_SUPPORT_EMAIL, RESEND_ADMIN_EMAIL, RESEND_FROM_NAME, RESEND_SEGMENT_ID_NOREPLY, RESEND_SEGMENT_ID_SUPPORT, RESEND_SEGMENT_ID_NOTIFICATIONS, ADMIN_EMAILS, USE_MOCK_EMAILS, SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_ENABLED

HDICR service runtime:

- DATABASE_URL, DB_POOL_SIZE, AUTH0_DOMAIN, AUTH0_AUDIENCE, HDICR_DEFAULT_TENANT_ID

Shared middleware/tenant claims:

- AUTH0_TENANT_ID_CLAIM_NAMESPACE, AUTH0_ROLES_CLAIM_NAMESPACE, CONSENT_SERVICE_URL

CI/ops:

- VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, HDICR_AWS_ACCESS_KEY_ID, HDICR_AWS_SECRET_ACCESS_KEY, HDICR_AWS_REGION, SNYK_TOKEN, GITLEAKS_LICENSE, RUN_RLS_INTEGRATION, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET

Primary references:

- [apps/web/.env.example](apps/web/.env.example)
- [apps/web/src/lib/db.ts](apps/web/src/lib/db.ts)
- [apps/web/src/lib/hdicr/hdicr-http-client.ts](apps/web/src/lib/hdicr/hdicr-http-client.ts)
- [shared/middleware/src/index.ts](shared/middleware/src/index.ts)
- [shared/utils/src/secrets.ts](shared/utils/src/secrets.ts)

### B. Security classification

SAFE:

- Non-secret public URLs and flags: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_APP_NAME, SENTRY_ENABLED, USE_MOCK_S3, USE_MOCK_EMAILS, NODE_ENV

SENSITIVE:

- AUTH0_DOMAIN, AUTH0_AUDIENCE, HDICR_REMOTE_BASE_URL, AUTH0_CLIENT_ID, HDICR_CLIENT_ID, AWS_REGION, AWS_S3_BUCKET_NAME, NEXT_PUBLIC_SENTRY_DSN

CRITICAL:

- AUTH0_CLIENT_SECRET, AUTH0_SECRET, HDICR_CLIENT_SECRET, DATABASE_URL, TI_DATABASE_URL, DATABASE_PASSWORD, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, SENTRY_AUTH_TOKEN, ENCRYPTION_KEY, ISSUER_ED25519_PRIVATE_KEY, CONSENT_SIGNING_PRIVATE_KEY, VERCEL_TOKEN, HDICR_AWS_ACCESS_KEY_ID, HDICR_AWS_SECRET_ACCESS_KEY

### C. Rotation requirements

Rotate immediately:

- DB credentials (DATABASE_URL/TI_DATABASE_URL).
- Auth0 secrets (client secrets and session secret).
- HDICR client secret.
- AWS access keys.
- Stripe secret + webhook secret.
- Resend key.
- Sentry auth token.
- Encryption and private signing keys (with migration strategy).

### D. Missing variables (production-critical)

- Required for TI to call HDICR:
  - HDICR_ADAPTER_MODE=remote
  - HDICR_REMOTE_BASE_URL
  - HDICR_CLIENT_ID
  - HDICR_CLIENT_SECRET
  - AUTH0_DOMAIN
  - AUTH0_AUDIENCE
- Required for SEP-042 cutover:
  - TI_DATABASE_URL present
  - DATABASE_URL absent from TI runtime env
- Naming consistency must be verified:
  - AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET expected by runtime code.

## 7. Security and Access Control

### Strengths

- JWT validation and tenant extraction in shared middleware.
- Scope checks on identity, consent, licensing handlers.
- Evidence:
  - [shared/middleware/src/index.ts](shared/middleware/src/index.ts)
  - [services/identity-service/src/index.ts](services/identity-service/src/index.ts)
  - [services/consent-service/src/index.ts](services/consent-service/src/index.ts)
  - [services/licensing-service/src/handler.ts](services/licensing-service/src/handler.ts)

### High-risk findings

- Consent enforcement endpoint has incomplete API key validation.
- Middleware currently fails open on auth errors.
- Evidence:
  - [apps/web/src/app/api/v1/consent/check/route.ts](apps/web/src/app/api/v1/consent/check/route.ts)
  - [apps/web/src/middleware.ts](apps/web/src/middleware.ts)
- Representation service lacks scope authorization parity.
- Evidence:
  - [services/representation-service/src/index.ts](services/representation-service/src/index.ts)

## 8. Data Flow and Isolation

Current:

- User -> TI web -> HDICR APIs for HDICR domains + TI direct DB for TI-owned domains -> RDS/S3

Isolation status:

- Logical tenant isolation controls exist (RLS + tenant-scoped queries).
- Physical isolation is incomplete due shared RDS and mixed schema ownership.

Evidence:

- [scripts/check-hdicr-db-coimport.sh](scripts/check-hdicr-db-coimport.sh)
- [scripts/check-hdicr-owned-table-access.sh](scripts/check-hdicr-owned-table-access.sh)
- [scripts/verify-sep042-cutover-readiness.mjs](scripts/verify-sep042-cutover-readiness.mjs)

## 9. Deployment Structure

Good:

- TI and HDICR deployments are split in CI/CD with path filters and separate secrets.
- Evidence:
  - [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  - [.github/workflows/hdicr-deploy.yml](.github/workflows/hdicr-deploy.yml)

Needs hardening:

- Confirm strict environment scoping and secret ownership per deployment target.
- Ensure no live-like sensitive values are tracked in deploy config examples.
- Evidence:
  - [infra/api-gateway/samconfig.toml](infra/api-gateway/samconfig.toml)

## 10. Security Risks by Severity

Critical:

- Missing API key verification in consent-check enforcement endpoint.
- Auth middleware fail-open behavior.
- Credential/key exposure event requiring immediate rotation.

High:

- Missing representation scope authorization.
- Shared DB coupling between TI and HDICR.
- Overly broad IAM permissions.

Medium:

- Runtime static AWS credentials path still available.
- API Gateway default authorizer is NONE, reducing defense-in-depth.
- Incomplete mandatory context contract for execution-level requests.

Low:

- In-memory edge rate limiting is per-instance only.

## 11. Ordered Action Plan

1. Implement API key hash verification and trusted client resolution in [apps/web/src/app/api/v1/consent/check/route.ts](apps/web/src/app/api/v1/consent/check/route.ts).
2. Change auth exception handling in [apps/web/src/middleware.ts](apps/web/src/middleware.ts) to fail-closed for protected routes.
3. Rotate all exposed secrets and private keys immediately.
4. Add scope checks for representation endpoints in [services/representation-service/src/index.ts](services/representation-service/src/index.ts).
5. Enforce canonical TI-to-HDICR request context: tenantId, projectId, licenseId, usageIntent, policyVersion, traceId.
6. Tighten IAM policies to least privilege with explicit resources.
7. Move runtime AWS auth to role-first, remove reliance on static access key envs where possible.
8. Complete physical data-plane separation between TI and HDICR.
9. If strategic target remains HDICR processing-only, migrate licensing/commercial logic fully into TI.
10. Add automated architecture conformance checks in CI.

## 12. Final Verdict

The project is substantially improved and close to strong service separation, but not yet production-ready for a high-trust multi-tenant environment until the critical auth and secrets controls are completed.
