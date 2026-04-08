import { query } from '@/lib/db';

export async function getNotificationProfileByAuth0UserId(auth0UserId: string) {
  const profileResult = await query(
    'SELECT id, role FROM user_profiles WHERE auth0_user_id = $1',
    [auth0UserId]
  );

  return profileResult.rows[0] || null;
}

export async function countUnreadFeedback() {
  const result = await query('SELECT COUNT(*) as count FROM user_feedback WHERE is_read = false', []);
  return parseInt(result.rows[0]?.count ?? '0', 10) || 0;
}

export async function countUnreadSupportForUser(userProfileId: string) {
  const result = await query(
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
    [userProfileId]
  );

  return parseInt(result.rows[0]?.count ?? '0', 10) || 0;
}

export async function countOpenSupportTicketsForAdmin(userProfileId: string) {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM support_tickets
     WHERE status IN ('open', 'waiting_on_user')
       AND (assigned_to IS NULL OR assigned_to = $1)`,
    [userProfileId]
  );

  return parseInt(result.rows[0]?.count ?? '0', 10) || 0;
}

export async function countUrgentOpenSupportTickets() {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM support_tickets
     WHERE status IN ('open', 'waiting_on_user')`,
    []
  );

  return parseInt(result.rows[0]?.count ?? '0', 10) || 0;
}

export async function countPendingRepresentationRequestsForAgent(agentId: string) {
  const result = await query(
    `SELECT COUNT(*) AS count
     FROM representation_requests
     WHERE agent_id = $1
       AND status = 'pending'`,
    [agentId]
  );

  return parseInt(result.rows[0]?.count ?? '0', 10) || 0;
}

export async function countPendingRepresentationRequestsForActor(actorId: string) {
  const result = await query(
    `SELECT COUNT(*) AS count
     FROM representation_requests
     WHERE actor_id = $1
       AND status = 'pending'`,
    [actorId]
  );

  return parseInt(result.rows[0]?.count ?? '0', 10) || 0;
}