# DB Migration Backlog: HDICR and TI Separation

Date: 2026-04-11
Status: Planned backlog for implementation runs
Strategy: Fresh rebuild from empty databases (test data reset), then code routing hardening

## Locked Decisions

1. Fresh rebuild is approved (pre-launch, test data only).
2. HDICR is source of truth for identity and consent.
3. TI is source of truth for commercial and representation workflows.
4. Eventual consistency is acceptable with maximum 5-second lag for TI read models from HDICR.
5. Admins must be able to query soft-deleted records for audit.
6. tenant_id rollout is required now to future-proof multi-tenancy.
7. DB setup must be compatible with later repo split (HDICR repo and TI repo).

## Domain Ownership (Final Target)

### HDICR-owned tables

- user_profiles
- actors
- consent_log
- identity_links
- verifiable_credentials
- bitstring_status_lists
- credential_status_entries
- licensing_requests
- usage_tracking
- audit_log
- api_clients
- consent_ledger
- licenses
- license_usage_log
- manual_verification_sessions

### TI-owned tables

- actor_media
- support_tickets
- support_ticket_messages
- user_feedback
- agents
- representation_requests
- actor_agent_relationships
- agency_team_members
- representation_terminations
- agent_invitation_codes

### TI read-model replicas sourced from HDICR

- hdicr_ref.user_profiles
- hdicr_ref.actors
- hdicr_ref.licenses
- hdicr_ref.consent_ledger_active

## Execution Order: Exact Migration Filenames

## Track A: Build HDICR Database from Empty

Run in this order:

1. infra/database/migrations/001_initial_schema.sql
2. infra/database/migrations/002_user_profiles.sql
3. infra/database/migrations/003_link_actors_to_user_profiles.sql
4. infra/database/migrations/004_identity_links.sql
5. infra/database/migrations/006_verifiable_credentials.sql
6. infra/database/migrations/007_bitstring_status_lists.sql
7. infra/database/migrations/008_consent_ledger_licenses.sql
8. infra/database/migrations/016_tenant_isolation.sql
9. infra/database/migrations/017_rls_policies.sql
10. infra/database/migrations/018_neutral_schema_aliases.sql
11. infra/database/migrations/019_manual_verification_sessions.sql
12. infra/database/migrations/020_guardrails_foundation.sql
13. infra/database/migrations/021_guardrails_immutability_and_audit.sql
14. infra/database/migrations/022_guardrails_data_flow_contracts.sql
15. infra/database/migrations/025_hdicr_tenant_completion.sql
16. infra/database/migrations/026_hdicr_soft_delete_admin_views.sql
17. infra/database/migrations/027_hdicr_outbox_sync_events.sql
18. infra/database/migrations/028_hdicr_drop_ti_domain_tables.sql

## Track B: Build TI Database from Empty

Run in this order:

1. infra/database/migrations/002_user_profiles.sql
2. infra/database/migrations/005_actor_media.sql
3. infra/database/migrations/009_support_tickets.sql
4. infra/database/migrations/010_user_feedback.sql
5. infra/database/migrations/011_feedback_support_linkage.sql
6. infra/database/migrations/012_user_profile_status_flags.sql
7. infra/database/migrations/013_agents.sql
8. infra/database/migrations/014_representation.sql
9. infra/database/migrations/015_agency_team_members.sql
10. infra/database/migrations/023_representation_terminations.sql
11. infra/database/migrations/024_agent_invitation_codes.sql
12. infra/database/migrations/029_ti_tenant_completion.sql
13. infra/database/migrations/030_ti_hdicr_ref_schema.sql
14. infra/database/migrations/031_ti_remove_cross_db_fks_add_validators.sql
15. infra/database/migrations/032_ti_soft_delete_admin_views.sql
16. infra/database/migrations/033_ti_rls_policies.sql

## New Migration Files: Required Scope

### 025_hdicr_tenant_completion.sql

Purpose: complete tenant_id coverage for HDICR tables not fully handled by 016.

Must include:

- Add tenant_id varchar(100) not null default 'trulyimagined' to:
  - user_profiles
  - consent_ledger
  - api_clients
  - licenses
  - license_usage_log
  - bitstring_status_lists
  - credential_status_entries
- Create indexes:
  - idx_user_profiles_tenant_id
  - idx_consent_ledger_tenant_actor_version
  - idx_api_clients_tenant_status
  - idx_licenses_tenant_actor_status
  - idx_license_usage_log_tenant_actor_created_at
  - idx_bitstring_status_lists_tenant_purpose
  - idx_credential_status_entries_tenant_credential
- Add comments on tenant_id columns.

### 026_hdicr_soft_delete_admin_views.sql

Purpose: ensure admin audit visibility including soft-deleted rows.

Must include:

- Create schema hdicr_admin.
- Create views:
  - hdicr_admin.v_user_profiles_all
  - hdicr_admin.v_actors_all
  - hdicr_admin.v_identity_links_all
  - hdicr_admin.v_verifiable_credentials_all
  - hdicr_admin.v_consent_ledger_all
  - hdicr_admin.v_licenses_all
  - hdicr_admin.v_manual_verification_sessions_all
  - hdicr_admin.v_audit_log_all
- Grant select to admin role(s).

### 027_hdicr_outbox_sync_events.sql

Purpose: provide reliable change stream from HDICR to TI read models.

Must include:

- Create outbox table public.sync_events with fields:
  - id uuid pk
  - aggregate_type text
  - aggregate_id uuid
  - event_type text
  - tenant_id varchar(100)
  - payload jsonb
  - source_version bigint
  - dedupe_key text unique
  - occurred_at timestamptz
  - processed_at timestamptz null
  - retry_count int default 0
  - last_error text null
- Create trigger functions and triggers for:
  - user_profiles
  - actors
  - consent_ledger
  - licenses
  - identity_links

### 028_hdicr_drop_ti_domain_tables.sql

Purpose: remove TI-owned tables from HDICR DB to enforce true separation.

Must include conditional drops if present:

- actor_media
- support_tickets
- support_ticket_messages
- user_feedback
- agents
- representation_requests
- actor_agent_relationships
- agency_team_members
- representation_terminations
- agent_invitation_codes

### 029_ti_tenant_completion.sql

Purpose: complete tenant_id coverage and normalization in TI DB.

Must include:

- Add tenant_id varchar(100) not null default 'trulyimagined' to:
  - actor_media
  - support_tickets
  - support_ticket_messages
  - user_feedback
  - agents
  - representation_requests
  - actor_agent_relationships
  - agency_team_members
  - representation_terminations
- Normalize agent_invitation_codes.tenant_id:
  - convert text to varchar(100)
  - backfill null to 'trulyimagined'
  - set not null
- Add tenant indexes for each table, including common composite indexes.

### 030_ti_hdicr_ref_schema.sql

Purpose: TI-local read models synced from HDICR, replacing hard cross-db FKs.

Must include:

- Create schema hdicr_ref.
- Create tables:
  - hdicr_ref.user_profiles
  - hdicr_ref.actors
  - hdicr_ref.licenses
  - hdicr_ref.consent_ledger_active
- Required columns on each:
  - source_id uuid
  - tenant_id varchar(100)
  - source_version bigint
  - synced_at timestamptz
  - deleted_at timestamptz null
- Add indexes for tenant and lookup keys.

### 031_ti_remove_cross_db_fks_add_validators.sql

Purpose: remove hard FK coupling to HDICR and enforce local validation using hdicr_ref.

Must include:

- Drop FK constraints referencing HDICR-origin entities where present:
  - actor_media.actor_id
  - representation_requests.actor_id
  - actor_agent_relationships.actor_id
  - representation_terminations.actor_id
  - agent_invitation_codes.used_by_actor_id
- Add validation functions and before insert/update triggers checking existence in hdicr_ref.actors.
- Add equivalent checks for user_profile references against hdicr_ref.user_profiles where needed.

### 032_ti_soft_delete_admin_views.sql

Purpose: admin audit visibility including deleted rows in TI.

Must include:

- Create schema ti_admin.
- Create views:
  - ti_admin.v_actor_media_all
  - ti_admin.v_support_tickets_all
  - ti_admin.v_support_ticket_messages_all
  - ti_admin.v_user_feedback_all
  - ti_admin.v_agents_all
  - ti_admin.v_representation_requests_all
  - ti_admin.v_actor_agent_relationships_all
  - ti_admin.v_agency_team_members_all
  - ti_admin.v_representation_terminations_all
  - ti_admin.v_agent_invitation_codes_all

### 033_ti_rls_policies.sql

Purpose: tenant-aware isolation and write checks in TI DB.

Must include:

- Enable RLS on all TI-owned tables.
- Create tenant isolation policies using current_setting('app.current_tenant_id', true).
- Add migration/admin role bypass as required for operational scripts.

## Table-by-Table tenant_id Changes (Implementation Order)

## Step 1: HDICR tenant_id baseline from existing migration 016

Already covered in existing file:

- actors
- consent_log
- identity_links
- verifiable_credentials
- licensing_requests
- usage_tracking
- audit_log
- representation_requests (temporary legacy presence)
- actor_agent_relationships (temporary legacy presence)

Action:

- Keep for compatibility during rebuild.
- Remove TI-owned legacy tables from HDICR in migration 028.

## Step 2: HDICR tenant_id completion in migration 025

Add or verify tenant_id on:

- user_profiles (new owner in HDICR)
- consent_ledger
- api_clients
- licenses
- license_usage_log
- bitstring_status_lists
- credential_status_entries
- manual_verification_sessions (already present from 019; validate not null + index)

Expected type and rule:

- tenant_id varchar(100) not null default 'trulyimagined'

## Step 3: TI tenant_id completion in migration 029

Add tenant_id on:

- actor_media
- support_tickets
- support_ticket_messages
- user_feedback
- agents
- representation_requests
- actor_agent_relationships
- agency_team_members
- representation_terminations

Normalize existing tenant_id on:

- agent_invitation_codes (text -> varchar(100), not null, default)

Expected type and rule:

- tenant_id varchar(100) not null default 'trulyimagined'

## Step 4: tenant-aware indexing

For each table above add:

- single index on tenant_id
- composite index aligned to top query path

Required composite examples:

- consent_ledger(tenant_id, actor_id, version desc)
- licenses(tenant_id, actor_id, status)
- support_tickets(tenant_id, status, created_at desc)
- representation_requests(tenant_id, actor_id, status)
- actor_media(tenant_id, actor_id, media_type)
- agents(tenant_id, auth0_user_id)

## Step 5: tenant-aware policies

- HDICR: extend RLS policy coverage to newly tenantized HDICR tables.
- TI: introduce RLS for TI-owned tables in 033.

## Cross-Database Independence Checklist (Repo Split Readiness)

1. TI has no hard FK to HDICR-owned primary tables.
2. TI relies on hdicr_ref schema for reference checks.
3. HDICR changes are emitted to outbox sync_events.
4. Both migration tracks can run independently from empty database.
5. No runtime path assumes a single shared DATABASE_URL.
6. Environment contracts use only:

- HDICR_DATABASE_URL
- TI_DATABASE_URL

## Backlog Tasks in Concrete Order

1. Create migration files 025 through 033 with content above.
2. Update migration runners for per-domain ordered execution lists.
3. Apply Track A to empty HDICR DB.
4. Apply Track B to empty TI DB.
5. Run schema validation checks:

- all required tables exist in correct DB
- all required tenant_id columns exist and are not null
- all required tenant indexes exist

6. Run cross-db coupling checks:

- no prohibited FK remains
- hdicr_ref schema present in TI

7. Run sync checks:

- outbox emits expected events
- TI read-model sync lag <= 5s

8. Run admin audit checks:

- admin views include soft-deleted rows

9. Run app smoke tests:

- auth/profile
- consent flows
- licensing
- representation
- support tickets

## Acceptance Criteria

1. Full rebuild from empty DB works repeatably with no manual patching.
2. Domain ownership is enforced physically (table placement) and logically (no hard cross-db FK).
3. tenant_id is present and indexed across all domain tables listed.
4. Admin audit access includes deleted records via admin schemas.
5. HDICR to TI synchronization is operational with max 5-second lag.
6. Codebase can proceed to repo split with minimal DB boundary changes.

## Runbook Notes

1. Keep this file as canonical backlog across implementation runs.
2. Any migration filename or ordering change must be updated here in the same PR.
3. Do not introduce new cross-domain hard FKs after this point.
