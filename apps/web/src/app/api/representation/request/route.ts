import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id, getActiveRepresentationForActor } from '@/lib/representation';

interface RequestPayload {
  agentRegistryId?: string;
  message?: string;
}

/**
 * POST /api/representation/request
 * Actor submits a representation request to an agent by registry ID.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    if (!roles.includes('Actor')) {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const actor = await getActorByAuth0Id(user.sub);
    if (!actor) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const activeRelationship = await getActiveRepresentationForActor(actor.id);
    if (activeRelationship) {
      return NextResponse.json(
        {
          error: `You are already represented by ${activeRelationship.agency_name}. Remove your current representation before requesting a new one.`,
        },
        { status: 409 }
      );
    }

    const payload = (await request.json()) as RequestPayload;
    const agentRegistryId = payload.agentRegistryId?.trim();

    if (!agentRegistryId) {
      return NextResponse.json({ error: 'Agent registry ID is required' }, { status: 400 });
    }

    const agentResult = await query(
      `SELECT id, agency_name, profile_completed
       FROM agents
       WHERE registry_id = $1
         AND deleted_at IS NULL`,
      [agentRegistryId]
    );

    if (agentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found for the provided registry ID' }, { status: 404 });
    }

    const agent = agentResult.rows[0];

    if (!agent.profile_completed) {
      return NextResponse.json(
        { error: 'This agent is not available yet. Their profile is not complete.' },
        { status: 409 }
      );
    }

    const duplicatePending = await query(
      `SELECT 1
       FROM representation_requests
       WHERE actor_id = $1
         AND agent_id = $2
         AND status = 'pending'
       LIMIT 1`,
      [actor.id, agent.id]
    );

    if (duplicatePending.rows.length > 0) {
      return NextResponse.json(
        { error: 'You already have a pending request with this agent.' },
        { status: 409 }
      );
    }

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
      [actor.id, agent.id, payload.message?.trim() || null]
    );

    return NextResponse.json({
      success: true,
      request: result.rows[0],
      message: `Representation request sent to ${agent.agency_name}.`,
    });
  } catch (error) {
    console.error('[REPRESENTATION_REQUEST] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
