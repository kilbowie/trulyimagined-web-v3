# Truly Imagined v3 — 90 Day Execution Roadmap

## 🎯 Core Objective

Build the foundation of:

> **“The global registry and compliance infrastructure for human digital identity in AI.”**

By Day 90, we must have:

- 300–1,000 verified actors onboarded
- 3–5 agency relationships started
- Identity Registry + Consent Ledger live
- First licensed usage (minutes generated)
- First revenue signals (even small)

---

# 🧭 Execution Principles

- Prioritise **trust over features**
- Prioritise **usage over scale**
- Build **infrastructure, not tools**
- Do things that **don’t scale** early
- Ship fast, iterate fast

---

# 🏗️ PHASE 1 (Days 1–30)
## Trust Layer + Registry Foundation

### 🎯 Goal:
Establish Truly Imagined as a **credible identity registry**, not an AI tool.

---

## 🔹 Step 1 — Repositioning (Week 1–2)

### Objective:
Shift all messaging to infrastructure + compliance.

### Deliverables:

- [ ] Rewrite homepage copy:
  - Focus on identity, consent, licensing
- [ ] Update README.md with new vision
- [ ] Create 1-page explainer for actors/agencies
- [ ] Define core value proposition:
  - “Control and license your digital identity in AI”

### Output:
Clear positioning as **rights infrastructure**

---

## 🔹 Step 2 — Repository + Environment Setup

### Objective:
Create clean v3 monorepo

### Tasks:

- [ ] Initialise new repo (`truly-imagined-v3`)
- [ ] Setup monorepo structure (`/v2`)
- [ ] Configure:
  - TypeScript
  - ESLint
  - Prettier
- [ ] Setup Next.js app (App Router)
- [ ] Install Tailwind (basic only)
- [ ] Setup environment variables

---

## 🔹 Step 3 — Core Backend Infrastructure

### Objective:
Lay technical foundation

### Tasks:

- [ ] Setup PostgreSQL (AWS RDS)
- [ ] Setup DB connection layer (`pg`)
- [ ] Setup AWS SAM
- [ ] Configure API Gateway
- [ ] Create initial Lambda handlers

---

## 🔹 Step 4 — Auth Layer (Auth0)

### Objective:
Secure system with role-based access

### Roles:

- Actor
- Agent
- Admin
- Enterprise (future-ready)

### Tasks:

- [ ] Integrate Auth0
- [ ] Implement JWT validation middleware
- [ ] Extract roles from tokens
- [ ] Protect API routes

---

## 🔹 Step 5 — Identity Registry (MVP)

### Objective:
Enable actors to register identity

### Features:

- Actor profile creation
- Identity metadata
- Verification status (basic)

### Tasks:

- [ ] Create Actor table
- [ ] Build API:
  - POST /identity/register
  - GET /identity/{id}
- [ ] Build frontend form
- [ ] Store data in PostgreSQL

---

## 🔹 Step 6 — Consent Ledger (CRITICAL)

### Objective:
Track all permissions and usage

### Requirements:

- Append-only log
- Timestamped records
- Future audit-ready

### Tasks:

- [ ] Create ConsentLog table
- [ ] Build API:
  - POST /consent/log
  - GET /consent/{actor_id}
- [ ] Ensure immutable logging design

---

## 🔹 Step 7 — Basic Frontend

### Objective:
Minimal functional UI (no design focus)

### Pages:

- Landing page (infrastructure messaging)
- Actor dashboard
- Identity registration
- Consent view

### Rules:

- No animations
- No branding polish
- Default Tailwind only

---

## ✅ Phase 1 Success Criteria

- [ ] 50–100 actors onboarded
- [ ] Identity + Consent systems working
- [ ] Auth fully functional
- [ ] Core flows usable end-to-end

---

# ⚙️ PHASE 2 (Days 31–60)
## Supply Acquisition + Usage Enablement

### 🎯 Goal:
Scale actor onboarding + enable first licensing

---

## 🔹 Step 8 — Founding Actor Program

### Objective:
Rapidly onboard high-quality actors

### Tasks:

- [ ] Launch “Founding Registry”
- [ ] Create onboarding flow
- [ ] Manual onboarding support (allowed)
- [ ] Track actor pipeline

---

## 🔹 Step 9 — Agency Outreach

### Objective:
Secure early credibility

### Tasks:

- [ ] Contact 5–10 agencies
- [ ] Present registry as protection layer
- [ ] Build relationships (not transactions)

---

## 🔹 Step 10 — Licensing Service (MVP)

### Objective:
Enable basic licensing flow

### Features:

- Request license
- Approve/deny
- Record intent

### Tasks:

- [ ] Create LicenseRequest table
- [ ] Build API:
  - POST /license/request
- [ ] Connect to consent system

---

## 🔹 Step 11 — Synthetic Audition Tool (Basic)

### Objective:
Generate first usage

### Features:

- Input script
- Select actor
- Generate output (can be mocked/manual)

### Tasks:

- [ ] Create simple UI flow
- [ ] Connect to licensing system
- [ ] Log usage as “minutes”

---

## 🔹 Step 12 — Usage Tracking

### Objective:
Measure platform activity

### Tasks:

- [ ] Track minutes generated
- [ ] Store usage data
- [ ] Link to actors

---

## ✅ Phase 2 Success Criteria

- [ ] 300–500 actors onboarded
- [ ] 1–2 agency relationships
- [ ] Licensing flow functional
- [ ] First 10,000–100,000 minutes generated

---

# 🌐 PHASE 3 (Days 61–90)
## Usage + Revenue Signals

### 🎯 Goal:
Prove real-world demand

---

## 🔹 Step 13 — First Customers

### Objective:
Get real usage

### Targets:

- Indie filmmakers
- Small studios
- AI builders

### Tasks:

- [ ] Outreach campaigns
- [ ] Offer early access
- [ ] Support manually if needed

---

## 🔹 Step 14 — Close First Deals

### Objective:
Validate monetisation

### Tasks:

- [ ] Charge for usage (even small)
- [ ] Process payments manually if needed
- [ ] Record transactions

---

## 🔹 Step 15 — Improve Core Flows

### Objective:
Stabilise system

### Tasks:

- [ ] Fix bugs
- [ ] Improve API reliability
- [ ] Improve dashboard usability

---

## 🔹 Step 16 — Basic Analytics

### Objective:
Track growth

### Metrics:

- Actors onboarded
- Licensing requests
- Minutes generated
- Revenue

---

## ✅ Phase 3 Success Criteria

- [ ] 500+ actors onboarded
- [ ] 3+ agency relationships
- [ ] 10+ paying customers
- [ ] 100,000+ licensed minutes
- [ ] Clear product-market signal

---

# 📊 Weekly Tracking Metrics

Track every week:

- [ ] Actors onboarded
- [ ] Agencies contacted
- [ ] Licensing requests
- [ ] Minutes generated
- [ ] Revenue

---

# ⚠️ Non-Goals (Do NOT Build Yet)

- AI avatar generation tools
- Advanced UI/UX design
- Marketplace browsing
- Complex Stripe billing
- Real-time systems

---

# 🧠 Final Reminder

The goal is NOT to build a perfect product.

The goal is:

> **To prove that human digital identity can be registered, controlled, and licensed in AI — and that people will use it.**