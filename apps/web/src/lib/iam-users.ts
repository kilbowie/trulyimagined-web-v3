import { queryTi } from '@/lib/db';

export async function listIamUsersWithAgentData() {
  const usersResult = await queryTi(
    `
      SELECT
        up.id,
        up.auth0_user_id,
        up.email,
        up.role,
        up.username,
        up.legal_name,
        up.professional_name,
        up.profile_completed,
        up.is_verified,
        up.is_pro,
        up.created_at,
        up.updated_at,
        ag.id AS agent_id,
        ag.agency_name,
        ag.verification_status AS agent_verification_status,
        ag.registry_id AS agent_registry_id,
        ag.profile_completed AS agent_profile_completed
      FROM user_profiles up
      LEFT JOIN agents ag ON ag.auth0_user_id = up.auth0_user_id AND ag.deleted_at IS NULL
      ORDER BY up.created_at DESC
    `
  );

  return usersResult.rows;
}
