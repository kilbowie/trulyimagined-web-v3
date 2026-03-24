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
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';

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
    const actorCheck = await query('SELECT id FROM actors WHERE id = $1', [actorId]);

    if (actorCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    // 7. If licensing_request_id provided, verify it exists and is approved
    if (licensingRequestId) {
      const licenseCheck = await query('SELECT id, status FROM licensing_requests WHERE id = $1', [
        licensingRequestId,
      ]);

      if (licenseCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Licensing request not found' }, { status: 404 });
      }

      if (licenseCheck.rows[0].status !== 'approved') {
        return NextResponse.json(
          {
            error: 'Licensing request not approved',
            status: licenseCheck.rows[0].status,
          },
          { status: 403 }
        );
      }
    }

    // 8. Log usage
    const id = randomUUID();
    const result = await query(
      `INSERT INTO usage_tracking (
        id, actor_id, licensing_request_id, usage_type, quantity, unit,
        project_name, generated_by, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        id,
        actorId,
        licensingRequestId || null,
        usageType,
        quantity,
        unit,
        projectName || null,
        generatedBy || session.user?.sub || 'system',
        JSON.stringify(metadata),
      ]
    );

    // 9. Log to audit trail
    await query(
      `INSERT INTO audit_log (
        actor_id, action, resource_type, resource_id, metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        actorId,
        'usage_tracked',
        'usage_tracking',
        id,
        JSON.stringify({
          actorId,
          usageType,
          quantity,
          unit,
        }),
      ]
    );

    // 10. Return success
    return NextResponse.json(
      {
        success: true,
        usage: result.rows[0],
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
