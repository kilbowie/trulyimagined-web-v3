import { NextResponse } from 'next/server';
import { createConnectExpressAccount } from '@/lib/stripe';
import { queryTi } from '@/lib/db';
import { getConnectActorContext, updateActorConnectStatus } from '../_shared';

export async function POST() {
  try {
    const actorContext = await getConnectActorContext();
    if (!actorContext.ok) {
      return NextResponse.json({ error: actorContext.error }, { status: actorContext.status });
    }

    const { context } = actorContext;

    if (!context.email) {
      return NextResponse.json(
        { error: 'Actor email is required before creating a Connect account' },
        { status: 400 }
      );
    }

    if (context.stripeAccountId) {
      const status = await updateActorConnectStatus(context.stripeAccountId);
      return NextResponse.json({
        success: true,
        accountId: context.stripeAccountId,
        onboardingComplete: status.onboardingComplete,
        created: false,
      });
    }

    const account = await createConnectExpressAccount({
      email: context.email,
      metadata: {
        actor_id: context.actorId,
        user_profile_id: context.userProfileId,
        auth0_user_id: context.auth0UserId,
        role: context.role,
      },
    });

    await queryTi(
      `UPDATE actors
       SET stripe_account_id = $2,
           stripe_account_status = 'pending',
           stripe_onboarding_complete = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [context.actorId, account.id]
    );

    return NextResponse.json({
      success: true,
      accountId: account.id,
      onboardingComplete: false,
      created: true,
    });
  } catch (error) {
    console.error('[STRIPE CONNECT] create route failed', error);
    return NextResponse.json({ error: 'Failed to create Connect account' }, { status: 500 });
  }
}
