import { NextRequest, NextResponse } from 'next/server';
import {
  clearPrimaryActorHeadshot,
  getActorMediaById,
  setActorMediaPrimary,
} from '@/lib/actor-media';
import { getCurrentUser } from '@/lib/auth';
import { resolveActorIdByAuth0UserId } from '@/lib/hdicr/actor-identity';

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
    const media = await getActorMediaById(mediaId);

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Verify ownership
    if (media.actor_id !== actorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only headshots can be set as primary
    if (media.media_type !== 'headshot') {
      return NextResponse.json({ error: 'Only headshots can be set as primary' }, { status: 400 });
    }

    // Clear previous primary for this media type
    await clearPrimaryActorHeadshot(actorId);

    // Set this as primary
    const updatedMedia = await setActorMediaPrimary(mediaId);

    return NextResponse.json({
      success: true,
      media: updatedMedia,
    });
  } catch (error) {
    console.error('Set primary media error:', error);
    return NextResponse.json({ error: 'Failed to set primary media' }, { status: 500 });
  }
}
