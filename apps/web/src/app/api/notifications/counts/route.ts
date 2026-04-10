import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listActorLicensingRequests } from '@/lib/hdicr/licensing-client';
import {
  countOpenSupportTicketsForAdmin,
  countPendingRepresentationRequestsForActor,
  countPendingRepresentationRequestsForAgent,
  countUnreadFeedback,
  countUnreadSupportForUser,
  countUrgentOpenSupportTickets,
  getNotificationProfileByAuth0UserId,
} from '@/lib/notification-counts';
import { getActorByAuth0Id, getAgentByAuth0Id } from '@/lib/representation';

// DB-OWNER: TI

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
    const profile = await getNotificationProfileByAuth0UserId(user.sub);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const isAdmin = profile.role === 'Admin';

    const counts: {
      unreadFeedback: number;
      unreadSupport: number;
      openSupportTickets?: number;
      pendingRepresentationRequests?: number;
      pendingLicensingRequests?: number;
    } = {
      unreadFeedback: 0,
      unreadSupport: 0,
      pendingRepresentationRequests: 0,
      pendingLicensingRequests: 0,
    };

    // For admins: get unread feedback count
    if (isAdmin) {
      counts.unreadFeedback = await countUnreadFeedback();
    }

    // Get unread support ticket messages for this user
    // A ticket is "unread" if there's a new message from admin that user hasn't seen
    counts.unreadSupport = await countUnreadSupportForUser(profile.id);

    // For admins: also count open/unassigned tickets
    if (isAdmin) {
      counts.openSupportTickets = await countOpenSupportTicketsForAdmin(profile.id);

      // For the red notification, consider any open tickets
      counts.unreadSupport = Math.max(counts.unreadSupport, await countUrgentOpenSupportTickets());
    }

    if (profile.role === 'Agent') {
      try {
        const agent = await getAgentByAuth0Id(user.sub);
        if (agent) {
          counts.pendingRepresentationRequests = await countPendingRepresentationRequestsForAgent(
            agent.id
          );
        }
      } catch (error) {
        console.warn(
          '[NOTIFICATIONS_COUNT_WARN] Skipping agent representation count due to upstream error',
          error
        );
      }
    }

    if (profile.role === 'Actor') {
      try {
        const actor = await getActorByAuth0Id(user.sub);
        if (actor) {
          counts.pendingRepresentationRequests = await countPendingRepresentationRequestsForActor(
            actor.id
          );

          const licensingResult = await listActorLicensingRequests(actor.id, 'pending');
          counts.pendingLicensingRequests = licensingResult.pendingCount;
        }
      } catch (error) {
        console.warn(
          '[NOTIFICATIONS_COUNT_WARN] Skipping actor remote counts due to upstream error',
          error
        );
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
