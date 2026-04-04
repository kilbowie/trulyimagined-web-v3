import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id, getAgentByAuth0Id } from '@/lib/representation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateRequestPayload {
  action?: 'approve' | 'reject' | 'withdraw';
  responseNote?: string;
}

/**
 * PUT /api/representation/requests/:id
 * Agent approves/rejects requests, actor can withdraw own pending requests.
 */
export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const hasAgentRole = roles.includes('Agent');
    const hasActorRole = roles.includes('Actor');

    if (!hasAgentRole && !hasActorRole) {
      return NextResponse.json(
        { error: 'Forbidden: Actor or Agent role required' },
        { status: 403 }
      );
    }

    const agent = hasAgentRole ? await getAgentByAuth0Id(user.sub) : null;
    const actor = hasActorRole ? await getActorByAuth0Id(user.sub) : null;

    const { id } = await params;
    const body = (await req.json()) as UpdateRequestPayload;

    if (!body.action || !['approve', 'reject', 'withdraw'].includes(body.action)) {
      return NextResponse.json(
        { error: 'Action must be approve, reject, or withdraw' },
        { status: 400 }
      );
    }

    const requestResult = await query(
      `SELECT id, actor_id, agent_id, status
       FROM representation_requests
       WHERE id = $1`,
      [id]
    );

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ error: 'Representation request not found' }, { status: 404 });
    }

    const targetRequest = requestResult.rows[0];

    if (targetRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request is already ${targetRequest.status}` },
        { status: 409 }
      );
    }

    if (body.action === 'withdraw') {
      if (!actor || targetRequest.actor_id !== actor.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const withdrawnResult = await query(
        `UPDATE representation_requests
         SET status = 'withdrawn',
             response_note = COALESCE($2, response_note),
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, body.responseNote?.trim() || 'Withdrawn by actor']
      );

      return NextResponse.json({
        success: true,
        request: withdrawnResult.rows[0],
        message: 'Representation request withdrawn.',
      });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 });
    }

    if (targetRequest.agent_id !== agent.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!agent.profile_completed) {
      return NextResponse.json(
        {
          error:
            'Complete your agent profile before responding to representation requests.',
        },
        { status: 409 }
      );
    }

    if (body.action === 'approve') {
      const existingRelationship = await query(
        `SELECT id
         FROM actor_agent_relationships
         WHERE actor_id = $1
           AND ended_at IS NULL
         LIMIT 1`,
        [targetRequest.actor_id]
      );

      if (existingRelationship.rows.length > 0) {
        return NextResponse.json(
          {
            error:
              'This actor is already represented by another agent. The actor must end their current representation before approval.',
          },
          { status: 409 }
        );
      }

      const approvedResult = await query(
        `UPDATE representation_requests
         SET status = 'approved',
             response_note = $2,
             responded_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND status = 'pending'
         RETURNING *`,
        [id, body.responseNote?.trim() || null]
      );

      if (approvedResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Request is no longer pending' },
          { status: 409 }
        );
      }

      await query(
        `INSERT INTO actor_agent_relationships (
          actor_id,
          agent_id,
          representation_request_id,
          started_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())`,
        [targetRequest.actor_id, targetRequest.agent_id, id]
      );

      return NextResponse.json({
        success: true,
        request: approvedResult.rows[0],
        message: 'Representation request approved and actor linked to your roster.',
      });
    }

    const rejectedResult = await query(
      `UPDATE representation_requests
       SET status = 'rejected',
           response_note = $2,
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, body.responseNote?.trim() || null]
    );

    return NextResponse.json({
      success: true,
      request: rejectedResult.rows[0],
      message: 'Representation request rejected.',
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return NextResponse.json(
        {
          error:
            'This actor is already represented by another agent. The actor must end their current representation before approval.',
        },
        { status: 409 }
      );
    }

    console.error('[REPRESENTATION_REQUESTS_ID] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
