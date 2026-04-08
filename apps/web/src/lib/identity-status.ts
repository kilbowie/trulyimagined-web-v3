import { query } from '@/lib/db';
import { resolveActorRecordByAuth0UserId } from '@/lib/hdicr/actor-identity';

type ProfileFlags = {
  is_verified: boolean;
  is_pro: boolean;
};

export type RegistrationStatusActor = {
  id: string;
  registryId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  stageName?: string;
  bio?: string;
  location?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  isVerified: boolean;
  isPro: boolean;
  isFoundingMember: boolean;
  createdAt: string;
  updatedAt?: string;
};

export async function getUserProfileVerificationFlags(auth0UserId: string): Promise<ProfileFlags> {
  const profileResult = await query(
    `SELECT
       COALESCE(is_verified, FALSE) AS is_verified,
       COALESCE(is_pro, FALSE) AS is_pro
     FROM user_profiles
     WHERE auth0_user_id = $1
     LIMIT 1`,
    [auth0UserId]
  );

  return profileResult.rows[0] || { is_verified: false, is_pro: false };
}

export async function getActorRegistrationStatusByAuth0UserId(auth0UserId: string): Promise<{
  registered: boolean;
  actor: RegistrationStatusActor | null;
}> {
  const actorRecord = await resolveActorRecordByAuth0UserId(auth0UserId);

  if (!actorRecord) {
    return { registered: false, actor: null };
  }

  const profile = await getUserProfileVerificationFlags(auth0UserId);

  const verificationStatus: 'pending' | 'verified' | 'rejected' =
    actorRecord.verification_status === 'verified' || actorRecord.verification_status === 'rejected'
      ? actorRecord.verification_status
      : 'pending';

  const actor: RegistrationStatusActor = {
    id: actorRecord.id,
    registryId: actorRecord.registry_id ?? null,
    firstName: actorRecord.first_name ?? '',
    lastName: actorRecord.last_name ?? '',
    stageName: actorRecord.stage_name ?? undefined,
    location: actorRecord.location ?? undefined,
    bio: actorRecord.bio ?? undefined,
    verificationStatus,
    isVerified: Boolean(profile.is_verified) || verificationStatus === 'verified',
    isPro: Boolean(profile.is_pro),
    isFoundingMember: Boolean(actorRecord.is_founding_member),
    createdAt: actorRecord.created_at ?? new Date().toISOString(),
    updatedAt: actorRecord.created_at ?? undefined,
    email: actorRecord.email ?? '',
  };

  return {
    registered: true,
    actor,
  };
}
