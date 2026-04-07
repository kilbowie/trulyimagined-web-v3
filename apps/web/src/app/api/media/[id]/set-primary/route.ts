import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveActorIdByAuth0UserId } from '@/lib/hdicr/actor-identity';
import { queries } from '@database/queries-v3';

// DB-OWNER: TI

/**
 * PUT /api/media/[id]/set-primary
 * Set a headshot as primary and update display orders
 */
export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mediaId } = await params;

    // Get actor record
    const actorId = await resolveActorIdByAuth0UserId(user.sub);

    if (!actorId) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    // Get media record to verify ownership
    const mediaResult = await query(queries.actorMedia.getById, [mediaId]);

    if (!mediaResult.rows || mediaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const media = mediaResult.rows[0];

    // Verify ownership
    if (media.actor_id !== actorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only headshots can be set as primary
    if (media.media_type !== 'headshot') {
      return NextResponse.json({ error: 'Only headshots can be set as primary' }, { status: 400 });
    }

    // Clear previous primary for this media type
    await query(queries.actorMedia.clearPrimary, [actorId, 'headshot']);

    // Set this as primary
    const updateResult = await query(queries.actorMedia.setPrimary, [mediaId]);

    return NextResponse.json({
      success: true,
      media: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Set primary media error:', error);
    return NextResponse.json({ error: 'Failed to set primary media' }, { status: 500 });
  }
}
