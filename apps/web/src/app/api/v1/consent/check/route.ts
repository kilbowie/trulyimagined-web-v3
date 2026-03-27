/**
 * POST /api/v1/consent/check
 *
 * External API Enforcement Endpoint
 *
 * This endpoint is called by external API clients to verify they have permission
 * to use an actor's data for a specific purpose.
 *
 * Authentication: Requires API key + signed request
 *
 * Request Body:
 * {
 *   "actorId": "uuid",
 *   "requestedUsage": "film_tv" | "advertising" | "ai_training" | "synthetic_media" | "voice_replication",
 *   "apiClientId": "uuid",
 *   "metadata": { ... }
 * }
 *
 * Response:
 * {
 *   "decision": "allow" | "deny" | "conditional",
 *   "reason": "string",
 *   "policyVersion": number,
 *   "licenseId": "uuid",
 *   "commercial": {
 *     "paymentRequired": boolean,
 *     "minFee": number,
 *     "revenueShare": number
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getLatestConsent,
  evaluateConsentUsage,
  isPaymentRequired,
  getMinimumFee,
  type ConsentPolicy,
} from '@/lib/consent-ledger';
import {
  getActiveLicense,
  isAPIClientVerified,
  recordLicenseUsage,
  logLicenseUsage,
  isLicenseExpired,
} from '@/lib/licensing';

// ===========================================
// REQUEST SCHEMA
// ===========================================

const ConsentCheckRequestSchema = z.object({
  actorId: z.string().uuid(),
  requestedUsage: z.enum([
    'film_tv',
    'advertising',
    'ai_training',
    'synthetic_media',
    'voice_replication',
  ]),
  apiClientId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

type _ConsentCheckRequest = z.infer<typeof ConsentCheckRequestSchema>;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Extract API key from Authorization header
 */
function extractAPIKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

/**
 * Extract requesting IP address
 */
function extractIPAddress(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

// ===========================================
// MAIN HANDLER
// ===========================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = extractIPAddress(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    // ===============================================
    // STEP 1: Authenticate API Client
    // ===============================================
    const apiKey = extractAPIKey(request);
    if (!apiKey) {
      return NextResponse.json(
        {
          decision: 'deny',
          reason: 'Missing API key. Include Authorization: Bearer <key> header.',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // TODO: Verify API key against api_clients.api_key_hash
    // For now, we'll extract clientId from request body
    // In production, derive from verified API key

    // ===============================================
    // STEP 2: Parse Request Body
    // ===============================================
    const body = await request.json();
    const validationResult = ConsentCheckRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          decision: 'deny',
          reason: 'Invalid request format',
          error: 'BAD_REQUEST',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { actorId, requestedUsage, apiClientId, metadata } = validationResult.data;

    // ===============================================
    // STEP 3: Verify API Client Credentials
    // ===============================================
    const isVerified = await isAPIClientVerified(apiClientId);
    if (!isVerified) {
      return NextResponse.json(
        {
          decision: 'deny',
          reason: 'API client is not verified. Contact support@trulyimagined.com',
          error: 'UNVERIFIED_CLIENT',
        },
        { status: 403 }
      );
    }

    // ===============================================
    // STEP 4: Fetch Active License
    // ===============================================
    const license = await getActiveLicense(actorId, apiClientId);

    if (!license) {
      await logLicenseUsage('', apiClientId, actorId, 'deny', {
        endpoint: '/api/v1/consent/check',
        method: 'POST',
        requestedUsageType: requestedUsage,
        reason: 'No active license found',
        ipAddress,
        userAgent,
        requestMetadata: metadata,
      });

      return NextResponse.json(
        {
          decision: 'deny',
          reason: 'No active license found for this actor. Request license first.',
          error: 'NO_LICENSE',
        },
        { status: 403 }
      );
    }

    // Check if license is expired
    if (isLicenseExpired(license)) {
      await logLicenseUsage(license.id, apiClientId, actorId, 'deny', {
        endpoint: '/api/v1/consent/check',
        method: 'POST',
        requestedUsageType: requestedUsage,
        reason: 'License has expired',
        ipAddress,
        userAgent,
        requestMetadata: metadata,
      });

      return NextResponse.json(
        {
          decision: 'deny',
          reason: 'License has expired. Renew license to continue.',
          error: 'LICENSE_EXPIRED',
          licenseId: license.id,
        },
        { status: 403 }
      );
    }

    // ===============================================
    // STEP 5: Fetch Latest Consent Ledger Entry
    // ===============================================
    const consentEntry = await getLatestConsent(actorId);

    if (!consentEntry) {
      await logLicenseUsage(license.id, apiClientId, actorId, 'deny', {
        endpoint: '/api/v1/consent/check',
        method: 'POST',
        requestedUsageType: requestedUsage,
        reason: 'No active consent policy found',
        ipAddress,
        userAgent,
        requestMetadata: metadata,
      });

      return NextResponse.json(
        {
          decision: 'deny',
          reason: 'Actor has no active consent policy',
          error: 'NO_CONSENT',
          licenseId: license.id,
        },
        { status: 403 }
      );
    }

    // ===============================================
    // STEP 6: Evaluate Requested Usage Against Policy
    // ===============================================
    const policy = consentEntry.policy as ConsentPolicy;
    const evaluation = evaluateConsentUsage(policy, requestedUsage);

    if (!evaluation.allowed) {
      await logLicenseUsage(license.id, apiClientId, actorId, 'deny', {
        endpoint: '/api/v1/consent/check',
        method: 'POST',
        requestedUsageType: requestedUsage,
        reason: evaluation.reason,
        ipAddress,
        userAgent,
        requestMetadata: metadata,
      });

      return NextResponse.json(
        {
          decision: 'deny',
          reason: evaluation.reason,
          policyVersion: consentEntry.version,
          licenseId: license.id,
          error: 'USAGE_NOT_PERMITTED',
        },
        { status: 403 }
      );
    }

    // ===============================================
    // STEP 7: Check Commercial Terms
    // ===============================================
    const paymentRequired = isPaymentRequired(policy);
    const minFee = getMinimumFee(policy);
    const revenueShare = policy.commercial?.revenueShare;

    const decision = paymentRequired ? 'conditional' : 'allow';

    // ===============================================
    // STEP 8: Record Usage & Return Success
    // ===============================================
    await recordLicenseUsage(license.id);

    await logLicenseUsage(license.id, apiClientId, actorId, decision, {
      endpoint: '/api/v1/consent/check',
      method: 'POST',
      requestedUsageType: requestedUsage,
      reason: evaluation.allowed ? 'Usage permitted by consent' : evaluation.reason,
      ipAddress,
      userAgent,
      requestMetadata: metadata,
    });

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      decision,
      reason: paymentRequired
        ? 'Usage permitted - payment required per actor consent'
        : 'Usage permitted by actor consent',
      policyVersion: consentEntry.version,
      licenseId: license.id,
      commercial: {
        paymentRequired,
        minFee,
        revenueShare,
      },
      attribution: {
        required: policy.attributionRequired,
      },
      constraints: {
        territory: policy.constraints?.territory,
        expiryDate: policy.constraints?.expiryDate,
      },
      meta: {
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[CONSENT CHECK] Error:', error);

    return NextResponse.json(
      {
        decision: 'deny',
        reason: 'Internal server error while checking consent',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
