# Step 10 Implementation - Quick Start Guide

## Overview

Step 10: Consent Proof API (Cryptographic) has been successfully implemented! 🎉

This feature provides JWT-signed consent proofs that external consumers can verify independently.

---

## 🚀 Quick Setup

### 1. Generate RSA Keypair

```bash
cd scripts
node generate-consent-signing-keys.js
```

This will output three environment variables you need to add to your `.env.local` file.

### 2. Add Keys to Environment

Copy the output from step 1 and add to `apps/web/.env.local`:

```env
CONSENT_SIGNING_PRIVATE_KEY="LS0tLS1CRUdJTi..."
CONSENT_SIGNING_PUBLIC_KEY="LS0tLS1CRUdJTi..."
CONSENT_SIGNING_KEY_ID="consent-key-1234567890"
```

**⚠️ IMPORTANT:**

- Never commit these keys to Git!
- The `.consent-keys.local` file is already in `.gitignore`
- For production, store keys in AWS Secrets Manager

### 3. Install Dependencies (Already Done)

The following packages have been added:

- `jsonwebtoken@^9.0.2`
- `@types/jsonwebtoken@^9.0.5`

Run `pnpm install` if not already done.

---

## 📦 What Was Implemented

### Files Created

1. **`scripts/generate-consent-signing-keys.js`**
   - Generates RSA-2048 keypair for JWT signing
   - Outputs environment variables and JWKS format

2. **`apps/web/src/lib/consent-proof.ts`**
   - `generateConsentProof()` - Creates JWT-signed consent proofs
   - `verifyConsentProof()` - Verifies JWT signatures (for testing)
   - `getConsentSigningJWKS()` - Returns JWKS for public key

3. **`apps/web/src/app/.well-known/jwks.json/route.ts`**
   - Public endpoint for key verification
   - GET `/.well-known/jwks.json`
   - CORS enabled, 24-hour cache

4. **`STEP10_COMPLETE.md`**
   - Complete documentation
   - External consumer integration examples (Node.js & Python)
   - Security considerations
   - Testing instructions

5. **`test-consent-proof.js`**
   - Test script that validates JWT generation/verification
   - Run with: `node test-consent-proof.js`

### Files Modified

1. **`apps/web/src/app/api/consent/check/route.ts`**
   - Added `includeProof` query parameter (default: true)
   - Generates JWT proof for granted consents
   - Returns `proof` field in response

2. **`apps/web/.env.example`**
   - Added consent signing keys section

3. **`apps/web/package.json`**
   - Added `jsonwebtoken` dependency

---

## 🧪 Testing

### 1. Run Unit Tests

```bash
node test-consent-proof.js
```

**Expected output:**

```
🎉 All Tests Passed!
✅ JWT Generation: Working
✅ JWT Verification: Working
✅ JWKS Generation: Working
✅ Tamper Detection: Working
✅ Expiry Detection: Working
```

### 2. Test JWKS Endpoint

Start the dev server:

```bash
pnpm dev
```

Test the endpoint:

```bash
curl http://localhost:3000/.well-known/jwks.json
```

**Expected:** JSON response with public key in JWKS format

### 3. Test Consent Check with Proof

```bash
curl "http://localhost:3000/api/consent/check?actorId=YOUR_ACTOR_ID&consentType=voice_synthesis"
```

**Expected response (if consent granted):**

```json
{
  "isGranted": true,
  "consent": { ... },
  "latestAction": { ... },
  "proof": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImNvbnNlbnQta2V5LTEifQ..."
}
```

---

## 🔐 Security Notes

### Private Key Protection

- ✅ `.consent-keys.local` is in `.gitignore`
- ✅ Private key should NEVER be committed to Git
- ✅ For production: Use AWS Secrets Manager
- ✅ Key rotation supported via unique Key ID (kid)

### JWT Validation (External Consumers)

External systems MUST validate:

1. **Signature** - Using public key from `/.well-known/jwks.json`
2. **Issuer** - Must be `did:web:trulyimagined.com`
3. **Expiration** - Check `exp` claim
4. **Audience** - Should match expected value

---

## 📚 For External Consumers

### Node.js Integration

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'https://trulyimagined.com/.well-known/jwks.json',
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

jwt.verify(
  proofToken,
  getKey,
  {
    issuer: 'did:web:trulyimagined.com',
    algorithms: ['RS256'],
  },
  (err, decoded) => {
    if (!err) {
      console.log('✅ Consent valid:', decoded.consent);
    }
  }
);
```

Full examples in `STEP10_COMPLETE.md`

---

## 🎯 What's Next?

**Step 11: Database Encryption (At Rest)**

Encrypt sensitive fields at application level:

- `identity_links.credential_data`
- `verifiable_credentials.credential_json`

See `TECHNICAL_ARCHITECTURE.md` for details.

---

## 📖 Additional Resources

- **Full Documentation:** `STEP10_COMPLETE.md`
- **External Integration Guide:** See "External Consumer Integration" section in `STEP10_COMPLETE.md`
- **Technical Architecture:** `TECHNICAL_ARCHITECTURE.md` (Step 10 section)

---

## ✅ Checklist

Before deploying to production:

- [ ] Generate production RSA keypair
- [ ] Store private key in AWS Secrets Manager
- [ ] Add keys to production environment variables
- [ ] Test JWKS endpoint in production
- [ ] Test consent check with proof
- [ ] Provide integration docs to external consumers
- [ ] Set up key rotation schedule (annually)

---

## 🎉 Success!

Step 10 is complete. The consent proof API is now ready for external consumers to verify actor consent cryptographically!
