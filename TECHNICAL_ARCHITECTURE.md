# Truly Imagined — Technical Architecture & Implementation Roadmap

## 🎯 Vision & Strategic Objective

Transform Truly Imagined from:
> **"A single-product digital identity registry for talent"**

Into:
> **"A scalable identity orchestration layer capable of integrating with government digital identity frameworks, financial institutions, and healthcare systems"**

---

## 🏆 Core Mission

Build a **production-grade, modular, standards-compliant identity orchestration platform** that serves as:

1. **Global Human Digital Identity Consent Registry** (Steps 1-5 ✅ COMPLETE — March 2026)
2. **Identity Orchestration Layer** for multi-provider identity linking
3. **Verification Infrastructure** ready for UK Trust Framework, eIDAS certification

---

## 🧭 Architecture Principles

- **Security First**: Production-grade encryption, audit trails, compliance-ready
- **Standards-Aligned**: OIDC, OAuth2, W3C Verifiable Credentials, DIDs
- **Modular Design**: Extensible for new identity providers without core rewrites
- **Incremental Migration**: Scale beyond Vercel serverless when needed (no big rewrite)
- **Build for Trust**: Infrastructure over features, compliance over convenience

---

## ✅ Current State (Steps 1-5 Completed — March 2026)

**Completed Infrastructure:**

- ✅ **Monorepo Structure**: TypeScript, Next.js 14 App Router, Tailwind CSS
- ✅ **PostgreSQL Database**: AWS RDS with 3 migrations deployed
- ✅ **Auth0 Integration**: JWT validation middleware, role-based access control
- ✅ **Identity Registry MVP**: Actor registration API (`POST /api/identity/register`) + frontend
- ✅ **Database Schema**: 
  - `user_profiles` (all users with roles: Actor, Agent, Admin, Enterprise)
  - `actors` (extended Actor profiles linked to user_profiles)
  - `consent_log` (append-only audit trail)
  - `licensing_requests`, `usage_tracking`, `audit_log`

**Tech Stack:**
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Vercel
- **Backend**: AWS Lambda (Node.js 18), API Gateway, PostgreSQL 15 (RDS)
- **Auth**: Auth0 (OIDC/OAuth2) with JWT verification (`jwks-rsa`)
- **Storage**: AWS S3 (media storage)
- **Infrastructure**: AWS SAM, TypeScript, `pg` driver

---

# 📐 1. High-Level Architecture

## Core Services

```
┌──────────────────────────────────────────────────────────┐
│                   EXTERNAL CONSUMERS                     │
│  (Studios, AI Platforms, Financial Institutions, Gov't)  │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│            API GATEWAY (AWS API Gateway)                  │
│  - Request routing, Rate limiting, API keys, CORS        │
└───────────────────────┬──────────────────────────────────┘
                        │
             ┌──────────┴──────────┐
             │                     │
┌────────────▼──────┐  ┌──────────▼──────────┐
│   VERCEL EDGE     │  │  AWS LAMBDA         │
│   Next.js App     │  │  Backend Services   │
│   - SSR/ISR       │  │  - Identity Service │
│   - Auth0 Session │  │  - Consent Service  │
│   - UI/UX         │  │  - Credential Svc   │
└────────────┬──────┘  │  - Verification Svc │
             │         │  - Audit Service    │
             │         │  - Licensing Service│
             └─────────┴──────────┬──────────┘
                                  │
                      ┌───────────┴────────────┐
                      │                        │
           ┌──────────▼──────────┐  ┌─────────▼─────────┐
           │  PostgreSQL (RDS)   │  │   AWS S3          │
           │  - User profiles    │  │   - Media storage │
           │  - Identities       │  │   - Credentials   │
           │  - Credentials      │  │   - Documents     │
           │  - Consent logs     │  └───────────────────┘
           │  - Audit trails     │
           └──────────┬──────────┘
                      │
           ┌──────────▼──────────┐
           │  External IDPs      │
           │  - Gov IDs (OIDC)   │
           │  - KYC (Onfido)     │
           │  - Banks (OpenID)   │
           └─────────────────────┘
```

## Service Interaction Patterns

1. **Frontend → Backend**: Next.js API routes → Lambda (current)
2. **Lambda → Database**: PostgreSQL connection pool via `pg`
3. **Lambda → External**: HTTPS to KYC providers, government IDPs
4. **Service → Service**: Internal async via EventBridge (future Phase 2)

---

# 🔧 2. Service Breakdown (Implementation-Level)

## 2.1 Identity Service

**Location**: `services/identity-service/`

**Responsibilities:**
- User identity registration and management
- Multi-provider identity linking (Auth0, government IDs, banks, KYC)
- Identity resolution and confidence scoring
- Profile management

**Folder Structure:**
```
services/identity-service/
├── src/
│   ├── index.ts
│   ├── handlers/
│   │   ├── register.ts           # ✅ DONE (POST /api/identity/register)
│   │   ├── link-provider.ts      # TODO: POST /api/identity/link
│   │   ├── get-profile.ts        # GET /api/identity/{id}
│   │   └── resolve-identity.ts   # POST /api/identity/resolve
│   ├── models/
│   │   ├── identity.ts
│   │   └── identity-link.ts
│   ├── services/
│   │   ├── identity-resolver.ts  # Multi-provider resolution
│   │   └── confidence-scorer.ts  # Assurance level calculation
│   └── utils/
│       └── validation.ts
├── package.json
└── tsconfig.json
```

**Key API Endpoints:**

```typescript
// ✅ IMPLEMENTED
POST /api/identity/register
{
  "firstName": "John",
  "lastName": "Smith",
  "stageName": "John S",
  "bio": "Actor bio"
}
Response: { actorId: "uuid", registryId: "TI-ACTOR-00001" }

// TODO: Multi-provider linking
POST /api/identity/link
{
  "provider": "uk-gov-verify",  // or "bank-openid", "onfido"
  "authorizationCode": "...",
  "redirectUri": "..."
}
Response: {
  "linkId": "uuid",
  "verificationLevel": "high",
  "confidence": 0.95
}

// TODO: Identity resolution
GET /api/identity/{id}
Response: {
  "userId": "uuid",
  "identityLinks": [
    { "provider": "auth0", "verified": true, "assuranceLevel": "low" },
    { "provider": "uk-gov-verify", "verified": true, "assuranceLevel": "high" }
  ],
  "overallConfidence": 0.92,
  "verificationStatus": "verified"
}
```

**Dependencies:**
- `pg`, `zod`, `jsonwebtoken`, `jwks-rsa`

---

## 2.2 Consent Service

**Location**: `services/consent-service/`

**Responsibilities:**
- Record consent grants, revocations, updates
- Enforce consent scope and duration
- Provide "proof of consent" API for external verification
- Manage consent expiry

**Folder Structure:**
```
services/consent-service/
├── src/
│   ├── index.ts
│   ├── handlers/
│   │   ├── grant-consent.ts      # POST /api/consent/grant
│   │   ├── revoke-consent.ts     # POST /api/consent/revoke
│   │   ├── check-consent.ts      # GET /api/consent/check
│   │   └── list-consents.ts      # GET /api/consent/{actorId}
│   ├── models/
│   │   └── consent.ts
│   ├── services/
│   │   ├── consent-validator.ts
│   │   └── consent-enforcer.ts
│   └── utils/
│       └── expiry-checker.ts
├── package.json
└── tsconfig.json
```

**Key API Endpoints:**

```typescript
// Grant consent
POST /api/consent/grant
{
  "actorId": "uuid",
  "consentType": "voice_synthesis",
  "scope": {
    "projectName": "Film XYZ",
    "duration": "2024-01-01 to 2024-12-31",
    "usageTypes": ["advertising", "promotional"],
    "territories": ["UK", "US"]
  },
  "requesterId": "uuid",
  "requesterType": "studio"
}

// Check consent (for external consumers)
GET /api/consent/check?actorId={uuid}&consentType=voice_synthesis&projectId={id}
Response: {
  "isGranted": true,
  "consentId": "uuid",
  "scope": {...},
  "expiresAt": "2024-12-31T23:59:59Z",
  "proof": "base64-encoded-signed-jwt"  // Cryptographic proof
}

// Revoke consent
POST /api/consent/revoke
{
  "actorId": "uuid",
  "consentId": "uuid",
  "reason": "Project cancelled"
}
```

**Internal Logic (Consent Validation):**

```typescript
async function checkConsent(actorId: string, consentType: string, projectId: string) {
  // Query consent_log for most recent grant/revoke
  const latestConsent = await db.query(`
    SELECT * FROM consent_log 
    WHERE actor_id = $1 
      AND consent_type = $2 
      AND (consent_scope->>'projectId' = $3 OR consent_scope->>'projectId' IS NULL)
    ORDER BY created_at DESC 
    LIMIT 1
  `, [actorId, consentType, projectId]);

  // Check if granted and not expired
  if (latestConsent.action === 'granted') {
    const expiresAt = latestConsent.consent_scope.expiresAt;
    if (!expiresAt || new Date(expiresAt) > new Date()) {
      return { isGranted: true, consent: latestConsent };
    }
  }

  return { isGranted: false };
}
```

---

## 2.3 Credential Service

**Location**: `services/credential-service/` (new)

**Responsibilities:**
- Issue W3C Verifiable Credentials (VCs)
- Store and manage credentials
- Implement selective disclosure (BBS+, future)
- Verify presented credentials

**Folder Structure:**
```
services/credential-service/
├── src/
│   ├── index.ts
│   ├── handlers/
│   │   ├── issue-credential.ts    # POST /api/credentials/issue
│   │   ├── verify-credential.ts   # POST /api/credentials/verify
│   │   └── revoke-credential.ts   # POST /api/credentials/revoke
│   ├── models/
│   │   └── verifiable-credential.ts
│   ├── services/
│   │   ├── vc-issuer.ts
│   │   ├── vc-verifier.ts
│   │   └── did-resolver.ts
│   └── crypto/
│       └── signing.ts
├── package.json
└── tsconfig.json
```

**Key API Endpoints:**

```typescript
// Issue a Verifiable Credential
POST /api/credentials/issue
{
  "userId": "uuid",
  "credentialType": "IdentityCredential",
  "claims": {
    "fullName": "John Smith",
    "dateOfBirth": "1990-01-01",
    "nationality": "GB",
    "verificationLevel": "high"
  }
}
Response: {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "IdentityCredential"],
  "issuer": "did:web:trulyimagined.com",
  "issuanceDate": "2026-03-23T00:00:00Z",
  "credentialSubject": {
    "id": "did:web:trulyimagined.com:users:{uuid}",
    ...claims
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "verificationMethod": "did:web:trulyimagined.com#key-1",
    "proofValue": "z3FXQ..."
  }
}
```

**Dependencies:**
- `@digitalbazaar/vc`, `@digitalbazaar/ed25519-signature-2020`, `did-resolver`

---

## 2.4 Verification Service

**Location**: `services/verification-service/` (new)

**Responsibilities:**
- Integrate with KYC providers (Onfido, Persona, Jumio)
- Orchestrate government ID verification
- Calculate assurance levels (UK Trust Framework GPG 45, eIDAS)
- Manage verification workflows

**Folder Structure:**
```
services/verification-service/
├── src/
│   ├── index.ts
│   ├── handlers/
│   │   ├── start-verification.ts  # POST /api/verification/start
│   │   ├── check-status.ts        # GET /api/verification/{id}
│   │   └── webhook.ts             # POST /api/verification/webhook
│   ├── providers/
│   │   ├── onfido.ts
│   │   ├── persona.ts
│   │   ├── gov-gateway.ts
│   │   └── base-provider.ts
│   ├── services/
│   │   ├── assurance-calculator.ts  # GPG 45 assurance levels
│   │   └── verification-orchestrator.ts
│   └── models/
│       └── verification.ts
├── package.json
└── tsconfig.json
```

**Key API Endpoints:**

```typescript
// Start KYC verification
POST /api/verification/start
{
  "userId": "uuid",
  "provider": "onfido",
  "verificationType": "identity",
  "documents": ["passport", "drivers-license"]
}
Response: {
  "verificationId": "uuid",
  "provider": "onfido",
  "sdkToken": "onfido-sdk-token-for-frontend",
  "status": "pending"
}

// Check verification status
GET /api/verification/{verificationId}
Response: {
  "verificationId": "uuid",
  "status": "complete",
  "assuranceLevel": "high",  // low, medium, high, very-high (GPG 45)
  "result": {
    "documentVerified": true,
    "livenessCheck": true,
    "nameMatch": true,
    "dobMatch": true
  }
}
```

**Dependencies:**
- `onfido-node`, `persona` (KYC SDKs)

---

## 2.5 Audit Service

**Location**: `services/audit-service/` (new)

**Responsibilities:**
- Immutable audit logging (all system actions)
- Compliance reporting (GDPR, data access logs)
- Anomaly detection
- Export audit trails for external audits

**Key API Endpoints:**

```typescript
// Log audit event (internal only)
POST /internal/audit/log
{
  "eventType": "CONSENT_GRANTED",
  "actorId": "uuid",
  "userId": "uuid",
  "metadata": {...},
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}

// Query logs (admin only)
GET /api/audit/logs?userId={uuid}&eventType=CONSENT_GRANTED&startDate=...&endDate=...
```

---

## 2.6 Licensing Service

**Location**: `services/licensing-service/`

**Responsibilities:**
- Handle licensing requests for AI usage
- Track usage metrics (minutes generated, API calls)
- Integrate with consent service for enforcement
- Generate usage reports

**Key API Endpoints:**

```typescript
// Request license
POST /api/license/request
{
  "actorId": "uuid",
  "projectName": "Film XYZ",
  "usageType": "voice_synthesis",
  "estimatedMinutes": 120,
  "territories": ["UK", "US"]
}

// Track usage
POST /api/usage/track
{
  "licenseId": "uuid",
  "actorId": "uuid",
  "minutesGenerated": 10
}
```

---

# 🗄️ 3. Database Design

## 3.1 Existing Schema (Deployed ✅)

### `user_profiles` Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth0_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Actor', 'Agent', 'Enterprise', 'Admin')),
  username VARCHAR(100) UNIQUE NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  professional_name VARCHAR(255) UNIQUE NOT NULL,
  use_legal_as_professional BOOLEAN DEFAULT FALSE,
  spotlight_id VARCHAR(500) UNIQUE,
  profile_completed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Base table for ALL users. Replaces Auth0 roles with database-backed system.

---

### `actors` Table
```sql
CREATE TABLE actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  auth0_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  stage_name VARCHAR(200),
  bio TEXT,
  profile_image_url VARCHAR(500),
  location VARCHAR(200),
  verification_status VARCHAR(50) DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  registry_id VARCHAR(100) UNIQUE,  -- "TI-ACTOR-00001"
  is_founding_member BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Extended profile for Actor role only.

---

### `consent_log` Table (Append-Only ✅)
```sql
CREATE TABLE consent_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (action IN ('granted', 'revoked', 'updated', 'requested')),
  consent_type VARCHAR(100) NOT NULL,
  consent_scope JSONB NOT NULL DEFAULT '{}'::JSONB,
  project_name VARCHAR(255),
  project_description TEXT,
  requester_id UUID,
  requester_type VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

**Purpose**: Immutable audit trail of all consent actions. No UPDATE or DELETE.

---

### Other Existing Tables
- `licensing_requests`: License requests (status: pending/approved/denied)
- `usage_tracking`: Track AI generation minutes
- `audit_log`: General system audit events

---

## 3.2 New Schema (TODO — Next Migrations)

### Migration 004: `identity_links` Table
```sql
-- Links user identities to external providers
CREATE TABLE identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  provider VARCHAR(100) NOT NULL,  -- 'auth0', 'uk-gov-verify', 'bank-openid', 'onfido'
  provider_user_id VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL,  -- 'oauth', 'oidc', 'kyc', 'government'
  
  verification_level VARCHAR(50),  -- 'low', 'medium', 'high', 'very-high' (GPG 45)
  assurance_level VARCHAR(50),     -- eIDAS: 'low', 'substantial', 'high'
  verified_at TIMESTAMP WITH TIME ZONE,
  
  credential_data JSONB,  -- Encrypted claims from provider
  
  is_active BOOLEAN DEFAULT TRUE,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_profile_id, provider, provider_user_id)
);
```

**Purpose**: Enable multi-provider identity linking (government IDs, banks, KYC).

---

### Migration 005: `verifiable_credentials` Table
```sql
-- W3C Verifiable Credentials storage
CREATE TABLE verifiable_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  credential_type VARCHAR(100) NOT NULL,
  credential_json JSONB NOT NULL,  -- Full W3C VC
  
  issuer_did VARCHAR(255) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  
  holder_did VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### Migration 006: `kyc_verifications` Table
```sql
-- KYC verification records
CREATE TABLE kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  provider VARCHAR(100) NOT NULL,  -- 'onfido', 'persona'
  provider_verification_id VARCHAR(255) UNIQUE NOT NULL,
  
  verification_type VARCHAR(100) NOT NULL,
  documents_submitted VARCHAR(100)[],
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  
  result JSONB,
  assurance_level VARCHAR(50),
  confidence_score DECIMAL(3,2),
  
  document_verified BOOLEAN,
  liveness_check_passed BOOLEAN,
  name_match BOOLEAN,
  dob_match BOOLEAN,
  
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);
```

---

### Migration 007: `agents` Table
```sql
-- Extended profile for Agent role
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  agency_name VARCHAR(255),
  agency_registration_number VARCHAR(100),
  agency_address TEXT,
  agency_website VARCHAR(500),
  
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  represents_actors UUID[],  -- Array of actor IDs
  
  bio TEXT,
  profile_image_url VARCHAR(500),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### Migration 008: `enterprises` Table
```sql
-- Extended profile for Enterprise role
CREATE TABLE enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  company_name VARCHAR(255) NOT NULL,
  company_registration_number VARCHAR(100) UNIQUE,
  company_address TEXT,
  company_website VARCHAR(500),
  
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  api_key_hash VARCHAR(255),
  api_rate_limit INTEGER DEFAULT 1000,
  
  stripe_customer_id VARCHAR(255),
  billing_email VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

# 🔗 4. Identity Orchestration Layer

## 4.1 Multi-Provider Identity Linking

**Goal**: Allow users to link multiple identity providers to establish high-confidence identity.

**Example Flow:**

1. **User registers via Auth0** (email/password)
   - Creates `user_profiles` record with `role='Actor'`
   - Assurance level: **Low**

2. **User links UK Gov Verify** (OIDC)
   - OAuth2/OIDC flow to UK Gov Gateway
   - Receives: full name (verified), DOB (verified), address (verified)
   - Creates `identity_links` record with `verification_level='high'`
   - Assurance level: **High**

3. **User links bank via Open Banking**
   - OAuth2 flow to bank
   - Receives: account holder name, account verification
   - Creates `identity_links` record with `verification_level='medium'`

4. **User completes KYC with Onfido**
   - Uploads passport, liveness check
   - Creates `kyc_verifications` record
   - Assurance level: **High**

**Result**: User has 4 linked identities with overall confidence score 0.95.

---

## 4.2 Identity Resolution & Confidence Scoring

**Algorithm:**

```typescript
async function resolveIdentity(userProfileId: string): Promise<IdentityResolution> {
  // 1. Fetch all identity links
  const links = await db.query(`
    SELECT * FROM identity_links 
    WHERE user_profile_id = $1 AND is_active = TRUE
  `, [userProfileId]);

  // 2. Fetch KYC verifications
  const kycVerifications = await db.query(`
    SELECT * FROM kyc_verifications 
    WHERE user_profile_id = $1 AND status = 'complete'
  `, [userProfileId]);

  // 3. Calculate weighted confidence score
  const weights = {
    'auth0': 0.1,
    'uk-gov-verify': 0.4,
    'bank-openid': 0.3,
    'onfido': 0.4
  };

  let weightedScore = 0;
  let totalWeight = 0;

  for (const link of links) {
    const weight = weights[link.provider] || 0.1;
    const score = mapVerificationLevelToScore(link.verification_level);
    weightedScore += weight * score;
    totalWeight += weight;
  }

  const confidenceScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // 4. Determine assurance level
  let assuranceLevel: string;
  if (confidenceScore >= 0.9) assuranceLevel = 'very-high';
  else if (confidenceScore >= 0.7) assuranceLevel = 'high';
  else if (confidenceScore >= 0.5) assuranceLevel = 'medium';
  else assuranceLevel = 'low';

  return {
    userProfileId,
    identityLinks: links,
    kycVerifications,
    overallConfidence: confidenceScore,
    assuranceLevel
  };
}
```

---

# 🔐 5. Standards Integration

## 5.1 OpenID Connect (OIDC)

**Current**: ✅ Auth0 (OIDC provider)

**Future Integrations**:
- UK Gov Gateway (OneLogin)
- Bank Open Banking OIDC
- NHS Identity (future)

**Library**: `openid-client` (Node.js)

**Example: UK Gov Verify Integration**

```typescript
import { Issuer, generators } from 'openid-client';

// 1. Discover OIDC configuration
const ukGovIssuer = await Issuer.discover('https://oidc.integration.account.gov.uk');

const client = new ukGovIssuer.Client({
  client_id: process.env.UK_GOV_CLIENT_ID,
  client_secret: process.env.UK_GOV_CLIENT_SECRET,
  redirect_uris: ['https://trulyimagined.com/auth/callback/gov'],
  response_types: ['code']
});

// 2. Generate authorization URL with PKCE
const code_verifier = generators.codeVerifier();
const code_challenge = generators.codeChallenge(code_verifier);

const authUrl = client.authorizationUrl({
  scope: 'openid profile',
  code_challenge,
  code_challenge_method: 'S256',
  vtr: '["Cl.Cm"]'  // Request Confidence Level Medium
});

// Redirect user to authUrl

// 3. Exchange code for tokens (in callback)
const params = client.callbackParams(req);
const tokenSet = await client.callback(
  'https://trulyimagined.com/auth/callback/gov',
  params,
  { code_verifier }
);

const claims = tokenSet.claims();
// claims.sub = Government user ID
// claims.name = Verified name
// claims.birthdate = Verified DOB

// 4. Store in identity_links
await storeIdentityLink(user.profileId, 'uk-gov-verify', claims);
```

---

## 5.2 W3C Verifiable Credentials (VCs)

**Purpose**: Issue machine-verifiable identity credentials

**Library**: `@digitalbazaar/vc`

```bash
npm install @digitalbazaar/vc @digitalbazaar/ed25519-signature-2020
```

**Example: Issue Identity Credential**

```typescript
import vc from '@digitalbazaar/vc';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';

const credential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://trulyimagined.com/credentials/v1"
  ],
  "type": ["VerifiableCredential", "IdentityCredential"],
  "issuer": "did:web:trulyimagined.com",
  "issuanceDate": new Date().toISOString(),
  "credentialSubject": {
    "id": `did:web:trulyimagined.com:users:${user.id}`,
    "fullName": user.legalName,
    "verificationLevel": "high",
    "verifiedAt": new Date().toISOString()
  }
};

// Sign credential
const suite = new Ed25519Signature2020({ key: issuerKeyPair });
const signedVC = await vc.issue({ credential, suite, documentLoader });

// Store in database
await db.query(`
  INSERT INTO verifiable_credentials (
    user_profile_id, credential_type, credential_json, issuer_did
  ) VALUES ($1, $2, $3, $4)
`, [user.profileId, 'IdentityCredential', signedVC, 'did:web:trulyimagined.com']);
```

---

## 5.3 Decentralised Identifiers (DIDs)

**DID Method**: `did:web` (HTTPS-based, simplest for MVP)

**Format**: `did:web:trulyimagined.com:users:{userId}`

**DID Document** (served at `https://trulyimagined.com/users/{userId}/did.json`):

```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:web:trulyimagined.com:users:550e8400-...",
  "verificationMethod": [{
    "id": "did:web:trulyimagined.com:users:550e8400-...#key-1",
    "type": "Ed25519VerificationKey2020",
    "controller": "did:web:trulyimagined.com:users:550e8400-...",
    "publicKeyMultibase": "z6Mkj..."
  }],
  "authentication": ["...-users:550e8400-...#key-1"]
}
```

**Implementation**: Create API endpoint to serve DID documents

```typescript
// GET /users/:userId/did.json
export async function GET(req, { params }) {
  const { userId } = params;
  const user = await db.query(`SELECT * FROM user_profiles WHERE id = $1`, [userId]);
  
  if (!user) return new Response('Not Found', { status: 404 });

  const didDocument = {
    "@context": "https://www.w3.org/ns/did/v1",
    "id": `did:web:trulyimagined.com:users:${userId}`,
    "verificationMethod": [{
      "id": `did:web:trulyimagined.com:users:${userId}#key-1`,
      "type": "Ed25519VerificationKey2020",
      "controller": `did:web:trulyimagined.com:users:${userId}`,
      "publicKeyMultibase": user.publicKey
    }],
    "authentication": [`did:web:trulyimagined.com:users:${userId}#key-1`]
  };

  return new Response(JSON.stringify(didDocument), {
    headers: { 'Content-Type': 'application/did+json' }
  });
}
```

---

# 🛡️ 6. Consent & Permission System

## 6.1 Consent Model

**Schema** (already deployed ✅):

```sql
CREATE TABLE consent_log (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES actors(id),
  action VARCHAR(50) CHECK (action IN ('granted', 'revoked', 'updated', 'requested')),
  consent_type VARCHAR(100) NOT NULL,  -- 'voice_synthesis', 'image_usage', 'full_likeness'
  consent_scope JSONB NOT NULL,  -- { projectName, duration, usageTypes[], territories[] }
  project_name VARCHAR(255),
  requester_id UUID,
  requester_type VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Append-Only**: No UPDATE or DELETE operations.

---

## 6.2 Revocation Mechanism

**Flow:**
1. Actor clicks "Revoke" on consent
2. System appends new record with `action='revoked'`
3. External systems query `/api/consent/check` → returns `isGranted: false`

```typescript
// POST /api/consent/revoke
async function revokeConsent(req) {
  const { actorId, consentId, reason } = req.body;

  await db.query(`
    INSERT INTO consent_log (actor_id, action, consent_type, consent_scope, metadata) 
    SELECT actor_id, 'revoked', consent_type, consent_scope, 
           jsonb_build_object('originalConsentId', $2, 'reason', $3)
    FROM consent_log WHERE id = $2
  `, [actorId, consentId, reason]);

  return { status: 'revoked', loggedAt: new Date() };
}
```

---

## 6.3 "Proof of Consent" API

**Purpose**: Cryptographic proof for external consumers

**Implementation**: Signed JWT

```typescript
// GET /api/consent/proof?actorId={uuid}&consentType=voice_synthesis&projectId={id}

async function getConsentProof(req) {
  const { actorId, consentType, projectId } = req.query;

  const consent = await checkConsent(actorId, consentType, projectId);
  if (!consent.isGranted) {
    return { error: 'Consent not granted' };
  }

  // Generate signed JWT proof
  const proof = jwt.sign({
    iss: 'did:web:trulyimagined.com',
    sub: actorId,
    consentType,
    projectId,
    scope: consent.scope,
    grantedAt: consent.grantedAt,
    expiresAt: consent.expiresAt,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(new Date(consent.expiresAt).getTime() / 1000)
  }, process.env.CONSENT_SIGNING_KEY, {
    algorithm: 'RS256',
    keyid: 'consent-key-1'
  });

  return { isGranted: true, consentId: consent.id, proof };
}
```

**External Verification:**

```typescript
const decoded = jwt.verify(proof, trulyImaginedPublicKey, {
  algorithms: ['RS256'],
  issuer: 'did:web:trulyimagined.com'
});

if (decoded.consentType === 'voice_synthesis' && new Date(decoded.expiresAt) > new Date()) {
  // Consent is valid, proceed
}
```

---

# 🔒 7. Security Architecture

## 7.1 Authentication

**Current**: ✅ Auth0 JWT validation (RS256)

**Middleware** (implemented in `shared/middleware/src/index.ts`):

```typescript
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000  // 10 minutes
});

export async function validateAuth0Token(event) {
  const token = event.headers.Authorization?.replace('Bearer ', '');
  if (!token) throw new Error('No token provided');

  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}
```

---

## 7.2 Encryption

### At Rest

**Database**: AWS RDS encryption (verify enabled)

**Application-Level Encryption** (for sensitive fields):

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decrypt(ciphertext: string, key: string): string {
  const [ivB64, authTagB64, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let plaintext = decipher.update(encrypted, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

// Usage: Encrypt identity_links.credential_data
const encryptedData = encrypt(JSON.stringify(claims), process.env.ENCRYPTION_KEY);
await db.query(`UPDATE identity_links SET credential_data = $1 WHERE id = $2`, 
  [encryptedData, linkId]);
```

**Key Storage**: AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name trulyimagined/encryption-key \
  --secret-string "$(openssl rand -hex 32)"
```

---

### In Transit

- ✅ Vercel: Automatic HTTPS
- ✅ AWS API Gateway: HTTPS-only
- ✅ RDS: SSL/TLS connections

**Database SSL:**

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.RDS_CA_CERT
  }
});
```

---

## 7.3 Secrets Management

**Production**: Migrate to AWS Secrets Manager

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'eu-west-2' });

export async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString;
}
```

**Secrets to Store:**
- `trulyimagined/db-password`
- `trulyimagined/encryption-key`
- `trulyimagined/auth0-client-secret`
- `trulyimagined/stripe-api-key`
- `trulyimagined/onfido-api-token`
- `trulyimagined/consent-signing-key`

---

## 7.4 Role-Based Access Control (RBAC)

**Roles**: Actor, Agent, Admin, Enterprise

**Helpers** (✅ implemented):

```typescript
export function requireRole(user: User, allowedRoles: string[]) {
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: Requires role ${allowedRoles.join(' or ')}`);
  }
}

export function canAccessActorResources(user: User, actorAuth0Id: string): boolean {
  if (user.role === 'Actor' && user.auth0UserId === actorAuth0Id) return true;
  if (user.role === 'Admin') return true;
  return false;
}
```

---

# 🔮 8. Cryptographic Enhancements (Phase 2+)

## 8.1 Selective Disclosure (BBS+ Signatures)

**Use Case**: Actor shares credential but reveals only specific fields

**Library**: `@mattrglobal/bbs-signatures`

```bash
npm install @mattrglobal/bbs-signatures
```

**Example:**

```typescript
import { generateBls12381G2KeyPair, sign, deriveProof } from '@mattrglobal/bbs-signatures';

// 1. Issuer signs credential
const keyPair = await generateBls12381G2KeyPair();
const messages = [
  Buffer.from('John Smith'),    // name
  Buffer.from('1990-01-01'),    // DOB
  Buffer.from('123 Main St'),   // address
  Buffer.from('GB')             // nationality
];
const signature = await sign({ keyPair, messages });

// 2. Actor derives proof (reveal fields 0 and 3 only)
const proof = await deriveProof({
  signature,
  publicKey: keyPair.publicKey,
  messages,
  revealed: [0, 3]  // name and nationality only
});

// 3. Verifier sees only revealed fields
```

**Integration**: Phase 2 — Modify Credential Service

---

## 8.2 Zero-Knowledge Proofs (ZKP)

**Use Case**: Prove attributes without revealing raw data
- "I am over 18" without revealing birthdate
- "I live in UK" without revealing address

**Implementation**: zk-SNARKs via `snarkjs` (Circom)

**Phase**: Phase 3+ (complex, requires circuit design)

**Design Now to Avoid Rework:**
- Store claims in structured format (✅ using JSONB)
- Use numeric age instead of birthdate
- Store country code separately

---

# 🌉 9. API Gateway & External Integrations

## 9.1 Unified API Gateway

**Current**: AWS API Gateway → Lambda

**Future**: Expand for external consumers

**AWS SAM Configuration:**

```yaml
# infra/api-gateway/template.yaml
Resources:
  TrulyImaginedAPI:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Auth:
        DefaultAuthorizer: Auth0Authorizer

  IdentityServiceFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/index.handler
      Runtime: nodejs18.x
      CodeUri: ../../services/identity-service
      Events:
        RegisterIdentity:
          Type: Api
          Properties:
            Path: /identity/register
            Method: post
```

---

## 9.2 KYC Provider Integration (Onfido)

**SDK**: `onfido-node`

```bash
npm install onfido-node
```

**Implementation:**

```typescript
import { Onfido, Region } from 'onfido-node';

const onfido = new Onfido({
  apiToken: process.env.ONFIDO_API_TOKEN,
  region: Region.EU
});

// Create applicant
const applicant = await onfido.applicant.create({
  firstName: userProfile.firstName,
  lastName: userProfile.lastName,
  email: userProfile.email
});

// Generate SDK token for frontend
const sdkToken = await onfido.sdkToken.generate({
  applicantId: applicant.id,
  referrer: 'https://trulyimagined.com/*'
});

// Store verification record
await db.query(`
  INSERT INTO kyc_verifications (
    user_profile_id, provider, provider_verification_id, status
  ) VALUES ($1, $2, $3, $4)
`, [userId, 'onfido', applicant.id, 'pending']);

return { sdkToken: sdkToken.token, applicantId: applicant.id };
```

**Webhook Handler:**

```typescript
app.post('/api/verification/webhook/onfido', async (req, res) => {
  // Verify signature
  const signature = req.headers['x-sha2-signature'];
  const isValid = verifyOnfidoSignature(req.body, signature, process.env.ONFIDO_WEBHOOK_SECRET);
  if (!isValid) return res.status(401).send('Invalid signature');

  const { payload } = req.body;
  
  if (payload.action === 'check.completed') {
    const check = await onfido.check.find(payload.object.id);
    
    // Update verification record
    await db.query(`
      UPDATE kyc_verifications 
      SET status = $1, result = $2, document_verified = $3, 
          liveness_check_passed = $4, completed_at = NOW()
      WHERE provider_verification_id = $5
    `, [
      check.result,
      check,
      check.breakdown.document_verification?.result === 'clear',
      check.breakdown.facial_similarity_photo?.result === 'clear',
      payload.object.applicant_id
    ]);
  }

  res.sendStatus(200);
});
```

---

## 9.3 Open Banking Integration (TrueLayer)

**SDK**: `truelayer-client`

```typescript
import { AuthAPIClient, DataAPIClient } from 'truelayer-client';

// Generate auth link
const authClient = new AuthAPIClient({
  client_id: process.env.TRUELAYER_CLIENT_ID,
  client_secret: process.env.TRUELAYER_CLIENT_SECRET
});

const authUrl = authClient.getAuthUrl({
  redirectURI: 'https://trulyimagined.com/auth/callback/bank',
  scope: ['info', 'accounts'],
  nonce: 'random-nonce'
});

// Exchange code for tokens
const tokens = await authClient.exchangeCodeForToken(code, redirectURI);

const dataClient = new DataAPIClient({ access_token: tokens.access_token });
const info = await dataClient.getInfo();

// Store identity link
await db.query(`
  INSERT INTO identity_links (
    user_profile_id, provider, provider_user_id, provider_type, verification_level
  ) VALUES ($1, $2, $3, $4, $5)
`, [userId, 'truelayer', info.accountHolderId, 'open-banking', 'medium']);
```

---

# 🚀 10. DevOps & Infrastructure

## 10.1 Environments

1. **Development** (local)
2. **Staging** (AWS + Vercel staging)
3. **Production** (AWS + Vercel production)

---

## 10.2 CI/CD Pipeline

**GitHub Actions** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g pnpm
      - run: pnpm install
      - run: pnpm build --filter=web
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pip install aws-sam-cli
      - run: sam build
      - run: sam deploy --no-confirm-changeset
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## 10.3 Monitoring

**Tools:**
1. **CloudWatch**: Lambda invocations, errors, duration
2. **Sentry** (optional): Error tracking

```bash
npm install @sentry/nextjs
```

```typescript
// apps/web/instrumentation.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV,
  tracesSampleRate: 0.1
});
```

---

# 📈 11. Migration & Scalability Strategy

## 11.1 When to Scale Beyond Vercel?

**Triggers:**
- Lambda timeout issues (>30s execution)
- Cold start latency >500ms p99
- Cost exceeds dedicated infrastructure
- 10,000+ requests/minute

---

## 11.2 Incremental Migration Plan

### Phase 1: ✅ Current State
- PostgreSQL on RDS (scalable)
- S3 for media
- Lambda for APIs

### Phase 2: Containerize Heavy Services
**When**: Identity resolution, credential issuance become bottlenecks

**How**: Migrate to AWS ECS (Fargate)

**Services to Migrate First:**
1. Identity Service (compute-heavy)
2. Verification Service (slow external APIs)
3. Credential Service (cryptography)

**Deployment:**

```dockerfile
# services/identity-service/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

**Route Traffic**: API Gateway → ALB → ECS Service

---

### Phase 3: Keep Frontend on Vercel
**Why**: Vercel excels at Next.js (SSR, ISR, edge)

**What Stays**: Next.js app, thin API routes
**What Moves**: Business logic → ECS/Lambda

---

### Phase 4: Message Queue (EventBridge / SQS)
**When**: Need async processing

**Pattern**:
```
API Gateway → Lambda (writes to SQS) → ECS Worker (processes queue)
```

---

# 🎯 12. Immediate Next Steps (Steps 6-20)

**Status**: Steps 1-5 ✅ COMPLETE

---

## ✅ Step 6 — Consent Ledger (CRITICAL) 🚀 NEXT

**Objective**: Enable consent grant/revoke; provide consent-checking API

**Tasks**:

1. **Create Consent API Endpoints**:
   - `POST /api/consent/grant`
   - `POST /api/consent/revoke`
   - `GET /api/consent/check`
   - `GET /api/consent/{actorId}`

2. **Implement Logic**:
   - Insert `action='granted'` into `consent_log`
   - Insert `action='revoked'` into `consent_log`
   - Query latest consent to determine active status

3. **Build Frontend**:
   - Actor dashboard: "My Consents" page
   - List consents (active/revoked/expired)
   - "Revoke" button

4. **Consent Enforcement Middleware**:
   - `requireConsent(actorId, consentType, projectId)`

**Files to Create**:
- `services/consent-service/src/handlers/grant-consent.ts`
- `services/consent-service/src/handlers/revoke-consent.ts`
- `services/consent-service/src/handlers/check-consent.ts`
- `apps/web/src/app/api/consent/grant/route.ts`
- `apps/web/src/app/api/consent/revoke/route.ts`
- `apps/web/src/app/api/consent/check/route.ts`
- `apps/web/src/app/dashboard/consents/page.tsx`

**Acceptance Criteria**:
- Actor can grant consent
- Actor can revoke consent
- External API can check consent validity
- Consent log is append-only

---

## Step 7 — Multi-Provider Identity Linking

**Objective**: Enable users to link external identity providers

**Tasks**:

1. **Database Migration 004**: Add `identity_links` table
2. **Create API**: `POST /api/identity/link`
3. **Integrate Onfido**:
   - `POST /api/verification/start`
   - Webhook handler
4. **Build UI**: "Verify Identity" page

**Dependencies**: `onfido-node`

---

## Step 8 — Identity Confidence Scoring

**Objective**: Calculate overall identity confidence

**Tasks**:

1. Implement `resolveIdentity(userId)` function
2. Create API: `GET /api/identity/{userId}/resolution`
3. Add confidence badge to UI

---

## Step 9 — Verifiable Credentials Issuance

**Objective**: Issue W3C VCs

**Tasks**:

1. **Migration 005**: Add `verifiable_credentials` table
2. Install VC libraries: `@digitalbazaar/vc`
3. Generate issuer keys (Ed25519)
4. Implement `POST /api/credentials/issue`
5. Create DID document endpoint

---

## Step 10 — Consent Proof API (Cryptographic)

**Objective**: Provide JWT-signed consent proofs

**Tasks**:

1. Generate RSA keypair for JWT signing
2. Implement proof generation in `GET /api/consent/check`
3. Create `GET /.well-known/jwks.json` (public key)
4. Documentation for external consumers

---

## Step 11 — Database Encryption (At Rest)

**Objective**: Encrypt sensitive fields at application level

**Tasks**:

1. Generate encryption key (AES-256)
2. Create encryption helpers (`crypto.ts`)
3. Encrypt `identity_links.credential_data`
4. Update API handlers

---

## Step 12 — API Rate Limiting & Security

**Objective**: Protect APIs from abuse

**Tasks**:

1. Configure API Gateway throttling
2. Implement API key system for Enterprise clients
3. Add API key validation middleware
4. Update CORS settings

---

## Step 13 — Audit Logging (All Actions)

**Objective**: Log all system actions

**Tasks**:

1. Create audit helper: `logAuditEvent()`
2. Add audit calls to all endpoints
3. Create admin audit dashboard

---

## Step 14 — Agent Profile & Relationships

**Objective**: Enable Agent role

**Tasks**:

1. **Migration 007**: Add `agents` table
2. Create Agent registration API
3. Create Agent-Actor relationship API
4. Update access control

---

## Step 15 — Enterprise Client Onboarding

**Objective**: Enable Enterprise role

**Tasks**:

1. **Migration 008**: Add `enterprises` table
2. Create Enterprise registration flow
3. Generate API keys (admin approved)
4. Create Enterprise dashboard

---

## Step 16 — CI/CD Pipeline

**Objective**: Automate deployment

**Tasks**:

1. Create GitHub Actions workflow
2. Setup secrets
3. Configure environments (main → production)

---

## Step 17 — Monitoring & Alerting

**Objective**: Detect issues proactively

**Tasks**:

1. Setup CloudWatch alarms
2. Integrate Sentry
3. Create monitoring dashboard

---

## Step 18 — UK Gov Verify Integration (OIDC)

**Objective**: Enable government ID verification

**Tasks**:

1. Register with UK One Login
2. Implement OIDC flow using `openid-client`
3. Store in `identity_links` with `verification_level='high'`

---

## Step 19 — Open Banking Integration

**Objective**: Enable bank-based verification

**Tasks**:

1. Choose provider (TrueLayer, Plaid, Yapily)
2. Implement OAuth2 flow
3. Store bank link in `identity_links`

---

## Step 20 — Selective Disclosure (BBS+)

**Objective**: Enable privacy-preserving credentials

**Tasks**:

1. Install `@mattrglobal/bbs-signatures`
2. Implement BBS+ issuance
3. Create proof derivation API

---

# 📊 Success Metrics

**Technical Milestones** (Next 90 Days):
- ✅ Steps 1-5 complete (current)
- ✅ Consent system operational (Step 6)
- ✅ Multi-provider linking (Steps 7-8)
- ✅ W3C VC issuance (Step 9)
- ✅ Encryption + security (Steps 11-12)

**Business Metrics**:
- 300+ actors onboarded
- 3+ agency relationships
- First licensed usage
- Revenue signals

**Compliance Readiness**:
- Audit logs complete
- Data encryption (at rest + in transit)
- RBAC implemented
- Consent management operational

---

# 🚦 Trade-Offs & Decision Points

## When to Use Vercel vs. AWS Lambda?

**Vercel**:
- ✅ Next.js frontend + simple APIs
- ❌ Long-running tasks (>10s)

**AWS Lambda**:
- ✅ Backend business logic
- ✅ Database operations
- ❌ Real-time WebSockets (use ECS)

---

## When to Adopt New Standards?

**Implement Now**:
- ✅ OIDC/OAuth2
- ✅ W3C VCs
- ✅ DID:web

**Phase 2**:
- ⏳ BBS+ Selective Disclosure
- ⏳ DID:key

**Phase 3+**:
- ⏳ zk-SNARKs
- ⏳ Blockchain DIDs

---

# 📝 Key Files & Locations

**Deployed Schema**:
- `infra/database/migrations/001_initial_schema.sql` ✅
- `infra/database/migrations/002_user_profiles.sql` ✅
- `infra/database/migrations/003_link_actors_to_user_profiles.sql` ✅

**Implemented Services**:
- `apps/web/src/app/api/identity/register/route.ts` ✅
- `apps/web/src/app/api/profile/route.ts` ✅
- `shared/middleware/src/index.ts` (JWT, RBAC) ✅

**Next Migrations (TODO)**:
- `004_identity_links.sql`
- `005_verifiable_credentials.sql`
- `006_kyc_verifications.sql`
- `007_agents.sql`
- `008_enterprises.sql`

**Services to Build**:
- `services/consent-service/` (Step 6) 🚀 NEXT
- `services/verification-service/` (Step 7)
- `services/credential-service/` (Step 9)

---

# 🏁 Summary

This architecture transforms Truly Imagined from a **single-product registry** into a **modular, secure, standards-compliant identity orchestration platform**.

**Current State**: Steps 1-5 complete (Auth0, PostgreSQL, Actor registration)  
**Next Priority**: Step 6 — Consent Ledger (CRITICAL for compliance & trust)

**Benefits**:
- ✅ Modular services (extensible)
- ✅ Standards-aligned (OIDC, W3C VCs, DIDs)
- ✅ Production-grade security
- ✅ Scalable infrastructure
- ✅ Compliance-ready (UK Trust Framework, eIDAS)

**Timeline**: Steps 6-20 → 60-90 days (depends on external integrations)

---

## ⚠️ IMPLEMENTATION PERMISSION REQUIRED

**Status**: Technical architecture revision complete ✅  
**Awaiting**: User permission to proceed with **Step 6 (Consent Ledger implementation)**

---

**END OF TECHNICAL ARCHITECTURE**
