import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';

/**
 * GET /api/representation/lookup?registryId=XXXX-XXXX-XXXX
 * Actor lookup for agent registry ID before sending request.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    if (!roles.includes('Actor')) {
      return NextResponse.json({ error: 'Forbidden: Actor role required' }, { status: 403 });
    }

    const registryId = request.nextUrl.searchParams.get('registryId')?.trim();

    if (!registryId) {
      return NextResponse.json({ error: 'registryId query parameter is required' }, { status: 400 });
    }

    const result = await query(
      `SELECT
         id,
         registry_id,
         agency_name,
         verification_status,
         profile_image_url,
         location,
         website_url,
         profile_completed
       FROM agents
       WHERE registry_id = $1
         AND deleted_at IS NULL`,
      [registryId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const agent = result.rows[0];

    if (!agent.profile_completed) {
      return NextResponse.json(
        { error: 'This agent is not available yet. Their profile is not complete.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      agent,
    });
  } catch (error) {
    console.error('[REPRESENTATION_LOOKUP] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
