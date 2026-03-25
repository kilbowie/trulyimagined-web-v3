import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { queries } from '@database/queries-v3';

/**
 * PUT /api/actors/[id]
 * Update actor profile information
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actorId = params.id;
    const body = await request.json();

    // Get actor record to verify ownership
    const actorResult = await query(queries.actors.getById, [actorId]);

    if (!actorResult.rows || actorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    const actor = actorResult.rows[0];

    // Verify ownership
    if (actor.auth0_user_id !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update actor profile
    const updateResult = await query(queries.actors.update, [
      actorId,
      body.firstName || null,
      body.lastName || null,
      body.stageName || null,
      body.bio || null,
      body.location || null,
      null, // profile_image_url (updated via media upload)
    ]);

    return NextResponse.json({
      success: true,
      actor: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Update actor error:', error);
    return NextResponse.json({ error: 'Failed to update actor profile' }, { status: 500 });
  }
}
