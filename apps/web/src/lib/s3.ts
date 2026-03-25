import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.USE_MOCK_S3 === 'true';
const DEV_UPLOAD_DIR = path.join(process.cwd(), 'public', 'dev-uploads');

// Initialize S3 client (only if not in dev mode)
const s3Client = DEV_MODE ? null : new S3Client({
  region: process.env.AWS_REGION || 'eu-west-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'trimg-actor-media';

// Ensure dev upload directory exists
if (DEV_MODE && !fs.existsSync(DEV_UPLOAD_DIR)) {
  fs.mkdirSync(DEV_UPLOAD_DIR, { recursive: true });
}

/**
 * Upload file to S3
 */
export async function uploadToS3(params: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{ success: boolean; url: string; key: string }> {
  try {
    // Development mode: Save to local file system
    if (DEV_MODE) {
      const filePath = path.join(DEV_UPLOAD_DIR, params.key.replace(/\//g, '_'));
      fs.writeFileSync(filePath, params.body);
      
      // Return local URL
      const localUrl = `/dev-uploads/${params.key.replace(/\//g, '_')}`;
      console.log('[DEV] Saved file locally:', localUrl);
      
      return {
        success: true,
        url: localUrl,
        key: params.key,
      };
    }

    // Production mode: Upload to S3
    if (!s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
      // Make files publicly readable (for headshots that need to be displayed)
      // ACL: 'public-read',  // Uncomment if you want public access
    });

    await s3Client.send(command);

    // Construct the S3 URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'eu-west-1'}.amazonaws.com/${params.key}`;

    return {
      success: true,
      url,
      key: params.key,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(key: string): Promise<{ success: boolean }> {
  try {
    // Development mode: Delete from local file system
    if (DEV_MODE) {
      const filePath = path.join(DEV_UPLOAD_DIR, key.replace(/\//g, '_'));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('[DEV] Deleted file locally:', filePath);
      }
      return { success: true };
    }

    // Production mode: Delete from S3
    if (!s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    return { success: true };
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`Failed to delete from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a signed URL for temporary access to a private file
 * Useful for serving private media or generating download links
 */
export async function getSignedS3Url(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    // Development mode: Return local URL
    if (DEV_MODE) {
      return `/dev-uploads/${key.replace(/\//g, '_')}`;
    }

    // Production mode: Generate signed URL
    if (!s3Client) {
      throw new Error('S3 client not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate S3 key for actor media
 */
export function generateS3Key(actorId: string, mediaType: 'headshots' | 'audio' | 'video', fileName: string): string {
  // Clean filename to remove special characters
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  
  return `actors/${actorId}/${mediaType}/${timestamp}-${cleanFileName}`;
}

/**
 * Validate file type based on media type
 */
export function validateFileType(file: File, mediaType: 'headshot' | 'audio_reel' | 'video_reel'): boolean {
  const allowedTypes: Record<string, string[]> = {
    headshot: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    audio_reel: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
    video_reel: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  };

  return allowedTypes[mediaType]?.includes(file.type) || false;
}

/**
 * Validate file size (in bytes)
 */
export function validateFileSize(file: File, mediaType: 'headshot' | 'audio_reel' | 'video_reel'): boolean {
  const maxSizes: Record<string, number> = {
    headshot: 10 * 1024 * 1024, // 10MB for images
    audio_reel: 50 * 1024 * 1024, // 50MB for audio
    video_reel: 500 * 1024 * 1024, // 500MB for video
  };

  return file.size <= maxSizes[mediaType];
}

export { s3Client, BUCKET_NAME };
