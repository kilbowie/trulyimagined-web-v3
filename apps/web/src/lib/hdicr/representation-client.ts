import { query } from '@/lib/db';

type RepresentationRequestAction = 'approve' | 'reject' | 'withdraw';

export async function getActorByAuth0UserId(auth0UserId: string) {
  const result = await query(
    `SELECT a.id, a.auth0_user_id, a.registry_id, a.stage_name, a.first_name, a.last_name
     FROM actors a
     WHERE a.auth0_user_id = $1
       AND a.deleted_at IS NULL`,
    [auth0UserId]
  );

  return result.rows[0] || null;
}

export async function getAgentByAuth0UserId(auth0UserId: string) {
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

export async function getAgentByRegistryId(registryId: string) {
  const result = await query(
    `SELECT id, registry_id, agency_name, verification_status, profile_image_url, location, website_url, profile_completed
     FROM agents
     WHERE registry_id = $1
       AND deleted_at IS NULL`,
    [registryId]
  );

  return result.rows[0] || null;
}

export async function hasPendingRequest(actorId: string, agentId: string) {
  const result = await query(
    `SELECT 1
     FROM representation_requests
     WHERE actor_id = $1
       AND agent_id = $2
       AND status = 'pending'
     LIMIT 1`,
    [actorId, agentId]
  );

  return result.rows.length > 0;
}

export async function createRepresentationRequest(params: {
  actorId: string;
  agentId: string;
  message?: string | null;
}) {
  const result = await query(
    `INSERT INTO representation_requests (
      actor_id,
      agent_id,
      status,
      message,
      requested_at,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, 'pending', $3, NOW(), NOW(), NOW()
    )
    RETURNING *`,
    [params.actorId, params.agentId, params.message?.trim() || null]
  );

  return result.rows[0] || null;
}

export async function listIncomingRequests(agentId: string) {
  const incoming = await query(
    `SELECT
      rr.id,
      rr.actor_id,
      rr.agent_id,
      rr.status,
      rr.message,
      rr.response_note,
      rr.requested_at,
      rr.responded_at,
      rr.created_at,
      rr.updated_at,
      a.stage_name,
      a.first_name,
      a.last_name,
      a.registry_id AS actor_registry_id
     FROM representation_requests rr
     INNER JOIN actors a ON a.id = rr.actor_id
     WHERE rr.agent_id = $1
     ORDER BY rr.requested_at DESC`,
    [agentId]
  );

  return incoming.rows;
}

export async function listOutgoingRequests(actorId: string) {
  const outgoing = await query(
    `SELECT
      rr.id,
      rr.actor_id,
      rr.agent_id,
      rr.status,
      rr.message,
      rr.response_note,
      rr.requested_at,
      rr.responded_at,
      rr.created_at,
      rr.updated_at,
      ag.agency_name,
      ag.registry_id AS agent_registry_id,
      ag.verification_status,
      ag.profile_image_url
     FROM representation_requests rr
     INNER JOIN agents ag ON ag.id = rr.agent_id
     WHERE rr.actor_id = $1
       AND ag.deleted_at IS NULL
     ORDER BY rr.requested_at DESC`,
    [actorId]
  );

  return outgoing.rows;
}

export async function getRepresentationRequestById(requestId: string) {
  const result = await query(
    `SELECT id, actor_id, agent_id, status
     FROM representation_requests
     WHERE id = $1`,
    [requestId]
  );

  return result.rows[0] || null;
}

export async function updateRepresentationRequest(params: {
  requestId: string;
  action: RepresentationRequestAction;
  responseNote?: string | null;
}) {
  if (params.action === 'withdraw') {
    const withdrawnResult = await query(
      `UPDATE representation_requests
       SET status = 'withdrawn',
           response_note = COALESCE($2, response_note),
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [params.requestId, params.responseNote?.trim() || 'Withdrawn by actor']
    );

    return withdrawnResult.rows[0] || null;
  }

  if (params.action === 'approve') {
    const approvedResult = await query(
      `UPDATE representation_requests
       SET status = 'approved',
           response_note = $2,
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND status = 'pending'
       RETURNING *`,
      [params.requestId, params.responseNote?.trim() || null]
    );

    return approvedResult.rows[0] || null;
  }

  const rejectedResult = await query(
    `UPDATE representation_requests
     SET status = 'rejected',
         response_note = $2,
         responded_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [params.requestId, params.responseNote?.trim() || null]
  );

  return rejectedResult.rows[0] || null;
}

export async function actorHasActiveRelationship(actorId: string) {
  const result = await query(
    `SELECT id
     FROM actor_agent_relationships
     WHERE actor_id = $1
       AND ended_at IS NULL
     LIMIT 1`,
    [actorId]
  );

  return result.rows.length > 0;
}

export async function createActorAgentRelationship(params: {
  actorId: string;
  agentId: string;
  representationRequestId: string;
}) {
  await query(
    `INSERT INTO actor_agent_relationships (
      actor_id,
      agent_id,
      representation_request_id,
      started_at,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
    [params.actorId, params.agentId, params.representationRequestId]
  );
}

export async function getRelationshipById(relationshipId: string) {
  const result = await query(
    `SELECT id, actor_id, agent_id, ended_at
     FROM actor_agent_relationships
     WHERE id = $1`,
    [relationshipId]
  );

  return result.rows[0] || null;
}

export async function endRelationship(params: {
  relationshipId: string;
  endedByAuth0UserId: string;
  endedBy: 'actor' | 'agent';
}) {
  const updated = await query(
    `UPDATE actor_agent_relationships
     SET ended_at = NOW(),
         ended_by_auth0_id = $2,
         ended_reason = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [params.relationshipId, params.endedByAuth0UserId, `Ended by ${params.endedBy}`]
  );

  return updated.rows[0] || null;
}
