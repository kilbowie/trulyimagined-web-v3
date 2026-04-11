import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { isAdmin } from '@/lib/auth';
import { queryHdicr } from '@/lib/db';
import { DEFAULT_TENANT_ID } from '@/lib/manual-verification';
import { listActors } from '@/lib/hdicr/identity-client';

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

    const actorsPayload = await listActors({ limit: 1000, offset: 0 });
    const pendingActors = actorsPayload.actors.filter((actor) => {
      const verificationStatus =
        (typeof actor.verification_status === 'string' ? actor.verification_status : undefined) ||
        (typeof actor.verificationStatus === 'string' ? actor.verificationStatus : undefined);
      return verificationStatus === 'pending';
    });

    const verifications = await Promise.all(
      pendingActors.map(async (actor) => {
        const actorId =
          (typeof actor.id === 'string' ? actor.id : undefined) ??
          (typeof actor.actor_id === 'string' ? actor.actor_id : undefined);

        if (!actorId) {
          return null;
        }

        const latestSessionResult = await queryHdicr(
          `SELECT id, status, preferred_timezone, phone_number, scheduled_at, created_at, updated_at
           FROM manual_verification_sessions
           WHERE actor_id = $1::uuid
             AND tenant_id = $2
             AND deleted_at IS NULL
           ORDER BY created_at DESC
           LIMIT 1`,
          [actorId, tenantId]
        );

        const latest = latestSessionResult.rows[0] as
          | {
              id?: string;
              status?: string;
              preferred_timezone?: string;
              phone_number?: string;
              scheduled_at?: string;
              created_at?: string;
              updated_at?: string;
            }
          | undefined;

        return {
          actor_id: actorId,
          registry_id:
            (typeof actor.registry_id === 'string' ? actor.registry_id : undefined) ||
            (typeof actor.registryId === 'string' ? actor.registryId : undefined) ||
            null,
          email: typeof actor.email === 'string' ? actor.email : null,
          first_name:
            (typeof actor.first_name === 'string' ? actor.first_name : undefined) ||
            (typeof actor.firstName === 'string' ? actor.firstName : undefined) ||
            null,
          last_name:
            (typeof actor.last_name === 'string' ? actor.last_name : undefined) ||
            (typeof actor.lastName === 'string' ? actor.lastName : undefined) ||
            null,
          stage_name:
            (typeof actor.stage_name === 'string' ? actor.stage_name : undefined) ||
            (typeof actor.stageName === 'string' ? actor.stageName : undefined) ||
            null,
          verification_status:
            (typeof actor.verification_status === 'string' ? actor.verification_status : undefined) ||
            (typeof actor.verificationStatus === 'string' ? actor.verificationStatus : undefined) ||
            null,
          actor_created_at:
            (typeof actor.created_at === 'string' ? actor.created_at : undefined) ||
            (typeof actor.createdAt === 'string' ? actor.createdAt : undefined) ||
            null,
          verification_request_id: latest?.id ?? null,
          request_status: latest?.status ?? null,
          preferred_timezone: latest?.preferred_timezone ?? null,
          phone_number: latest?.phone_number ?? null,
          scheduled_at: latest?.scheduled_at ?? null,
          request_created_at: latest?.created_at ?? null,
          request_updated_at: latest?.updated_at ?? null,
        };
      })
    );

    const orderedVerifications = verifications
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort((a, b) => {
        const aTime = Date.parse(a.request_created_at || a.actor_created_at || '') || 0;
        const bTime = Date.parse(b.request_created_at || b.actor_created_at || '') || 0;
        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      data: {
        verifications: orderedVerifications,
        total: orderedVerifications.length,
      },
    });
  } catch (error) {
    console.error('[ADMIN_VERIFICATION_PENDING] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
