import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { sendSupportTicketResponseEmail, sendSupportTicketCreatedEmail } from '@/lib/email';

// DB-OWNER: TI

/**
 * POST /api/support/tickets/[id]/messages
 * Add a message to a ticket
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const body = await request.json();
    const { message, is_internal_note = false } = body;

    // Validation
    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: 'Message must be 10,000 characters or less' },
        { status: 400 }
      );
    }

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

    // Check if ticket exists and user has access
    const ticketResult = await query(
      'SELECT t.user_id, t.status, t.ticket_number, t.subject FROM support_tickets t WHERE t.id = $1',
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const ticket = ticketResult.rows[0];

    // Authorization: Users can only comment on their own tickets, Admins can comment on all
    if (!isAdmin && ticket.user_id !== profileId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent internal notes from non-admins
    if (is_internal_note && !isAdmin) {
      return NextResponse.json({ error: 'Only admins can create internal notes' }, { status: 403 });
    }

    // Prevent adding messages to closed tickets
    if (ticket.status === 'closed') {
      return NextResponse.json({ error: 'Cannot add messages to closed tickets' }, { status: 400 });
    }

    // Add message
    const messageResult = await query(
      `INSERT INTO support_ticket_messages (ticket_id, user_id, message, is_internal_note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [ticketId, profileId, message, is_internal_note]
    );

    const newMessage = messageResult.rows[0];

    // Update ticket status if user responded
    if (!isAdmin && ticket.status === 'waiting_on_user') {
      await query(`UPDATE support_tickets SET status = 'open' WHERE id = $1`, [ticketId]);
    }

    // If admin responded, set status to waiting_on_user (optional behavior)
    if (isAdmin && !is_internal_note && ticket.status === 'open') {
      await query(`UPDATE support_tickets SET status = 'waiting_on_user' WHERE id = $1`, [
        ticketId,
      ]);
    }

    // Send email notifications
    try {
      if (isAdmin && !is_internal_note) {
        // Admin responded - notify the user
        const userResult = await query(
          `SELECT up.auth0_user_id, up.full_name 
           FROM user_profiles up 
           WHERE up.id = $1`,
          [ticket.user_id]
        );

        if (userResult.rows.length > 0) {
          const ticketUser = userResult.rows[0];
          // Get user email from Auth0 ID would require another query or passing it
          // For now, we'll use a placeholder
          await sendSupportTicketResponseEmail(
            user.email || '',
            ticketUser.full_name || 'User',
            ticket.ticket_number,
            ticket.subject,
            message
          );
        }
      } else if (!isAdmin) {
        // User responded - notify admins
        await sendSupportTicketCreatedEmail(
          ticket.ticket_number,
          user.email || 'Unknown',
          `User Reply: ${ticket.subject}`,
          'medium'
        );
      }
    } catch (emailError) {
      console.error('[EMAIL_NOTIFICATION_ERROR]', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: {
        id: newMessage.id,
        ticket_id: ticketId,
        user_id: profileId,
        message,
        is_internal_note,
        created_at: newMessage.created_at,
      },
    });
  } catch (error) {
    console.error('[SUPPORT_MESSAGE_CREATE_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to add message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
