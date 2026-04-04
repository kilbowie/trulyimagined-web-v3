import { NextResponse } from 'next/server';
import { getAgentTeamMembership } from '@/lib/auth';

/**
 * GET /api/agent-team/me
 * Returns the current user's active agency team membership, or null.
 */
export async function GET() {
  try {
    const membership = await getAgentTeamMembership();
    return NextResponse.json({ success: true, membership });
  } catch (error) {
    console.error('[AGENT_TEAM_ME] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
