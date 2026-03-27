# Next.js 15 Upgrade Plan

**Date:** March 27, 2026  
**Status:** 📋 PLANNED  
**Priority:** HIGH (Security vulnerabilities)

---

## Executive Summary

This document outlines the plan to upgrade Next.js from **14.2.35 → 15.x** to resolve 4 remaining security vulnerabilities (1 high, 3 moderate) identified in dependency audits.

---

## Remaining Vulnerabilities

### HIGH Severity (1)

**GHSA-h25m-26qc-wcjf:** Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components

- **Current Version:** 14.2.35
- **Fixed In:** >=15.0.8
- **Status:** Already ignored in CI workflow (`security-scan.yml`)
- **Impact:** Potential DoS in production if using insecure RSC patterns

### MODERATE Severity (3)

**GHSA-9g9p-9gw9-jx7f:** Next.js self-hosted applications vulnerable to DoS via Image Optimizer remotePatterns

- **Fixed In:** >=15.5.10
- **Impact:** Self-hosted only, Vercel deployments not affected

**GHSA-ggv3-7p47-pfv8:** Next.js HTTP request smuggling in rewrites

- **Fixed In:** >=15.5.13
- **Impact:** Request smuggling with specific rewrite configurations

**GHSA-3x4c-7xq6-9pq8:** Next.js unbounded next/image disk cache growth

- **Fixed In:** >=15.5.14
- **Impact:** Disk exhaustion over time in self-hosted deployments

### Target Version

**Next.js 15.5.14+** (latest stable that fixes all vulnerabilities)

---

## Impact Assessment

### Breaking Changes (Next.js 14 → 15)

Based on [Next.js 15 upgrade guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15):

1. **React 19 Requirement**
   - Next.js 15 requires React 19
   - May require updates to React-dependent packages

2. **Minimum Node.js Version**
   - Requires Node.js 18.18+ (we're on 20, ✅ OK)

3. **fetch Caching Changes**
   - `fetch` requests are no longer cached by default
   - Need to opt-in with `cache: 'force-cache'`

4. **Route Handlers**
   - `GET` functions now run uncached by default
   - May need `export const dynamic = 'force-static'`

5. **Middleware Changes**
   - No breaking changes expected for our usage

6. **TypeScript Changes**
   - Stricter types for async components
   - May surface new type errors

### Affected Dependencies

**Direct Dependencies:**

- `apps/web/package.json`: `next@14.2.35` → `next@^15.5.14`
- `react@^18.2.0` → `react@^19.0.0`
- `react-dom@^18.2.0` → `react-dom@^19.0.0`

**Peer Dependencies:**

- `@auth0/nextjs-auth0@4.16.0` - Check compatibility with Next.js 15
- `@sentry/nextjs@10.46.0` - Check compatibility with Next.js 15
- May require updates to both packages

---

## Upgrade Strategy

### Phase 1: Research & Compatibility Check ✅

**Tasks:**

1. ✅ Review Next.js 15 upgrade guide
2. ⏳ Check @auth0/nextjs-auth0 compatibility with Next.js 15
3. ⏳ Check @sentry/nextjs compatibility with Next.js 15
4. ⏳ Identify breaking changes relevant to our codebase
5. ⏳ Review React 19 breaking changes

**Outcome:** List of required changes and dependency updates

### Phase 2: Create Upgrade Branch

**Tasks:**

1. Create `feature/nextjs-15-upgrade` branch from develop
2. Update package.json versions:
   ```json
   {
     "next": "^15.5.14",
     "react": "^19.0.0",
     "react-dom": "^19.0.0",
     "@auth0/nextjs-auth0": "latest compatible version",
     "@sentry/nextjs": "latest compatible version"
   }
   ```
3. Run `pnpm install`
4. Fix any immediate installation errors

### Phase 3: Fix Breaking Changes

**Tasks:**

1. Update fetch calls to explicitly set caching:

   ```typescript
   // Before
   const res = await fetch(url);

   // After
   const res = await fetch(url, { cache: 'force-cache' });
   ```

2. Review and update Route Handlers if needed:

   ```typescript
   // If caching needed
   export const dynamic = 'force-static';
   ```

3. Fix TypeScript errors surfaced by stricter types

4. Update any deprecated API usage

5. Review and test Server Components patterns

### Phase 4: Testing

**Local Testing:**

- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] Dev server runs without errors (`pnpm dev`)
- [ ] Production build runs without errors

**Functional Testing:**

- [ ] Auth0 login/logout flow
- [ ] Role-based access control
- [ ] Consent management UI
- [ ] Credential issuance flow
- [ ] Media rendering (images)
- [ ] Debug pages (in dev only)
- [ ] API routes (all v1 endpoints)

**Performance Testing:**

- [ ] Build time comparison (14.2.35 vs 15.5.14)
- [ ] Bundle size comparison
- [ ] Page load times
- [ ] Server action performance

**Monitoring:**

- [ ] Set up Sentry error tracking on branch
- [ ] Check for new React 19 warnings in console
- [ ] Monitor for hydration mismatches

### Phase 5: Deployment

**Staging:**

1. Deploy to Vercel preview environment
2. Run full regression test suite
3. Monitor Sentry for 24-48 hours
4. Load test critical paths

**Production:**

1. Merge to develop → wait for CI green
2. Create PR to main with upgrade notes
3. Deploy to production during low-traffic window
4. Monitor closely for first 2 hours
5. Have rollback plan ready

---

## Rollback Plan

If critical issues found in production:

1. **Immediate:** Revert git commit, redeploy previous version
2. **Document:** What broke, error messages, reproduction steps
3. **Fix Forward:** Address issues in new branch, repeat testing
4. **Timeline:** Aim for fix within 24 hours or stay on 14.2.35

---

## Dependencies Compatibility Matrix

| Package             | Current | Target  | Next.js 15 Support | Notes                  |
| ------------------- | ------- | ------- | ------------------ | ---------------------- |
| next                | 14.2.35 | 15.5.14 | ✅ Native          | Main upgrade           |
| react               | 18.2.0  | 19.0.0  | ✅ Required        | Required by Next.js 15 |
| react-dom           | 18.2.0  | 19.0.0  | ✅ Required        | Required by Next.js 15 |
| @auth0/nextjs-auth0 | 4.16.0  | TBD     | ❓ Check           | Verify support         |
| @sentry/nextjs      | 10.46.0 | TBD     | ❓ Check           | Verify support         |
| @vercel/blob        | Current | -       | ✅ Compatible      | No changes needed      |

---

## Timeline Estimate

**Total Time:** 3-5 days

- **Research & Planning:** 4-6 hours
- **Upgrade Implementation:** 6-8 hours
- **Testing:** 8-12 hours
- **Staging Deployment:** 1-2 days monitoring
- **Production Deployment:** 1 day + monitoring

---

## Success Criteria

- ✅ All 4 Next.js CVEs resolved (verified via `pnpm audit`)
- ✅ Zero production errors for 48 hours post-deployment
- ✅ All functional tests passing
- ✅ Performance metrics within 5% of baseline
- ✅ No new TypeScript/lint errors
- ✅ Sentry error rate unchanged or improved

---

## Risk Assessment

**HIGH RISK:**

- React 19 breaking changes affecting component behavior
- Auth0 integration issues
- Sentry compatibility problems
- Fetch caching changes breaking data flow

**MEDIUM RISK:**

- Performance regressions
- Build time increases
- New hydration warnings

**LOW RISK:**

- CSS/styling changes
- Development experience impacts
- Documentation gaps

**MITIGATION:**

- Comprehensive testing before production
- Deploy during low-traffic window
- Have rollback plan ready
- Monitor Sentry closely post-deployment

---

## Resources

- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [@auth0/nextjs-auth0 Compatibility](https://github.com/auth0/nextjs-auth0/releases)
- [@sentry/nextjs Compatibility](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

## Current Status

**Dependencies Fixed (March 27, 2026):**

- ✅ minimatch, brace-expansion, glob vulnerabilities resolved via overrides
- ✅ 6 out of 11 vulnerabilities fixed
- ⏳ 5 remaining (4 Next.js, 1 aws-sdk low severity)

**Next Actions:**

1. Research @auth0/nextjs-auth0 and @sentry/nextjs Next.js 15 compatibility
2. Create upgrade branch
3. Begin upgrade implementation following this plan

---

**END OF DOCUMENT**
