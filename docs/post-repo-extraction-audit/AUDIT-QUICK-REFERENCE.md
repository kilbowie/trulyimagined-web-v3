# Post-Extraction Audit: Quick Reference

**Status**: Repos extracted and separated ✅  
**Next**: Run comprehensive audit before Phase 6 deployment

---

## One-Minute Summary

You now have a complete audit prompt that checks:

| Area | What's Checked | Passes? |
|------|---|---|
| **TI Repo** | Structure, build, types, integration, tests | ✅? |
| **HDICR Repo** | Structure, build, types, Lambda, SAM, tests | ✅? |
| **Integration** | Contract gates, URL consistency, no cross-repo imports | ✅? |
| **Issues** | Critical, high priority, medium priority | Identified |
| **Fixes** | Specific remediation for each issue | Provided |

---

## How to Use

### Step 1: Copy Prompt (30 seconds)
```
File: COPILOT-POST-EXTRACTION-AUDIT-PROMPT.md
Action: Select all → Copy
```

### Step 2: Open Copilot (30 seconds)
```
1. Open VS Code
2. Cmd+Shift+I (Mac) or Ctrl+Shift+I (Windows)
3. GitHub Copilot Chat opens
```

### Step 3: Paste & Run (2 minutes)
```
1. Paste prompt into chat
2. Answer Copilot's questions:
   - "Audit both TI and HDICR repos"
   - Provide repo paths or confirm GitHub URLs
   - Flag any known issues
3. Copilot runs audit
```

### Step 4: Review Results (5-10 minutes)
```
Copilot provides:
- ✅ Passing checks
- 🔴 Critical issues (MUST fix)
- 🟠 High priority issues (SHOULD fix)
- 🟡 Medium priority issues (CAN fix later)
- 📋 Exact fixes for each issue
```

### Step 5: Apply Fixes (5-60 minutes depending on issues)
```
For each issue:
- Read fix description
- Apply code changes
- Run verification command
- Mark as complete
```

### Step 6: Ready for Phase 6
```
When all critical + high priority issues fixed:
→ Proceed to Phase 6 (Deployment)
```

---

## What Gets Audited

### TI Repository
- ✅ File structure (apps/web, shared/*)
- ✅ Dependencies & lockfile
- ✅ TypeScript build (`pnpm build`)
- ✅ HDICR integration layer
- ✅ Contract gate test (OpenAPI validation)
- ✅ Environment variables
- ✅ Git status
- ✅ No HDICR service imports

### HDICR Repository
- ✅ File structure (services/*, shared/*, infra/)
- ✅ Dependencies & lockfile
- ✅ TypeScript build (`pnpm build`)
- ✅ OpenAPI specifications (all 4 services)
- ✅ Database setup (Prisma)
- ✅ Lambda handlers
- ✅ Auth integration (Auth0)
- ✅ SAM template validity
- ✅ Environment variables
- ✅ Git status
- ✅ No TI web app imports

### Cross-Repo
- ✅ OpenAPI contract alignment
- ✅ URL consistency (Auth0 audience, domains)
- ✅ No cross-repo imports
- ✅ Database separation
- ✅ HTTP communication protocol

---

## Issue Categories

### 🔴 Critical (MUST FIX)
- Missing OpenAPI specs
- Contract gate test fails
- URL drift (audience/domain mismatch)
- Cross-repo imports detected
- SAM template invalid

**Fix time**: 5-30 minutes  
**Can proceed to Phase 6**: NO (must fix)

### 🟠 High Priority (SHOULD FIX)
- Build or type-check fails
- Test suite fails
- Missing env var documentation
- Database connection string wrong

**Fix time**: 5-20 minutes  
**Can proceed to Phase 6**: NO (should fix)

### 🟡 Medium Priority (CAN FIX)
- Missing README.md
- Messy git history
- Incomplete comments

**Fix time**: 5-15 minutes  
**Can proceed to Phase 6**: YES (but better with these fixed)

---

## Audit Commands (Manual Option)

If you want to run some checks yourself before Copilot:

```bash
# TI Repo
cd /path/to/trulyimagined
pnpm install --no-frozen-lockfile && pnpm build && pnpm type-check
pnpm --filter web test -- src/lib/hdicr/openapi-contract-gate.contract.test.ts
git status

# HDICR Repo
cd /path/to/hdicr
pnpm install --no-frozen-lockfile && pnpm build && pnpm type-check
sam validate -t infra/template.yaml
ls -la services/*/openapi.yaml
git status
```

If all pass: ✅ Green light  
If any fail: 🔴 Identify and fix

---

## Expected Outcomes

### Best Case ✅
```
All checks pass
→ No critical issues
→ No high priority issues
→ Ready for Phase 6
Time saved: Phase 6 runs smoothly
```

### Normal Case 🟠
```
1-3 high priority issues found
→ Fix time: 15-45 minutes
→ Re-test
→ Ready for Phase 6
Time added: ~1 hour
```

### Worst Case 🔴
```
Critical issues found
→ Fix time: 30-120 minutes
→ Multiple re-tests
→ Review with Copilot
→ Ready for Phase 6
Time added: ~2-3 hours
```

---

## Timeline

```
Audit run:           5 minutes
Review results:      5-10 minutes
Apply fixes:         5-60 minutes (depends on issues)
Re-test:             5-10 minutes
Final verification:  5 minutes
───────────────────────────────
Total:               25 minutes to 2+ hours
```

**Conservative estimate**: 1 hour (audit + fixes + re-test)

---

## Pre-Phase 6 Go/No-Go Decision

**GO conditions:**
- ✅ All critical issues fixed
- ✅ All high priority issues fixed
- ✅ Both repos build cleanly
- ✅ Contract gate passes
- ✅ SAM template validates
- ✅ No URL drift

**NO-GO conditions:**
- 🔴 Any critical issue unfixed
- 🟠 Multiple high priority issues unfixed
- 🔴 Build/type-check failures remain
- 🔴 Contract gate still failing

If you're in GO condition → Proceed to Phase 6  
If you're in NO-GO condition → Fix and re-run audit

---

## Quick Decision Tree

```
Does TI build?
  ├─ YES → Next check
  └─ NO → Fix build issues first

Does HDICR build?
  ├─ YES → Next check
  └─ NO → Fix build issues first

Does contract gate pass?
  ├─ YES → Next check
  └─ NO → Sync OpenAPI specs

Does SAM template validate?
  ├─ YES → Next check
  └─ NO → Fix template YAML

Are URLs consistent?
  ├─ YES → Next check
  └─ NO → Fix domain/audience drift

Are there cross-repo imports?
  ├─ NO → All green ✅
  └─ YES → Remove them

Result: Ready for Phase 6 ✅
```

---

## What Comes Next

### If Audit Passes ✅
→ Proceed directly to Phase 6 (SAM deploy, Vercel deploy, testing)

### If Issues Found 🔴
→ Apply fixes provided by Copilot  
→ Re-run audit (can use same prompt again)  
→ When all critical/high priority fixed → Phase 6

---

## Final Checklist Before Pasting Prompt

- [ ] Both repos are cloned locally
- [ ] You're ready to spend 25 minutes to 2 hours (depending on issues)
- [ ] You have access to both repo file systems
- [ ] You can modify and commit code if needed
- [ ] You have VS Code open with Copilot Chat ready

**Ready?** → Paste the audit prompt into Copilot Chat

---

**This audit is your final safety check before Phase 6 deployment. It will identify any issues and provide fixes. Run it now.** 🚀
