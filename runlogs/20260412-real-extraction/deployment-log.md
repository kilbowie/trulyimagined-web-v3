# Phase 6 Deployment Log — HDICR SAM Production Deploy

**Date**: 2026-04-12  
**Stack**: `hdicr-production` (eu-west-1)  
**Status**: COMPLETE ✅

---

## Stack Details

| Resource                          | Value                                                          |
| --------------------------------- | -------------------------------------------------------------- |
| CloudFormation stack              | `hdicr-production`                                             |
| AWS Region                        | `eu-west-1`                                                    |
| API Gateway endpoint              | `https://yo0ruku52c.execute-api.eu-west-1.amazonaws.com/prod/` |
| Custom domain                     | `hdicr.trulyimagined.com`                                      |
| API Gateway regional CNAME target | `d-cs6923lsw2.execute-api.eu-west-1.amazonaws.com`             |
| HDICR GitHub commit               | `875cd50` (branch: `extract/hdicr-split-20260412`)             |

---

## Issues Resolved During Deploy

### Bug 1 — Template: Invalid DependsOn reference

- `HDICRBasePathMapping.DependsOn` referenced `HDICRApiStage` (non-existent)
- Fixed: used correct SAM-generated logical ID `HDICRApiprodStage`

### Bug 2 — Template: Reserved Lambda env var

- `AWS_REGION: !Ref AWS::Region` in Globals is a Lambda-reserved key
- Fixed: removed from template

### Bug 3 — Template: Base path mapping created before stage ready

- Fixed: added `DependsOn: [HDICRApiprodStage, HDICRCustomDomain]`

### Bug 4 — Runtime: Workspace packages not bundled

- Lambda artifacts were plain `tsc` output; `@trulyimagined/database`, `@trulyimagined/middleware`, etc. not present at runtime
- Fixed: added `scripts/bundle-lambdas.mjs` (esbuild, resolves workspace path aliases into self-contained `dist/index.js`)

### Bug 5 — Template: Wrong env var name for database URL

- Template set `HDICR_DATABASE_URL` but `DatabaseClient` reads `DATABASE_URL`
- Fixed: renamed to `DATABASE_URL` in all 4 function definitions

### Bug 6 — Runtime: WebCrypto `this` binding error

- `getOrCreateCorrelationId()` in `shared/middleware` detached `crypto.randomUUID` from its context
- Fixed: call as `cryptoObj.randomUUID()` keeping `this` bound

---

## Endpoint Health Check Results

| Service        | Path                                              | Status                  |
| -------------- | ------------------------------------------------- | ----------------------- |
| Identity       | `GET /v1/identity/actors/exists?auth0UserId=test` | **401 Unauthorized** ✅ |
| Consent        | `GET /v1/consent/test`                            | **401 Unauthorized** ✅ |
| Licensing      | `GET /v1/license/test`                            | **401 Unauthorized** ✅ |
| Representation | `GET /v1/representation/test`                     | **401 Unauthorized** ✅ |

---

## DNS Status

- CNAME required: `hdicr.trulyimagined.com` → `d-cs6923lsw2.execute-api.eu-west-1.amazonaws.com`
- DNS-only (not proxied) in Cloudflare
- Status: Pending Cloudflare CNAME creation

---

## Next Steps

- [ ] Phase 6.2: TI Vercel deployment (merge `extract/ti-split-20260412` → main)
- [ ] Configure Vercel environment variables for TI
- [ ] Verify `hdicr.trulyimagined.com` DNS resolves once CNAME added
- [ ] End-to-end auth flow test with real Auth0 JWT
