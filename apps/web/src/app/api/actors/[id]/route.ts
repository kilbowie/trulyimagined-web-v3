import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getActorById, updateActorProfile } from '@/lib/hdicr/identity-client';

/**
 * PUT /api/actors/[id]
 * Update actor profile information
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: actorId } = await params;
    const body = await request.json();

    const actor = await getActorById(actorId);
    if (!actor) {
      return NextResponse.json({ error: 'Actor not found' }, { status: 404 });
    }

    // Verify ownership
    if ((actor.auth0_user_id as string | undefined) !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedActor = await updateActorProfile(actorId, {
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      stageName: body.stageName || null,
      bio: body.bio || null,
      location: body.location || null,
      profileImageUrl: null,
    });

    return NextResponse.json({
      success: true,
      actor: updatedActor,
    });
  } catch (error) {
    console.error('Update actor error:', error);
    return NextResponse.json({ error: 'Failed to update actor profile' }, { status: 500 });
  }
}
