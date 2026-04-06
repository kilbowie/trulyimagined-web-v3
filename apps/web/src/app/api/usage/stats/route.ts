/**
 * Usage Tracking API - Global Stats
 *
 * GET /api/usage/stats
 *
 * Get platform-wide usage statistics
 */

import { NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getGlobalUsageStats } from '@/lib/hdicr/usage-client';

export async function GET() {
  try {
    // 1. Authenticate (admin only)
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check if user has admin role (from database)
    const hasAdminRole = await isAdmin();

    if (!hasAdminRole) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 3. Get platform-wide stats
    const usageStats = await getGlobalUsageStats();

    // 7. Return comprehensive stats
    return NextResponse.json({
      stats: usageStats.stats,
      recentActivity: usageStats.recentActivity,
      topActors: usageStats.topActors.map((actor) => ({
        id: actor.id,
        name: actor.stage_name || `${actor.first_name} ${actor.last_name}`,
        totalMinutes: parseFloat(actor.total_minutes || '0'),
        totalImages: parseFloat(actor.total_images || '0'),
        totalVideoSeconds: parseFloat(actor.total_video_seconds || '0'),
        totalRecords: parseInt(actor.total_records || '0'),
      })),
      totals: {
        actorsWithUsage: parseInt(usageStats.totals?.total_actors_with_usage || '0'),
        totalRecords: parseInt(usageStats.totals?.total_usage_records || '0'),
        totalVoiceMinutes: parseFloat(usageStats.totals?.total_voice_minutes || '0'),
        totalImages: parseFloat(usageStats.totals?.total_images || '0'),
        totalVideoSeconds: parseFloat(usageStats.totals?.total_video_seconds || '0'),
      },
    });
  } catch (error) {
    console.error('[Usage Stats Error]', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve usage stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
