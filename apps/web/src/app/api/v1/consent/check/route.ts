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
import { checkConsentEnforcement } from '@/lib/hdicr/consent-client';
import { HdicrHttpError } from '@/lib/hdicr/hdicr-http-client';

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

    const enforcement = await checkConsentEnforcement({
      ...validationResult.data,
      ipAddress,
      userAgent,
    });

    const status =
      typeof enforcement.httpStatus === 'number' && enforcement.httpStatus >= 100
        ? enforcement.httpStatus
        : 200;

    const { httpStatus: _ignoredStatus, ...payload } = enforcement;

    return NextResponse.json(payload, { status });
  } catch (error) {
    console.error('[CONSENT CHECK] Error:', error);

    if (error instanceof HdicrHttpError) {
      return NextResponse.json(
        {
          decision: 'deny',
          reason: 'Consent enforcement service is currently unavailable',
          error: 'UPSTREAM_ERROR',
        },
        { status: 503 }
      );
    }

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
