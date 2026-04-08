import { NextRequest, NextResponse } from 'next/server';
import { getActorMediaById, softDeleteActorMedia, updateActorMediaRecord } from '@/lib/actor-media';
import { getCurrentUser } from '@/lib/auth';
import { resolveActorIdByAuth0UserId } from '@/lib/hdicr/actor-identity';
import { deleteFromS3 } from '@/lib/s3';

// DB-OWNER: TI

/**
 * PUT /api/media/[id]
 * Update media metadata (title, photo_credit, description)
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mediaId } = await params;
    const body = await request.json();

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

    // Update media metadata
    const updatedMedia = await updateActorMediaRecord({
      mediaId,
      title: body.title || null,
      photoCredit: body.photoCredit || null,
      description: body.description || null,
      isPrimary: body.isPrimary !== undefined ? body.isPrimary : null,
      displayOrder: body.displayOrder !== undefined ? body.displayOrder : null,
    });

    return NextResponse.json({
      success: true,
      media: updatedMedia,
    });
  } catch (error) {
    console.error('Update media error:', error);
    return NextResponse.json({ error: 'Failed to update media' }, { status: 500 });
  }
}

/**
 * DELETE /api/media/[id]
 * Delete media (soft delete in DB, hard delete from S3)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get media record to verify ownership and get S3 key
    const media = await getActorMediaById(mediaId);

    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Verify ownership
    if (media.actor_id !== actorId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete from S3
    try {
      await deleteFromS3(media.s3_key);
    } catch (s3Error) {
      console.error('S3 deletion failed:', s3Error);
      // Continue with DB deletion even if S3 fails
    }

    // Soft delete from database
    await softDeleteActorMedia(mediaId);

    return NextResponse.json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error) {
    console.error('Delete media error:', error);
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}
