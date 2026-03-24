/**
 * JWT Consent Proof Generation
 *
 * This module provides cryptographic proof of consent via JWT signatures.
 * External consumers can verify these proofs using the public key published
 * at /.well-known/jwks.json
 *
 * Standards:
 * - JWT (RFC 7519)
 * - JWS (RFC 7515)
 * - JWKS (RFC 7517)
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Generate a JWT-signed consent proof
 *
 * @param consentData - Consent record data
 * @returns JWT string that external consumers can verify
 */
export function generateConsentProof(consentData: {
  consentId: string;
  actorId: string;
  consentType: string;
  projectId?: string;
  projectName?: string;
  scope: Record<string, unknown>;
  grantedAt: string;
  expiresAt?: string;
}): string {
  // Retrieve private key from environment
  const privateKeyBase64 = process.env.CONSENT_SIGNING_PRIVATE_KEY;
  const keyId = process.env.CONSENT_SIGNING_KEY_ID || 'consent-key-1';

  if (!privateKeyBase64) {
    throw new Error(
      'CONSENT_SIGNING_PRIVATE_KEY not configured. Run: node scripts/generate-consent-signing-keys.js'
    );
  }

  // Decode private key from base64
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

  // Calculate expiration time for JWT (use consent expiry or 1 year default)
  const expiresAt = consentData.expiresAt
    ? new Date(consentData.expiresAt).getTime() / 1000
    : Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year

  // Construct JWT payload
  const payload = {
    // Standard JWT claims
    iss: 'did:web:trulyimagined.com', // Issuer (our DID)
    sub: consentData.actorId, // Subject (actor who granted consent)
    aud: 'https://api.trulyimagined.com', // Audience (who can verify)
    iat: Math.floor(Date.now() / 1000), // Issued at
    exp: expiresAt, // Expiration
    jti: consentData.consentId, // JWT ID (unique identifier)

    // Custom consent claims
    consent: {
      id: consentData.consentId,
      type: consentData.consentType,
      projectId: consentData.projectId || null,
      projectName: consentData.projectName || null,
      scope: consentData.scope,
      grantedAt: consentData.grantedAt,
      expiresAt: consentData.expiresAt || null,
    },

    // Metadata
    version: '1.0',
    standard: 'W3C-VC-compatible',
  };

  // Sign JWT with RSA-256
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    keyid: keyId,
  });

  return token;
}

/**
 * Verify a consent proof JWT (for testing or internal verification)
 *
 * External consumers should verify using the public key from /.well-known/jwks.json
 *
 * @param token - JWT string
 * @returns Decoded payload if valid, throws error if invalid
 */
export function verifyConsentProof(token: string): jwt.JwtPayload | string {
  const publicKeyBase64 = process.env.CONSENT_SIGNING_PUBLIC_KEY;

  if (!publicKeyBase64) {
    throw new Error('CONSENT_SIGNING_PUBLIC_KEY not configured');
  }

  const publicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: 'did:web:trulyimagined.com',
      audience: 'https://api.trulyimagined.com',
    });

    return decoded;
  } catch (error) {
    const err = error as Error;
    throw new Error(`Invalid consent proof: ${err.message}`);
  }
}

/**
 * Get JWKS (JSON Web Key Set) for public key publication
 *
 * This should be exposed at /.well-known/jwks.json
 *
 * @returns JWKS object
 */
export function getConsentSigningJWKS(): { keys: Array<Record<string, unknown>> } {
  const publicKeyBase64 = process.env.CONSENT_SIGNING_PUBLIC_KEY;
  const keyId = process.env.CONSENT_SIGNING_KEY_ID || 'consent-key-1';

  if (!publicKeyBase64) {
    throw new Error('CONSENT_SIGNING_PUBLIC_KEY not configured');
  }

  const publicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');

  // Convert PEM to JWK
  const publicKeyObject = crypto.createPublicKey(publicKey);
  const jwk = publicKeyObject.export({ format: 'jwk' });

  return {
    keys: [
      {
        ...jwk,
        kid: keyId,
        use: 'sig',
        alg: 'RS256',
        key_ops: ['verify'],
      },
    ],
  };
}

/**
 * Example usage for external consumers (documentation)
 */
export const EXTERNAL_VERIFICATION_EXAMPLE = `
// External Consumer: Verify Consent Proof
// 
// Step 1: Fetch public key from JWKS endpoint
const jwksResponse = await fetch('https://trulyimagined.com/.well-known/jwks.json');
const jwks = await jwksResponse.json();

// Step 2: Verify JWT using public key
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'https://trulyimagined.com/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 86400000 // 24 hours
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Verify the proof JWT
jwt.verify(consentProofToken, getKey, {
  issuer: 'did:web:trulyimagined.com',
  audience: 'https://api.trulyimagined.com',
  algorithms: ['RS256']
}, (err, decoded) => {
  if (err) {
    console.error('Invalid consent proof:', err.message);
    return;
  }
  
  console.log('✅ Consent is valid:', decoded.consent);
  // Access consent details:
  // - decoded.consent.id
  // - decoded.consent.type
  // - decoded.consent.scope
  // - decoded.exp (expiration timestamp)
});
`;
