/**
 * Usage Tracking API - Global Stats
 *
 * GET /api/usage/stats
 *
 * Get platform-wide usage statistics
 */

import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. Authenticate (admin/staff only)
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check if user has admin role (from Auth0 roles)
    const roles = session.user['https://trulyimagined.com/roles'] || [];
    const isAdmin = roles.includes('Admin') || roles.includes('Staff');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 3. Get platform-wide stats
    const statsQuery = `
      SELECT 
        usage_type,
        unit,
        COUNT(DISTINCT actor_id) as unique_actors,
        SUM(quantity) as total_quantity,
        AVG(quantity) as avg_quantity,
        COUNT(*) as total_records,
        MIN(created_at) as first_usage,
        MAX(created_at) as last_usage
      FROM usage_tracking
      GROUP BY usage_type, unit
      ORDER BY usage_type;
    `;

    const statsResult = await query(statsQuery);

    // 4. Get recent usage (last 30 days)
    const recentQuery = `
      SELECT 
        DATE(created_at) as usage_date,
        usage_type,
        SUM(quantity) as daily_quantity,
        COUNT(*) as daily_records
      FROM usage_tracking
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at), usage_type
      ORDER BY usage_date DESC, usage_type;
    `;

    const recentResult = await query(recentQuery);

    // 5. Get top actors by usage
    const topActorsQuery = `
      SELECT 
        a.id,
        a.first_name,
        a.last_name,
        a.stage_name,
        SUM(CASE WHEN ut.usage_type = 'voice_minutes' THEN ut.quantity ELSE 0 END) as total_minutes,
        SUM(CASE WHEN ut.usage_type = 'image_generation' THEN ut.quantity ELSE 0 END) as total_images,
        SUM(CASE WHEN ut.usage_type = 'video_seconds' THEN ut.quantity ELSE 0 END) as total_video_seconds,
        COUNT(*) as total_records
      FROM usage_tracking ut
      JOIN actors a ON ut.actor_id = a.id
      GROUP BY a.id, a.first_name, a.last_name, a.stage_name
      ORDER BY total_minutes DESC
      LIMIT 10;
    `;

    const topActorsResult = await query(topActorsQuery);

    // 6. Get overall totals
    const totalsQuery = `
      SELECT 
        COUNT(DISTINCT actor_id) as total_actors_with_usage,
        COUNT(*) as total_usage_records,
        SUM(CASE WHEN usage_type = 'voice_minutes' THEN quantity ELSE 0 END) as total_voice_minutes,
        SUM(CASE WHEN usage_type = 'image_generation' THEN quantity ELSE 0 END) as total_images,
        SUM(CASE WHEN usage_type = 'video_seconds' THEN quantity ELSE 0 END) as total_video_seconds
      FROM usage_tracking;
    `;

    const totalsResult = await query(totalsQuery);

    // 7. Return comprehensive stats
    return NextResponse.json({
      stats: statsResult.rows,
      recentActivity: recentResult.rows,
      topActors: topActorsResult.rows.map((actor) => ({
        id: actor.id,
        name: actor.stage_name || `${actor.first_name} ${actor.last_name}`,
        totalMinutes: parseFloat(actor.total_minutes || '0'),
        totalImages: parseFloat(actor.total_images || '0'),
        totalVideoSeconds: parseFloat(actor.total_video_seconds || '0'),
        totalRecords: parseInt(actor.total_records || '0'),
      })),
      totals: {
        actorsWithUsage: parseInt(totalsResult.rows[0]?.total_actors_with_usage || '0'),
        totalRecords: parseInt(totalsResult.rows[0]?.total_usage_records || '0'),
        totalVoiceMinutes: parseFloat(totalsResult.rows[0]?.total_voice_minutes || '0'),
        totalImages: parseFloat(totalsResult.rows[0]?.total_images || '0'),
        totalVideoSeconds: parseFloat(totalsResult.rows[0]?.total_video_seconds || '0'),
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
