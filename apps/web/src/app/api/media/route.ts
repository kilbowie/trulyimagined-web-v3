import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { queries } from '@database/queries-v3';

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
    const actorResult = await query(queries.actors.getByAuth0Id, [user.sub]);

    if (!actorResult.rows || actorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const actor = actorResult.rows[0];

    // Check for type filter
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type');

    let mediaResult;

    if (mediaType && ['headshot', 'audio_reel', 'video_reel'].includes(mediaType)) {
      mediaResult = await query(queries.actorMedia.getByActorAndType, [actor.id, mediaType]);
    } else {
      mediaResult = await query(queries.actorMedia.getByActor, [actor.id]);
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
