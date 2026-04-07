import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { getAgentByAuth0Id } from '@/lib/representation';
import { getCurrentConsentLedger, listConsentRecords } from '@/lib/hdicr/consent-client';
import { verifyActiveRepresentation } from '@/lib/hdicr/licensing-client';

// DB-OWNER: HDICR

interface RouteParams {
  params: Promise<{ actorId: string }>;
}

/**
 * GET /api/agent/actors/:actorId/consent
 * Returns consent history for actors represented by the authenticated agent.
 */
export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await getUserRoles();
    if (!roles.includes('Agent')) {
      return NextResponse.json({ error: 'Forbidden: Agent role required' }, { status: 403 });
    }

    const agent = await getAgentByAuth0Id(user.sub);
    if (!agent) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 });
    }

    const { actorId } = await params;

    const hasActiveRelationship = await verifyActiveRepresentation(actorId, agent.id);
    if (!hasActiveRelationship) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const consentLog = await listConsentRecords({ actorId, limit: 100, offset: 0 });
    const consentLedger = await getCurrentConsentLedger(actorId, true);

    const ledgerRows = [consentLedger.current, ...(consentLedger.history || [])].filter(Boolean);

    return NextResponse.json({
      consentLog: consentLog.rows,
      consentLedger: ledgerRows,
    });
  } catch (error) {
    console.error('[AGENT_ACTOR_CONSENT] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
