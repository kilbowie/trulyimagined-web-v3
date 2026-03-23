/**
 * Truly Imagined v3 - W3C Verifiable Credentials Library
 *
 * Standards Compliance:
 * - W3C Verifiable Credentials Data Model 2.0 (https://www.w3.org/TR/vc-data-model-2.0/)
 * - W3C DID Core 1.0 (did:web method)
 * - Ed25519Signature2020 cryptographic suite
 *
 * Features:
 * - Issue W3C Verifiable Credentials (v2.0 format)
 * - Verify credential signatures
 * - Revoke credentials
 * - Generate DID documents
 *
 * V2.0 Changes:
 * - Context: https://www.w3.org/ns/credentials/v2 (was v1)
 * - Date fields: validFrom/validUntil (was issuanceDate/expirationDate)
 * - JSON-LD 1.1 processing model
 */

import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import * as vc from '@digitalbazaar/vc';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { BitstringStatusListEntry } from './bitstring-status-list';

// ===========================================
// TYPES & SCHEMAS
// ===========================================

export const CredentialTypeSchema = z.enum([
  'IdentityCredential',
  'AgentCredential',
  'ActorCredential',
  'EnterpriseCredential',
  'VerifiedAgeCredential',
  'VerifiedProfessionalCredential',
]);

export type CredentialType = z.infer<typeof CredentialTypeSchema>;

export interface CredentialSubject {
  id: string; // holder DID
  [key: string]: unknown; // Additional claims based on credential type
}

export interface VerifiableCredential {
  '@context': string[];
  id: string; // W3C VC 2.0: unique credential identifier (URL)
  type: string[];
  issuer: string;
  validFrom: string; // W3C VC 2.0: replaces issuanceDate
  validUntil?: string; // W3C VC 2.0: replaces expirationDate
  credentialSubject: CredentialSubject;
  credentialStatus?: BitstringStatusListEntry | BitstringStatusListEntry[]; // W3C Bitstring Status List v1.0
  proof?: Record<string, unknown>; // Cryptographic proof
}

export interface IssueCredentialOptions {
  credentialType: CredentialType;
  holderDid: string;
  holderProfileId: string;
  claims: Record<string, unknown>;
  expiresInDays?: number;
  credentialStatus?: BitstringStatusListEntry | BitstringStatusListEntry[]; // Optional status list entry
}

// ===========================================
// ISSUER KEYPAIR INITIALIZATION
// ===========================================

let issuerKeyPair: Ed25519VerificationKey2020 | null = null;

/**
 * Initialize the issuer's Ed25519 keypair from environment variables
 * Uses lazy loading to avoid initialization errors
 */
async function getIssuerKeyPair(): Promise<Ed25519VerificationKey2020> {
  if (issuerKeyPair) {
    return issuerKeyPair;
  }

  const publicKey = process.env.ISSUER_ED25519_PUBLIC_KEY;
  const privateKey = process.env.ISSUER_ED25519_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error(
      'Missing Ed25519 keypair in environment. ' + 'Run: node scripts/generate-issuer-keys.js'
    );
  }

  // Import keypair from multibase-encoded strings
  issuerKeyPair = await Ed25519VerificationKey2020.from({
    id: 'did:web:trulyimagined.com#key-1',
    controller: 'did:web:trulyimagined.com',
    publicKeyMultibase: publicKey,
    privateKeyMultibase: privateKey,
  });

  return issuerKeyPair;
}

// ===========================================
// ISSUE VERIFIABLE CREDENTIAL
// ===========================================

/**
 * Issue a W3C Verifiable Credential to a user (v2.0 format)
 *
 * @param options - Credential issuance options
 * @returns Signed Verifiable Credential (W3C VC 2.0 format)
 *
 * @example
 * ```typescript
 * const credential = await issueCredential({
 *   credentialType: 'IdentityCredential',
 *   holderDid: 'did:web:trulyimagined.com:users:123e4567-e89b-12d3-a456-426614174000',
 *   holderProfileId: '123e4567-e89b-12d3-a456-426614174000',
 *   claims: {
 *     legalName: 'Jane Doe',
 *     verificationLevel: 'high',
 *     verifiedAt: new Date().toISOString(),
 *   },
 *   expiresInDays: 365,
 * });
 * ```
 */
export async function issueCredential(
  options: IssueCredentialOptions
): Promise<VerifiableCredential> {
  const { credentialType, holderDid, holderProfileId, claims, expiresInDays, credentialStatus } =
    options;

  // Validate credential type
  CredentialTypeSchema.parse(credentialType);

  // Initialize issuer keypair
  const keyPair = await getIssuerKeyPair();

  // Create signature suite
  const suite = new Ed25519Signature2020({ key: keyPair });

  // Valid from date (now) - W3C VC 2.0 format
  const validFrom = new Date().toISOString();

  // Valid until date (optional) - W3C VC 2.0 format
  let validUntil: string | undefined;
  if (expiresInDays) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + expiresInDays);
    validUntil = expDate.toISOString();
  }

  // Generate unique credential ID (W3C VC 2.0 requirement)
  const credentialId = `https://trulyimagined.com/api/credentials/${randomUUID()}`;

  // Build credential subject
  const credentialSubject: CredentialSubject = {
    id: holderDid,
    profileId: holderProfileId,
    ...claims,
  };

  // Build context array (include status context if credentialStatus provided)
  const contextArray = [
    'https://www.w3.org/ns/credentials/v2', // W3C VC 2.0 context
    'https://www.w3.org/ns/credentials/examples/v2', // Examples context
  ];

  if (credentialStatus) {
    contextArray.push('https://www.w3.org/ns/credentials/status/v1'); // W3C Bitstring Status List context
  }

  // Build unsigned credential (W3C VC 2.0 format)
  const unsignedCredential: Record<string, unknown> = {
    '@context': contextArray,
    id: credentialId, // W3C VC 2.0: unique credential identifier
    type: ['VerifiableCredential', credentialType],
    issuer: 'did:web:trulyimagined.com',
    validFrom, // W3C VC 2.0: replaces issuanceDate
    ...(validUntil && { validUntil }), // W3C VC 2.0: replaces expirationDate
    credentialSubject,
  };

  // Add credentialStatus if provided (W3C Bitstring Status List v1.0)
  if (credentialStatus) {
    unsignedCredential.credentialStatus = credentialStatus;
  }

  // Sign the credential
  const signedCredential = await vc.issue({
    credential: unsignedCredential,
    suite,
    documentLoader: customDocumentLoader,
  });

  return signedCredential as VerifiableCredential;
}

// ===========================================
// VERIFY VERIFIABLE CREDENTIAL
// ===========================================

/**
 * Verify a W3C Verifiable Credential's signature and integrity
 *
 * @param credential - The credential to verify
 * @returns Verification result with success status
 *
 * @example
 * ```typescript
 * const result = await verifyCredential(credential);
 * if (result.verified) {
 *   console.log('✅ Credential is valid');
 * } else {
 *   console.log('❌ Verification failed:', result.error);
 * }
 * ```
 */
export async function verifyCredential(
  credential: VerifiableCredential
): Promise<{ verified: boolean; error?: unknown }> {
  try {
    const keyPair = await getIssuerKeyPair();
    const suite = new Ed25519Signature2020({ key: keyPair });

    const result = await vc.verifyCredential({
      credential,
      suite,
      documentLoader: customDocumentLoader,
    });

    return {
      verified: result.verified,
      error: result.error,
    };
  } catch (error) {
    return {
      verified: false,
      error,
    };
  }
}

// ===========================================
// GENERATE DID DOCUMENT
// ===========================================

/**
 * Generate a W3C DID Document for a user
 * Uses did:web method (HTTPS-based, no blockchain required)
 *
 * @param userId - User's profile ID (UUID)
 * @param publicKeyMultibase - User's public key (optional, for user-controlled keys)
 * @returns DID Document (W3C DID Core 1.0)
 *
 * @example
 * ```typescript
 * const didDoc = await generateDidDocument('123e4567-e89b-12d3-a456-426614174000');
 * // DID: did:web:trulyimagined.com:users:123e4567-e89b-12d3-a456-426614174000
 * ```
 */
export async function generateDidDocument(
  userId: string,
  publicKeyMultibase?: string
): Promise<Record<string, unknown>> {
  const did = `did:web:trulyimagined.com:users:${userId}`;

  // If user has their own key, use it. Otherwise, use platform's key
  const keyPair = await getIssuerKeyPair();
  const verificationMethod = {
    id: `${did}#key-1`,
    type: 'Ed25519VerificationKey2020',
    controller: did,
    publicKeyMultibase: publicKeyMultibase || keyPair.publicKeyMultibase,
  };

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethod.id],
    assertionMethod: [verificationMethod.id],
    capabilityDelegation: [verificationMethod.id],
    capabilityInvocation: [verificationMethod.id],
  };
}

/**
 * Generate platform issuer DID Document
 * Published at /.well-known/did.json
 */
export async function generateIssuerDidDocument(): Promise<Record<string, unknown>> {
  const keyPair = await getIssuerKeyPair();
  const did = 'did:web:trulyimagined.com';

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: `${did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: keyPair.publicKeyMultibase,
      },
    ],
    authentication: [`${did}#key-1`],
    assertionMethod: [`${did}#key-1`],
    capabilityDelegation: [`${did}#key-1`],
    capabilityInvocation: [`${did}#key-1`],
    service: [
      {
        id: `${did}#credentials`,
        type: 'CredentialIssuer',
        serviceEndpoint: 'https://trulyimagined.com/api/credentials/issue',
      },
    ],
  };
}

// ===========================================
// DOCUMENT LOADER (for W3C contexts)
// ===========================================

/**
 * Custom document loader for resolving W3C credential contexts
 * Required by @digitalbazaar/vc library
 *
 * Supports W3C VC Data Model 2.0 contexts
 */
async function customDocumentLoader(url: string): Promise<Record<string, unknown>> {
  // W3C Verifiable Credentials v2.0 context
  if (url === 'https://www.w3.org/ns/credentials/v2') {
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': {
          '@version': 1.1,
          '@protected': true,
          '@vocab': 'https://www.w3.org/ns/credentials/issuer-dependent#',
          id: '@id',
          type: '@type',
          VerifiableCredential: {
            '@id': 'https://www.w3.org/2018/credentials#VerifiableCredential',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              credentialSubject: {
                '@id': 'https://www.w3.org/2018/credentials#credentialSubject',
                '@type': '@id',
              },
              issuer: {
                '@id': 'https://www.w3.org/2018/credentials#issuer',
                '@type': '@id',
              },
              validFrom: {
                '@id': 'https://www.w3.org/2018/credentials#validFrom',
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
              },
              validUntil: {
                '@id': 'https://www.w3.org/2018/credentials#validUntil',
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
              },
            },
          },
          VerifiablePresentation: {
            '@id': 'https://www.w3.org/2018/credentials#VerifiablePresentation',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              verifiableCredential: {
                '@id': 'https://www.w3.org/2018/credentials#verifiableCredential',
                '@type': '@id',
                '@container': '@graph',
              },
            },
          },
          credentialStatus: {
            '@id': 'https://www.w3.org/2018/credentials#credentialStatus',
            '@type': '@id',
          },
          credentialSchema: {
            '@id': 'https://www.w3.org/2018/credentials#credentialSchema',
            '@type': '@id',
          },
          evidence: {
            '@id': 'https://www.w3.org/2018/credentials#evidence',
            '@type': '@id',
          },
          termsOfUse: {
            '@id': 'https://www.w3.org/2018/credentials#termsOfUse',
            '@type': '@id',
          },
        },
      },
    };
  }

  // W3C Credentials examples v2 context
  if (url === 'https://www.w3.org/ns/credentials/examples/v2') {
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': {
          '@version': 1.1,
          '@protected': true,
          // Custom credential types
          IdentityCredential: 'https://trulyimagined.com/credentials#IdentityCredential',
          AgentCredential: 'https://trulyimagined.com/credentials#AgentCredential',
          ActorCredential: 'https://trulyimagined.com/credentials#ActorCredential',
          EnterpriseCredential: 'https://trulyimagined.com/credentials#EnterpriseCredential',
          VerifiedAgeCredential: 'https://trulyimagined.com/credentials#VerifiedAgeCredential',
          VerifiedProfessionalCredential:
            'https://trulyimagined.com/credentials#VerifiedProfessionalCredential',
          // Custom properties
          profileId: 'https://trulyimagined.com/credentials#profileId',
          legalName: 'https://trulyimagined.com/credentials#legalName',
          verificationLevel: 'https://trulyimagined.com/credentials#verificationLevel',
          verifiedAt: {
            '@id': 'https://trulyimagined.com/credentials#verifiedAt',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
        },
      },
    };
  }

  // W3C Verifiable Credentials v1.1 context (backwards compatibility)
  if (url === 'https://www.w3.org/2018/credentials/v1') {
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': {
          '@version': 1.1,
          '@protected': true,
          VerifiableCredential: {
            '@id': 'https://www.w3.org/2018/credentials#VerifiableCredential',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
            },
          },
        },
      },
    };
  }

  // W3C Credentials examples v1 context (backwards compatibility)
  if (url === 'https://www.w3.org/2018/credentials/examples/v1') {
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': {},
      },
    };
  }

  // Ed25519 signature suite context
  if (url === 'https://w3id.org/security/suites/ed25519-2020/v1') {
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': {
          '@version': 1.1,
          '@protected': true,
          Ed25519VerificationKey2020: {
            '@id': 'https://w3id.org/security#Ed25519VerificationKey2020',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              controller: {
                '@id': 'https://w3id.org/security#controller',
                '@type': '@id',
              },
              publicKeyMultibase: {
                '@id': 'https://w3id.org/security#publicKeyMultibase',
              },
            },
          },
          Ed25519Signature2020: {
            '@id': 'https://w3id.org/security#Ed25519Signature2020',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              verificationMethod: {
                '@id': 'https://w3id.org/security#verificationMethod',
                '@type': '@id',
              },
              proofPurpose: {
                '@id': 'https://w3id.org/security#proofPurpose',
                '@type': '@vocab',
              },
              created: {
                '@id': 'http://purl.org/dc/terms/created',
                '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
              },
              proofValue: {
                '@id': 'https://w3id.org/security#proofValue',
              },
            },
          },
        },
      },
    };
  }

  // DID Core context
  if (url === 'https://www.w3.org/ns/did/v1') {
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': {
          '@version': 1.1,
          '@protected': true,
          id: '@id',
          type: '@type',
        },
      },
    };
  }

  // W3C Bitstring Status List v1.0 context
  if (url === 'https://www.w3.org/ns/credentials/status/v1') {
    return {
      contextUrl: null,
      documentUrl: url,
      document: {
        '@context': {
          '@version': 1.1,
          '@protected': true,
          BitstringStatusListCredential: {
            '@id': 'https://www.w3.org/ns/credentials/status#BitstringStatusListCredential',
          },
          BitstringStatusList: {
            '@id': 'https://www.w3.org/ns/credentials/status#BitstringStatusList',
          },
          BitstringStatusListEntry: {
            '@id': 'https://www.w3.org/ns/credentials/status#BitstringStatusListEntry',
          },
          statusPurpose: {
            '@id': 'https://www.w3.org/ns/credentials/status#statusPurpose',
            '@type': '@vocab',
          },
          statusListIndex: {
            '@id': 'https://www.w3.org/ns/credentials/status#statusListIndex',
          },
          statusListCredential: {
            '@id': 'https://www.w3.org/ns/credentials/status#statusListCredential',
            '@type': '@id',
          },
          encodedList: {
            '@id': 'https://www.w3.org/ns/credentials/status#encodedList',
          },
          ttl: {
            '@id': 'https://www.w3.org/ns/credentials/status#ttl',
            '@type': 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
          },
          statusSize: {
            '@id': 'https://www.w3.org/ns/credentials/status#statusSize',
            '@type': 'http://www.w3.org/2001/XMLSchema#positiveInteger',
          },
          statusMessage: {
            '@id': 'https://www.w3.org/ns/credentials/status#statusMessage',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              status: {
                '@id': 'https://www.w3.org/ns/credentials/status#status',
              },
              message: {
                '@id': 'https://www.w3.org/ns/credentials/status#message',
              },
            },
          },
          statusReference: {
            '@id': 'https://www.w3.org/ns/credentials/status#statusReference',
            '@type': '@id',
          },
        },
      },
    };
  }

  throw new Error(`Unsupported context URL: ${url}`);
}

// ===========================================
// CREDENTIAL TYPE MAPPINGS
// ===========================================

/**
 * Get credential type based on user role and verification level
 */
export function getCredentialTypeForUser(
  role: 'Actor' | 'Agent' | 'Enterprise' | 'Admin'
): CredentialType {
  if (role === 'Agent') {
    return 'AgentCredential';
  }
  if (role === 'Actor') {
    return 'ActorCredential';
  }
  if (role === 'Enterprise') {
    return 'EnterpriseCredential';
  }

  // Default to IdentityCredential
  return 'IdentityCredential';
}
