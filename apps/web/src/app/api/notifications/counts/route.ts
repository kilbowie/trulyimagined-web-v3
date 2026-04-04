import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getActorByAuth0Id, getAgentByAuth0Id } from '@/lib/representation';

/**
 * GET /api/notifications/counts
 * Get notification counts for sidebar badges
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const profileResult = await query(
      'SELECT id, role FROM user_profiles WHERE auth0_user_id = $1',
      [user.sub]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];
    const isAdmin = profile.role === 'Admin';

    const counts: {
      unreadFeedback: number;
      unreadSupport: number;
      openSupportTickets?: number;
      pendingRepresentationRequests?: number;
    } = {
      unreadFeedback: 0,
      unreadSupport: 0,
      pendingRepresentationRequests: 0,
    };

    // For admins: get unread feedback count
    if (isAdmin) {
      const feedbackCountResult = await query(
        'SELECT COUNT(*) as count FROM user_feedback WHERE is_read = false',
        []
      );
      counts.unreadFeedback = parseInt(feedbackCountResult.rows[0].count) || 0;
    }

    // Get unread support ticket messages for this user
    // A ticket is "unread" if there's a new message from admin that user hasn't seen
    const supportCountResult = await query(
      `SELECT COUNT(DISTINCT st.id) as count
       FROM support_tickets st
       INNER JOIN support_ticket_messages stm ON stm.ticket_id = st.id
       WHERE st.user_id = $1
         AND stm.user_id != $1
         AND stm.created_at > COALESCE(
           (SELECT MAX(created_at) 
            FROM support_ticket_messages 
            WHERE ticket_id = st.id AND user_id = $1),
           st.created_at
         )
         AND st.status NOT IN ('resolved', 'closed')`,
      [profile.id]
    );
    counts.unreadSupport = parseInt(supportCountResult.rows[0].count) || 0;

    // For admins: also count open/unassigned tickets
    if (isAdmin) {
      const openTicketsResult = await query(
        `SELECT COUNT(*) as count 
         FROM support_tickets 
         WHERE status IN ('open', 'waiting_on_user') 
         AND (assigned_to IS NULL OR assigned_to = $1)`,
        [profile.id]
      );
      counts.openSupportTickets = parseInt(openTicketsResult.rows[0].count) || 0;

      // For the red notification, consider any open tickets
      const urgentTicketsResult = await query(
        `SELECT COUNT(*) as count 
         FROM support_tickets 
         WHERE status IN ('open', 'waiting_on_user')`,
        []
      );
      counts.unreadSupport = Math.max(
        counts.unreadSupport,
        parseInt(urgentTicketsResult.rows[0].count) || 0
      );
    }

    if (profile.role === 'Agent') {
      const agent = await getAgentByAuth0Id(user.sub);
      if (agent) {
        const pendingResult = await query(
          `SELECT COUNT(*) AS count
           FROM representation_requests
           WHERE agent_id = $1
             AND status = 'pending'`,
          [agent.id]
        );
        counts.pendingRepresentationRequests = parseInt(pendingResult.rows[0].count, 10) || 0;
      }
    }

    if (profile.role === 'Actor') {
      const actor = await getActorByAuth0Id(user.sub);
      if (actor) {
        const pendingResult = await query(
          `SELECT COUNT(*) AS count
           FROM representation_requests
           WHERE actor_id = $1
             AND status = 'pending'`,
          [actor.id]
        );
        counts.pendingRepresentationRequests = parseInt(pendingResult.rows[0].count, 10) || 0;
      }
    }

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (error) {
    console.error('[NOTIFICATIONS_COUNT_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch notification counts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
