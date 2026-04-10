import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';
import { getAgentByAuth0Id } from '@/lib/representation';

interface GenerateCodesPayload {
  batchSize?: number;
}

const CODE_LENGTH = 8;
const MAX_BATCH_SIZE = 100;
const DEFAULT_BATCH_SIZE = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInvitationCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const randomIndex = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[randomIndex];
  }
  return code;
}

async function requireAgentContext() {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const roles = await getUserRoles();
  if (!roles.includes('Agent')) {
    return {
      error: NextResponse.json({ error: 'Forbidden: Agent role required' }, { status: 403 }),
    };
  }

  const agent = await getAgentByAuth0Id(user.sub);
  if (!agent) {
    return { error: NextResponse.json({ error: 'Agent profile not found' }, { status: 404 }) };
  }

  return { user, agent };
}

/**
 * POST /api/agent/codes/generate
 * Generates invitation codes for actor representation onboarding.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAgentContext();
    if ('error' in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as GenerateCodesPayload;
    const requestedBatchSize = Number(body.batchSize || DEFAULT_BATCH_SIZE);

    if (!Number.isFinite(requestedBatchSize) || requestedBatchSize < 1) {
      return NextResponse.json(
        { error: 'batchSize must be an integer greater than 0' },
        { status: 400 }
      );
    }

    const batchSize = Math.min(Math.floor(requestedBatchSize), MAX_BATCH_SIZE);

    const insertedCodes: Array<{ id: string; code: string; expires_at: string }> = [];
    const maxAttempts = batchSize * 10;
    let attempts = 0;

    while (insertedCodes.length < batchSize && attempts < maxAttempts) {
      attempts += 1;
      const code = generateInvitationCode();

      const inserted = await query(
        `INSERT INTO agent_invitation_codes (
           code,
           agent_id,
           expires_at,
           tenant_id
         )
         VALUES ($1, $2, NOW() + INTERVAL '30 days', $3)
         ON CONFLICT (code) DO NOTHING
         RETURNING id, code, expires_at`,
        [code, auth.agent.id, auth.agent.tenant_id || null]
      );

      if (inserted.rows.length > 0) {
        insertedCodes.push(inserted.rows[0] as { id: string; code: string; expires_at: string });
      }
    }

    if (insertedCodes.length < batchSize) {
      return NextResponse.json(
        {
          error: 'Unable to generate the requested number of unique invitation codes',
          generated: insertedCodes.length,
          requested: batchSize,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        generated: insertedCodes.length,
        codes: insertedCodes,
      },
    });
  } catch (error) {
    console.error('[AGENT_CODES_GENERATE] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
