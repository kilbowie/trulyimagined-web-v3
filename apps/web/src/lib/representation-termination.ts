import { query } from '@/lib/db';
import { sendRepresentationTerminationCompletedEmail } from '@/lib/email';
import {
  endRelationship,
  getActorByAuth0UserId,
  getAgentByAuth0UserId,
  getRelationshipById,
} from '@/lib/hdicr/representation-client';

export class TerminationHttpError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(String(payload.error || 'Termination request failed'));
    this.status = status;
    this.payload = payload;
  }
}

export type RepresentationTerminationNotificationContext = {
  actorEmail: string | null;
  actorName: string;
  actorRegistryId: string | null;
  agentEmail: string | null;
  agencyName: string;
  agentRegistryId: string | null;
};

export async function getTerminationNotificationContext(
  relationshipId: string
): Promise<RepresentationTerminationNotificationContext | null> {
  const result = await query(
    `SELECT
       ac.email AS actor_email,
       COALESCE(ac.stage_name, NULLIF(TRIM(COALESCE(ac.first_name, '') || ' ' || COALESCE(ac.last_name, '')), ''), 'Actor') AS actor_name,
       ac.registry_id AS actor_registry_id,
       ag.contact_email AS agent_email,
       COALESCE(ag.agency_name, 'Agency') AS agency_name,
       ag.registry_id AS agent_registry_id
     FROM actor_agent_relationships aar
     INNER JOIN actors ac ON ac.id = aar.actor_id
     INNER JOIN agents ag ON ag.id = aar.agent_id
     WHERE aar.id = $1
     LIMIT 1`,
    [relationshipId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    actorEmail: row.actor_email || null,
    actorName: row.actor_name || 'Actor',
    actorRegistryId: row.actor_registry_id || null,
    agentEmail: row.agent_email || null,
    agencyName: row.agency_name || 'Agency',
    agentRegistryId: row.agent_registry_id || null,
  };
}

export async function scheduleRepresentationTermination(params: {
  relationshipId: string;
  initiatedByAuth0UserId: string;
  roles: string[];
  reason?: string | null;
}) {
  const hasActorRole = params.roles.includes('Actor');
  const hasAgentRole = params.roles.includes('Agent');

  if (!hasActorRole && !hasAgentRole) {
    throw new TerminationHttpError(403, {
      error: 'Forbidden: Actor or Agent role required',
    });
  }

  const [relationship, actor, agent] = await Promise.all([
    getRelationshipById(params.relationshipId),
    hasActorRole ? getActorByAuth0UserId(params.initiatedByAuth0UserId) : Promise.resolve(null),
    hasAgentRole ? getAgentByAuth0UserId(params.initiatedByAuth0UserId) : Promise.resolve(null),
  ]);

  if (!relationship) {
    throw new TerminationHttpError(404, {
      error: 'Representation relationship not found',
    });
  }

  if (relationship.ended_at) {
    throw new TerminationHttpError(409, {
      error: 'Representation is already ended',
    });
  }

  const actorCanTerminate = Boolean(actor && relationship.actor_id === actor.id);
  const agentCanTerminate = Boolean(agent && relationship.agent_id === agent.id);

  if (!actorCanTerminate && !agentCanTerminate) {
    throw new TerminationHttpError(403, {
      error: 'Forbidden',
    });
  }

  const existingPending = await query(
    `SELECT id, relationship_id, actor_id, agent_id, initiated_by, reason, notice_date, effective_date, status
     FROM representation_terminations
     WHERE relationship_id = $1
       AND status = 'pending_termination'
     LIMIT 1`,
    [params.relationshipId]
  );

  if (existingPending.rows.length > 0) {
    return {
      alreadyPending: true,
      termination: existingPending.rows[0],
    };
  }

  const initiatedBy = actorCanTerminate ? 'actor' : 'agent';

  const inserted = await query(
    `INSERT INTO representation_terminations (
       relationship_id,
       actor_id,
       agent_id,
       initiated_by,
       initiated_by_auth0_id,
       reason,
       notice_date,
       effective_date,
       status
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       NULLIF($6, ''),
       NOW(),
       NOW() + INTERVAL '30 days',
       'pending_termination'
     )
     RETURNING id, relationship_id, actor_id, agent_id, initiated_by, reason, notice_date, effective_date, status`,
    [
      params.relationshipId,
      relationship.actor_id,
      relationship.agent_id,
      initiatedBy,
      params.initiatedByAuth0UserId,
      params.reason || null,
    ]
  );

  return {
    alreadyPending: false,
    termination: inserted.rows[0],
  };
}

export async function listPendingTerminations(params: { actorId?: string; agentId?: string }) {
  if (!params.actorId && !params.agentId) {
    return [];
  }

  const filters: string[] = ["rt.status = 'pending_termination'"];
  const values: unknown[] = [];

  if (params.actorId) {
    values.push(params.actorId);
    filters.push(`rt.actor_id = $${values.length}`);
  }

  if (params.agentId) {
    values.push(params.agentId);
    filters.push(`rt.agent_id = $${values.length}`);
  }

  const result = await query(
    `SELECT
       rt.id,
       rt.relationship_id,
       rt.actor_id,
       rt.agent_id,
       rt.initiated_by,
       rt.reason,
       rt.notice_date,
       rt.effective_date,
       rt.status,
       a.agency_name,
       a.registry_id AS agent_registry_id,
       ac.registry_id AS actor_registry_id,
       ac.stage_name,
       ac.first_name,
       ac.last_name
     FROM representation_terminations rt
     INNER JOIN agents a ON a.id = rt.agent_id
     INNER JOIN actors ac ON ac.id = rt.actor_id
     WHERE ${filters.join(' AND ')}
     ORDER BY rt.effective_date ASC`,
    values
  );

  return result.rows;
}

export async function applyDueRepresentationTerminations(limit = 100) {
  const startedAt = Date.now();
  const warningFailureRateThreshold = Number(
    process.env.REPRESENTATION_TERMINATION_SWEEP_WARN_FAILURE_RATE || '0.2'
  );
  const warningFailureCountThreshold = Number(
    process.env.REPRESENTATION_TERMINATION_SWEEP_WARN_FAILURE_COUNT || '3'
  );

  const due = await query(
    `SELECT id, relationship_id, initiated_by, status
     FROM representation_terminations
     WHERE (
       (status = 'pending_termination' AND effective_date <= NOW())
       OR (status = 'failed' AND effective_date <= NOW())
     )
     ORDER BY effective_date ASC
     LIMIT $1`,
    [limit]
  );

  let completed = 0;
  let failed = 0;
  let retriesAttempted = 0;
  let retriesRecovered = 0;
  const failures: Array<{ terminationId: string; relationshipId: string; error: string }> = [];

  for (const row of due.rows) {
    const isRetryAttempt = row.status === 'failed';
    if (isRetryAttempt) {
      retriesAttempted += 1;
    }

    try {
      const context = await getTerminationNotificationContext(row.relationship_id);

      await endRelationship({
        relationshipId: row.relationship_id,
        endedByAuth0UserId: 'system:termination-sweep',
        endedBy: row.initiated_by === 'agent' ? 'agent' : 'actor',
      });

      await query(
        `UPDATE representation_terminations
         SET status = 'completed',
             completed_at = NOW(),
             updated_at = NOW(),
             last_error = NULL
         WHERE id = $1`,
        [row.id]
      );

      if (context) {
        try {
          await sendRepresentationTerminationCompletedEmail({
            actorEmail: context.actorEmail,
            actorName: context.actorName,
            actorRegistryId: context.actorRegistryId,
            agentEmail: context.agentEmail,
            agencyName: context.agencyName,
            agentRegistryId: context.agentRegistryId,
          });
        } catch (emailError) {
          console.error(
            '[REPRESENTATION_TERMINATION_SWEEP] Completion email send failed:',
            emailError
          );
        }
      }

      completed += 1;
      if (isRetryAttempt) {
        retriesRecovered += 1;
      }
    } catch (error) {
      failed += 1;
      const errorMessage =
        error instanceof Error ? error.message.slice(0, 500) : 'Unknown sweep failure';

      failures.push({
        terminationId: row.id,
        relationshipId: row.relationship_id,
        error: errorMessage,
      });

      await query(
        `UPDATE representation_terminations
         SET status = 'failed',
             last_error = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, errorMessage]
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  const failureRate = due.rows.length > 0 ? failed / due.rows.length : 0;
  const warningTriggered =
    failed >= warningFailureCountThreshold && failureRate >= warningFailureRateThreshold;

  if (warningTriggered) {
    console.warn('[REPRESENTATION_TERMINATION_SWEEP] Warning threshold exceeded', {
      scanned: due.rows.length,
      failed,
      completed,
      failureRate,
      warningFailureRateThreshold,
      warningFailureCountThreshold,
      retriesAttempted,
      retriesRecovered,
    });
  }

  return {
    scanned: due.rows.length,
    completed,
    failed,
    retriesAttempted,
    retriesRecovered,
    failureRate,
    durationMs,
    failures,
    warning: {
      triggered: warningTriggered,
      failureRateThreshold: warningFailureRateThreshold,
      failureCountThreshold: warningFailureCountThreshold,
    },
  };
}
