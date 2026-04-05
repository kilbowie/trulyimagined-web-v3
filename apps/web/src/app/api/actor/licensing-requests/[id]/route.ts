import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import {
  applyLicensingDecision,
  getLicensingRequestById,
  resolveActorIdByAuth0UserId,
} from '@/lib/hdicr/licensing-client';

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

    const actorId = await resolveActorIdByAuth0UserId(user.sub);
    if (!actorId) {
      return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }

    const { id } = await params;

    // Load the licensing request and verify ownership
    const req = await getLicensingRequestById(id);

    if (!req) {
      return NextResponse.json({ error: 'Licensing request not found' }, { status: 404 });
    }

    if (req.actor_id !== actorId) {
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

    const updatedRow = await applyLicensingDecision(id, actorId, action, rejectionReason);

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
