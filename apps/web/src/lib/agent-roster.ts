import { query } from '@/lib/db';

export async function listActiveAgentRosterRelationships(agentId: string) {
  const result = await query(
    `SELECT
      id AS relationship_id,
      actor_id,
      started_at
     FROM actor_agent_relationships
     WHERE agent_id = $1
       AND ended_at IS NULL
     ORDER BY started_at DESC`,
    [agentId]
  );

  return result.rows;
}
