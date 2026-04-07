import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveActorIdByAuth0UserId } from '@/lib/hdicr/actor-identity';
import { queries } from '@database/queries-v3';

// DB-OWNER: TI

/**
 * GET /api/media
 * Get all media for the current user
 * Query params: ?type=headshot|audio_reel|video_reel (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get actor record
    const actorId = await resolveActorIdByAuth0UserId(user.sub);

    if (!actorId) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    // Check for type filter
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type');

    let mediaResult;

    if (mediaType && ['headshot', 'audio_reel', 'video_reel'].includes(mediaType)) {
      mediaResult = await query(queries.actorMedia.getByActorAndType, [actorId, mediaType]);
    } else {
      mediaResult = await query(queries.actorMedia.getByActor, [actorId]);
    }

    return NextResponse.json({
      success: true,
      media: mediaResult.rows || [],
    });
  } catch (error) {
    console.error('Get media error:', error);
    return NextResponse.json({ error: 'Failed to retrieve media' }, { status: 500 });
  }
}
