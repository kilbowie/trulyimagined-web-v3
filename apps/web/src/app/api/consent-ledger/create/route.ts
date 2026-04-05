/**
 * POST /api/consent-ledger/create
 *
 * Create a new consent entry (for authenticated actors only)
 *
 * This endpoint allows actors to update their consent preferences.
 * A new versioned entry is created, and the previous one is marked as "superseded".
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { z } from 'zod';
import {
  createConsentLedgerEntry,
  resolveActorContextByAuth0UserId,
  type ConsentPolicy,
} from '@/lib/hdicr/consent-client';

// ===========================================
// REQUEST SCHEMA
// ===========================================

const PermissionLevelSchema = z.enum(['allow', 'require_approval', 'deny']);

const CreateConsentEntrySchema = z.object({
  policy: z.object({
    mediaUsage: z.object({
      film: PermissionLevelSchema,
      television: PermissionLevelSchema,
      streaming: PermissionLevelSchema,
      gaming: PermissionLevelSchema,
      voiceReplication: PermissionLevelSchema,
      virtualReality: PermissionLevelSchema,
      socialMedia: PermissionLevelSchema,
      advertising: PermissionLevelSchema,
      merchandise: PermissionLevelSchema,
      livePerformance: PermissionLevelSchema,
    }),
    contentTypes: z.object({
      explicit: PermissionLevelSchema,
      political: PermissionLevelSchema,
      religious: PermissionLevelSchema,
      violence: PermissionLevelSchema,
      alcohol: PermissionLevelSchema,
      tobacco: PermissionLevelSchema,
      gambling: PermissionLevelSchema,
      pharmaceutical: PermissionLevelSchema,
      firearms: PermissionLevelSchema,
      adultContent: PermissionLevelSchema,
    }),
    territories: z.object({
      allowed: z.array(z.string()),
      denied: z.array(z.string()),
    }),
    aiControls: z.object({
      trainingAllowed: z.boolean(),
      syntheticGenerationAllowed: z.boolean(),
      biometricAnalysisAllowed: z.boolean(),
    }),
    commercial: z.object({
      paymentRequired: z.boolean(),
      minFee: z.number().optional(),
      revenueShare: z.number().min(0).max(100).optional(),
    }),
    attributionRequired: z.boolean(),
    usageBlocked: z.boolean().optional(),
  }),
  reason: z.string().optional(),
});

// ===========================================
// HANDLER
// ===========================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    const actorContext = await resolveActorContextByAuth0UserId(auth0UserId);

    if (!actorContext) {
      return NextResponse.json(
        { error: 'Actor record not found. Only actors can manage consent.' },
        { status: 403 }
      );
    }

    const { actorId, userProfileId } = actorContext;

    // 4. Parse request body
    const body = await request.json();
    const validationResult = CreateConsentEntrySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { policy, reason } = validationResult.data;

    // 5. Extract request metadata
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // 6. Create consent entry
    const entry = await createConsentLedgerEntry({
      actorId,
      policy: policy as ConsentPolicy,
      reason,
      updatedBy: userProfileId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      entry: {
        id: entry.id,
        version: entry.version,
        status: entry.status,
        created_at: entry.created_at,
      },
      message: 'Consent preferences updated successfully',
    });
  } catch (error) {
    console.error('[CONSENT LEDGER] Create error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create consent entry',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
