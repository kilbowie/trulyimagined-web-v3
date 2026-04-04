import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id } from '@/lib/representation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RequestPayload {
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

/**
 * PUT /api/actor/licensing-requests/:id
 * Actor approves or rejects an incoming licensing request.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Load the licensing request and verify ownership
    const existing = await query(
      `SELECT id, actor_id, status, requester_name, project_name
       FROM licensing_requests
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Licensing request not found' }, { status: 404 });
    }

    const req = existing.rows[0];

    if (req.actor_id !== actor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (req.status !== 'pending') {
      return NextResponse.json(
        { error: `This request is already ${req.status} and cannot be updated.` },
        { status: 409 }
      );
    }

    const payload = (await request.json()) as RequestPayload;
    const { action, rejectionReason } = payload;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject".' },
        { status: 400 }
      );
    }

    if (action === 'reject' && rejectionReason && rejectionReason.trim().length > 1000) {
      return NextResponse.json(
        { error: 'Rejection reason must be 1000 characters or fewer.' },
        { status: 400 }
      );
    }

    let updatedRow;

    if (action === 'approve') {
      const result = await query(
        `UPDATE licensing_requests
         SET status = 'approved',
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND actor_id = $2
           AND status = 'pending'
         RETURNING *`,
        [id, actor.id]
      );
      updatedRow = result.rows[0];
    } else {
      const result = await query(
        `UPDATE licensing_requests
         SET status = 'rejected',
             rejected_at = NOW(),
             rejection_reason = $3,
             updated_at = NOW()
         WHERE id = $1
           AND actor_id = $2
           AND status = 'pending'
         RETURNING *`,
        [id, actor.id, rejectionReason?.trim() || null]
      );
      updatedRow = result.rows[0];
    }

    if (!updatedRow) {
      return NextResponse.json(
        { error: 'Update failed — request may have already been processed.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      request: updatedRow,
      message:
        action === 'approve'
          ? `Licensing request from ${req.requester_name} approved.`
          : `Licensing request from ${req.requester_name} rejected.`,
    });
  } catch (error) {
    console.error('[ACTOR_LICENSING_REQUESTS] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
