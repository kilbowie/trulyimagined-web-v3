import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
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

  // Fetch actor data from database
  const actorResult = await query(queries.actors.getByAuth0Id, [user.sub]);
  const profileResult = await query(
    'SELECT is_verified, is_pro FROM user_profiles WHERE auth0_user_id = $1',
    [user.sub]
  );

  let actor = null;
  let headshots = [];
  let accountStatus = { is_verified: false, is_pro: false };

  if (actorResult.rows && actorResult.rows.length > 0) {
    actor = actorResult.rows[0];

    // Fetch headshots
    const headshotsResult = await query(queries.actorMedia.getHeadshots, [actor.id]);
    headshots = headshotsResult.rows || [];
  }

  if (profileResult.rows && profileResult.rows.length > 0) {
    accountStatus = {
      is_verified: !!profileResult.rows[0].is_verified,
      is_pro: !!profileResult.rows[0].is_pro,
    };
  }

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
