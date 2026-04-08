# HDICR Tenant Onboarding Guide

This guide documents how to onboard a new tenant without schema changes.

## Preconditions

- `tenant_id` exists on HDICR tables (migration 016).
- RLS policies are present and service handlers set `app.current_tenant_id` (migration 017 + service code).
- Neutral aliases are available (`v_identity_subjects`, `identitySubjectId`, `displayName`) from migration 018 and identity API.

## Onboarding Steps

1. Issue tenant-specific Auth0 claims for the caller token.
2. Configure the tenant's HDICR M2M client and scopes.
3. Set `AUTH0_TENANT_ID_CLAIM_NAMESPACE` if using a custom claim namespace.
4. Use existing HDICR APIs to create and manage tenant data.
5. Verify tenant isolation by running identity-service `test:rls` with `RUN_RLS_INTEGRATION=1`.

## Verification Checklist

- Tenant-scoped records can be created with existing endpoints.
- Cross-tenant reads return empty result sets under RLS, not errors.
- API payloads expose neutral aliases (`identitySubjectId`, `displayName`).
- TI-specific fields are documented as `x-tenant-specific: trulyimagined`.

## Notes

- No schema migration required for onboarding a new tenant under the current model.
- Tenant-specific UX naming remains a presentation concern; core API and schema can remain additive and neutral.
