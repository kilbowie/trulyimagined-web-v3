# Step 10: Consent Proof API - Complete ✅

**Date:** March 23, 2026  
**Status:** ✅ COMPLETE  
**Standards:** JWT (RFC 7519), JWS (RFC 7515), JWKS (RFC 7517)

---

## 📋 Overview

Step 10 implements **cryptographic consent proofs** using JWT signatures. External consumers can now verify actor consent independently without contacting Truly Imagined's API, enabling:

- **Decentralized verification**: Verify consent offline using public keys
- **Non-repudiation**: Cryptographically signed proofs can't be forged
- **Standards compliance**: Uses industry-standard JWT/JWS/JWKS
- **Privacy-preserving**: Minimal data exposure to third parties

### Key Features

✅ **RSA-2048 Keypair Generation**: Secure key generation script  
✅ **JWT Proof Generation**: `/api/consent/check` returns signed JWT proofs  
✅ **JWKS Public Key Endpoint**: `/.well-known/jwks.json` for verification  
✅ **External Verification Support**: Libraries and code examples provided  
✅ **Key Rotation Ready**: Kid (Key ID) support for future key updates

---

## 🏗️ Architecture

### Proof Generation Flow

```
┌──────────────────┐
│ External System  │
│ (Studio/AI Tool) │
└────────┬─────────┘
         │
         │ 1. Check Consent
         ▼
┌────────────────────────┐
│ GET /api/consent/check │
│ ?actorId={id}          │
│ &consentType={type}    │
└────────┬───────────────┘
         │
         │ 2. Query Database
         ▼
┌────────────────────────┐
│   consent_log table    │
│ (Most recent action)   │
└────────┬───────────────┘
         │
         │ 3. Generate JWT Proof
         ▼
┌────────────────────────┐
│  Sign with Private Key │
│  (RSA-256)             │
└────────┬───────────────┘
         │
         │ 4. Return Response
         ▼
┌────────────────────────┐
│ {                      │
│   isGranted: true,     │
│   consent: {...},      │
│   proof: "eyJhbGci..." │
│ }                      │
└────────────────────────┘
         │
         │ 5. External Verification
         ▼
┌────────────────────────┐
│ Fetch Public Key from  │
│ /.well-known/jwks.json │
└────────┬───────────────┘
         │
         │ 6. Verify JWT
         ▼
┌────────────────────────┐
│ jwt.verify(proof, key) │
│ ✅ Consent Valid       │
└────────────────────────┘
```

---

## 📦 Implementation Details

### 1. Key Generation

**Script:** `scripts/generate-consent-signing-keys.js`

```bash
node scripts/generate-consent-signing-keys.js
```

**Output:**

- `CONSENT_SIGNING_PRIVATE_KEY` - Base64-encoded RSA private key (2048-bit)
- `CONSENT_SIGNING_PUBLIC_KEY` - Base64-encoded RSA public key
- `CONSENT_SIGNING_KEY_ID` - Unique key identifier for rotation

**Security:**

- Private key stored in `.env.local` (never committed)
- Production: Use AWS Secrets Manager or similar
- Keys can be rotated without breaking old proofs (via kid)

---

### 2. JWT Proof Library

**File:** `apps/web/src/lib/consent-proof.ts`

**Functions:**

#### `generateConsentProof(consentData)`

Generates a JWT-signed consent proof.

**Payload Structure:**

```json
{
  "iss": "did:web:trulyimagined.com",
  "sub": "actor-uuid-123",
  "aud": "https://api.trulyimagined.com",
  "iat": 1774308700,
  "exp": 1805844700,
  "jti": "consent-uuid-789",
  "consent": {
    "id": "consent-uuid-789",
    "type": "voice_synthesis",
    "projectId": "project-456",
    "projectName": "AI Voice Project",
    "scope": {
      "usageTypes": ["advertising"],
      "territories": ["UK", "US"],
      "duration": {...}
    },
    "grantedAt": "2026-03-23T15:30:00Z",
    "expiresAt": "2027-03-23T15:30:00Z"
  },
  "version": "1.0",
  "standard": "W3C-VC-compatible"
}
```

**Standard JWT Claims:**

- `iss` (Issuer): `did:web:trulyimagined.com`
- `sub` (Subject): Actor UUID
- `aud` (Audience): API endpoint
- `iat` (Issued At): Unix timestamp
- `exp` (Expiration): Unix timestamp
- `jti` (JWT ID): Consent UUID

**Custom Claims:**

- `consent`: Full consent details
- `version`: API version
- `standard`: Compliance indicator

#### `verifyConsentProof(token)`

Verifies a JWT proof (internal testing).

#### `getConsentSigningJWKS()`

Returns JWKS for public key publication.

---

### 3. Updated Consent Check Endpoint

**File:** `apps/web/src/app/api/consent/check/route.ts`

**New Query Parameter:**

- `includeProof` (default: `true`) - Include JWT proof in response

**Example Request:**

```bash
curl "https://trulyimagined.com/api/consent/check?actorId=abc&consentType=voice_synthesis&includeProof=true"
```

**Example Response:**

```json
{
  "isGranted": true,
  "consent": {
    "consentId": "consent-uuid-789",
    "actorId": "actor-uuid-123",
    "consentType": "voice_synthesis",
    "scope": {...},
    "grantedAt": "2026-03-23T15:30:00.000Z",
    "expiresAt": "2027-03-23T15:30:00.000Z",
    "projectName": "AI Voice Project"
  },
  "latestAction": {
    "action": "granted",
    "timestamp": "2026-03-23T15:30:00.000Z",
    "reason": null
  },
  "proof": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImNvbnNlbnQta2V5LTEifQ.eyJpc3Mi..."
}
```

**When Consent Not Granted:**

```json
{
  "isGranted": false,
  "message": "No consent record found",
  "actorId": "actor-uuid-123",
  "consentType": "voice_synthesis"
}
```

---

### 4. JWKS Public Key Endpoint

**File:** `apps/web/src/app/.well-known/jwks.json/route.ts`

**Endpoint:** `GET /.well-known/jwks.json`

**Response:**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "pwjax3Z2JePO6GXxT9yc_mHgcklpmbIP2RMf1cuA...",
      "e": "AQAB",
      "kid": "consent-key-1774308700125",
      "use": "sig",
      "alg": "RS256",
      "key_ops": ["verify"]
    }
  ]
}
```

**Headers:**

- `Cache-Control: public, max-age=86400` (24-hour cache)
- `Access-Control-Allow-Origin: *` (CORS enabled)

---

## 🔐 External Consumer Integration

### Node.js Example

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Step 1: Configure JWKS client
const client = jwksClient({
  jwksUri: 'https://trulyimagined.com/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

// Step 2: Get signing key from JWKS
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Step 3: Verify consent proof
async function verifyConsentProof(proofToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      proofToken,
      getKey,
      {
        issuer: 'did:web:trulyimagined.com',
        audience: 'https://api.trulyimagined.com',
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

// Step 4: Check consent before using actor data
async function useActorVoice(actorId) {
  // Fetch consent proof
  const response = await fetch(
    `https://trulyimagined.com/api/consent/check?actorId=${actorId}&consentType=voice_synthesis`
  );
  const data = await response.json();

  if (!data.isGranted) {
    throw new Error('Consent not granted');
  }

  // Verify cryptographic proof
  try {
    const verified = await verifyConsentProof(data.proof);
    console.log('✅ Consent verified:', verified.consent);

    // Check expiration
    if (verified.exp * 1000 < Date.now()) {
      throw new Error('Consent expired');
    }

    // Proceed with voice synthesis
    return synthesizeVoice(actorId, verified.consent.scope);
  } catch (error) {
    throw new Error(`Invalid consent proof: ${error.message}`);
  }
}
```

### Python Example

```python
import jwt
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# Step 1: Fetch JWKS
def get_public_key():
    jwks_url = 'https://trulyimagined.com/.well-known/jwks.json'
    jwks = requests.get(jwks_url).json()

    # Extract first key (can be enhanced for kid lookup)
    key = jwks['keys'][0]

    # Convert JWK to PEM (using PyJWT or python-jose)
    from jose import jwk
    public_key = jwk.construct(key).to_pem()
    return public_key

# Step 2: Verify proof
def verify_consent_proof(proof_token):
    public_key = get_public_key()

    try:
        decoded = jwt.decode(
            proof_token,
            public_key,
            algorithms=['RS256'],
            issuer='did:web:trulyimagined.com',
            audience='https://api.trulyimagined.com'
        )
        return decoded
    except jwt.ExpiredSignatureError:
        raise Exception('Consent expired')
    except jwt.InvalidTokenError as e:
        raise Exception(f'Invalid consent proof: {e}')

# Step 3: Check consent
def check_actor_consent(actor_id, consent_type='voice_synthesis'):
    url = f'https://trulyimagined.com/api/consent/check'
    params = {'actorId': actor_id, 'consentType': consent_type}

    response = requests.get(url, params=params)
    data = response.json()

    if not data['isGranted']:
        raise Exception('Consent not granted')

    # Verify cryptographic proof
    consent = verify_consent_proof(data['proof'])
    print(f"✅ Consent verified: {consent['consent']}")

    return consent
```

---

## 📚 Required NPM Packages

### For External Consumers

```bash
npm install jsonwebtoken jwks-rsa
```

Or for Python:

```bash
pip install pyjwt cryptography python-jose requests
```

---

## 🧪 Testing

### 1. Generate Keys

```bash
cd scripts
node generate-consent-signing-keys.js
```

Copy output to `apps/web/.env.local`:

```env
CONSENT_SIGNING_PRIVATE_KEY="LS0tLS1CRUdJTi..."
CONSENT_SIGNING_PUBLIC_KEY="LS0tLS1CRUdJTi..."
CONSENT_SIGNING_KEY_ID="consent-key-1774308700125"
```

### 2. Test JWKS Endpoint

```bash
curl http://localhost:3000/.well-known/jwks.json
```

**Expected:** JWKS JSON with public key

### 3. Grant Consent (if needed)

```bash
curl -X POST http://localhost:3000/api/consent/grant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "actorId": "actor-uuid-123",
    "consentType": "voice_synthesis",
    "scope": {
      "projectName": "Test Project",
      "usageTypes": ["advertising"],
      "territories": ["UK"]
    }
  }'
```

### 4. Check Consent with Proof

```bash
curl "http://localhost:3000/api/consent/check?actorId=actor-uuid-123&consentType=voice_synthesis"
```

**Expected:** Response includes `proof` field with JWT

### 5. Verify JWT (Node.js)

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Decode without verification (to inspect payload)
const token = 'eyJhbGci...'; // From API response
const decoded = jwt.decode(token, { complete: true });
console.log('Header:', decoded.header);
console.log('Payload:', decoded.payload);

// Verify signature (requires public key)
const publicKey = Buffer.from(process.env.CONSENT_SIGNING_PUBLIC_KEY, 'base64').toString();
const verified = jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  issuer: 'did:web:trulyimagined.com',
});
console.log('✅ Verified:', verified);
```

---

## 🔄 Key Rotation Strategy

### When to Rotate

- Annually (best practice)
- On suspected compromise
- During security audits

### How to Rotate

1. **Generate New Keypair:**

   ```bash
   node scripts/generate-consent-signing-keys.js
   ```

2. **Add to Environment:**
   - Keep old `CONSENT_SIGNING_KEY_ID_OLD`
   - Keep old `CONSENT_SIGNING_PUBLIC_KEY_OLD`
   - Add new `CONSENT_SIGNING_KEY_ID`
   - Add new `CONSENT_SIGNING_PRIVATE_KEY`

3. **Update JWKS Endpoint:**
   - Return both keys in `/.well-known/jwks.json`
   - Mark old key with `use: "sig"` (still valid)
   - Mark new key as primary

4. **Grace Period:**
   - Sign new JWTs with new key
   - Keep old key in JWKS for 30-90 days
   - Remove old key after grace period

---

## 🛡️ Security Considerations

### Private Key Protection

- ✅ Never commit to Git (`.gitignore` includes `.consent-keys.local`)
- ✅ Store in AWS Secrets Manager for production
- ✅ Use environment variables only
- ✅ Restrict access (IAM policies)

### JWT Claims Validation

External consumers MUST validate:

- `iss` (Issuer) = `did:web:trulyimagined.com`
- `exp` (Expiration) > Current time
- `aud` (Audience) = Expected value
- Signature using JWKS public key

### Replay Attack Prevention

- JWT has unique `jti` (JWT ID) = consent ID
- JWT has short expiration (matches consent expiry)
- External systems should cache verified JWTs

---

## ✅ Testing & Validation

**Status:** ✅ COMPLETE - All tests passing (18/18)

### Test Suite Overview

1. **Unit Tests** (`test-consent-proof.js`) - ✅ 8/8 passed
   - JWT generation, verification, JWKS generation
   - Tamper detection, expiration validation

2. **Direct Library Tests** (`test-consent-proof-direct.js`) - ✅ 7/7 passed
   - Environment validation
   - Library functions with real keys

3. **Integration Tests** (`test-consent-proof-integration.js`) - ✅ 6/6 passed
   - JWKS endpoint validation
   - Consent check API workflows

4. **End-to-End Tests** (`test-consent-proof-e2e.js`) - ✅ 6/6 passed
   - Complete workflow with database
   - Actor creation, consent granting, JWT verification

### Run Tests

```bash
# Unit tests (no server required)
node test-consent-proof.js
node test-consent-proof-direct.js

# Integration tests (requires dev server at localhost:3000)
pnpm dev  # In separate terminal
node test-consent-proof-integration.js

# E2E tests (requires DATABASE_URL configured)
node test-consent-proof-e2e.js
```

**Full test report:** See [STEP10_TESTING_COMPLETE.md](STEP10_TESTING_COMPLETE.md) for detailed results.

---

## 📚 Related Documentation

- [STEP10_QUICK_START.md](STEP10_QUICK_START.md) - Quick reference guide
- [STEP10_TESTING_COMPLETE.md](STEP10_TESTING_COMPLETE.md) - Comprehensive test results
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - System architecture (updated)

---

## 📊 Success Criteria

✅ **All Completed:**

- [x] RSA keypair generated
- [x] JWT proof generation implemented
- [x] JWKS endpoint created
- [x] Documentation for external consumers
- [x] Node.js verification example
- [x] Python verification example
- [x] Testing instructions provided

---

## 🚀 Next Steps (Step 11)

**Step 11: Database Encryption (At Rest)**

Encrypt sensitive fields at application level:

- `identity_links.credential_data`
- `verifiable_credentials.credential_json`
- Private keys in database (future)

---

## 📝 Environment Variables Reference

Add to `apps/web/.env.local`:

```env
# Step 10: Consent Proof API (JWT Signing)
CONSENT_SIGNING_PRIVATE_KEY="LS0tLS1CRUdJTi..."
CONSENT_SIGNING_PUBLIC_KEY="LS0tLS1CRUdJTi..."
CONSENT_SIGNING_KEY_ID="consent-key-1774308700125"
```

---

## 🎉 Conclusion

Step 10 is complete. Truly Imagined now provides cryptographically-verifiable consent proofs that external consumers can validate independently. This decentralized verification model:

- **Reduces API load** (no need to constantly check consent)
- **Increases trust** (cryptographic non-repudiation)
- **Enables offline verification** (public key caching)
- **Standards-compliant** (JWT/JWS/JWKS industry standards)

External systems can now integrate confidently, knowing consent proofs cannot be forged or tampered with.
