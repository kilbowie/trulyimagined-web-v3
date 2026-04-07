import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { resolveActorIdByAuth0UserId } from '@/lib/hdicr/actor-identity';
import { queries } from '@database/queries-v3';
import { uploadToS3, generateS3Key, validateFileType, validateFileSize } from '@/lib/s3';

// DB-OWNER: TI

/**
 * POST /api/media/upload
 * Upload media file (headshot, audio reel, or video reel) to S3 and create database record
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get actor record
    const actorId = await resolveActorIdByAuth0UserId(user.sub);

    if (!actorId) {
      return NextResponse.json(
        { error: 'Actor profile not found. Please register your identity first.' },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mediaType = formData.get('mediaType') as 'headshot' | 'audio_reel' | 'video_reel';
    const title = (formData.get('title') as string) || null;
    const photoCredit = (formData.get('photoCredit') as string) || null;
    const description = (formData.get('description') as string) || null;

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!mediaType || !['headshot', 'audio_reel', 'video_reel'].includes(mediaType)) {
      return NextResponse.json({ error: 'Invalid media type' }, { status: 400 });
    }

    // Validate file type
    if (!validateFileType(file, mediaType)) {
      return NextResponse.json(
        { error: `Invalid file type for ${mediaType}. Please upload a supported file format.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (!validateFileSize(file, mediaType)) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed for ${mediaType}` },
        { status: 400 }
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate S3 key
    const s3FolderMap = {
      headshot: 'headshots',
      audio_reel: 'audio',
      video_reel: 'video',
    } as const;

    const s3Key = generateS3Key(actorId, s3FolderMap[mediaType], file.name);

    // Upload to S3
    const uploadResult = await uploadToS3({
      key: s3Key,
      body: buffer,
      contentType: file.type,
      metadata: {
        actorId,
        mediaType,
        originalName: file.name,
      },
    });

    // Check if this is the first headshot (should be primary)
    let isPrimary = false;
    let displayOrder = 0;

    if (mediaType === 'headshot') {
      const existingHeadshotsResult = await query(queries.actorMedia.getByActorAndType, [
        actorId,
        'headshot',
      ]);

      if (!existingHeadshotsResult.rows || existingHeadshotsResult.rows.length === 0) {
        isPrimary = true;
        displayOrder = 0;
      } else {
        // Set display order to next available
        displayOrder = existingHeadshotsResult.rows.length;
      }
    }

    // Create database record
    const mediaRecord = await query(queries.actorMedia.create, [
      actorId, // actor_id
      mediaType, // media_type
      file.name, // file_name
      s3Key, // s3_key
      uploadResult.url, // s3_url
      file.size, // file_size_bytes
      file.type, // mime_type
      title, // title
      photoCredit, // photo_credit
      description, // description
      isPrimary, // is_primary
      displayOrder, // display_order
    ]);

    return NextResponse.json({
      success: true,
      media: mediaRecord.rows[0],
    });
  } catch (error) {
    console.error('Media upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload media' },
      { status: 500 }
    );
  }
}
