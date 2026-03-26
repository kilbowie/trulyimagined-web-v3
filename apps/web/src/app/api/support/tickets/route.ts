import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { sendSupportTicketCreatedEmail } from '@/lib/email';

/**
 * GET /api/support/tickets
 * List support tickets
 * - Users see their own tickets
 * - Admins see all tickets
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const isAdmin = roles.includes('Admin');

    // Get user's profile ID
    const profileResult = await query('SELECT id FROM user_profiles WHERE auth0_user_id = $1', [
      user.sub,
    ]);

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profileId = profileResult.rows[0].id;

    // Query tickets based on role
    let ticketsResult;
    if (isAdmin) {
      // Admins see all tickets
      ticketsResult = await query(
        `SELECT * FROM support_tickets_with_user
         ORDER BY 
           CASE status
             WHEN 'open' THEN 1
             WHEN 'in_progress' THEN 2
             WHEN 'waiting_on_user' THEN 3
             WHEN 'resolved' THEN 4
             WHEN 'closed' THEN 5
           END,
           created_at DESC
         LIMIT 100`,
        []
      );
    } else {
      // Users see only their tickets
      ticketsResult = await query(
        `SELECT * FROM support_tickets_with_user
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [profileId]
      );
    }

    return NextResponse.json({
      success: true,
      tickets: ticketsResult.rows,
      isAdmin,
    });
  } catch (error) {
    console.error('[SUPPORT_TICKETS_LIST_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch tickets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, message, priority = 'medium' } = body;

    // Validation
    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    if (subject.length > 255) {
      return NextResponse.json(
        { error: 'Subject must be 255 characters or less' },
        { status: 400 }
      );
    }

    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority level' }, { status: 400 });
    }

    // Get user's profile ID
    const profileResult = await query('SELECT id FROM user_profiles WHERE auth0_user_id = $1', [
      user.sub,
    ]);

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profileId = profileResult.rows[0].id;

    // Create ticket
    const ticketResult = await query(
      `INSERT INTO support_tickets (user_id, subject, priority, status)
       VALUES ($1, $2, $3, 'open')
       RETURNING id, ticket_number, created_at`,
      [profileId, subject, priority]
    );

    const ticket = ticketResult.rows[0];

    // Add initial message
    await query(
      `INSERT INTO support_ticket_messages (ticket_id, user_id, message)
       VALUES ($1, $2, $3)`,
      [ticket.id, profileId, message]
    );

    // Send email notification to support team
    try {
      await sendSupportTicketCreatedEmail(
        ticket.ticket_number,
        user.email || 'Unknown',
        subject,
        priority
      );
    } catch (emailError) {
      console.error('[EMAIL_NOTIFICATION_ERROR]', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject,
        status: 'open',
        priority,
        created_at: ticket.created_at,
      },
    });
  } catch (error) {
    console.error('[SUPPORT_TICKET_CREATE_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to create ticket',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
