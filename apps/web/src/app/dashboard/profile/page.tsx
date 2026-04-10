import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { resolveActorRecordByAuth0UserId } from '@/lib/hdicr/actor-identity';
import { queries } from '@database/queries-v3';
import ProfileClient from './ProfileClient';

/**
 * Actor Profile Page (Server Component)
 * Fetches data from database and passes to client component
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const isActor = roles.includes('Actor');

  if (!isActor) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-muted-foreground">
            Actor role required to view and edit profile details.
          </p>
        </div>
      </div>
    );
  }

  const profileResult = await query(
    'SELECT is_verified, is_pro FROM user_profiles WHERE auth0_user_id = $1',
    [user.sub]
  );

  let actorRecord = null;
  try {
    actorRecord = await resolveActorRecordByAuth0UserId(user.sub);
  } catch (error) {
    console.warn('[PROFILE] HDICR actor record unavailable, continuing with local data only', error);
  }
  let headshots = [];
  let accountStatus = { is_verified: false, is_pro: false };

  if (actorRecord) {
    const headshotsResult = await query(queries.actorMedia.getHeadshots, [actorRecord.id]);
    headshots = headshotsResult.rows || [];
  }

  if (profileResult.rows && profileResult.rows.length > 0) {
    accountStatus = {
      is_verified: !!profileResult.rows[0].is_verified,
      is_pro: !!profileResult.rows[0].is_pro,
    };
  }

  const actor = actorRecord
    ? {
        id: actorRecord.id,
        first_name: actorRecord.first_name ?? '',
        last_name: actorRecord.last_name ?? '',
        stage_name: actorRecord.stage_name ?? null,
        email: actorRecord.email ?? user.email ?? '',
        location: actorRecord.location ?? null,
        bio: actorRecord.bio ?? null,
        verification_status: actorRecord.verification_status ?? 'pending',
        registry_id: actorRecord.registry_id ?? '',
        profile_image_url: actorRecord.profile_image_url ?? null,
      }
    : null;

  return (
    <ProfileClient
      user={user}
      roles={roles}
      actor={actor}
      headshots={headshots}
      accountStatus={accountStatus}
    />
  );
}
