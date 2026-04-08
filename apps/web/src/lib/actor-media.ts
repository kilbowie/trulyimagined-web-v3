import { query } from '@/lib/db';
import { queries } from '@database/queries-v3';

export async function listActorMedia(actorId: string, mediaType?: string) {
  if (mediaType) {
    const result = await query(queries.actorMedia.getByActorAndType, [actorId, mediaType]);
    return result.rows || [];
  }

  const result = await query(queries.actorMedia.getByActor, [actorId]);
  return result.rows || [];
}

export async function getActorMediaById(mediaId: string) {
  const result = await query(queries.actorMedia.getById, [mediaId]);
  return result.rows?.[0] || null;
}

export async function createActorMediaRecord(params: {
  actorId: string;
  mediaType: 'headshot' | 'audio_reel' | 'video_reel';
  fileName: string;
  s3Key: string;
  s3Url: string;
  fileSizeBytes: number;
  mimeType: string;
  title: string | null;
  photoCredit: string | null;
  description: string | null;
  isPrimary: boolean;
  displayOrder: number;
}) {
  const result = await query(queries.actorMedia.create, [
    params.actorId,
    params.mediaType,
    params.fileName,
    params.s3Key,
    params.s3Url,
    params.fileSizeBytes,
    params.mimeType,
    params.title,
    params.photoCredit,
    params.description,
    params.isPrimary,
    params.displayOrder,
  ]);

  return result.rows?.[0] || null;
}

export async function updateActorMediaRecord(params: {
  mediaId: string;
  title: string | null;
  photoCredit: string | null;
  description: string | null;
  isPrimary: boolean | null;
  displayOrder: number | null;
}) {
  const result = await query(queries.actorMedia.update, [
    params.mediaId,
    params.title,
    params.photoCredit,
    params.description,
    params.isPrimary,
    params.displayOrder,
  ]);

  return result.rows?.[0] || null;
}

export async function clearPrimaryActorHeadshot(actorId: string) {
  await query(queries.actorMedia.clearPrimary, [actorId, 'headshot']);
}

export async function setActorMediaPrimary(mediaId: string) {
  const result = await query(queries.actorMedia.setPrimary, [mediaId]);
  return result.rows?.[0] || null;
}

export async function softDeleteActorMedia(mediaId: string) {
  await query(queries.actorMedia.softDelete, [mediaId]);
}