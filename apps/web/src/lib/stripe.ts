/**
 * Stripe Identity Configuration
 *
 * Step 7: Multi-Provider Identity Linking with Stripe Identity
 *
 * Stripe Identity provides:
 * - Government ID verification (passport, driver's license, national ID)
 * - Liveness detection (selfie verification)
 * - Document authenticity checks
 * - GPG 45 & eIDAS compliance mapping
 *
 * Cost: $1.50-$3.00 per verification (no setup fees)
 *
 * @see https://stripe.com/docs/identity
 */

import Stripe from 'stripe';

/**
 * Lazy-initialize Stripe SDK
 * Only initializes when actually needed, so mock verification can work without Stripe keys
 */
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }

  return stripeInstance;
}

/**
 * Get Stripe SDK instance (for compatibility with existing code)
 * Server-side only - never expose to client
 */
export const stripe = new Proxy({} as Stripe, {
  get: (_target, prop) => {
    const instance = getStripe();
    const value = instance[prop as keyof Stripe];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

/**
 * Verification level mapping for GPG 45 (UK Government Trust Framework)
 *
 * Maps Stripe Identity verification outcomes to GPG 45 confidence levels
 *
 * @see https://www.gov.uk/government/publications/identity-proofing-and-verification-of-an-individual
 */
export const GPG45_MAPPING = {
  // Stripe verification with government-issued ID + liveness → High confidence
  verified: {
    verification_level: 'high',
    assurance_level: 'high',
    gpg45_confidence: 'high', // GPG 45: Evidence strength HIGH
  },
  // Partial verification (document valid but liveness failed)
  requires_input: {
    verification_level: 'medium',
    assurance_level: 'medium',
    gpg45_confidence: 'medium',
  },
  // Verification failed or document not authentic
  failed: {
    verification_level: 'low',
    assurance_level: 'low',
    gpg45_confidence: 'low',
  },
} as const;

/**
 * eIDAS Level of Assurance Mapping (EU Regulation 910/2014)
 *
 * Maps Stripe Identity to eIDAS LoA levels
 *
 * @see https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/eIDAS+Levels+of+Assurance
 */
export const EIDAS_MAPPING = {
  verified: {
    eidas_level: 'high', // eIDAS High: Multi-factor + biometric
    verification_level: 'high',
  },
  requires_input: {
    eidas_level: 'substantial', // eIDAS Substantial: Two-factor
    verification_level: 'medium',
  },
  failed: {
    eidas_level: 'low', // eIDAS Low: Single-factor
    verification_level: 'low',
  },
} as const;

/**
 * Stripe Identity verification types
 */
export type StripeVerificationStatus =
  | 'verified'
  | 'requires_input'
  | 'failed'
  | 'processing'
  | 'canceled';

/**
 * Map Stripe status to internal verification level
 */
export function mapStripeStatusToVerificationLevel(status: StripeVerificationStatus): {
  verification_level: string;
  assurance_level: string;
  gpg45_confidence: string;
  eidas_level: string;
} {
  switch (status) {
    case 'verified':
      return {
        ...GPG45_MAPPING.verified,
        eidas_level: EIDAS_MAPPING.verified.eidas_level,
      };
    case 'requires_input':
      return {
        ...GPG45_MAPPING.requires_input,
        eidas_level: EIDAS_MAPPING.requires_input.eidas_level,
      };
    case 'failed':
    case 'canceled':
      return {
        ...GPG45_MAPPING.failed,
        eidas_level: EIDAS_MAPPING.failed.eidas_level,
      };
    case 'processing':
      return {
        verification_level: 'pending',
        assurance_level: 'pending',
        gpg45_confidence: 'pending',
        eidas_level: 'pending',
      };
  }
}

/**
 * Create Stripe Identity verification session
 *
 * @param _userEmail - User's email address (unused, kept for future use)
 * @param metadata - Additional metadata to attach to the session
 * @returns Stripe VerificationSession
 */
export async function createVerificationSession(
  _userEmail: string,
  metadata?: Record<string, string>
) {
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: {
      ...metadata,
      service: 'trulyimagined',
      created_by: 'web-app',
    },
    options: {
      document: {
        // Require government-issued ID with photo
        require_id_number: true,
        require_live_capture: true,
        require_matching_selfie: true, // Liveness check
        allowed_types: ['driving_license', 'passport', 'id_card'],
      },
    },
    // Return URL after verification completes
    return_url: `${process.env.AUTH0_BASE_URL}/dashboard/verify-identity?session_id={VERIFICATION_SESSION_ID}`,
  });

  return session;
}

/**
 * Retrieve verification session status
 *
 * @param sessionId - Stripe VerificationSession ID
 * @returns Verification session with status
 */
export async function getVerificationSession(sessionId: string) {
  const session = await stripe.identity.verificationSessions.retrieve(sessionId);
  return session;
}

/**
 * Get verified identity data from completed session
 *
 * @param sessionId - Stripe VerificationSession ID
 * @returns Verified identity data (name, DOB, ID number, etc.)
 */
export async function getVerifiedIdentityData(sessionId: string) {
  const session = await stripe.identity.verificationSessions.retrieve(sessionId, {
    expand: ['verified_outputs'],
  });

  if (session.status !== 'verified') {
    return null;
  }

  // Extract document data if available
  // Note: Stripe types don't expose full verification report structure as of API version 2026-02-25
  // We use type assertions to access nested properties that exist at runtime but not in types
  const report =
    typeof session.last_verification_report === 'string'
      ? null
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.last_verification_report as unknown as Record<string, any> | null);

  return {
    firstName: session.verified_outputs?.first_name || null,
    lastName: session.verified_outputs?.last_name || null,
    dateOfBirth: session.verified_outputs?.dob || null,
    idNumber: session.verified_outputs?.id_number || null,
    address: session.verified_outputs?.address || null,
    documentType: report?.document?.type || null,
    documentNumber: report?.document?.number || null,
    documentExpiry: report?.document?.expiration_date || null,
    documentIssuingCountry: report?.document?.issuing_country || null,
    livenessCheck: report?.selfie?.status === 'verified',
    verifiedAt: new Date(report?.created ?? Date.now()),
  };
}
