# Consent Ledger - Testing Guide

## Step 6: Consent Ledger (COMPLETE)

### Overview

The consent ledger is now fully implemented as an immutable, append-only audit trail for actor consent management. This system enables cryptographic proof of consent for external consumers and ensures compliance with UK Trust Framework and eIDAS standards.

---

## Architecture

### Backend Components (Lambda)

- **Location**: `services/consent-service/`
- **Handlers**:
  - `grant-consent.ts` - Record consent grants
  - `revoke-consent.ts` - Record consent revocations
  - `check-consent.ts` - Verify active consent status
  - `list-consents.ts` - Retrieve consent history
- **Database**: `consent_log` table (append-only, immutable)

### API Routes (Next.js)

- **Location**: `apps/web/src/app/api/consent/`
- **Endpoints**:
  - `POST /api/consent/grant` - Grant new consent
  - `POST /api/consent/revoke` - Revoke existing consent
  - `GET /api/consent/check` - Check consent status
  - `GET /api/consent/[actorId]` - List all consents for actor

### Frontend UI

- **Location**: `apps/web/src/app/dashboard/consents/`
- **Features**:
  - View active, revoked, and expired consents
  - Summary cards (counts for each status)
  - Revoke consent button
  - Consent scope details (project, territories, usage types, duration)

### Middleware (Enforcement)

- **Location**: `shared/middleware/src/index.ts`
- **Functions**:
  - `requireConsent(actorId, consentType, projectId?)` - Enforce consent (throws if not granted)
  - `hasConsent(actorId, consentType, projectId?)` - Check consent (returns boolean)

---

## Testing Workflow

### 1. Grant Consent (API Test)

```bash
curl -X POST http://localhost:3000/api/consent/grant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH0_TOKEN" \
  -d '{
    "actorId": "actor-uuid-123",
    "consentType": "voice_synthesis",
    "scope": {
      "projectName": "AI Voice Project Alpha",
      "projectId": "project-456",
      "duration": {
        "startDate": "2026-03-23",
        "endDate": "2027-03-23"
      },
      "usageTypes": ["advertising", "promotional"],
      "territories": ["UK", "US"],
      "exclusions": ["political", "adult-content"]
    }
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Consent granted and logged to immutable ledger",
  "consent": {
    "consentId": "consent-789",
    "actorId": "actor-uuid-123",
    "action": "granted",
    "consentType": "voice_synthesis",
    "scope": { ... },
    "grantedAt": "2026-03-23T15:30:00.000Z"
  }
}
```

---

### 2. Check Consent Status (API Test)

```bash
curl -X GET "http://localhost:3000/api/consent/check?actorId=actor-uuid-123&consentType=voice_synthesis&projectId=project-456"
```

**Expected Response (Active Consent):**

```json
{
  "isGranted": true,
  "consent": {
    "consentId": "consent-789",
    "actorId": "actor-uuid-123",
    "consentType": "voice_synthesis",
    "scope": { ... },
    "grantedAt": "2026-03-23T15:30:00.000Z",
    "expiresAt": "2027-03-23",
    "isExpired": false
  },
  "latestAction": {
    "action": "granted",
    "timestamp": "2026-03-23T15:30:00.000Z",
    "reason": null
  }
}
```

**Expected Response (No Consent):**

```json
{
  "isGranted": false,
  "message": "No consent record found for this actor and consent type",
  "actorId": "actor-uuid-123",
  "consentType": "voice_synthesis",
  "projectId": "project-456"
}
```

---

### 3. List Consents (API Test)

```bash
curl -X GET "http://localhost:3000/api/consent/actor-uuid-123?limit=100&offset=0" \
  -H "Authorization: Bearer YOUR_AUTH0_TOKEN"
```

**Expected Response:**

```json
{
  "actorId": "actor-uuid-123",
  "summary": {
    "active": 2,
    "revoked": 1,
    "expired": 0,
    "totalRecords": 5
  },
  "consents": {
    "active": [ ... ],
    "revoked": [ ... ],
    "expired": [ ... ]
  },
  "fullHistory": [ ... ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 5,
    "hasMore": false
  }
}
```

---

### 4. Revoke Consent (API Test)

```bash
curl -X POST http://localhost:3000/api/consent/revoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH0_TOKEN" \
  -d '{
    "actorId": "actor-uuid-123",
    "consentId": "consent-789",
    "reason": "Actor requested revocation via dashboard"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Consent revoked and logged to immutable ledger",
  "revocation": {
    "revocationId": "consent-790",
    "actorId": "actor-uuid-123",
    "action": "revoked",
    "consentType": "voice_synthesis",
    "revokedAt": "2026-03-23T16:00:00.000Z",
    "reason": "Actor requested revocation via dashboard"
  }
}
```

---

### 5. Frontend UI Test

1. **Navigate to Consent Dashboard**:
   - URL: `http://localhost:3000/dashboard/consents`
   - Requires Auth0 authentication

2. **Verify UI Elements**:
   - ✅ Summary cards (Active, Revoked, Expired, Total)
   - ✅ Three sections: Active Consents, Revoked Consents, Expired Consents
   - ✅ Each consent shows: type, project name, usage types, territories, expiry date
   - ✅ "Revoke" button on active consents

3. **Test Revoke Flow**:
   - Click "Revoke" button on an active consent
   - Confirm revocation in dialog
   - Verify consent moves from "Active" to "Revoked" section

---

### 6. Middleware Enforcement Test

Create a test Lambda function that uses the consent enforcement middleware:

```typescript
import { requireConsent } from '@trulyimagined/middleware';

export async function testHandler(event: any) {
  const { actorId, projectId } = JSON.parse(event.body);

  try {
    // This will throw if consent is not granted
    await requireConsent(actorId, 'voice_synthesis', projectId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Consent verified - proceeding with voice generation',
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Consent required',
        message: error.message,
      }),
    };
  }
}
```

**Test Cases**:

1. Call with valid consent → Expect 200 OK
2. Call with revoked consent → Expect 403 Forbidden
3. Call with expired consent → Expect 403 Forbidden
4. Call with no consent → Expect 403 Forbidden

---

### 7. Database Verification (PostgreSQL)

```sql
-- View all consents for an actor
SELECT * FROM consent_log
WHERE actor_id = 'actor-uuid-123'
ORDER BY created_at DESC;

-- Count consents by action
SELECT action, COUNT(*)
FROM consent_log
WHERE actor_id = 'actor-uuid-123'
GROUP BY action;

-- Find most recent consent per type
SELECT DISTINCT ON (consent_type)
  consent_type, action, created_at
FROM consent_log
WHERE actor_id = 'actor-uuid-123'
ORDER BY consent_type, created_at DESC;
```

---

## Acceptance Criteria (Step 6)

✅ **Backend Consent Handlers**

- [x] Grant consent handler with validation
- [x] Revoke consent handler (append-only, no deletions)
- [x] Check consent handler with expiry logic
- [x] List consents handler with pagination

✅ **API Routes**

- [x] POST /api/consent/grant
- [x] POST /api/consent/revoke
- [x] GET /api/consent/check
- [x] GET /api/consent/[actorId]

✅ **Frontend UI**

- [x] Consent dashboard page
- [x] Display active, revoked, and expired consents
- [x] Summary cards
- [x] Revoke consent button
- [x] Consent scope details

✅ **Middleware**

- [x] requireConsent() function
- [x] hasConsent() function
- [x] Example usage documentation

✅ **Database**

- [x] Immutable consent_log table (already deployed)
- [x] Append-only design (no UPDATE/DELETE)

---

## Next Steps (Step 7)

Once testing is complete, proceed to:

- **Step 7**: Multi-Provider Identity Linking
- **Step 8**: Onfido KYC Integration

---

## Environment Variables Required

```env
# Lambda consent service URL
CONSENT_SERVICE_URL=https://api-gateway-url/consent

# Database connection (already configured)
DATABASE_URL=postgresql://...

# Auth0 credentials (already configured)
AUTH0_DOMAIN=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
```

---

## Compliance Notes

- **Immutable Ledger**: All consent actions are permanently recorded and cannot be modified or deleted
- **Audit Trail**: Full history of grants, revocations, and expirations
- **Cryptographic Proof**: Future enhancement will add JWT-signed consent proofs for external verification
- **UK Trust Framework**: Consent model aligns with UK digital identity standards
- **eIDAS**: Supports cross-border consent recognition within EU

---

## Known Limitations & Future Enhancements

1. **Cryptographic Proofs** (Step 12): Add JWT-signed consent tokens for external verification
2. **Webhook Notifications**: Notify external systems when consent is revoked
3. **Bulk Revocation**: UI to revoke all consents at once
4. **Consent Templates**: Pre-defined consent types for common use cases
5. **Analytics Dashboard**: Visualize consent trends over time
