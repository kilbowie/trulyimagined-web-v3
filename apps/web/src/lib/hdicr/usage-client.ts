import { query } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function actorExistsById(actorId: string): Promise<boolean> {
  const actorCheck = await query('SELECT id FROM actors WHERE id = $1', [actorId]);
  return actorCheck.rows.length > 0;
}

export async function getLicensingRequestStatusById(licensingRequestId: string) {
  const licenseCheck = await query('SELECT id, status FROM licensing_requests WHERE id = $1', [
    licensingRequestId,
  ]);

  return licenseCheck.rows[0] || null;
}

export async function createUsageTrackingRecord(params: {
  actorId: string;
  licensingRequestId?: string;
  usageType: 'voice_minutes' | 'image_generation' | 'video_seconds';
  quantity: number;
  unit: 'minutes' | 'images' | 'seconds';
  projectName?: string;
  generatedBy: string;
  metadata: Record<string, unknown>;
}) {
  const id = randomUUID();

  const result = await query(
    `INSERT INTO usage_tracking (
      id, actor_id, licensing_request_id, usage_type, quantity, unit,
      project_name, generated_by, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING *`,
    [
      id,
      params.actorId,
      params.licensingRequestId || null,
      params.usageType,
      params.quantity,
      params.unit,
      params.projectName || null,
      params.generatedBy,
      JSON.stringify(params.metadata),
    ]
  );

  return result.rows[0] || null;
}

export async function createUsageAuditLog(params: {
  actorId: string;
  resourceId: string;
  usageType: 'voice_minutes' | 'image_generation' | 'video_seconds';
  quantity: number;
  unit: 'minutes' | 'images' | 'seconds';
}) {
  await query(
    `INSERT INTO audit_log (
      actor_id, action, resource_type, resource_id, metadata,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      params.actorId,
      'usage_tracked',
      'usage_tracking',
      params.resourceId,
      JSON.stringify({
        actorId: params.actorId,
        usageType: params.usageType,
        quantity: params.quantity,
        unit: params.unit,
      }),
    ]
  );
}

export async function getUsageActorById(actorId: string) {
  const actorResult = await query(
    'SELECT id, first_name, last_name, stage_name FROM actors WHERE id = $1',
    [actorId]
  );

  if (actorResult.rows.length === 0) {
    return null;
  }

  return actorResult.rows[0];
}

export async function getActorUsageRecords(actorId: string, limit: number, offset: number) {
  const usageResult = await query(
    `SELECT * FROM usage_tracking
     WHERE actor_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [actorId, limit, offset]
  );

  return usageResult.rows;
}

export async function getActorUsageStats(actorId: string) {
  const statsResult = await query(
    `SELECT
      usage_type,
      unit,
      SUM(quantity) as total_quantity,
      COUNT(*) as total_records,
      MIN(created_at) as first_usage,
      MAX(created_at) as last_usage
    FROM usage_tracking
    WHERE actor_id = $1
    GROUP BY usage_type, unit`,
    [actorId]
  );

  const minutesResult = await query(
    `SELECT SUM(quantity) as total_minutes
     FROM usage_tracking
     WHERE actor_id = $1 AND usage_type = 'voice_minutes' AND unit = 'minutes'`,
    [actorId]
  );

  return {
    stats: statsResult.rows,
    totalMinutes: parseFloat(minutesResult.rows[0]?.total_minutes || '0'),
  };
}

export async function getGlobalUsageStats() {
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

  const totalsQuery = `
    SELECT
      COUNT(DISTINCT actor_id) as total_actors_with_usage,
      COUNT(*) as total_usage_records,
      SUM(CASE WHEN usage_type = 'voice_minutes' THEN quantity ELSE 0 END) as total_voice_minutes,
      SUM(CASE WHEN usage_type = 'image_generation' THEN quantity ELSE 0 END) as total_images,
      SUM(CASE WHEN usage_type = 'video_seconds' THEN quantity ELSE 0 END) as total_video_seconds
    FROM usage_tracking;
  `;

  const [statsResult, recentResult, topActorsResult, totalsResult] = await Promise.all([
    query(statsQuery),
    query(recentQuery),
    query(topActorsQuery),
    query(totalsQuery),
  ]);

  return {
    stats: statsResult.rows,
    recentActivity: recentResult.rows,
    topActors: topActorsResult.rows,
    totals: totalsResult.rows[0] || null,
  };
}
