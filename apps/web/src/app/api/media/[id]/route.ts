import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { queries } from '@database/queries-v3';
import { deleteFromS3 } from '@/lib/s3';

/**
 * PUT /api/media/[id]
 * Update media metadata (title, photo_credit, description)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mediaId = params.id;
    const body = await request.json();

    // Get actor record
    const actorResult = await query(queries.actors.getByAuth0Id, [user.sub]);

    if (!actorResult.rows || actorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const actor = actorResult.rows[0];

    // Get media record to verify ownership
    const mediaResult = await query(queries.actorMedia.getById, [mediaId]);

    if (!mediaResult.rows || mediaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const media = mediaResult.rows[0];

    // Verify ownership
    if (media.actor_id !== actor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update media metadata
    const updateResult = await query(queries.actorMedia.update, [
      mediaId,
      body.title || null,
      body.photoCredit || null,
      body.description || null,
      body.isPrimary !== undefined ? body.isPrimary : null,
      body.displayOrder !== undefined ? body.displayOrder : null,
    ]);

    return NextResponse.json({
      success: true,
      media: updateResult.rows[0],
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
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mediaId = params.id;

    // Get actor record
    const actorResult = await query(queries.actors.getByAuth0Id, [user.sub]);

    if (!actorResult.rows || actorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const actor = actorResult.rows[0];

    // Get media record to verify ownership and get S3 key
    const mediaResult = await query(queries.actorMedia.getById, [mediaId]);

    if (!mediaResult.rows || mediaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const media = mediaResult.rows[0];

    // Verify ownership
    if (media.actor_id !== actor.id) {
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
    await query(queries.actorMedia.softDelete, [mediaId]);

    return NextResponse.json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error) {
    console.error('Delete media error:', error);
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}
