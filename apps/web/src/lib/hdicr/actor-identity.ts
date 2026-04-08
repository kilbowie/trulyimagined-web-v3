import { getActorById } from '@/lib/hdicr/identity-client';
import { getActorByAuth0UserId } from '@/lib/hdicr/representation-client';

type RemoteActorReference = {
  id?: string;
};

type RemoteActorRecord = Record<string, unknown>;

export type ActorIdentityRecord = {
  id: string;
  auth0_user_id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  stage_name?: string | null;
  bio?: string | null;
  location?: string | null;
  profile_image_url?: string | null;
  verification_status?: string | null;
  is_founding_member?: boolean;
  registry_id?: string | null;
  created_at?: string | null;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeActorRecord(actor: RemoteActorRecord, fallbackId: string): ActorIdentityRecord {
  return {
    id: readString(actor.id) ?? fallbackId,
    auth0_user_id: readString(actor.auth0_user_id) ?? readString(actor.auth0UserId),
    email: readString(actor.email),
    first_name: readString(actor.first_name) ?? readString(actor.firstName),
    last_name: readString(actor.last_name) ?? readString(actor.lastName),
    stage_name: readString(actor.stage_name) ?? readString(actor.stageName),
    bio: readString(actor.bio),
    location: readString(actor.location),
    profile_image_url: readString(actor.profile_image_url) ?? readString(actor.profileImageUrl),
    verification_status:
      readString(actor.verification_status) ?? readString(actor.verificationStatus),
    is_founding_member:
      typeof actor.is_founding_member === 'boolean'
        ? actor.is_founding_member
        : Boolean(actor.isFoundingMember),
    registry_id: readString(actor.registry_id) ?? readString(actor.registryId),
    created_at: readString(actor.created_at) ?? readString(actor.createdAt),
  };
}

export async function resolveActorIdByAuth0UserId(auth0UserId: string): Promise<string | null> {
  const actor = (await getActorByAuth0UserId(auth0UserId)) as RemoteActorReference | null;
  return readString(actor?.id) ?? null;
}

export async function resolveActorRecordByAuth0UserId(
  auth0UserId: string
): Promise<ActorIdentityRecord | null> {
  const actorId = await resolveActorIdByAuth0UserId(auth0UserId);
  if (!actorId) {
    return null;
  }

  const actor = (await getActorById(actorId)) as RemoteActorRecord | null;
  if (!actor) {
    return { id: actorId };
  }

  return normalizeActorRecord(actor, actorId);
}
