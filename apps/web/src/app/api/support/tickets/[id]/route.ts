import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * GET /api/support/tickets/[id]
 * Get a specific ticket with all messages
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;

    // Get user's profile ID
    const profileResult = await query('SELECT id FROM user_profiles WHERE auth0_user_id = $1', [
      user.sub,
    ]);

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profileId = profileResult.rows[0].id;
    const roles = await getUserRoles();
    const isAdmin = roles.includes('Admin');

    // Get ticket details
    const ticketResult = await query(`SELECT * FROM support_tickets_with_user WHERE id = $1`, [
      ticketId,
    ]);

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = ticketResult.rows[0];

    // Authorization: Users can only see their own tickets, Admins can see all
    if (!isAdmin && ticket.user_id !== profileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all messages for this ticket
    const messagesResult = await query(
      `SELECT 
         stm.id,
         stm.message,
         stm.is_internal_note,
         stm.created_at,
         stm.updated_at,
         stm.user_id,
         up.email AS user_email,
         up.username AS user_username
       FROM support_ticket_messages stm
       JOIN user_profiles up ON stm.user_id = up.id
       WHERE stm.ticket_id = $1
       ${!isAdmin ? 'AND stm.is_internal_note = FALSE' : ''}
       ORDER BY stm.created_at ASC`,
      [ticketId]
    );

    return NextResponse.json({
      success: true,
      ticket: {
        ...ticket,
        messages: messagesResult.rows,
      },
      isAdmin,
    });
  } catch (error) {
    console.error('[SUPPORT_TICKET_GET_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch ticket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/support/tickets/[id]
 * Update ticket status/assignment (Admin only)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const isAdmin = roles.includes('Admin');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const ticketId = params.id;
    const body = await request.json();
    const { status, priority, assigned_to } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      if (!['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.push(`status = $${paramIndex++}`);
      values.push(status);

      // Set resolved_at or closed_at timestamps
      if (status === 'resolved') {
        updates.push(`resolved_at = CURRENT_TIMESTAMP`);
      } else if (status === 'closed') {
        updates.push(`closed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (priority !== undefined) {
      if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
        return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
      }
      updates.push(`priority = $${paramIndex++}`);
      values.push(priority);
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(assigned_to || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    values.push(ticketId);

    const result = await query(
      `UPDATE support_tickets 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, ticket_number, status, priority, assigned_to, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error('[SUPPORT_TICKET_UPDATE_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to update ticket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
