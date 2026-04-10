import { query } from '@/lib/db';

export async function listActiveAgentRosterRelationships(agentId: string) {
  const result = await query(
    `SELECT
      id AS relationship_id,
      actor_id,
      started_at,
      rt.id AS pending_termination_id,
      rt.notice_date AS pending_termination_notice_date,
      rt.effective_date AS pending_termination_effective_date,
      rt.reason AS pending_termination_reason
     FROM actor_agent_relationships aar
     LEFT JOIN representation_terminations rt
       ON rt.relationship_id = aar.id
      AND rt.status = 'pending_termination'
     WHERE agent_id = $1
       AND ended_at IS NULL
     ORDER BY started_at DESC`,
    [agentId]
  );

  return result.rows;
}
