import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { DEFAULT_TENANT_ID } from '@/lib/manual-verification';

// DB-OWNER: HDICR

export async function GET() {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403 });
    }

    const tenantId = DEFAULT_TENANT_ID;

    const result = await query(
      `SELECT
         a.id AS actor_id,
         a.registry_id,
         a.email,
         a.first_name,
         a.last_name,
         a.stage_name,
         a.verification_status,
         a.created_at AS actor_created_at,
         latest.id AS verification_request_id,
         latest.status AS request_status,
         latest.preferred_timezone,
         latest.phone_number,
         latest.scheduled_at,
         latest.created_at AS request_created_at,
         latest.updated_at AS request_updated_at
       FROM actors a
       LEFT JOIN LATERAL (
         SELECT mvs.*
         FROM manual_verification_sessions mvs
         WHERE mvs.actor_id = a.id
           AND mvs.tenant_id = $1
           AND mvs.deleted_at IS NULL
         ORDER BY mvs.created_at DESC
         LIMIT 1
       ) latest ON true
       WHERE a.tenant_id = $1
         AND a.deleted_at IS NULL
         AND a.verification_status = 'pending'
       ORDER BY COALESCE(latest.created_at, a.created_at) DESC`,
      [tenantId]
    );

    return NextResponse.json({
      success: true,
      data: {
        verifications: result.rows,
        total: result.rowCount || 0,
      },
    });
  } catch (error) {
    console.error('[ADMIN_VERIFICATION_PENDING] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
