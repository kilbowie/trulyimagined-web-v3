import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles, getAgentTeamMembership } from '@/lib/auth';
import { query } from '@/lib/db';
import { getCurrentConsentLedger } from '@/lib/hdicr/consent-client';
import { getActorById } from '@/lib/hdicr/identity-client';
import { getAgentByAuth0Id } from '@/lib/representation';

// DB-OWNER: HDICR

/**
 * GET /api/agent/roster
 * Returns active actor roster for the authenticated agent or an active team member
 * with the canManageRoster permission.
 */
export async function GET() {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();

    // Resolve agentId: agency owner (Agent role) or team member with canManageRoster
    let agentId: string | null = null;

    if (roles.includes('Agent')) {
      const agent = await getAgentByAuth0Id(user.sub);
      agentId = agent?.id ?? null;
    } else {
      const membership = await getAgentTeamMembership();
      if (membership?.permissions.canManageRoster) {
        agentId = membership.agencyId;
      }
    }

    if (agentId === null && !roles.includes('Agent')) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    if (!agentId) {
      return NextResponse.json({ roster: [], total: 0 });
    }

    const relationships = await query(
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

    const roster = (
      await Promise.all(
        relationships.rows.map(async (relationship) => {
          const [actor, consent] = await Promise.all([
            getActorById(relationship.actor_id as string),
            getCurrentConsentLedger(relationship.actor_id as string, false),
          ]);

          if (!actor) {
            return null;
          }

          const currentConsent = consent.current as {
            version?: number;
            policy?: Record<string, unknown> | null;
          } | null;
          const consentPolicy = currentConsent?.policy ?? null;

          return {
            relationship_id: relationship.relationship_id,
            started_at: relationship.started_at,
            id: actor.id,
            registry_id: actor.registry_id ?? null,
            stage_name: actor.stage_name ?? null,
            first_name: actor.first_name ?? null,
            last_name: actor.last_name ?? null,
            verification_status: actor.verification_status ?? null,
            profile_image_url: actor.profile_image_url ?? null,
            location: actor.location ?? null,
            consent_version: currentConsent?.version ?? null,
            consent_policy: consentPolicy,
            consent_usage_blocked: Boolean(
              consentPolicy && typeof consentPolicy === 'object' && 'usageBlocked' in consentPolicy
                ? consentPolicy.usageBlocked
                : false
            ),
          };
        })
      )
    ).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return NextResponse.json({
      roster,
      total: roster.length,
    });
  } catch (error) {
    console.error('[AGENT_ROSTER] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
