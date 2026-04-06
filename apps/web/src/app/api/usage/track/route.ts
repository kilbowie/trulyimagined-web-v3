/**
 * Usage Tracking API - Track Usage
 *
 * POST /api/usage/track
 *
 * Log usage events (minutes generated, images created, etc.)
 * Immutable append-only records
 */

import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import {
  actorExistsById,
  createUsageAuditLog,
  createUsageTrackingRecord,
  getLicensingRequestStatusById,
} from '@/lib/hdicr/usage-client';

// Type definitions
interface TrackUsageRequest {
  actorId: string;
  licensingRequestId?: string;
  usageType: 'voice_minutes' | 'image_generation' | 'video_seconds';
  quantity: number;
  unit: 'minutes' | 'images' | 'seconds';
  projectName?: string;
  generatedBy?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request
    const body: TrackUsageRequest = await req.json();
    const {
      actorId,
      licensingRequestId,
      usageType,
      quantity,
      unit,
      projectName,
      generatedBy,
      metadata = {},
    } = body;

    // 3. Validate required fields
    if (!actorId || !usageType || !quantity || !unit) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['actorId', 'usageType', 'quantity', 'unit'],
        },
        { status: 400 }
      );
    }

    // 4. Validate quantity
    if (quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 });
    }

    // 5. Validate usage type and unit match
    const validCombinations: Record<string, string> = {
      voice_minutes: 'minutes',
      image_generation: 'images',
      video_seconds: 'seconds',
    };

    if (validCombinations[usageType] !== unit) {
      return NextResponse.json(
        {
          error: 'Invalid usage_type and unit combination',
          expected: `${usageType} requires unit: ${validCombinations[usageType]}`,
        },
        { status: 400 }
      );
    }

    // 6. Verify actor exists
    const actorExists = await actorExistsById(actorId);

    if (!actorExists) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    // 7. If licensing_request_id provided, verify it exists and is approved
    if (licensingRequestId) {
      const licensingRequest = await getLicensingRequestStatusById(licensingRequestId);

      if (!licensingRequest) {
        return NextResponse.json({ error: 'Licensing request not found' }, { status: 404 });
      }

      if (licensingRequest.status !== 'approved') {
        return NextResponse.json(
          {
            error: 'Licensing request not approved',
            status: licensingRequest.status,
          },
          { status: 403 }
        );
      }
    }

    // 8. Log usage
    const usage = await createUsageTrackingRecord({
      actorId,
      licensingRequestId,
      usageType,
      quantity,
      unit,
      projectName,
      generatedBy: generatedBy || session.user?.sub || 'system',
      metadata,
    });

    // 9. Log to audit trail
    if (usage?.id) {
      await createUsageAuditLog({
        actorId,
        resourceId: usage.id,
        usageType,
        quantity,
        unit,
      });
    }

    // 10. Return success
    return NextResponse.json(
      {
        success: true,
        usage,
        message: `Successfully tracked ${quantity} ${unit} of ${usageType}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Usage Track Error]', error);
    return NextResponse.json(
      {
        error: 'Failed to track usage',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
