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
import { query } from '@/lib/db';
import { z } from 'zod';
import {
  createConsentEntry,
  type ConsentPolicy,
  type CreateConsentEntryParams,
} from '@/lib/consent-ledger';

// ===========================================
// REQUEST SCHEMA
// ===========================================

const CreateConsentEntrySchema = z.object({
  policy: z.object({
    usage: z.object({
      film_tv: z.boolean(),
      advertising: z.boolean(),
      ai_training: z.boolean(),
      synthetic_media: z.boolean(),
      voice_replication: z.boolean(),
    }),
    commercial: z.object({
      paymentRequired: z.boolean(),
      minFee: z.number().optional(),
      revenueShare: z.number().min(0).max(100).optional(),
    }),
    constraints: z.object({
      duration: z.number().optional(),
      expiryDate: z.string().optional(),
      territory: z.array(z.string()).optional(),
    }),
    attributionRequired: z.boolean(),
    aiControls: z.object({
      trainingAllowed: z.boolean(),
      likenessGenerationAllowed: z.boolean(),
      voiceCloningAllowed: z.boolean(),
    }),
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

    // 2. Get user profile
    const profileResult = await query(
      'SELECT id, role FROM user_profiles WHERE auth0_user_id = $1',
      [auth0UserId]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];

    // 3. Find actor record
    const actorResult = await query(
      'SELECT id FROM actors WHERE user_profile_id = $1',
      [profile.id]
    );

    if (actorResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Actor record not found. Only actors can manage consent.' },
        { status: 403 }
      );
    }

    const actorId = actorResult.rows[0].id;

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
    const params: CreateConsentEntryParams = {
      actorId,
      policy: policy as ConsentPolicy,
      reason,
      updatedBy: profile.id,
      ipAddress,
      userAgent,
    };

    const entry = await createConsentEntry(params);

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
