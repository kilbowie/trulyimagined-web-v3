import { query } from '@/lib/db';
import { resolveActorIdByAuth0UserId } from '@/lib/hdicr/actor-identity';

export async function getUserProfileByAuth0Id(auth0UserId: string) {
  const result = await query('SELECT id, auth0_user_id, role FROM user_profiles WHERE auth0_user_id = $1', [
    auth0UserId,
  ]);
  return result.rows[0] || null;
}

export async function getActorByAuth0Id(auth0UserId: string) {
  const actorId = await resolveActorIdByAuth0UserId(auth0UserId);

  return actorId ? { id: actorId } : null;
}

export async function getAgentByAuth0Id(auth0UserId: string) {
  const result = await query(
    `SELECT a.id, a.auth0_user_id, a.registry_id, a.agency_name, a.verification_status, a.profile_completed
     FROM agents a
     WHERE a.auth0_user_id = $1
       AND a.deleted_at IS NULL`,
    [auth0UserId]
  );

  return result.rows[0] || null;
}

export async function getActiveRepresentationForActor(actorId: string) {
  const result = await query(
    `SELECT r.id,
            r.actor_id,
            r.agent_id,
            r.started_at,
            ag.registry_id,
            ag.agency_name,
            ag.verification_status,
            ag.profile_image_url,
            ag.location,
            ag.website_url
     FROM actor_agent_relationships r
     INNER JOIN agents ag ON ag.id = r.agent_id
     WHERE r.actor_id = $1
       AND r.ended_at IS NULL
       AND ag.deleted_at IS NULL
     LIMIT 1`,
    [actorId]
  );

  return result.rows[0] || null;
}

export async function hasActiveRelationship(actorId: string, agentId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM actor_agent_relationships
     WHERE actor_id = $1
       AND agent_id = $2
       AND ended_at IS NULL
     LIMIT 1`,
    [actorId, agentId]
  );

  return result.rows.length > 0;
}
