# Truly Imagined MVP: Sprint Breakdown with User Stories & Acceptance Criteria

---

## SPRINT 1: Core Identity & Consent Registration (Weeks 1–2)

### Theme
Get actors verified and registering baseline consent preferences. Foundation for everything else.

### Implementation Progress Update (2026-04-10)
- [x] Story 1.3 partial delivery completed:
  - Admin verification APIs delivered for pending queue, schedule, and complete.
  - Admin verification dashboard delivered and linked in dashboard sidebar.
  - Manual verification persistence migration delivered (`manual_verification_sessions`).
- [x] Story 1.8 partial delivery completed:
  - Actor onboarding checklist API and dashboard checklist component delivered.
- [x] Guardrails pre-Sprint-3 tranche delivered:
  - Adapted migrations 020/021/022 committed (foundation, immutability, audit/data-flow contracts).
  - App-layer split DB pool support and explicit HDICR query routing delivered for new Sprint 1 paths.

### Story 1.1: Stripe Identity Integration - Session Creation
**Assignee:** Backend (identity-service)

**User Story:**
As an actor signing up, I want to start a KYC verification with Stripe Identity so my identity is verified before I can create deals.

**Acceptance Criteria:**
- [ ] POST `/api/verification/start` accepts `provider: 'stripe'` parameter
- [ ] Stripe VerificationSession created with `requirements: ['id_number', 'face']`
- [ ] Session ID stored in `identity_links` table with status `pending`
- [ ] Frontend receives verification session URL to embed/redirect to
- [ ] User can start verification from actor dashboard
- [ ] Error handling: if Stripe API fails, return 500 with error message
- [ ] All requests must be authenticated (Auth0 session required)
- [ ] Telemetry: log session creation (user_id, session_id, timestamp)

**Story Points:** 3

**Dependencies:** Auth0 integration (existing)

**Notes:**
- Use Stripe test API key in staging
- Verify with real Stripe account in production
- Session expires in 24 hours (Stripe default)

---

### Story 1.2: Stripe Identity Integration - Webhook Handling
**Assignee:** Backend (identity-service)

**User Story:**
As the system, I want to receive Stripe webhooks when an actor completes identity verification so I can update their verification status automatically.

**Acceptance Criteria:**
- [ ] POST `/api/webhooks/stripe` endpoint created and deployed
- [ ] Webhook signature verified using `Stripe.Signature.verifyHeader()`
- [ ] `identity.verification_session.verified` event handler created
  - [ ] Fetches verification session details from Stripe
  - [ ] Extracts verified data (id_type, verified_at)
  - [ ] Updates `identity_links` table: status = 'verified', assurance_level = 'high'
  - [ ] Creates audit log entry
  - [ ] Sends "Verification successful" email to actor
- [ ] `identity.verification_session.requires_input` event handler created
  - [ ] Updates status = 'requires_input'
  - [ ] Sends "Please retry" email with new session link
- [ ] Webhook deduplication: skip if event already processed (check `webhook_events` table)
- [ ] Error logging: log failures to Sentry + PagerDuty alert if retries exhausted
- [ ] All sensitive data (ID numbers) logged as `[REDACTED]` in audit trail

**Story Points:** 5

**Dependencies:** Story 1.1

**Testing:**
- Use Stripe webhook tester in dashboard
- Test with `stripe trigger identity.verification_session.verified`

---

### Story 1.3: Manual Verification Flow - Admin Booking & Verification
**Assignee:** Backend (identity-service) + Frontend (admin dashboard)

**User Story:**
As the founder, I want to manually verify actors via video call for MVP hype/exclusivity, so I can approve verification without waiting for full Stripe checks.

**Acceptance Criteria:**

**Backend:**
- [ ] POST `/api/verification/manual-request` creates a manual verification request
  - [ ] Input: actor_id, preferred_timezone, phone_number
  - [ ] Creates record in `verification_requests` table (status: pending_scheduling)
  - [ ] Sends email to founder with actor details + link to admin dashboard
- [x] POST `/api/admin/verification/schedule` (admin-only endpoint)
  - [x] Input support: actor_id, scheduled_at (datetime), meeting link
  - [x] Upserts open manual verification session to status = 'scheduled'
  - [ ] Sends calendar invite to actor (email + iCal)
  - [x] Stores meeting link in encrypted field
- [x] POST `/api/admin/verification/complete` (admin-only)
  - [x] Input support: verification_request_id or actor_id, verified: boolean, notes: string
  - [x] If verified = true:
    - [x] Upserts identity_links with manual-video verification and medium assurance
    - [x] Updates manual verification session to completed + actor verification status
    - [x] Sends "You're verified!" email to actor
  - [x] If verified = false:
    - [x] Updates actor verification status to rejected and session status to failed
    - [ ] Sends "Verification failed, please retry" email + new Stripe session link
  - [x] Creates audit log: who verified, when, notes (non-sensitive)

**Frontend (Admin Dashboard):**
- [x] Pending verifications list: show actor name, email, phone, timezone, status
- [x] "Schedule" action to set datetime + meeting link
- [x] Completion action for verification outcome
  - [x] Verified/not-verified selection
  - [x] Notes input
  - [x] Submit action
  - [x] Success confirmation

**Story Points:** 8

**Dependencies:** Story 1.1, Auth0, Email service

**Manual Testing:**
- Create test actor → request manual verification → schedule meeting → mark verified
- Verify email invites received & contain correct timezone

---

### Story 1.4: Actor Registration Endpoint
**Assignee:** Backend (identity-service)

**User Story:**
As an actor, I want to create my profile with legal & professional name so I can register on the platform.

**Acceptance Criteria:**
- [ ] POST `/api/identity/register` accepts:
  - `legalName` (string, required)
  - `professionalName` (string, required)
  - `metadata` (object, optional)
- [ ] Validation:
  - [ ] Both names must be 2–100 characters
  - [ ] No names that are all numbers
  - [ ] Reject if actor already registered (unique constraint on user_id)
- [ ] Creates `actors` record:
  - `user_id` (from Auth0)
  - `legal_name`
  - `professional_name`
  - `registry_id` (auto-generated UUID)
  - `verification_status` (starts as 'unverified')
  - `created_at`
- [ ] Returns registry_id + onboarding checklist
- [ ] Email confirmation: "Welcome to Truly Imagined, complete your profile"
- [ ] Audit log: actor created, registration_id

**Story Points:** 3

**Dependencies:** Auth0, identity-service, actors table

**Testing:**
- Register two actors with same name → both succeed (names don't need to be unique)
- Register with special characters (é, ñ) → succeeds
- Register with 1-char name → fails validation

---

### Story 1.5: Consent Registration Endpoint - Work Types & Content Restrictions
**Assignee:** Backend (consent-service)

**User Story:**
As an actor, I want to specify what types of work I consent to (Film, TV, Commercial, VoiceOver, Gaming) and what content restrictions I have (Political, Religious, Explicit, Drugs, Alcohol, Gambling) so Studios know what they can license.

**Acceptance Criteria:**
- [ ] POST `/api/consent/grant` accepts:
  ```json
  {
    "work_types": ["Film", "TV", "Commercial"],
    "content_restrictions": ["Political", "Drugs"],
    "territories": { "allowed": ["GB", "US"], "denied": ["CN", "RU"] },
    "data_for_training": false
  }
  ```
- [ ] Validation:
  - [ ] work_types must be subset of ["Film", "TV", "Commercial", "VoiceOver", "Gaming"]
  - [ ] content_restrictions must be subset of ["Political", "Religious", "Explicit", "Drugs", "Alcohol", "Gambling"]
  - [ ] territories.allowed/denied must be valid ISO 3166-1 alpha-2 country codes
  - [ ] Cannot have same country in both allowed AND denied
- [ ] Creates initial `consent_ledger` entry:
  - `actor_id`
  - `version` = 1
  - `policy` = JSON of above
  - `status` = 'active'
  - `created_at`
- [ ] Returns consent summary
- [ ] Audit log: consent granted, version 1

**Story Points:** 5

**Dependencies:** consent-service, consent_ledger table, actors table

**Testing:**
- Register consent with all fields → succeeds
- Omit territories → defaults to {"allowed": ["*"]} (world-wide)
- data_for_training = true → succeeds (separate from consent restrictions)
- work_types = ["InvalidType"] → fails validation

---

### Story 1.6: Consent Read Endpoint - Actor Dashboard View
**Assignee:** Backend (consent-service)

**User Story:**
As an actor, I want to view my current consent preferences on my dashboard so I can confirm what I've registered.

**Acceptance Criteria:**
- [ ] GET `/api/consent/me` (authenticated, actor-only)
- [ ] Returns latest consent_ledger entry for actor:
  ```json
  {
    "registry_id": "actor-uuid",
    "version": 1,
    "work_types": ["Film", "TV"],
    "content_restrictions": ["Political"],
    "territories": { "allowed": ["GB", "US"], "denied": [] },
    "data_for_training": false,
    "updated_at": "2024-02-15T10:30:00Z",
    "status": "active"
  }
  ```
- [ ] Returns 401 if not authenticated
- [ ] Returns 404 if no consent registered yet
- [ ] Telemetry: log view (for auditing who accessed what)

**Story Points:** 2

**Dependencies:** Story 1.5

**Testing:**
- Register consent → fetch via GET /api/consent/me → data matches
- Fetch as different actor → returns 401/forbidden

---

### Story 1.7: Consent Ledger & Audit Trail
**Assignee:** Backend (consent-service)

**User Story:**
As the system, I want to maintain a complete audit trail of all consent changes so compliance & disputes can reference historical versions.

**Acceptance Criteria:**
- [ ] Every consent change (grant, revoke) creates new `consent_ledger` entry:
  - `actor_id`
  - `version` (auto-increment per actor)
  - `policy` (JSON snapshot of entire consent)
  - `status` (active/revoked)
  - `created_at`
  - `created_by` (user_id of actor or agent who initiated)
  - `reason` (e.g., "actor requested", "arbitration update")
- [ ] Ledger entries are immutable (never UPDATE, only INSERT)
- [ ] GET `/api/consent/ledger` (admin-only) returns all versions for actor
  - Paginated (default 20 per page)
  - Sortable by version or created_at
- [ ] No PII in reason field; use abstract descriptions only
- [ ] Timestamps in UTC

**Story Points:** 3

**Dependencies:** consent_ledger table

**Testing:**
- Create consent v1 → update consent → verify v2 created, v1 unchanged
- Fetch ledger → see all versions in order
- Verify timestamps are UTC

---

### Story 1.8: Frontend - Actor Onboarding Flow UI
**Assignee:** Frontend (Next.js)

**User Story:**
As an actor, I want a smooth onboarding flow that guides me from sign-up → identity verification → consent registration, so I know what's required at each step.

**Acceptance Criteria:**
- [x] Dashboard onboarding checklist shows step-by-step progress:
  1. Sign in (Auth0 login)
  2. Register profile (legal/professional name)
  3. Verify identity (Stripe or manual video call option)
  4. Register consent (work types + restrictions)
  5. "Complete" page
- [x] Each checklist step shows status: pending/completed
- [ ] Step 2: Form with legal_name + professional_name, submit → creates actor
- [ ] Step 3: Two buttons:
  - "Verify with Stripe" → opens Stripe verification flow
  - "Request video call" → shows form (timezone, phone), submits to backend, shows "Founder will schedule" message
- [ ] Step 4: Multi-select checkboxes for work_types, content_restrictions
  - [ ] Toggle for territories (toggle between "World-wide" and "Custom")
  - [ ] Custom territories: search bar + country select (autocomplete)
  - [ ] Checkbox: "Allow AI training data usage"
  - [ ] Submit → POST /api/consent/grant
- [ ] Step 5: Success message + "Go to dashboard" link
- [ ] Auto-save drafts: use localStorage to save work-in-progress consent
- [x] Error handling: checklist API failures surface retryable error state
- [x] Mobile responsive (dashboard checklist layout)

**Story Points:** 13

**Dependencies:** Stories 1.1–1.7, Auth0, Stripe verification embed

**Testing:**
- Complete full onboarding flow end-to-end
- Refresh page midway → resume from same step
- Fill consent form → leave page → return → data still there (localStorage)

---

## SPRINT 1 Summary

**Deliverables:**
- Identity verification (Stripe + manual)
- Actor registration
- Consent registration & audit trail
- Actor dashboard UI

**Deployment:**
- Stripe Identity test mode enabled
- Manual verification flow live (founder can start booking)
- Actors can register, verify, and submit consent

**Metric to Track:**
- Time from sign-up to consent-registered (target: < 30 min)
- Verification success rate (target: > 90%)

---

## SPRINT 2: Agent Onboarding & Representation (Weeks 3–4)

### Theme
Agents can verify their profile and connect with actors. Form representation relationships.

### Story 2.1: Agency Profile Creation
**Assignee:** Backend

**User Story:**
As an agent/agency, I want to create an agency profile so I can manage my roster and connect with actors.

**Acceptance Criteria:**
- [ ] POST `/api/agency/create` (authenticated, agent role)
- [ ] Input:
  ```json
  {
    "agency_name": "Creative Reps Ltd",
    "agency_contact_email": "hello@creative-reps.co.uk",
    "agency_phone": "+44 20 7123 4567",
    "address": "123 Soho St, London",
    "website": "https://creative-reps.co.uk"
  }
  ```
- [ ] Validation:
  - [ ] agency_name: 2–100 chars
  - [ ] email: valid format
  - [ ] phone: valid UK format or international
- [ ] Creates `agents` record:
  - `user_id` (from Auth0)
  - `agency_name`
  - `contact_email`
  - `phone`
  - `address`
  - `website`
  - `verified_at` (null until verified)
  - `created_at`
- [ ] Returns agency_id + onboarding message
- [ ] Email confirmation: "Verify your agency email"
- [ ] Audit log

**Story Points:** 3

**Dependencies:** agents table, Auth0

---

### Story 2.2: Verification Code Generation
**Assignee:** Backend

**User Story:**
As an agent, I want to generate unique invitation codes for actors so they can join my agency and represent me.

**Acceptance Criteria:**
- [ ] POST `/api/agent/codes/generate` (authenticated, agent)
- [ ] Input: `batch_size` (optional, default 5, max 100)
- [ ] Generates N random 8-char alphanumeric codes: `A7K9M2BX`
- [ ] Creates records in `agent_invitation_codes` table:
  - `code` (unique)
  - `agent_id`
  - `created_at`
  - `expires_at` (30 days from now)
  - `used_by_actor_id` (null until redeemed)
  - `redeemed_at` (null)
- [ ] Returns list of codes
- [ ] Telemetry: log code generation (for auditing abuse)
- [ ] GET `/api/agent/codes/list` returns all codes with status (pending, redeemed, expired)

**Story Points:** 4

**Dependencies:** agent_invitation_codes table

**Testing:**
- Generate 5 codes → all unique
- Generate 1000 codes → rate limit or batch successfully
- Code expires after 30 days → status shows "expired"

---

### Story 2.3: Actor Redeems Invitation Code
**Assignee:** Backend

**User Story:**
As an actor, I want to enter an agent's invitation code to request representation from them.

**Acceptance Criteria:**
- [ ] POST `/api/representation/request` (authenticated, actor)
- [ ] Input: `code` (string)
- [ ] Validation:
  - [ ] Code exists & not expired
  - [ ] Code not already redeemed
  - [ ] Actor not already represented by same agent
- [ ] Creates `representation_requests` record:
  - `actor_id`
  - `agent_id`
  - `status` = 'pending'
  - `created_at`
  - `requested_by` = 'actor'
- [ ] Updates `agent_invitation_codes`: used_by_actor_id, redeemed_at
- [ ] Sends email to agent: "New actor wants representation: [actor name]"
- [ ] Returns confirmation message to actor
- [ ] Audit log

**Story Points:** 4

**Dependencies:** Story 2.2, representation_requests table

**Testing:**
- Redeem valid code → request created, status = pending
- Redeem expired code → fails with "Code expired"
- Redeem same code twice → second fails with "Already redeemed"

---

### Story 2.4: Agent Approves/Rejects Representation Request
**Assignee:** Backend

**User Story:**
As an agent, I want to approve or reject representation requests from actors so I can manage my roster.

**Acceptance Criteria:**
- [ ] PATCH `/api/representation/requests/:request_id` (authenticated, agent)
- [ ] Input:
  ```json
  {
    "action": "approve" | "reject",
    "reason": "string (optional, required if rejecting)"
  }
  ```
- [ ] Authorization: only the agent on the request can approve/reject
- [ ] If approve:
  - [ ] representation_requests: status = 'accepted', accepted_at = NOW()
  - [ ] Create `actor_agent_relationships` record:
    - `actor_id`
    - `agent_id`
    - `status` = 'active'
    - `started_at` = NOW()
  - [ ] Email actor: "Your representation request was approved"
  - [ ] Email agent: "Representation confirmed with [actor name]"
- [ ] If reject:
  - [ ] representation_requests: status = 'rejected', reason
  - [ ] Email actor: "Your representation request was rejected. Reason: [reason]"
- [ ] Audit log (don't expose rejection reason to logs, keep private)

**Story Points:** 4

**Dependencies:** representation_requests, actor_agent_relationships tables

**Testing:**
- Agent approves → actor_agent_relationships created
- Agent rejects → actor_agent_relationships not created
- Non-agent tries to approve → 403 forbidden

---

### Story 2.5: Agent Roster Dashboard
**Assignee:** Backend + Frontend

**User Story:**
As an agent, I want to see a dashboard showing all my represented actors, their consent preferences, and deal status so I can manage relationships.

**Acceptance Criteria:**

**Backend:**
- [ ] GET `/api/agent/roster` (authenticated, agent)
- [ ] Returns:
  ```json
  {
    "actors": [
      {
        "actor_id": "uuid",
        "registry_id": "actor-registry",
        "name": "Jane Doe",
        "professional_name": "Jane",
        "verification_status": "verified",
        "consent": {
          "work_types": ["Film", "TV"],
          "content_restrictions": ["Political"],
          "updated_at": "2024-02-15"
        },
        "active_licenses": 3,
        "pending_deals": 1,
        "joined_at": "2024-02-01"
      }
    ],
    "total": 15
  }
  ```
- [ ] Pagination: 10 per page
- [ ] Search: filter by actor name or registry_id
- [ ] Only return actors in active representation_requests

**Frontend:**
- [ ] Display as table or cards
- [ ] Columns: Actor Name, Consent Summary (work types), Verification Status, Active Deals, Actions
- [ ] Actions: "View details", "Send deal offer", "Manage relationship"
- [ ] Consent summary shows work types as tags (Film, TV, etc.)
- [ ] Click actor → detail page (see full consent, deal history, communication log)
- [ ] Mobile responsive

**Story Points:** 8

**Dependencies:** Stories 2.1–2.4

**Testing:**
- Agent with 20 actors → pagination shows 10 per page
- Search by name → filters correctly
- Search by registry_id → filters correctly

---

### Story 2.6: Actor Representation Status View
**Assignee:** Backend + Frontend

**User Story:**
As an actor, I want to see who represents me and manage those relationships so I can confirm or end representation.

**Acceptance Criteria:**

**Backend:**
- [ ] GET `/api/actor/representation` (authenticated, actor)
- [ ] Returns:
  ```json
  {
    "pending_requests": [
      {
        "agent_id": "uuid",
        "agency_name": "Creative Reps",
        "created_at": "2024-02-10",
        "status": "pending"
      }
    ],
    "active_agents": [
      {
        "agent_id": "uuid",
        "agency_name": "Creative Reps",
        "contact_email": "hello@creative-reps.co.uk",
        "started_at": "2024-02-12",
        "deals_negotiated": 3
      }
    ]
  }
  ```

**Frontend:**
- [ ] Show two sections: Pending Requests & Active Agents
- [ ] Pending: "Approve" / "Decline" buttons
- [ ] Active: Agent card with name, contact, deals count, "Remove representation" button
- [ ] Remove representation → confirms before deleting

**Story Points:** 5

**Dependencies:** Stories 2.1–2.4

---

### Story 2.7: 30-Day Representation Termination Flow
**Assignee:** Backend

**User Story:**
As an actor or agent, I want to terminate representation with 30 days' notice so I can end the relationship professionally.

**Acceptance Criteria:**
- [ ] POST `/api/representation/terminate` (authenticated, actor OR agent)
- [ ] Input:
  ```json
  {
    "relationship_id": "uuid",
    "reason": "string (optional)"
  }
  ```
- [ ] Creates `representation_terminations` record:
  - `actor_agent_relationship_id`
  - `initiated_by` (actor or agent)
  - `reason` (optional)
  - `notice_date` = NOW()
  - `effective_date` = NOW() + 30 days
  - `status` = 'pending_termination'
- [ ] Updates actor_agent_relationships: status = 'terminating'
- [ ] Email both parties: "30-day termination notice in effect. Effective date: [date]"
- [ ] GET `/api/representation/terminating` shows actors/agents in termination period
- [ ] On effective date (cron job or scheduled task):
  - [ ] Update actor_agent_relationships: status = 'inactive'
  - [ ] Email both: "Representation ended as of [date]"
- [ ] All existing licenses (deals signed before termination) continue to be honored (agent still gets cut)

**Story Points:** 8

**Dependencies:** Stories 2.1–2.4, representation_terminations table

**Testing:**
- Initiate termination → status = 'terminating'
- Check effective date = today + 30 days
- Simulate date jump to effective date → status = 'inactive'
- Verify actor can still see old deals + agent's cut

---

### Story 2.8: Role-Based Permissions (Team Members)
**Assignee:** Backend

**User Story:**
As an agency owner (agent), I want to invite team members (other agents/assistants) to manage my roster with specific permissions so I can delegate without giving full access.

**Acceptance Criteria:**
- [ ] POST `/api/agency/team/invite` (authenticated, agent/owner)
- [ ] Input:
  ```json
  {
    "email": "teammate@creative-reps.co.uk",
    "permissions": {
      "canManageRoster": true,
      "canViewConsent": true,
      "canManageRequests": false
    }
  }
  ```
- [ ] Creates `agency_team_members` record:
  - `agent_id` (the owner's agent_id)
  - `email`
  - `invited_at`
  - `accepted_at` (null initially)
  - `permissions` (JSON)
- [ ] Sends email invite: "You've been invited to manage roster at Creative Reps"
- [ ] Invite link: teammate signs in, accepts/declines
- [ ] If accepted: creates auth0 mapping (teammate's user_id linked to agency)
- [ ] GET `/api/agency/team` (agent-only) shows all team members + permissions
- [ ] PATCH `/api/agency/team/:member_id` updates permissions
- [ ] DELETE `/api/agency/team/:member_id` removes team member

**Authorization Checks:**
- [ ] GET /api/agent/roster checks: `user is agent OR (user is team member AND canManageRoster = true)`
- [ ] GET /api/consent checks: `user is agent OR (user is team member AND canViewConsent = true)`
- [ ] PATCH /api/representation/requests checks: `user is agent OR (user is team member AND canManageRequests = true)`

**Story Points:** 8

**Dependencies:** Stories 2.1–2.4, agency_team_members table

**Testing:**
- Invite teammate with canManageRoster=true → can access roster
- Invite teammate with canManageRoster=false → cannot access roster (403)
- Remove teammate → loses access

---

### Story 2.9: Frontend - Agent Dashboard
**Assignee:** Frontend (Next.js)

**User Story:**
As an agent, I want a unified dashboard showing my roster, pending requests, and team so I can manage my business.

**Acceptance Criteria:**
- [ ] Dashboard layout:
  1. **Quick stats:** Active actors, pending deals, monthly earnings
  2. **Pending requests:** List of actors requesting representation, approve/decline buttons
  3. **Roster:** Table of actors (name, consent, verification status), search & pagination
  4. **Team members:** List of invited/accepted team members with permission badges
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states for all data fetches
- [ ] Error handling: if fetch fails, show retry button
- [ ] Notifications (badge icon) showing pending requests count

**Story Points:** 10

**Dependencies:** Stories 2.1–2.8

---

## SPRINT 2 Summary

**Deliverables:**
- Agency profile creation
- Invitation code system
- Representation request workflow (approve/reject)
- Agent roster dashboard
- Actor representation management
- 30-day termination notice
- Team member delegation

**Metric to Track:**
- Time from agent sign-up to first actor representation (target: < 1 day)
- Representation acceptance rate (target: > 80%)

---

## SPRINT 3: Deal Templates & Negotiation UI (Weeks 5–6)

### Theme
Build the marketplace: deal proposals, negotiation, and signing using Equity-based templates.

### Story 3.1: Equity Deal Template Data Model
**Assignee:** Backend

**User Story:**
As the system, I want to embed Equity suggested terms as predefined deal templates so Studios and agents can quickly create compliant agreements.

**Acceptance Criteria:**
- [ ] Create `deal_templates` table:
  ```sql
  CREATE TABLE deal_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,  -- "Standard Film License"
    description TEXT,
    equity_section TEXT,  -- e.g., "Section 2: Licensing terms"
    base_remuneration_rules JSONB,
    moral_rights_rules JSONB,
    usage_restrictions JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    is_default BOOLEAN DEFAULT FALSE
  );
  ```
- [ ] Seed templates from Equity document:
  - **Template 1:** "Performance Recording & Usage" (remuneration for recording + usage rights)
  - **Template 2:** "Synthetic Media License" (performance cloning specific)
  - **Template 3:** "Voice/Likeness Only" (face/voice usage without performance)
- [ ] Each template includes:
  - [ ] Work type (Film, TV, Commercial, etc.)
  - [ ] Remuneration structure (base fee + usage-based)
  - [ ] Territory options (GB, US, World-wide)
  - [ ] Duration (days, weeks, years)
  - [ ] Payment terms (Net 30, Net 60, etc.)
  - [ ] Moral rights clauses (attribution, integrity, withdrawal, first publication)
  - [ ] Dispute resolution (Equity-aligned mediation)
- [ ] GET `/api/deal-templates` returns all templates
- [ ] GET `/api/deal-templates/:id` returns full template with field definitions

**Story Points:** 5

**Dependencies:** database schema

**Testing:**
- Fetch all templates → returns 3+
- Fetch single template → includes all required fields

---

### Story 3.2: Deal Creation Endpoint (Studio proposes)
**Assignee:** Backend

**User Story:**
As a studio, I want to propose a deal to an actor (via their agent) using a template so I can offer them a job.

**Acceptance Criteria:**
- [ ] POST `/api/deals/create` (authenticated, studio role)
- [ ] Input:
  ```json
  {
    "template_id": "uuid",
    "actor_id": "uuid",
    "project_name": "Summer Commercial 2024",
    "work_type": "Commercial",
    "usage_types": ["online_paid", "social_media"],
    "territory": "GB",
    "duration_days": 365,
    "first_usage_date": "2024-03-01",
    "remuneration": {
      "recording_fee": 5000,
      "usage_fee_percentage": 10,
      "expected_revenue": 50000,
      "ti_revenue_share": 12,
      "agent_percentage": 15,
      "payment_due_date": "2024-03-15",
      "payment_terms": "net 30"
    },
    "custom_terms": "object (optional, additional clauses)"
  }
  ```
- [ ] Validation:
  - [ ] template_id exists
  - [ ] actor_id exists & verified
  - [ ] actor has active agent representation (or null agent_id)
  - [ ] remuneration.recording_fee > 0
  - [ ] first_usage_date >= today
  - [ ] duration_days <= template's max_duration
- [ ] Creates `deals` record:
  - `studio_user_id`
  - `actor_id`
  - `agent_id` (from active_agent_relationships for actor)
  - `deal_template_id`
  - `status` = 'draft'
  - `project_name`
  - `work_type`
  - `usage_types` (JSON array)
  - `territory`
  - `duration_days`
  - `first_usage_date`
  - `commercial_terms` (JSON of remuneration + terms)
  - `created_at`
- [ ] Returns deal_id + share link
- [ ] Email to agent: "New deal proposal: [project_name]"
  - Include link: https://trulyimagined.com/deals/[deal_id]
- [ ] Audit log

**Story Points:** 8

**Dependencies:** Story 3.1, deals table, studio verification

**Testing:**
- Create deal with all fields → succeeds, status = draft
- Create deal with invalid actor_id → fails 404
- Create deal with remuneration = 0 → fails validation

---

### Story 3.3: Deal Review & Editing (Agent/Actor review)
**Assignee:** Backend + Frontend

**User Story:**
As an agent or actor, I want to review a deal proposal and suggest edits before signing so we can negotiate fair terms.

**Acceptance Criteria:**

**Backend:**
- [ ] GET `/api/deals/:deal_id` (authenticated, actor/agent/studio involved)
- [ ] Returns full deal including:
  - All commercial terms
  - Template clauses
  - Status history (who viewed, when)
- [ ] Returns 403 if user not involved in deal
- [ ] PATCH `/api/deals/:deal_id` (authenticated, agent or actor)
- [ ] Input: `suggested_changes` (object with fields to update)
  ```json
  {
    "suggested_changes": {
      "remuneration": {
        "recording_fee": 7000,
        "agent_percentage": 20
      },
      "custom_terms": "No political content"
    }
  }
  ```
- [ ] Creates `deal_edits` record:
  - `deal_id`
  - `edit_by` (actor or agent)
  - `suggested_changes` (JSON)
  - `created_at`
  - `status` = 'pending_review'
- [ ] Updates deals: status = 'pending_changes'
- [ ] Email to studio: "Deal counter-proposal received"
  - Include changes summary

**Frontend:**
- [ ] Deal detail page shows current terms in read-only cards
- [ ] "Edit terms" button opens form with pre-filled values
- [ ] Fields editable: recording_fee, agent_percentage, territory, duration, custom_terms
- [ ] Submit → sends suggested_changes via PATCH
- [ ] Confirmation message: "Your counter-proposal sent to studio"

**Story Points:** 10

**Dependencies:** Stories 3.1–3.2, deal_edits table

**Testing:**
- Agent reviews deal → can edit any term
- Studio reviews agent's edit → sees changes summary
- Non-involved user tries to view deal → 403 forbidden

---

### Story 3.4: Deal Approval & Signing
**Assignee:** Backend + Frontend

**User Story:**
As all parties, I want to approve final deal terms and sign so the deal becomes binding.

**Acceptance Criteria:**

**Backend:**
- [ ] PATCH `/api/deals/:deal_id` with `action: 'approve'` (authenticated, actor/agent/studio)
- [ ] Creates `deal_approvals` record:
  - `deal_id`
  - `approved_by` (actor or agent or studio)
  - `approved_at`
- [ ] Logic:
  - Actor approval required
  - Agent approval required (if agent represents actor)
  - Studio approval required (implicit on creation, but can revoke)
- [ ] Once ALL three approved:
  - [ ] deals: status = 'signed', signed_at = NOW()
  - [ ] Create `licenses` record (see Payment Sprint 4 for details)
  - [ ] Email all: "Deal signed! License is active."
- [ ] If actor/agent decline:
  - [ ] deals: status = 'declined'
  - [ ] Email studio: "Deal declined"
- [ ] Audit log: who approved, when

**Frontend:**
- [ ] Deal page shows approval status (actor ✓, agent ✓, studio ✓)
- [ ] If logged-in user is actor/agent:
  - [ ] "Approve" button (makes user approve)
  - [ ] "Decline" button (marks as declined)
  - [ ] Shows confirmation: "Are you sure? This is binding."
- [ ] Once approved, show "Awaiting other parties" message
- [ ] Once all approve, show "Deal signed!" + link to license details

**Story Points:** 10

**Dependencies:** Stories 3.1–3.3, deal_approvals table

**Testing:**
- Actor approves, agent approves, studio approves → deal.status = signed
- Actor approves, agent declines → deal.status = declined, studio notified
- Try to approve twice → idempotent (second approval is no-op)

---

### Story 3.5: Studio Profile Creation & Staging
**Assignee:** Backend + Frontend

**User Story:**
As a studio, I want to create a profile so I can propose deals to actors.

**Acceptance Criteria:**

**Backend:**
- [ ] POST `/api/studio/profile/create` (authenticated, studio role)
- [ ] Input:
  ```json
  {
    "company_name": "Universal Pictures",
    "contact_email": "deals@universal.com",
    "phone": "+44 20 1234 5678",
    "address": "123 Film St, London",
    "website": "https://universal.com"
  }
  ```
- [ ] Creates `studios` record:
  - `user_id`
  - `company_name`
  - `contact_email`
  - `phone`
  - `address`
  - `website`
  - `verification_status` = 'staging' (NOT 'verified')
  - `created_at`
- [ ] Adds note to user_profiles: role = 'Studio', status = 'staging'
- [ ] Returns studio_id
- [ ] Email: "Your studio profile created. Staging mode: deals are practice-only until verified."
- [ ] GET `/api/studio/profile` returns studio profile

**Frontend:**
- [ ] Sign-up flow for studios (similar to actor/agent)
- [ ] Form: company_name, contact_email, phone, address, website
- [ ] Submit → creates profile
- [ ] Confirmation: "Profile created. In staging mode."
- [ ] Warning badge: "Staging - No real payments" on all deal pages

**Story Points:** 5

**Dependencies:** studios table, user_profiles

**Testing:**
- Create studio → profile.verification_status = 'staging'
- All deals created by staging studios are marked as "practice"

---

### Story 3.6: Deal Status Tracking & History
**Assignee:** Backend

**User Story:**
As all parties, I want to see the full history of a deal (created, edited, approved, signed) so there's transparency.

**Acceptance Criteria:**
- [ ] GET `/api/deals/:deal_id/history` returns timeline:
  ```json
  {
    "events": [
      {
        "event_type": "deal_created",
        "by": "studio_name",
        "at": "2024-02-15T10:00:00Z"
      },
      {
        "event_type": "deal_edited",
        "by": "agent_name",
        "changes": { "recording_fee": [5000, 7000] },
        "at": "2024-02-15T14:30:00Z"
      },
      {
        "event_type": "deal_approved",
        "by": "actor_name",
        "at": "2024-02-16T09:00:00Z"
      }
    ]
  }
  ```
- [ ] All users involved can view history
- [ ] Frontend: timeline view or activity log

**Story Points:** 4

**Dependencies:** Stories 3.1–3.5

---

### Story 3.7: Frontend - Deal Proposal & Negotiation UI
**Assignee:** Frontend (Next.js)

**User Story:**
As a studio, agent, or actor, I want an intuitive deal creation/review interface so I can quickly propose and negotiate deals.

**Acceptance Criteria:**

**Studio-facing (Deal Creation):**
- [ ] Form with steps:
  1. Select template
  2. Search & select actor
  3. Project details (name, work type, usage types)
  4. Territory & duration
  5. Remuneration (recording fee, usage % expectation)
  6. Custom terms (free text)
  7. Review & submit
- [ ] Template selector: shows descriptions + preview
- [ ] Actor search: search by name or registry_id
- [ ] Auto-fills agent_id if actor has active representation
- [ ] Currency selection (GBP default)
- [ ] Submit → POST /api/deals/create → confirmation page with deal_id & share link

**Agent/Actor-facing (Deal Review):**
- [ ] Deal card showing:
  - Project name, work type, territory, duration
  - Remuneration breakdown (recording + usage)
  - Full terms in accordion (expandable)
  - Approval status (actor ✓/✗, agent ✓/✗, studio ✓)
- [ ] "Edit terms" button → opens form (pre-filled)
  - Highlights which fields are editable (remuneration, custom_terms)
  - Submit → PATCH /api/deals/:id
  - Shows "Changes sent to studio" confirmation
- [ ] "Approve" / "Decline" buttons (require confirmation modal)
- [ ] Activity log: shows who did what, when

**Mobile-responsive:**
- [ ] Forms stack vertically
- [ ] Deal cards collapse on mobile

**Story Points:** 15

**Dependencies:** Stories 3.1–3.6

---

## SPRINT 3 Summary

**Deliverables:**
- Equity-based deal templates
- Deal creation (studio-initiated)
- Deal editing/counter-proposal
- Deal approval & signing workflow
- Studio profile creation (staging mode)
- Deal history tracking
- UI for all of the above

**Metric to Track:**
- Time from deal creation to signing (target: < 5 days)
- Deal counter-proposal rate (typical: 20–30%)

---

## SPRINT 4: HDICR Studio Query & License Issuance (Weeks 7–8)

### Theme
Studios query consent for real; deals create licenses; usage begins to be tracked.

### Story 4.1: Consent Query Endpoint (Studio → HDICR)
**Assignee:** Backend (consent-service)

**User Story:**
As a studio, I want to query an actor's consent before proposing a deal so I know if they can be licensed for my project.

**Acceptance Criteria:**
- [ ] Endpoint: POST `/api/v1/consent/check` (external, API-key auth OR OAuth)
- [ ] Input:
  ```json
  {
    "actor_id": "uuid",
    "requested_usage": "film_tv" | "advertising" | "synthetic_media" | "voice_replication",
    "territory": "GB" | "US" | "WORLD",
    "studio_id": "uuid"
  }
  ```
- [ ] Validation:
  - [ ] actor_id exists
  - [ ] studio_id exists (MVP: only TI internal, no external API clients yet)
  - [ ] requested_usage is valid enum
  - [ ] territory is valid
- [ ] Query logic:
  - [ ] Fetch latest active consent_ledger entry for actor
  - [ ] Check: is requested_usage in actor's consent.work_types?
  - [ ] Check: is territory in actor's consent.territories.allowed?
  - [ ] Check: does requested_usage conflict with content_restrictions?
- [ ] Response:
  ```json
  {
    "decision": "allow" | "deny",
    "reason": "string",
    "consent_version": 1,
    "consent_timestamp": "2024-02-15T10:00:00Z",
    "actor_registry_id": "uuid"
  }
  ```
  - [ ] If deny: reason = "Usage not permitted by consent policy"
- [ ] Audit log: query received, actor_id, result, studio_id
- [ ] No PII in response (except actor_registry_id)

**Story Points:** 8

**Dependencies:** consent_ledger table, actor table

**Testing:**
- Actor has Film consent, query for Film → "allow"
- Actor lacks TV consent, query for TV → "deny"
- Actor has Political restriction, query for Political content → "deny"
- Query for world-wide when only GB allowed → "deny"

---

### Story 4.2: License Creation on Deal Signing
**Assignee:** Backend

**User Story:**
As the system, I want to create a license record when a deal is signed so usage can be tracked and enforced.

**Acceptance Criteria:**
- [ ] On deal signing (deal.status = 'signed'):
  - [ ] Backend triggers POST `/internal/licenses/create` (internal endpoint)
  - [ ] Input: deal_id
  - [ ] Fetch deal + commercial_terms
  - [ ] Fetch actor's current consent version
  - [ ] Creates `licenses` record:
    ```sql
    INSERT INTO licenses (
      actor_id, studio_user_id, deal_id, 
      work_type, usage_types, territory, duration_days, first_usage_date,
      commercial_terms, 
      consent_version_at_signing,
      status, created_at, signed_at
    ) VALUES (...)
    ```
  - [ ] consent_version_at_signing = current consent ledger version (PIN consent to this version)
  - [ ] status = 'active'
  - [ ] Returns license_id
- [ ] Audit log: license created, linked to deal

**Story Points:** 4

**Dependencies:** Stories 3.4, licenses table

---

### Story 4.3: Usage Logging Infrastructure
**Assignee:** Backend

**User Story:**
As the system, I want to log every usage of a licensed actor so we have a complete audit trail.

**Acceptance Criteria:**
- [ ] Create `license_usage_log` table:
  ```sql
  CREATE TABLE license_usage_log (
    id BIGSERIAL PRIMARY KEY,
    license_id BIGINT NOT NULL REFERENCES licenses(id),
    studio_user_id BIGINT REFERENCES user_profiles(id),
    usage_date TIMESTAMP NOT NULL,
    usage_type VARCHAR(50),  -- "broadcast", "streaming", "social_media", etc.
    reach_estimate BIGINT,     -- estimated views/impressions
    revenue_generated NUMERIC(12,2),
    metadata JSONB,            -- contextual info (channel, platform, etc.)
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] POST `/api/usage/log` (authenticated, studio)
  - [ ] Input: license_id, usage_type, reach_estimate, revenue_generated, metadata
  - [ ] Validates license_id belongs to authenticated studio
  - [ ] Inserts into usage_log
  - [ ] Audit log: usage logged
- [ ] GET `/api/licenses/:license_id/usage` (authenticated, actor/agent/studio)
  - [ ] Returns paginated usage_log entries

**Story Points:** 4

**Dependencies:** license_usage_log table

---

### Story 4.4: Usage Validation Against Consent
**Assignee:** Backend

**User Story:**
As the system, I want to validate that each usage aligns with the actor's pinned consent version at license signing.

**Acceptance Criteria:**
- [ ] When logging usage (Story 4.3), validate:
  - [ ] license.status = 'active' (not suspended/frozen)
  - [ ] usage_date >= license.first_usage_date AND usage_date <= license.end_date (if capped)
  - [ ] usage_type is within license.usage_types
  - [ ] Fetch license.consent_version_at_signing, resolve consent_ledger at that version
  - [ ] Check if usage_type is permitted by that consent version
- [ ] If validation passes:
  - [ ] Log usage successfully
  - [ ] Decision: "allow"
- [ ] If validation fails:
  - [ ] Reject usage log
  - [ ] Create usage denial audit entry
  - [ ] Email studio: "Usage rejected due to consent restrictions"
  - [ ] Decision: "deny"

**Story Points:** 5

**Dependencies:** Stories 4.2–4.3, consent_ledger

**Testing:**
- Log usage within consent → allows
- Log usage outside consent → denies with reason
- Log usage after license.end_date → denies

---

### Story 4.5: License Expiration Logic
**Assignee:** Backend

**User Story:**
As the system, I want to automatically expire licenses when their term ends so usage is prevented.

**Acceptance Criteria:**
- [ ] Add column to licenses: `end_date` TIMESTAMP
- [ ] Calculate from: first_usage_date + duration_days
- [ ] Cron job (runs nightly or on schedule):
  - [ ] Query: SELECT * FROM licenses WHERE end_date < NOW() AND status = 'active'
  - [ ] For each: UPDATE licenses SET status = 'expired', expired_at = NOW()
  - [ ] Email actor + agent: "License [project] has expired"
  - [ ] Email studio: "License [project] has expired. No further usage permitted."
  - [ ] Audit log: license expired
- [ ] Usage validation (Story 4.4) checks: if status = 'expired', deny usage

**Story Points:** 4

**Dependencies:** Stories 4.2–4.4

---

### Story 4.6: License Dashboard (Actor/Agent view earnings)
**Assignee:** Backend + Frontend

**User Story:**
As an actor or agent, I want to see all my active licenses, usage stats, and earnings so I can track revenue.

**Acceptance Criteria:**

**Backend:**
- [ ] GET `/api/licenses/me` (authenticated, actor or agent)
- [ ] Returns active + recent licenses:
  ```json
  {
    "licenses": [
      {
        "license_id": "uuid",
        "project_name": "Summer Commercial",
        "work_type": "Commercial",
        "studio": "Universal Pictures",
        "status": "active",
        "signed_at": "2024-02-16",
        "end_date": "2025-02-16",
        "commercial_terms": { "recording_fee": 5000, "usage_fee_percentage": 10 },
        "usage_stats": {
          "total_logs": 15,
          "estimated_reach": 500000,
          "revenue_generated": 12500
        },
        "earnings": {
          "actor_net": 4250,
          "agent_cut": 750
        }
      }
    ]
  }
  ```
- [ ] Pagination & filtering (status, date range)
- [ ] GET `/api/licenses/:license_id/earnings` returns detailed breakdown

**Frontend:**
- [ ] Table view: Project, Status, Signed Date, Earnings
- [ ] Click row → detail page:
  - [ ] Full commercial terms
  - [ ] Usage activity (recent logs)
  - [ ] Earnings breakdown (actor net, agent cut, TI fee)
  - [ ] Payment status (pending, paid, disputed)
- [ ] Summary stats: total earnings (YTD, all-time)

**Story Points:** 8

**Dependencies:** Stories 4.2–4.5

---

### Story 4.7: Admin License Management Dashboard
**Assignee:** Backend + Frontend

**User Story:**
As an admin, I want a dashboard showing all licenses, usage, and payment status so I can monitor platform health.

**Acceptance Criteria:**

**Backend:**
- [ ] GET `/api/admin/licenses` (admin-only)
- [ ] Returns all licenses with filters: status, studio, actor, date range
- [ ] Summary stats: total licenses, active, expired, disputes

**Frontend:**
- [ ] Table: Project, Actor, Studio, Status, Signed Date, Revenue
- [ ] Filters: status (active, expired, suspended), date range, studio, actor search
- [ ] Click license → detail page with usage log + payments

**Story Points:** 6

**Dependencies:** Stories 4.2–4.5

---

## SPRINT 4 Summary

**Deliverables:**
- Consent query endpoint (functional for MVP: TI-only)
- License creation on deal signing
- Usage logging & audit trail
- Usage validation against consent
- License expiration automation
- License dashboards (actor/agent/admin)

**Metric to Track:**
- License creation latency (should be < 1 second)
- Usage validation success rate (target: > 99%)

---

## SPRINT 5: Consent Revocation & Arbitration (Weeks 9–10)

### Theme
Handle consent revocation on active deals. Arbitration workflow with 30-day negotiation window.

### Story 5.1: Consent Revocation Endpoint
**Assignee:** Backend (consent-service)

**User Story:**
As an actor, I want to revoke a work type or territory from my consent so my preferences are updated.

**Acceptance Criteria:**
- [ ] PATCH `/api/consent/revoke` (authenticated, actor)
- [ ] Input:
  ```json
  {
    "work_types_to_remove": ["Political"],
    "territories_to_remove": ["CN"],
    "reason": "string (optional)"
  }
  ```
- [ ] Validation:
  - [ ] work_types_to_remove are subset of actor's current consent
  - [ ] territories_to_remove are subset of actor's current consent
  - [ ] Cannot remove all work types (must have at least one)
- [ ] Logic:
  1. Fetch actor's current consent_ledger version
  2. Create new version (v+1) with updated policy (removed items deleted)
  3. Insert new consent_ledger entry:
     - version = v+1
     - status = 'active'
     - policy = updated JSON
     - reason = "actor revoked [items]"
  4. Check: are there active licenses affected by this revocation?
     - [ ] Query licenses where:
       - actor_id = this actor
       - status = 'active'
       - work_type was removed OR territory was removed
       - end_date >= today
  5. If YES → trigger arbitration flow (Story 5.2)
  6. If NO → complete revocation, email actor "Consent updated"
- [ ] Audit log: revocation initiated, version change

**Story Points:** 8

**Dependencies:** consent-service, consent_ledger

**Testing:**
- Remove one work type → new version created
- Revoke work type with no active licenses → completes silently
- Revoke work type with 3 active licenses → triggers arbitration for all 3

---

### Story 5.2: Arbitration Request Creation
**Assignee:** Backend

**User Story:**
As the system, I want to create an arbitration request when a consent revocation affects active licenses so both parties can negotiate new terms.

**Acceptance Criteria:**
- [ ] When revocation triggers arbitration (Story 5.1):
  - [ ] For each affected license:
    - [ ] Create `arbitration_requests` record:
      ```sql
      INSERT INTO arbitration_requests (
        license_id, actor_id, studio_user_id, agent_id,
        initiated_by, reason,
        old_consent_version, new_consent_version,
        notice_date, resolution_deadline (= notice_date + 30 days),
        status
      ) VALUES (...)
      ```
    - [ ] status = 'pending'
    - [ ] Update licenses: status = 'arbitration_pending'
    - [ ] Create usage_pause record (prevent usage queries during arbitration)
  - [ ] Email actor: "Arbitration initiated for [license]. You have 30 days to reach agreement."
  - [ ] Email agent: same
  - [ ] Email studio: same + details of what changed in consent
- [ ] Audit log: arbitration created, reason

**Story Points:** 6

**Dependencies:** Story 5.1, arbitration_requests table

---

### Story 5.3: Automatic Dispute Check (Day 0–5)
**Assignee:** Backend

**User Story:**
As the system, I want to automatically check if a revocation dispute can be auto-resolved within 5 days so uncontested revocations complete quickly.

**Acceptance Criteria:**
- [ ] On arbitration creation (Story 5.2), schedule async task:
  - [ ] Wait 5 days
  - [ ] Call `/internal/arbitration/auto-check` (internal endpoint)
  - [ ] For each arbitration_request:
    - [ ] Fetch old_consent_version & new_consent_version
    - [ ] Fetch license.commercial_terms
    - [ ] Check: does new consent conflict with commercial_terms?
      - [ ] Example: commercial says "Film+TV usage", new consent removes "TV"
      - [ ] Example: commercial says "World-wide", new consent restricts to "GB only"
    - [ ] If NO conflict:
      - [ ] Status = 'auto_resolved'
      - [ ] Update license: status = 'active' (resume usage)
      - [ ] Email all: "Revocation is compatible with existing deal. License continues as-is."
      - [ ] Audit log: auto-resolved
    - [ ] If YES conflict:
      - [ ] Status = 'requires_negotiation'
      - [ ] Continue to negotiation phase (Story 5.4)
      - [ ] Email all: "Terms conflict. Both parties must negotiate new agreement."

**Story Points:** 8

**Dependencies:** Story 5.2

---

### Story 5.4: Arbitration Negotiation Phase (Day 0–30)
**Assignee:** Backend + Frontend

**User Story:**
As actor/agent/studio, I want to propose new commercial terms during arbitration so we can reach agreement.

**Acceptance Criteria:**

**Backend:**
- [ ] POST `/api/arbitration/:arbitration_id/propose` (authenticated, actor/agent/studio)
- [ ] Input:
  ```json
  {
    "proposed_changes": {
      "remuneration": { "recording_fee": 6000 },
      "custom_terms": "Revised territory to GB only"
    },
    "reason": "New terms align with updated consent"
  }
  ```
- [ ] Creates `arbitration_proposals` record:
  - proposed_by (actor, agent, or studio)
  - proposed_changes (JSON)
  - created_at
- [ ] Updates arbitration_request: status = 'proposal_pending' (if first proposal)
- [ ] Email other parties: "[Party] has proposed new terms. Review and respond."
- [ ] GET `/api/arbitration/:arbitration_id/proposals` returns all proposals in order

**Frontend:**
- [ ] Arbitration detail page shows:
  - Countdown to resolution deadline
  - Current commercial terms
  - Proposal history (who proposed what, when)
  - "Propose new terms" button → opens form
  - Form fields: editable remuneration, custom_terms
  - Submit → POST /api/arbitration/:id/propose
- [ ] After submission: shows "Awaiting response from other parties"

**Story Points:** 10

**Dependencies:** Story 5.3, arbitration_proposals table

---

### Story 5.5: Arbitration Agreement & License Update
**Assignee:** Backend

**User Story:**
As all parties, I want to agree on new terms during arbitration so the license can be updated and usage resumed.

**Acceptance Criteria:**
- [ ] All parties (actor/agent/studio) must approve same proposal:
  - [ ] PATCH `/api/arbitration/:arbitration_id/approve` (authenticated)
  - [ ] Input: proposal_id
  - [ ] Creates approval record for authenticated user
  - [ ] When all three approved:
    - [ ] Update license.commercial_terms with new proposed terms
    - [ ] Update license.status = 'active' (resume usage)
    - [ ] Update arbitration_request: status = 'resolved', resolved_at = NOW()
    - [ ] Email all: "Arbitration resolved. License terms updated. Usage resumed."
    - [ ] Audit log: arbitration resolved, new terms
- [ ] If approval deadline passes (Day 30) without agreement:
  - [ ] Update arbitration_request: status = 'unresolved'
  - [ ] Update license: status = 'frozen'
  - [ ] Update license: payment_status = 'disputed' (see Payment Sprint 6)
  - [ ] Email all: "Arbitration deadline passed. License and fees frozen. Dispute escalates off-platform."
  - [ ] Create escalation ticket: admin notified, legal involvement possible

**Story Points:** 10

**Dependencies:** Story 5.4

---

### Story 5.6: Usage Pause During Arbitration
**Assignee:** Backend

**User Story:**
As the system, I want to prevent usage logging during arbitration so consent/license disputes don't create liability.

**Acceptance Criteria:**
- [ ] When arbitration created (Story 5.2):
  - [ ] license.status = 'arbitration_pending'
- [ ] POST `/api/usage/log` (Story 4.3) checks:
  - [ ] if license.status = 'arbitration_pending', reject with 409:
    ```json
    {
      "error": "License in arbitration. Usage paused."
    }
    ```
- [ ] Email studio: "Usage paused for [license] pending arbitration resolution."
- [ ] If arbitration resolves:
  - [ ] license.status = 'active'
  - [ ] Usage can resume
- [ ] If arbitration unresolved → license.status = 'frozen'
  - [ ] All usage attempts denied

**Story Points:** 4

**Dependencies:** Stories 5.2, 5.5

**Testing:**
- Log usage on active license → succeeds
- License enters arbitration → usage attempt rejected
- Arbitration resolves → usage succeeds again

---

### Story 5.7: Admin Arbitration Dashboard
**Assignee:** Backend + Frontend

**User Story:**
As an admin, I want to see all active arbitrations and their status so I can track disputes.

**Acceptance Criteria:**

**Backend:**
- [ ] GET `/api/admin/arbitrations` (admin-only)
- [ ] Returns all arbitrations with filters: status, actor, studio, date range
- [ ] Summary: total pending, resolved, unresolved, average resolution time

**Frontend:**
- [ ] Table: License ID, Project, Actor, Studio, Status, Days Left
- [ ] Filters: status (pending, requires_negotiation, auto_resolved, unresolved)
- [ ] Click row → detail page:
  - [ ] Timeline of proposals + approvals
  - [ ] Current commercial terms
  - [ ] Countdown to deadline
  - [ ] Action: escalate to legal (admin-only)
- [ ] Color coding: green (auto-resolved), yellow (pending), red (unresolved)

**Story Points:** 6

**Dependencies:** Stories 5.1–5.6

---

## SPRINT 5 Summary

**Deliverables:**
- Consent revocation endpoint
- Arbitration request creation
- Automatic dispute checking (Day 0–5)
- Negotiation workflow (Day 0–30)
- Agreement & license update
- Usage pause enforcement
- Admin dashboard for arbitrations

**Metric to Track:**
- Arbitration resolution time (target: < 20 days average)
- Auto-resolution rate (target: > 60%, meaning most revocations don't conflict)

---

## SPRINT 6: Audit, Compliance & Polish (Weeks 11–12)

### Theme
GDPR-ready, audit trails, payment processing, and launch polish.

### Story 6.1: Payment Processing Integration - Stripe Setup
**Assignee:** Backend + DevOps

**User Story:**
As the system, I want Stripe to handle all payments so we stay PCI-DSS compliant and can split payouts.

**Acceptance Criteria:**
- [ ] Create Stripe account (production) or use test keys (staging)
- [ ] Configure Stripe API keys in environment
- [ ] Set up webhook endpoint: POST `/api/webhooks/stripe`
- [ ] Enable Stripe webhooks in dashboard: payment_intent.succeeded, payment_intent.payment_failed, transfer.created, transfer.failed, charge.refunded
- [ ] Test webhook delivery (Stripe test mode)
- [ ] Create helper functions:
  - [ ] `createPaymentIntent(amount, studio_id, license_id)`
  - [ ] `createTransfer(amount, recipient_bank_account_id, metadata)`
  - [ ] `refundPayment(payment_intent_id, reason)`
- [ ] Add Stripe SDK to backend (Node.js)
- [ ] Error handling: retry logic for failed transfers (exponential backoff)

**Story Points:** 8

**Dependencies:** Stripe account, payment-related database tables

---

### Story 6.2: Payment Invoice Creation (Studio)
**Assignee:** Backend + Frontend

**User Story:**
As a studio, I want to receive a Stripe-hosted invoice so I can pay securely without entering card details on TI.

**Acceptance Criteria:**

**Backend:**
- [ ] POST `/api/payment/invoice/create` (authenticated, studio)
- [ ] Input: license_id
- [ ] Fetch license + commercial_terms
- [ ] Create Stripe Invoice:
  ```
  Stripe.invoices.create({
    customer: studio_stripe_customer_id,
    amount_due: commercial_terms.studio_payable * 100 (pence),
    currency: 'gbp',
    metadata: { license_id, actor_registry_id }
  })
  ```
- [ ] Send invoice to studio email (Stripe handles this)
- [ ] Store invoice_id in licenses table
- [ ] Return invoice URL for manual access
- [ ] Email studio with Stripe payment link

**Frontend:**
- [ ] Deal signed → automatic invoice creation & email
- [ ] License detail page: "Invoice" button → opens Stripe-hosted invoice (read-only)

**Story Points:** 6

**Dependencies:** Story 6.1, licenses table

---

### Story 6.3: Payment Webhook Processing
**Assignee:** Backend

**User Story:**
As the system, I want to process Stripe webhooks so payments are captured and payouts are split automatically.

**Acceptance Criteria:**
- [ ] POST `/api/webhooks/stripe` (Stripe signature verification)
- [ ] Handler for `payment_intent.succeeded`:
  - [ ] Fetch license_id from metadata
  - [ ] Call `processPayout(license_id, payment_intent_id)` (from payment architecture doc)
  - [ ] Log in payment_audit_log
- [ ] Handler for `payment_intent.payment_failed`:
  - [ ] Update licenses: payment_status = 'failed'
  - [ ] Email studio: "Payment failed. Retry at [link]"
  - [ ] Email actor/agent: "Deal payment is pending"
- [ ] Handler for `transfer.created`:
  - [ ] Update payouts table: status = 'transferring'
  - [ ] Log in payment_audit_log
- [ ] Handler for `transfer.failed`:
  - [ ] Update payouts: status = 'failed', failure_reason
  - [ ] Email recipient: "Payout failed. Please verify bank account."
  - [ ] Admin alert: manual intervention needed
- [ ] Webhook deduplication (check event ID already processed)
- [ ] Error handling: log to Sentry, don't fail (Stripe will retry)

**Story Points:** 10

**Dependencies:** Story 6.1, payment_audit_log table, Payout service (from architecture)

---

### Story 6.4: Payout Calculations & Distribution
**Assignee:** Backend

**User Story:**
As the system, I want to calculate and distribute payouts to actors, agents, and TI so everyone gets paid correctly.

**Acceptance Criteria:**
- [ ] Service: `PayoutService.processPayout(license_id, payment_intent_id)`
- [ ] Logic (from architecture doc):
  1. Calculate actor_gross_fee - (agent_percentage of gross) = actor_net
  2. Calculate agent_fee = actor_gross_fee * agent_percentage
  3. Calculate ti_fee = studio_payable * ti_percentage
  4. Create Stripe transfers:
     - Actor → actor's bank account
     - Agent → agent's bank account
     - TI → TI account (no transfer needed, funds stay with TI)
  5. Create payout records in database
  6. Send notifications
- [ ] Test with sample data:
  - Studio pays £10,000
  - Actor gross: £5,000, agent gets 15% = £750, actor net = £4,250
  - TI gets 12% of £10,000 = £1,200
  - Verify: 4250 + 750 + 1200 + remainder = 10000
- [ ] Handle edge cases:
  - [ ] No agent (agent_percentage = 0)
  - [ ] Agent disabled (still pay if deal signed before)
  - [ ] Bank account not verified (transfer fails, handled by webhook)
- [ ] Audit log every payout

**Story Points:** 12

**Dependencies:** Story 6.1–6.3, payouts table

**Testing:**
- Mock Stripe transfer API
- Run payout for deal with agent → all three get paid
- Run payout for deal without agent → actor + TI get paid

---

### Story 6.5: Bank Account Management (Actor/Agent)
**Assignee:** Backend + Frontend

**User Story:**
As an actor or agent, I want to add my bank account so I can receive payouts without card entry on TI.

**Acceptance Criteria:**

**Backend:**
- [ ] POST `/api/payout/bank-account/add` (authenticated, actor/agent)
- [ ] Input: sort_code, account_number (or Stripe token if pre-tokenized)
- [ ] Validate sort code (6 digits, UK format)
- [ ] Validate account number (8 digits, UK format)
- [ ] Create bank account token via Stripe (no storage on TI):
  ```
  const token = await stripe.bankAccountTokens.create({
    bank_account: { country: 'GB', account_holder_type: 'individual', sort_code, account_number }
  })
  ```
- [ ] Store only token in payment_methods table:
  - stripe_bank_account_id (the token, not account number)
  - is_primary = true (if first account)
- [ ] Delete input from memory immediately (don't log)
- [ ] Return confirmation: "Bank account added"
- [ ] Email confirmation with masked account (****1234)
- [ ] GET `/api/payout/bank-accounts` returns masked accounts (no full details)

**Frontend:**
- [ ] Account settings page
- [ ] Form: Sort Code, Account Number (two separate fields)
- [ ] Submit → POST /api/payout/bank-account/add
- [ ] List of linked accounts (display as "Bank Account ****1234")
- [ ] "Remove" option for secondary accounts
- [ ] Mobile number for payment method verification (optional, for security)

**Story Points:** 8

**Dependencies:** Story 6.1, payment_methods table

**Security Notes:**
- Never log sort code or account number
- Use Stripe tokens exclusively
- HTTPS only for bank account forms
- No copy-paste of account number in UI

---

### Story 6.6: Refund & Dispute Handling
**Assignee:** Backend + Frontend

**User Story:**
As an admin, I want to process refunds if a deal is disputed or cancelled so payouts can be reversed.

**Acceptance Criteria:**

**Backend:**
- [ ] POST `/api/payment/refund` (admin-only)
- [ ] Input: license_id, reason (optional)
- [ ] Fetch license + payment_intent_id
- [ ] Validate: license.payment_status = 'paid' (can only refund paid)
- [ ] Create Stripe refund:
  ```
  stripe.refunds.create({
    payment_intent: payment_intent_id,
    reason: 'requested_by_customer' | 'fraudulent' | 'duplicate'
  })
  ```
- [ ] Reverse payouts:
  - [ ] Query payouts for this license
  - [ ] For each payout: create reverse transfer (negative amount)
  - [ ] Update payout: status = 'refunded'
- [ ] Update license: payment_status = 'refunded', refunded_at
- [ ] Email all parties: "Refund processed. Amount: [£X]"
- [ ] Audit log: refund initiator, reason, amount
- [ ] Handle errors: if reverse transfer fails, alert admin

**Frontend:**
- [ ] Admin dashboard: license detail page
- [ ] Button: "Process refund" (requires confirmation modal)
- [ ] Form: reason dropdown (Requested, Fraudulent, Duplicate), optional notes
- [ ] Submit → POST /api/payment/refund → confirmation page

**Story Points:** 10

**Dependencies:** Stories 6.1–6.5

---

### Story 6.7: Payment Audit Trail
**Assignee:** Backend

**User Story:**
As an admin or auditor, I want a complete log of all payment events so disputes can be resolved.

**Acceptance Criteria:**
- [ ] Every payment event writes to `payment_audit_log`:
  - payment_intent.created
  - payment_intent.succeeded
  - transfer.created
  - transfer.failed
  - charge.refunded
  - payout.completed
- [ ] Log structure:
  ```sql
  license_id, event_type, stripe_event_id, amount_pence, status, metadata (JSON), created_at
  ```
- [ ] No sensitive data in logs (no card numbers, full bank details)
- [ ] Example entry: `{ license_id: 123, event_type: 'transfer.created', amount_pence: 425000, status: 'processed', metadata: { recipient_type: 'actor', stripe_transfer_id: 'tr_1234' } }`
- [ ] GET `/api/admin/payments/audit` (admin-only)
  - [ ] Query audit_log with filters: license_id, event_type, date_range
  - [ ] Export as CSV
  - [ ] Timeline view for license
- [ ] Deduplication: if Stripe event_id already in log, skip

**Story Points:** 6

**Dependencies:** payment_audit_log table

---

### Story 6.8: GDPR Data Deletion & Right to Erasure
**Assignee:** Backend

**User Story:**
As an actor, I want to delete my consent history while keeping payment/license records for compliance so my data is truly erased.

**Acceptance Criteria:**
- [ ] POST `/api/gdpr/delete-consent-history` (authenticated, actor)
- [ ] Input: confirmation = true, reason (optional)
- [ ] Before deletion, create archive record in `gdpr_deletions`:
  ```sql
  actor_id, deletion_type ('consent_history'), archived_at, archived_by_user, reason
  ```
- [ ] Delete from consent_ledger: all entries for this actor
- [ ] Preserve: licenses, payouts, usage_log (for dispute resolution & payment records)
- [ ] Email confirmation: "Consent history deleted as of [date]"
- [ ] Audit log: deletion request & confirmation
- [ ] Full account deletion (POST `/api/gdpr/delete-account`):
  - [ ] Soft-delete user_profiles: status = 'deleted', deleted_at = NOW()
  - [ ] Keep actors, licenses, payouts (for audit & payment)
  - [ ] Delete personal data (name, email, phone) → anonymize as [DELETED_USER_123]
  - [ ] Delete auth0 user (if possible)
  - [ ] Create archive record

**Story Points:** 10

**Dependencies:** GDPR infrastructure, anonymization functions

**Legal Notes:**
- Consult UK Data Protection Office for GDPR compliance
- Payment records: keep for 6+ years (tax requirements)
- License records: keep for dispute period (e.g., 3 years)

---

### Story 6.9: RDS Encryption Remediation
**Assignee:** DevOps

**User Story:**
As the system, I want RDS to be encrypted at rest so sensitive data (bank accounts, payments) is protected.

**Acceptance Criteria:**
- [ ] Current state: trimg-db-v3 has storage_encrypted = false (identified in earlier audit)
- [ ] Process:
  1. Create RDS snapshot of trimg-db-v3 (unencrypted)
  2. Copy snapshot with encryption enabled
  3. Restore from encrypted snapshot → new DB instance
  4. Update DNS/connection string to point to new instance
  5. Verify data integrity (run SELECT COUNT(*) on all tables)
  6. Delete old unencrypted instance
- [ ] Test in staging first (use snapshot of production, encrypt, verify)
- [ ] Zero-downtime migration (blue-green):
  - [ ] Create encrypted replica while old DB running
  - [ ] Switch application to encrypted DB
  - [ ] Verify no errors for 1 hour
  - [ ] Decommission old DB
- [ ] Enable backups: daily automated snapshots, 30-day retention
- [ ] Enable Multi-AZ (stretch goal, not critical for MVP)

**Story Points:** 12

**Dependencies:** AWS, RDS, DevOps access

**Risk:** Downtime possible if not careful. Test thoroughly in staging.

---

### Story 6.10: Monitoring & Alerting
**Assignee:** DevOps + Backend

**User Story:**
As ops, I want alerts for payment failures, transfer failures, and system health so I can respond to issues.

**Acceptance Criteria:**
- [ ] Set up monitoring for:
  - [ ] Payment success rate (target: > 99%)
  - [ ] Transfer failure rate (alert if > 1%)
  - [ ] Payout latency (alert if > 2 hours)
  - [ ] Database connection pool (alert if exhausted)
  - [ ] API error rate (alert if > 0.1%)
  - [ ] Webhook processing lag (alert if > 5 min)
- [ ] Alerting channels:
  - [ ] Sentry for exceptions
  - [ ] PagerDuty for critical alerts (payment failures)
  - [ ] Slack for informational alerts (transfer created)
  - [ ] Email for billing/payment summaries (daily)
- [ ] Dashboard:
  - [ ] Real-time payment volume
  - [ ] Error logs (searchable)
  - [ ] License status breakdown (active, expired, arbitration, frozen)
  - [ ] Actor/Agent/Studio growth

**Story Points:** 8

**Dependencies:** Sentry, PagerDuty, Slack integrations

---

### Story 6.11: Testing - Full Payment Flow
**Assignee:** QA + Backend

**User Story:**
As QA, I want end-to-end payment tests so we can verify all flows work before launch.

**Acceptance Criteria:**
- [ ] Test scenario 1: Deal signing → Invoice → Payment → Payout split
  1. Create deal (studio)
  2. Actor/agent approve
  3. Deal signed → license created
  4. POST /api/payment/invoice/create
  5. Use Stripe test card (4242...) to pay
  6. Webhook fires payment_intent.succeeded
  7. Payouts created & transferred to test bank accounts
  8. Verify amounts: actor net, agent cut, TI fee sum to studio_payable
  9. Email notifications sent
- [ ] Test scenario 2: Refund flow
  1. Run scenario 1
  2. POST /api/payment/refund
  3. Verify Stripe refund created
  4. Verify reverse transfers created
  5. Verify emails sent to all parties
- [ ] Test scenario 3: Transfer failure
  1. Mock Stripe transfer to fail
  2. Webhook processes transfer.failed
  3. Verify payout status = 'failed'
  4. Verify admin alert sent
- [ ] Test scenario 4: Agent disabled mid-deal
  1. Create deal with agent
  2. Sign deal → payout split includes agent
  3. Payment succeeds → agent still gets cut (not retroactive)
- [ ] Manual testing with Stripe test mode (4242 card, 4000 decline card, etc.)

**Story Points:** 15

**Dependencies:** All payment stories

---

### Story 6.12: Documentation & Go-Live
**Assignee:** Product/Founder

**User Story:**
As a studio/actor/agent, I want clear documentation on how to use payment features so I can operate independently.

**Acceptance Criteria:**
- [ ] Documentation:
  - [ ] "How to add bank account" (actor/agent)
  - [ ] "How to propose a deal" (studio)
  - [ ] "How to pay an invoice" (studio)
  - [ ] "How to track earnings" (actor/agent)
  - [ ] "What to do if payment fails" (troubleshooting)
  - [ ] FAQ: "How long until I get paid?" (T+3 business days typical)
- [ ] Video tutorials (optional, MVP: docs sufficient)
- [ ] Email templates:
  - [ ] Payment failure notification (with retry link)
  - [ ] Payout confirmation (with amount & date)
  - [ ] Refund notification
- [ ] Legal review:
  - [ ] Stripe ToS compliance (data processing, revenue share)
  - [ ] Payment terms in license templates (reference Stripe-handled processing)
  - [ ] Anti-money laundering (AML) note (Stripe handles)
  - [ ] PCI-DSS compliance statement (Stripe SAQ A-EP)
- [ ] Go-live checklist:
  - [ ] Stripe production account verified
  - [ ] Test payments with real (small) amounts
  - [ ] Audit trails working
  - [ ] Alerts configured
  - [ ] Backup & disaster recovery plan
  - [ ] Key team trained on payment operations

**Story Points:** 10

**Dependencies:** All previous stories

---

## SPRINT 6 Summary

**Deliverables:**
- Stripe integration (full payment pipeline)
- Invoice creation & payment
- Payout splits & distribution
- Bank account management (PCI-DSS compliant)
- Refund & dispute handling
- Payment audit trail
- GDPR compliance (deletion workflows)
- RDS encryption
- Monitoring & alerting
- Full test suite
- Documentation & launch readiness

**Metric to Track:**
- Payment success rate (target: > 99%)
- Time from deal signing to payout (target: T+5 business days)
- Support tickets related to payment (target: < 1% of deals)

---

## Cross-Sprint Dependencies & Critical Path

```
Sprint 1 (Identity & Consent)
  ↓
Sprint 2 (Agents & Representation)
  ↓
Sprint 3 (Deal Templates)
  ↓
Sprint 4 (HDICR Queries & Licenses) + Sprint 6 (Payments in parallel)
  ↓
Sprint 5 (Arbitration & Revocation)
  ↓
LAUNCH
```

**Critical items (if any slip, launch delays):**
- Sprint 1: Identity verification
- Sprint 2: Agent representation (GTM dependency)
- Sprint 3: Deal UI (user-facing critical)
- Sprint 4: License creation (ops-critical)
- Sprint 6: Payment processing (revenue-critical)

---

## Definition of "Done" (Each Story)

For a story to be marked done:
- [ ] Code written & peer-reviewed
- [ ] Unit tests written & passing
- [ ] Integration tests passing (or scheduled for QA)
- [ ] Acceptance criteria verified by tester or founder
- [ ] Documentation updated (code comments, API docs)
- [ ] Audit log entry created (if relevant)
- [ ] No high-severity bugs in Sentry
- [ ] Deployed to staging & founder can manually test

For Payment stories specifically:
- [ ] No PCI-DSS violations introduced
- [ ] Sensitive data never logged or stored
- [ ] Stripe API calls verified with test mode
- [ ] Error handling & retries in place

---

## Effort Summary

| Sprint | Theme | Story Points | Est. Weeks |
|--------|-------|--------------|-----------|
| 1 | Identity & Consent | 42 | 2 |
| 2 | Agents & Representation | 50 | 2 |
| 3 | Deal Templates & Negotiation | 60 | 2 |
| 4 | Licenses & Usage | 35 | 2 |
| 5 | Arbitration | 48 | 2 |
| 6 | Payments & Compliance | 89 | 2 |
| **Total** | | **324** | **12** |

**Team composition (solo founder MVP):**
- Backend (identity, consent, deals, payments, arbitration): ~40 story points/week
- Frontend (dashboards, forms, UX): ~30 story points/week
- DevOps (Stripe, RDS, monitoring): ~10 story points/week

**Realistic solo founder pace:**
- 20–25 story points/week (part-time coding, part-time ops/founder duties)
- **Total duration: 13–16 weeks** (MVP ready in 4 months)

---

## Notes for Founder

1. **Payments are not optional.** They're critical to launch. Allocate significant time to Story 6.1–6.7.
2. **Test refunds thoroughly.** This is where most payment bugs surface.
3. **Bank account tokenization (Story 6.5) is security-critical.** Do not deviate from Stripe's recommended flow.
4. **Stripe webhooks can fail silently.** Implement monitoring (Story 6.10) from day one.
5. **Arbitration (Sprint 5) is complex.** Consider blocking a week just for testing scenarios.
6. **GDPR (Story 6.8) is legal-critical.** Consult a solicitor before going live.
7. **RDS encryption (Story 6.9) is blocking.** Get this done before accepting real payments.
8. **Launch gates:** Don't move to production until:
   - All payment tests pass (Story 6.11)
   - Stripe production account verified
   - RDS encrypted
   - Legal review complete
   - First 5 paid deals processed successfully in staging

---

## Appendix: Story Dependencies Map

```
1.1 (Stripe ID init) → 1.2 (Webhooks) ┐
                                      ├─→ 1.3 (Manual verification)
                                      ├─→ 1.4 (Actor registration)
                                      └─→ 1.5 (Consent)

1.5 (Consent) → 1.6 (Consent read) → 1.7 (Ledger) → 1.8 (Onboarding UI)

2.1 (Agency) → 2.2 (Codes) → 2.3 (Redeem) → 2.4 (Approve) → 2.5 (Roster)
            → 2.8 (Team perms) → 2.9 (Dashboard)

2.4 (Approve) → 2.6 (Actor view)
            → 2.7 (Termination)

3.1 (Templates) → 3.2 (Deal create) → 3.3 (Review) → 3.4 (Approve)
            → 3.5 (Studio profile)
            → 3.6 (History)
            → 3.7 (UI)

4.1 (Query endpoint) → 4.2 (License create) → 4.3 (Usage log)
                   → 4.4 (Usage validation)
                   → 4.5 (Expiration)
                   → 4.6 (Dashboard)
                   → 4.7 (Admin dashboard)

5.1 (Revoke) → 5.2 (Arb request) → 5.3 (Auto-check) → 5.4 (Negotiate)
           → 5.5 (Agree)
           → 5.6 (Usage pause)
           → 5.7 (Admin dashboard)

6.1 (Stripe) → 6.2 (Invoice) → 6.3 (Webhook) → 6.4 (Payout)
           → 6.5 (Bank account)
           → 6.6 (Refund)
           → 6.7 (Audit trail)
           → 6.8 (GDPR)
           → 6.11 (Testing)
           → 6.12 (Docs)

6.9 (RDS encryption) - can be parallel but must complete before launch
6.10 (Monitoring) - setup in parallel with other Sprint 6 stories
```

---

Done. This is your complete sprint breakdown with payment processing fully integrated, granular stories, and acceptance criteria. Ready to build?
