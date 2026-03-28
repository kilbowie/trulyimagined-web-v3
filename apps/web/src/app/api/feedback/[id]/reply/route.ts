import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { sendFeedbackResponseEmail } from '@/lib/email';

/**
 * POST /api/feedback/[id]/reply
 * Reply to feedback - creates a support ticket and sends email notification (Admin only)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    const isAdmin = roles.includes('Admin');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const feedbackId = params.id;
    const body = await request.json();
    const { message } = body;

    // Validation
    if (!message || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Reply message must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(feedbackId)) {
      return NextResponse.json({ error: 'Invalid feedback ID' }, { status: 400 });
    }

    // Get feedback details
    const feedbackResult = await query('SELECT * FROM user_feedback_with_details WHERE id = $1', [
      feedbackId,
    ]);

    if (feedbackResult.rows.length === 0) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    const feedback = feedbackResult.rows[0];

    // Get admin profile
    const adminProfileResult = await query(
      'SELECT id FROM user_profiles WHERE auth0_user_id = $1',
      [user.sub]
    );

    if (adminProfileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Admin profile not found' }, { status: 404 });
    }

    const adminProfileId = adminProfileResult.rows[0].id;

    // Format ticket subject
    const submissionDate = new Date(feedback.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const ticketSubject = `Feedback - ${feedback.topic} - ${submissionDate}`;

    // Create support ticket
    const ticketResult = await query(
      `INSERT INTO support_tickets (
        user_id, subject, status, priority, assigned_to, feedback_id
      ) VALUES ($1, $2, 'open', 'medium', $3, $4)
      RETURNING *`,
      [feedback.user_id, ticketSubject, adminProfileId, feedbackId]
    );

    const ticket = ticketResult.rows[0];

    // Add initial message to ticket (admin's reply)
    await query(
      `INSERT INTO support_ticket_messages (
        ticket_id, user_id, message, is_internal_note
      ) VALUES ($1, $2, $3, false)`,
      [ticket.id, adminProfileId, message.trim()]
    );

    // Mark feedback as read
    await query('UPDATE user_feedback SET is_read = true WHERE id = $1', [feedbackId]);

    // Send email notification to user (no admin notification for feedback replies)
    try {
      await sendFeedbackResponseEmail(
        feedback.user_email,
        feedback.user_username || feedback.user_professional_name || 'User',
        feedback.topic
      );
    } catch (emailError) {
      console.error('[FEEDBACK_REPLY_EMAIL_ERROR]', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully',
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
      },
    });
  } catch (error) {
    console.error('[FEEDBACK_REPLY_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to send reply',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
