# Truly Imagined MVP: Sprint Planning & Implementation Documentation

This directory contains the complete sprint planning, architecture, and implementation guides for the Truly Imagined + HDICR MVP.

---

## 📋 Document Index

### 1. **CODEBASE_ALIGNMENT_AND_GAPS.md** ← **START HERE**
   - **What:** Alignment between planned sprints and your current codebase
   - **Why:** Confirms what's built, identifies gaps, sets execution priorities
   - **For whom:** Founder, team leads, contractors
   - **Read time:** 15 min
   - **Key sections:**
     - ✅ What's ready (Sprints 1–2 are 70–90% complete)
     - ❌ What's missing (Sprints 3–6 not started, critical path identified)
     - 📊 Recommended execution order
     - 🎯 Database schema additions needed

### 2. **sprint-breakdown-stories-acceptance.md**
   - **What:** Granular user stories with acceptance criteria for all 6 sprints
   - **Why:** Detailed specs for implementing each feature; acceptance criteria for QA
   - **For whom:** Developers, QA testers, product managers
   - **Read time:** 45 min (skim) or 2 hours (detailed)
   - **Key sections:**
     - Sprint 1–6 story breakdowns (42 stories total)
     - Acceptance criteria (checkbox format)
     - Story point estimates
     - Dependencies & prioritization
     - Definition of "Done"

### 3. **stripe-payment-architecture.md**
   - **What:** Complete Stripe payment architecture (payment processing + payout splits)
   - **Why:** Payment processing is revenue-critical and PCI-DSS sensitive
   - **For whom:** Backend developers, DevOps, security reviewers
   - **Read time:** 30 min (overview) or 60 min (detailed)
   - **Key sections:**
     - Three-way payment split logic (actor → agent → TI)
     - PCI-DSS compliance strategy (zero payment data on TI servers)
     - Webhook handlers & retry logic
     - Database schema for payouts & audit trail
     - Refund & dispute handling
     - Go-live checklist

### 4. **COPILOT_IMPLEMENTATION_GUIDE.md**
   - **What:** Code patterns and Copilot prompts for implementing stories
   - **Why:** Ensures consistency as features are built (solo founder or contractor)
   - **For whom:** Developers using VS Code Copilot
   - **Read time:** 30 min
   - **Key sections:**
     - Story prompt template (copy & customize)
     - Code patterns (auth, database, API, audit, error handling)
     - Story-specific prompts (e.g., Story 3.1, 6.4)
     - Common pitfalls & how to avoid them
     - Testing & deployment checklists
     - Security checklist (payment-specific)

---

## 🚀 How to Use This Documentation

### For Solo Founder Building Features

1. **Pick your next sprint** from CODEBASE_ALIGNMENT_AND_GAPS.md (Section 6: Recommended Execution Order)
2. **Read the stories** for that sprint in sprint-breakdown-stories-acceptance.md
3. **Copy the story prompt** from COPILOT_IMPLEMENTATION_GUIDE.md (Section 3)
4. **Paste into VS Code Copilot Chat** (Cmd/Ctrl + Shift + I)
5. **Follow code patterns** from COPILOT_IMPLEMENTATION_GUIDE.md (Section 2)
6. **Check off acceptance criteria** from sprint-breakdown-stories-acceptance.md
7. **Run the alignment checklist** from CODEBASE_ALIGNMENT_AND_GAPS.md (Section 9)

### For Contractors / Team Members Joining

1. **Read CODEBASE_ALIGNMENT_AND_GAPS.md first** (understand current state)
2. **Review critical path** (Section 6) to know what's blocking launch
3. **Pick assigned stories** from sprint-breakdown-stories-acceptance.md
4. **Reference COPILOT_IMPLEMENTATION_GUIDE.md** for code patterns
5. **Slack/email us** if you find inconsistencies or blockers

### For QA / Testing

1. **Reference sprint-breakdown-stories-acceptance.md** for acceptance criteria
2. **Use the checkbox format** to verify each criterion is met
3. **Check COPILOT_IMPLEMENTATION_GUIDE.md** (Section 4: Testing Checklist) before sign-off
4. **Run payment tests** if feature involves payments (see stripe-payment-architecture.md, Testing & Validation section)

### For Security Review

1. **Read stripe-payment-architecture.md** (PCI-DSS compliance section)
2. **Review COPILOT_IMPLEMENTATION_GUIDE.md** (Section 7: Security Checklist)
3. **Verify RDS encryption** (CODEBASE_ALIGNMENT_AND_GAPS.md, Section 2.5)
4. **Check for audit logging** on sensitive actions (consent, payments, representation changes)

---

## 📊 Status at a Glance

| Sprint | Theme | Status | When to Start |
|--------|-------|--------|---------------|
| 1 | Identity & Consent | 🟢 90% done (key gaps now partially delivered) | Continue Sprint 1 completion |
| 2 | Agents & Representation | 🟢 70% done | Fill gaps this week |
| 3 | Deal Negotiation | 🔴 0% — NOT STARTED | Week 3 (CRITICAL PATH) |
| 4 | Licenses & Usage | 🟡 50% (HDICR query done) | Week 5 (depends on Sprint 3) |
| 5 | Arbitration | 🔴 10% (consent revoke done) | Week 7 (parallel with 6) |
| 6 | Payments & Compliance | 🔴 5% (Stripe SDK only) | Week 5 (CRITICAL PATH) |

**Critical Path:** Sprints 3 + 6 are blocking launch. Start them ASAP.

---

## 🎯 Next Steps (This Week)

### Immediate (Days 1–2)
- [ ] Read CODEBASE_ALIGNMENT_AND_GAPS.md (sections 1–3)
- [ ] Confirm Sprint 1–2 gaps are acceptable
- [ ] Decide: solo builder or hire contractor?

### Short-term (Days 3–7)
- [ ] Complete Sprint 1–2 gaps:
  - [x] Story 1.3 (partial): Manual verification admin APIs/dashboard delivered
  - [x] Story 1.8 (partial): Actor onboarding checklist API/UI delivered
  - [ ] Story 1.3 remaining: manual-request endpoint + calendar invite + failed-flow retry link
  - [ ] Story 1.8 remaining: full multi-step onboarding page and draft persistence
  - [ ] Story 2.2: Invitation code generation
  - [ ] Story 2.7: Termination workflow
- [ ] Start Sprint 3 (deal templates):
  - Story 3.1: Deal template table + seeders

### Guardrails Track (Pre-Sprint 3)
- [x] Delivered adapted guardrails migrations 020/021/022.
- [x] Delivered split DB pools and explicit HDICR query wiring for new Sprint 1 paths.
- [ ] Run staging migration apply + smoke checks (blocked locally until DATABASE_URL is configured for migration runner).

### Medium-term (Weeks 2–4)
- [ ] Finish Sprint 3 (deal negotiation UI)
- [ ] Start Sprint 6 early (payment processing):
  - Story 6.9: RDS encryption (MUST DO FIRST)
  - Story 6.1: Stripe setup

---

## 💡 Key Insights from Alignment Review

### What's Working Well ✅

- **Identity verification:** Stripe integration is production-ready
- **Consent ledger:** Immutable, versioned, audit-ready
- **Multi-tenancy:** Implemented correctly across schema + queries
- **Agent representation:** Core workflows exist, just missing invitation codes
- **HDICR query logic:** Enforcement handler (353 lines) is solid

### What Needs Building 🔴

- **Deal negotiation:** Complete feature set missing (no templates, no approval flow)
- **Payment processing:** Stripe SDK exists, but no payment intents, webhooks, or payout logic
- **Arbitration:** No dispute resolution when consent revocation affects deals
- **Compliance:** No GDPR deletion, no RDS encryption

### Critical Blockers 🚨

1. **RDS is not encrypted** → Must fix before payment processing
2. **No deal templates or negotiation UI** → Blocks entire commercial layer
3. **No payout split logic** → Blocks revenue

---

## 📚 How to Add This to Your Codebase

### Option A: Copy to Repo Root

```bash
cp /path/to/CODEBASE_ALIGNMENT_AND_GAPS.md /your/repo/docs/
cp /path/to/sprint-breakdown-stories-acceptance.md /your/repo/docs/
cp /path/to/stripe-payment-architecture.md /your/repo/docs/
cp /path/to/COPILOT_IMPLEMENTATION_GUIDE.md /your/repo/docs/
```

Then update your **root README.md** to link these:

```markdown
## Development

- **[Sprint Breakdown & Acceptance Criteria](./docs/sprint-breakdown-stories-acceptance.md)** — Story details for all 6 sprints
- **[Codebase Alignment & Gaps](./docs/CODEBASE_ALIGNMENT_AND_GAPS.md)** — What's built, what's missing, what's priority
- **[Payment Architecture](./docs/stripe-payment-architecture.md)** — Stripe integration, PCI-DSS compliance, payout splits
- **[Copilot Implementation Guide](./docs/COPILOT_IMPLEMENTATION_GUIDE.md)** — Code patterns, story prompts, testing checklists
```

### Option B: Link in VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "codex.documentationPaths": [
    "./docs/CODEBASE_ALIGNMENT_AND_GAPS.md",
    "./docs/sprint-breakdown-stories-acceptance.md",
    "./docs/stripe-payment-architecture.md",
    "./docs/COPILOT_IMPLEMENTATION_GUIDE.md"
  ]
}
```

### Option C: Embed in Copilot Context

When using Copilot, prefix your prompt with:

```
Context: I'm working on the Truly Imagined MVP (see docs/CODEBASE_ALIGNMENT_AND_GAPS.md and docs/sprint-breakdown-stories-acceptance.md for full project scope).

Story: [paste story number and criteria]

[rest of prompt]
```

---

## ❓ FAQ

**Q: Should I implement all stories in order?**  
A: No. Follow the critical path in CODEBASE_ALIGNMENT_AND_GAPS.md (Section 6). Deal negotiation (Sprint 3) and payment processing (Sprint 6) are blocking.

**Q: What if my codebase doesn't match the patterns in COPILOT_IMPLEMENTATION_GUIDE.md?**  
A: That's fine! Use the patterns as *examples*, not gospel. The key is consistency within your own codebase. Just ensure:
- Auth checks on every endpoint
- Audit logging on sensitive actions
- Multi-tenant awareness in all queries
- No payment data storage on TI servers

**Q: Can I implement Sprints out of order?**  
A: Yes, but be aware of dependencies:
- Sprint 3 (deals) must finish before Sprint 4 (licenses)
- Sprint 6 (payments) is independent but critical for revenue
- Sprint 5 (arbitration) is lower priority but needed for full compliance

**Q: What if I hire a contractor?**  
A: Send them:
1. CODEBASE_ALIGNMENT_AND_GAPS.md (for context + priorities)
2. sprint-breakdown-stories-acceptance.md (for detailed specs)
3. COPILOT_IMPLEMENTATION_GUIDE.md (for code patterns)
4. Your actual codebase (GitHub repo link)

Then assign specific stories + have them work through the story prompts in COPILOT_IMPLEMENTATION_GUIDE.md.

**Q: How do I know when a story is done?**  
A: Check the alignment checklist in CODEBASE_ALIGNMENT_AND_GAPS.md (Section 9). Also run the testing checklist in COPILOT_IMPLEMENTATION_GUIDE.md (Section 4).

**Q: What's the timeline for MVP?**  
A: If you work solo + 20–25 story points/week:
- Weeks 1–2: Sprint 1–2 (clean up gaps)
- Weeks 3–4: Sprint 3 (deal negotiation — CRITICAL)
- Weeks 5–6: Sprint 6 (payments — CRITICAL) + Sprint 4
- Weeks 7–8: Sprint 5 (arbitration) + polish
- **Total: 13–16 weeks** from now

---

## 📞 When to Seek Help

### Red Flags (Stop & Ask)

- Copilot generates code that doesn't include auth checks
- Payment-related code tries to store card/bank data on TI servers
- Database queries don't use multi-tenant pattern (queryWithTenant)
- No audit logging on sensitive actions
- Acceptance criteria aren't all met

### Green Flags (Good to Go)

- Code follows patterns from COPILOT_IMPLEMENTATION_GUIDE.md
- All acceptance criteria checked
- Audit logging present
- Error handling complete
- Tests written

---

## 🔄 Document Updates

These documents will evolve as:
- Sprints are completed (mark story ✅ in sprint-breakdown-stories-acceptance.md)
- New gaps are discovered (add to CODEBASE_ALIGNMENT_AND_GAPS.md)
- New patterns emerge (add to COPILOT_IMPLEMENTATION_GUIDE.md)
- Payment features are built (validate against stripe-payment-architecture.md)

**Last update:** April 10, 2026  
**Version:** 1.0 (MVP Sprint Planning)  
**Next review:** After Sprint 2 completion

---

## 🎉 You're Ready!

You now have:
- ✅ Complete sprint breakdown (42 stories with acceptance criteria)
- ✅ Codebase alignment (what's built, what's missing, priorities)
- ✅ Payment architecture (PCI-DSS compliant, fully detailed)
- ✅ Implementation guide (code patterns + Copilot prompts)

**Next action:** Pick your first story from CODEBASE_ALIGNMENT_AND_GAPS.md (Section 6), copy the prompt from COPILOT_IMPLEMENTATION_GUIDE.md, paste into VS Code Copilot, and start building.

Good luck! 🚀

---

**Questions?** Reference the specific document sections listed above. If you find gaps or inconsistencies, update this README with your learnings.
