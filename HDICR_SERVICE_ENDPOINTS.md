# HDICR Services HTTP Endpoints Summary

## Quick Reference: Service Base URLs

All services are AWS Lambda functions exposed via API Gateway and scoped to tenant.

- **Identity Service**: `/v1/identity/*`
- **Consent Service**: `/v1/consent/*`
- **Representation Service**: `/v1/representation/*`
- **Licensing Service**: `/v1/license/*`

---

## 1. Identity Service (`services/identity-service/src/index.ts`)

### Overview

Handles actor identity registration, profiles, and identity links management. Requires Auth0 token.

**Authorization Scopes:**

- GET operations: `hdicr:identity:read`
- POST/PUT operations: `hdicr:identity:write`

### Endpoints

#### Register New Actor

```
POST /v1/identity/register
Content-Type: application/json
```

**Request Body:**

```json
{
  "auth0UserId": "string",
  "email": "string (email)",
  "firstName": "string",
  "lastName": "string",
  "stageName": "string (optional)",
  "bio": "string (optional)",
  "location": "string (optional)"
}
```

**Response (201):**

```json
{
  "success": true,
  "actor": {
    "id": "uuid",
    "identitySubjectId": "uuid",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "stageName": "string",
    "displayName": "string",
    "verificationStatus": "string",
    "createdAt": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `INSERT INTO actors (auth0_user_id, email, ...)`

---

#### Get Actor by ID

```
GET /v1/identity/{id}
```

**Path Parameters:**

- `id`: Actor ID (UUID)

**Response (200):**

```json
{
  "actor": {
    "id": "uuid",
    "identitySubjectId": "uuid",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "stageName": "string",
    "displayName": "string",
    "bio": "string",
    "location": "string",
    "profileImageUrl": "string",
    "verificationStatus": "string",
    "isFoundingMember": "boolean",
    "registryId": "string",
    "createdAt": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `SELECT * FROM actors WHERE id = $1`
**Key Feature:** Single actor lookup by ID

---

#### List All Actors (Paginated)

```
GET /v1/identity?limit=50&offset=0
```

**Query Parameters:**

- `limit`: Integer (0-500, default: 50)
- `offset`: Integer (default: 0)

**Response (200):**

```json
{
  "actors": [
    {
      "id": "uuid",
      "identitySubjectId": "uuid",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "stageName": "string",
      "displayName": "string",
      "verificationStatus": "string",
      "isFoundingMember": "boolean",
      "registryId": "string",
      "createdAt": "timestamp"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": "number"
  }
}
```

**Use Case:** Replace SQL: `SELECT * FROM actors LIMIT $1 OFFSET $2`

---

#### Update Actor Profile

```
PUT /v1/identity/{id}
Content-Type: application/json
```

**Path Parameters:**

- `id`: Actor ID (UUID)

**Request Body:** (at least one field required)

```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "stageName": "string (optional)",
  "bio": "string (optional)",
  "location": "string (optional)",
  "profileImageUrl": "string (URL, optional)"
}
```

**Response (200):**

```json
{
  "success": true,
  "actor": {
    "id": "uuid",
    "identitySubjectId": "uuid",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "stageName": "string",
    "displayName": "string",
    "bio": "string",
    "location": "string",
    "profileImageUrl": "string",
    "updatedAt": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `UPDATE actors SET ... WHERE id = $1`

---

#### List Admin Users with Actors

```
GET /v1/identity/admin/users
```

**Response (200):**

```json
{
  "users": [
    {
      "user_profile_id": "uuid",
      "auth0_user_id": "string",
      "actor_ids": ["uuid"],
      ...
    }
  ],
  "total": "number"
}
```

**Use Case:** Administrative function to see all user-actor mappings

---

### Identity Links Operations

#### Get Identity Link by Provider

```
GET /v1/identity/link/by-provider?userProfileId=...&provider=...&providerUserId=...
```

**Query Parameters:**

- `userProfileId`: UUID (required)
- `provider`: String (required) - e.g., "auth0", "google", "government_id"
- `providerUserId`: String (required) - Provider's user ID

**Response (200):**

```json
{
  "link": {
    "id": "uuid",
    "user_profile_id": "uuid",
    "provider": "string",
    "provider_user_id": "string",
    "provider_type": "string",
    "verification_level": "string",
    "assurance_level": "string",
    "credential_data": "object",
    "is_active": "boolean",
    "expires_at": "timestamp",
    "last_verified_at": "timestamp",
    "created_at": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `SELECT * FROM identity_links WHERE user_profile_id = $1 AND provider = $2 AND provider_user_id = $3`
**Key Feature:** Multi-provider identity linking lookup

---

#### List Identity Links

```
GET /v1/identity/links?userProfileId=...&activeOnly=true
```

**Query Parameters:**

- `userProfileId`: UUID (required)
- `activeOnly`: Boolean string (default: "true") - Filter active links only

**Response (200):**

```json
{
  "links": [
    {
      "id": "uuid",
      "user_profile_id": "uuid",
      "provider": "string",
      "provider_user_id": "string",
      "provider_type": "string",
      "verification_level": "string",
      "assurance_level": "string",
      "credential_data": "object",
      "is_active": "boolean",
      "expires_at": "timestamp",
      "last_verified_at": "timestamp",
      "created_at": "timestamp"
    }
  ]
}
```

**Use Case:** Replace SQL: `SELECT * FROM identity_links WHERE user_profile_id = $1 AND (is_active = TRUE OR activeOnly = FALSE)`

---

#### Create Identity Link

```
POST /v1/identity/link/create
Content-Type: application/json
```

**Request Body:**

```json
{
  "userProfileId": "uuid",
  "provider": "string",
  "providerUserId": "string",
  "providerType": "string",
  "verificationLevel": "string (optional, default: 'low')",
  "assuranceLevel": "string (optional, default: 'low')",
  "credentialData": "object (optional)",
  "metadata": "object (optional)",
  "expiresAt": "timestamp (optional)"
}
```

**Response (201):**

```json
{
  "link": {
    /* full link object */
  },
  "id": "uuid"
}
```

**Use Case:** Replace SQL: `INSERT INTO identity_links (...)`

---

#### Reactivate Identity Link

```
POST /v1/identity/link/reactivate
Content-Type: application/json
```

**Request Body:**

```json
{
  "linkId": "uuid",
  "verificationLevel": "string (optional)",
  "assuranceLevel": "string (optional)",
  "credentialData": "object (optional)",
  "metadata": "object (optional)",
  "expiresAt": "timestamp (optional)"
}
```

**Response (201):**

```json
{
  "link": {
    /* full link object with is_active = true */
  }
}
```

**Use Case:** Re-enable a previously deactivated identity link

---

#### Unlink Identity by ID

```
POST /v1/identity/link/unlink-by-id
Content-Type: application/json
```

**Request Body:**

```json
{
  "linkId": "uuid",
  "userProfileId": "uuid"
}
```

**Response:** Success or error

**Use Case:** Deactivate an identity link by ID

---

#### Unlink Identity by Provider

```
POST /v1/identity/link/unlink-by-provider
Content-Type: application/json
```

**Request Body:**

```json
{
  "provider": "string",
  "userProfileId": "uuid"
}
```

**Response:** Success or error

**Use Case:** Deactivate all identity links for a provider

---

---

## 2. Consent Service (`services/consent-service/src/index.ts`)

### Overview

Append-only consent ledger. Tracks grant/revoke actions immutably. Requires Auth0 token.

**Authorization Scopes:**

- GET operations: `hdicr:consent:read`
- POST operations: `hdicr:consent:write`

### Endpoints

#### Check Consent Status

```
GET /v1/consent/check?actorId=...&consentType=...&projectId=...
```

**Query Parameters:**

- `actorId`: UUID (required)
- `consentType`: String (required) - e.g., "film_tv", "advertising", "ai_training"
- `projectId`: String (optional)

**Response (200):**

```json
{
  "isGranted": "boolean",
  "message": "string",
  "actorId": "uuid",
  "consentType": "string",
  "projectId": "string | null",
  "consentId": "uuid",
  "action": "granted | revoked",
  "scope": "object",
  "expiresAt": "timestamp | null"
}
```

**Use Case:** Replace SQL: `SELECT * FROM consent_log WHERE actor_id = $1 AND consent_type = $2 ORDER BY created_at DESC LIMIT 1`
**Key Feature:** Existence check + status verification

---

#### List All Consents for Actor

```
GET /v1/consent/list?actorId=...&limit=100&offset=0&action=granted
GET /v1/consent/{actorId}?limit=100&offset=0&action=granted
```

**Query Parameters:**

- `actorId`: UUID (required, can be path or query)
- `limit`: Integer (0-500, default: 100)
- `offset`: Integer (default: 0)
- `action`: String (optional) - "granted" or "revoked"

**Response (200):**

```json
{
  "activeConsents": [
    {
      "consentId": "uuid",
      "consentType": "string",
      "action": "granted",
      "scope": "object",
      "projectName": "string",
      "projectDescription": "string",
      "grantedAt": "timestamp",
      "expiresAt": "timestamp | null",
      "metadata": "object"
    }
  ],
  "revokedConsents": [
    /* same structure */
  ],
  "expiredConsents": [
    /* same structure */
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": "number"
  }
}
```

**Use Case:** Replace SQL: `SELECT * FROM consent_log WHERE actor_id = $1 ORDER BY created_at DESC`

---

#### Check Consent Enforcement

```
POST /v1/consent/enforcement/check
Content-Type: application/json
```

**Request Body:**

```json
{
  "actorId": "uuid",
  "requestedUsage": "film_tv | advertising | ai_training | synthetic_media | voice_replication",
  "apiClientId": "uuid",
  "metadata": "object (optional)",
  "ipAddress": "string (optional)",
  "userAgent": "string (optional)"
}
```

**Response (200):**

```json
{
  "httpStatus": 200,
  "decision": "allow | deny | conditional",
  "allowed": "boolean",
  "reason": "string (if denied)",
  "enforcementId": "uuid"
}
```

**Use Case:** Before-use consent policy enforcement (not just checking past consent)

---

#### Grant Consent

```
POST /v1/consent/grant
Content-Type: application/json
```

**Request Body:**

```json
{
  "actorId": "uuid",
  "consentType": "string",
  "scope": "object (with duration, restrictions, etc.)",
  "projectId": "string (optional)",
  "projectName": "string (optional)",
  "projectDescription": "string (optional)",
  "metadata": "object (optional)"
}
```

**Response (201):**

```json
{
  "success": true,
  "consentId": "uuid",
  "action": "granted",
  "actorId": "uuid",
  "consentType": "string",
  "grantedAt": "timestamp"
}
```

**Use Case:** Record new consent grant (immutable append)

---

#### Revoke Consent

```
POST /v1/consent/revoke
Content-Type: application/json
```

**Request Body:**

```json
{
  "actorId": "uuid",
  "consentType": "string",
  "projectId": "string (optional)",
  "reason": "string (optional)",
  "metadata": "object (optional)"
}
```

**Response (201):**

```json
{
  "success": true,
  "consentId": "uuid",
  "action": "revoked",
  "actorId": "uuid",
  "consentType": "string",
  "revokedAt": "timestamp"
}
```

**Use Case:** Record new consent revocation (immutable append)

---

---

## 3. Representation Service (`services/representation-service/src/index.ts`)

### Overview

Manages actor-agent representation relationships. Requires Auth0 token.

**Authorization Scopes:**

- GET operations: `hdicr:representation:read`
- POST operations: `hdicr:representation:write`

### Endpoints

#### Get Actor by Auth0 User ID

```
GET /v1/representation/actor?auth0UserId=...
```

**Query Parameters:**

- `auth0UserId`: String (required) - Auth0 subject ID

**Response (200):**

```json
{
  "actor": {
    "id": "uuid",
    "auth0_user_id": "string",
    "email": "string",
    "name": "string",
    "created_at": "timestamp"
  } | null
}
```

**Use Case:** Replace SQL: `SELECT * FROM actors WHERE auth0_user_id = $1`
**Key Feature:** Lookup actor by external Auth0 ID

---

#### Get Agent by Auth0 User ID

```
GET /v1/representation/agent?auth0UserId=...
```

**Query Parameters:**

- `auth0UserId`: String (required)

**Response (200):**

```json
{
  "agent": {
    "id": "uuid",
    "auth0_user_id": "string",
    "registry_id": "string",
    "agency_name": "string",
    "verification_status": "string",
    "profile_completed": "boolean"
  } | null
}
```

**Use Case:** Replace SQL: `SELECT * FROM agents WHERE auth0_user_id = $1 AND deleted_at IS NULL`

---

#### Get Agent by Registry ID

```
GET /v1/representation/agent-by-registry?registryId=...
```

**Query Parameters:**

- `registryId`: String (required)

**Response (200):**

```json
{
  "agent": {
    "id": "uuid",
    "auth0_user_id": "string",
    "registry_id": "string",
    "agency_name": "string",
    "verification_status": "string",
    "profile_completed": "boolean"
  } | null
}
```

**Use Case:** Replace SQL: `SELECT * FROM agents WHERE registry_id = $1 AND deleted_at IS NULL`

---

#### Get Active Representation for Actor

```
GET /v1/representation/active?actorId=...
```

**Query Parameters:**

- `actorId`: UUID (required)

**Response (200):**

```json
{
  "relationship": {
    "id": "uuid",
    "actor_id": "uuid",
    "agent_id": "uuid",
    "started_at": "timestamp",
    "registry_id": "string",
    "agency_name": "string",
    "verification_status": "string",
    "profile_image_url": "string",
    "location": "string",
    "website_url": "string"
  } | null
}
```

**Use Case:** Replace SQL: `SELECT ... FROM actor_agent_relationships WHERE actor_id = $1 AND ended_at IS NULL LIMIT 1`
**Key Feature:** Check if actor has active representation + get agent details

---

#### Check Pending Representation Request

```
GET /v1/representation/request/pending?actorId=...&agentId=...
```

**Query Parameters:**

- `actorId`: UUID (required)
- `agentId`: UUID (required)

**Response (200):**

```json
{
  "pending": "boolean"
}
```

**Use Case:** Replace SQL: `SELECT 1 FROM representation_requests WHERE actor_id = $1 AND agent_id = $2 AND status = 'pending'`
**Key Feature:** Existence check only

---

#### Create Representation Request

```
POST /v1/representation/request
Content-Type: application/json
```

**Request Body:**

```json
{
  "actorId": "uuid",
  "agentId": "uuid",
  "message": "string (optional)"
}
```

**Response (201):**

```json
{
  "request": {
    "id": "uuid",
    "actor_id": "uuid",
    "agent_id": "uuid",
    "message": "string",
    "status": "pending",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `INSERT INTO representation_requests (...)`

---

#### List Incoming Requests (for Agent)

```
GET /v1/representation/requests/incoming?agentId=...
```

**Query Parameters:**

- `agentId`: UUID (required)

**Response (200):**

```json
{
  "requests": [
    {
      "id": "uuid",
      "actor_id": "uuid",
      "agent_id": "uuid",
      "message": "string",
      "status": "pending | approved | rejected",
      "response_note": "string",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

**Use Case:** Replace SQL: `SELECT * FROM representation_requests WHERE agent_id = $1 ORDER BY created_at DESC`

---

#### List Outgoing Requests (from Actor)

```
GET /v1/representation/requests/outgoing?actorId=...
```

**Query Parameters:**

- `actorId`: UUID (required)

**Response (200):**

```json
{
  "requests": [
    /* same structure as incoming */
  ]
}
```

**Use Case:** Replace SQL: `SELECT * FROM representation_requests WHERE actor_id = $1 ORDER BY created_at DESC`

---

#### Get Representation Request by ID

```
GET /v1/representation/request?id=...
```

**Query Parameters:**

- `id`: UUID (required)

**Response (200):**

```json
{
  "request": {
    "id": "uuid",
    "actor_id": "uuid",
    "agent_id": "uuid",
    "message": "string",
    "status": "pending | approved | rejected | withdrawn",
    "response_note": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  } | null
}
```

**Use Case:** Replace SQL: `SELECT * FROM representation_requests WHERE id = $1`

---

#### Update Representation Request

```
POST /v1/representation/request/update
Content-Type: application/json
```

**Request Body:**

```json
{
  "requestId": "uuid",
  "action": "approve | reject | withdraw",
  "responseNote": "string (optional)"
}
```

**Response (200):**

```json
{
  "request": {
    "id": "uuid",
    "status": "approved | rejected | withdrawn",
    "response_note": "string",
    "updated_at": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `UPDATE representation_requests SET status = $1 WHERE id = $2`

---

#### Check Active Relationship

```
GET /v1/representation/relationship/active?actorId=...
```

**Query Parameters:**

- `actorId`: UUID (required)

**Response (200):**

```json
{
  "active": "boolean"
}
```

**Use Case:** Replace SQL: `SELECT 1 FROM actor_agent_relationships WHERE actor_id = $1 AND ended_at IS NULL`
**Key Feature:** Boolean existence check only

---

#### Create Relationship

```
POST /v1/representation/relationship
Content-Type: application/json
```

**Request Body:**

```json
{
  "actorId": "uuid",
  "agentId": "uuid",
  "representationRequestId": "uuid"
}
```

**Response (201):**

```json
{
  "success": true
}
```

**Use Case:** Replace SQL: `INSERT INTO actor_agent_relationships (...)`

---

#### Get Relationship by ID

```
GET /v1/representation/relationship?id=...
```

**Query Parameters:**

- `id`: UUID (required)

**Response (200):**

```json
{
  "relationship": {
    "id": "uuid",
    "actor_id": "uuid",
    "agent_id": "uuid",
    "started_at": "timestamp",
    "ended_at": "timestamp | null",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  } | null
}
```

**Use Case:** Replace SQL: `SELECT * FROM actor_agent_relationships WHERE id = $1`

---

#### End Relationship

```
POST /v1/representation/relationship/end
Content-Type: application/json
```

**Request Body:**

```json
{
  "relationshipId": "uuid",
  "endedByAuth0UserId": "string",
  "endedBy": "actor | agent"
}
```

**Response (200):**

```json
{
  "success": true,
  "relationship": {
    "id": "uuid",
    "ended_at": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `UPDATE actor_agent_relationships SET ended_at = NOW() WHERE id = $1`

---

---

## 4. Licensing Service (`services/licensing-service/src/handler.ts`)

### Overview

Manages licensing requests and approvals for actor content usage. Requires Auth0 token.

**Authorization Scopes:**

- GET operations: `hdicr:licensing:read`
- POST operations: `hdicr:licensing:write`

### Endpoints

#### Request License from Actor

```
POST /v1/license/request
Content-Type: application/json
```

**Request Body:**

```json
{
  "actorId": "uuid",
  "requesterName": "string",
  "requesterEmail": "string (email)",
  "requesterOrganization": "string (optional)",
  "projectName": "string",
  "projectDescription": "string",
  "usageType": "string",
  "intendedUse": "string",
  "durationStart": "timestamp (optional)",
  "durationEnd": "timestamp (optional)",
  "compensationOffered": "number | string (optional)",
  "compensationCurrency": "string (default: 'USD')"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "License request submitted",
  "request": {
    "id": "uuid",
    "actorId": "uuid",
    "projectName": "string",
    "usageType": "string",
    "status": "pending",
    "createdAt": "timestamp"
  }
}
```

**Use Case:** Replace SQL: `INSERT INTO license_requests (...)`

---

#### Get License Requests for Actor

```
GET /v1/license/actor/{actorId}?limit=50&offset=0
```

**Path Parameters:**

- `actorId`: UUID (required)

**Query Parameters:**

- `limit`: Integer (0-500, default: 50)
- `offset`: Integer (default: 0)

**Response (200):**

```json
{
  "actorId": "uuid",
  "requests": [
    {
      "id": "uuid",
      "requesterName": "string",
      "requesterEmail": "string",
      "requesterOrganization": "string",
      "projectName": "string",
      "projectDescription": "string",
      "usageType": "string",
      "intendedUse": "string",
      "compensationOffered": "number",
      "compensationCurrency": "string",
      "status": "pending | approved | rejected",
      "createdAt": "timestamp"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": "number"
  }
}
```

**Use Case:** Replace SQL: `SELECT * FROM license_requests WHERE actor_id = $1 LIMIT $2 OFFSET $3`

---

#### Approve License Request

```
POST /v1/license/{requestId}/approve
```

**Path Parameters:**

- `requestId`: UUID (required)

**Response (200):**

```json
{
  "success": true,
  "message": "License approved",
  "request": {
    "id": "uuid",
    "status": "approved",
    "approvedAt": "timestamp"
  }
}
```

**Response (404):**

```json
{
  "error": "License request not found"
}
```

**Use Case:** Replace SQL: `UPDATE license_requests SET status = 'approved', approved_at = NOW() WHERE id = $1`

---

#### Reject License Request

```
POST /v1/license/{requestId}/reject
Content-Type: application/json
```

**Path Parameters:**

- `requestId`: UUID (required)

**Request Body:**

```json
{
  "reason": "string (optional)"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "License rejected",
  "request": {
    "id": "uuid",
    "status": "rejected",
    "rejectedAt": "timestamp",
    "rejectionReason": "string"
  }
}
```

**Use Case:** Replace SQL: `UPDATE license_requests SET status = 'rejected', rejected_at = NOW() WHERE id = $1`

---

---

## Authentication & Error Handling

### Auth Headers

All endpoints require:

```
Authorization: Bearer {Auth0_JWT_Token}
```

The Auth0 token must include appropriate scopes for the operation (read/write).

### Common Error Responses

**401 Unauthorized:**

```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden:**

```json
{
  "error": "Forbidden",
  "detail": "Missing required scope: hdicr:identity:read"
}
```

**400 Bad Request:**

```json
{
  "error": "Validation failed",
  "details": {
    "formErrors": [],
    "fieldErrors": { "field_name": ["error message"] }
  }
}
```

**404 Not Found:**

```json
{
  "error": "Not found"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Internal server error",
  "message": "error details"
}
```

### Correlation Headers

All responses include correlation ID for tracing:

```
x-correlation-id: {UUID}
```

---

## Use Case Mapping: SQL → HTTP

### Example: User Profile Retrieval Path

```sql
-- Old: Direct DB Query
SELECT * FROM actors WHERE id = $1

-- New: HTTP Endpoint
GET /v1/identity/{id}
```

### Example: Consent Status Check

```sql
-- Old: Direct DB Query
SELECT * FROM consent_log
WHERE actor_id = $1 AND consent_type = $2
ORDER BY created_at DESC LIMIT 1

-- New: HTTP Endpoint
GET /v1/consent/check?actorId={id}&consentType={type}
```

### Example: Representation Verification

```sql
-- Old: Direct DB Query
SELECT 1 FROM actor_agent_relationships
WHERE actor_id = $1 AND ended_at IS NULL

-- New: HTTP Endpoint
GET /v1/representation/relationship/active?actorId={id}
```

### Example: Admin User Listing

```sql
-- Old: Direct DB Query
SELECT * FROM user_profiles
JOIN actors ON ...
WHERE role = 'admin'

-- New: HTTP Endpoint
GET /v1/identity/admin/users
```

---

## Summary Table

| Service            | Type                | Key Endpoints                                                      | Primary Lookup  | Existence Check   |
| ------------------ | ------------------- | ------------------------------------------------------------------ | --------------- | ----------------- |
| **Identity**       | User/Actor profiles | `GET /v1/identity/{id}`, `POST /v1/identity/register`              | By Actor ID     | N/A               |
| **Consent**        | Immutable ledger    | `GET /v1/consent/check`, `POST /v1/consent/grant`                  | By Actor + Type | isGranted boolean |
| **Representation** | Relationships       | `GET /v1/representation/active`, `POST /v1/representation/request` | By Actor ID     | active boolean    |
| **Licensing**      | License requests    | `GET /v1/license/actor/{id}`, `POST /v1/license/request`           | By Actor ID     | Status field      |

---

## Tenant Scoping

All services receive tenant context from:

1. **Auth0 token claim**: `tenantId`
2. **Environment fallback**: `HDICR_DEFAULT_TENANT_ID` (default: 'trulyimagined')

Tenant ID automatically scopes all queries (WHERE tenant_id = $X is implicit).
