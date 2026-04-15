import { NextResponse } from 'next/server';
import { getConnectActorContext, updateActorConnectStatus } from '../_shared';

export async function GET() {
  try {
    const actorContext = await getConnectActorContext();
    if (!actorContext.ok) {
      return NextResponse.json({ error: actorContext.error }, { status: actorContext.status });
    }

    const { stripeAccountId } = actorContext.context;
    if (!stripeAccountId) {
      return NextResponse.json(
        {
          success: true,
          connected: false,
          onboardingComplete: false,
        },
        { status: 200 }
      );
    }

    const status = await updateActorConnectStatus(stripeAccountId);

    return NextResponse.json({
      success: true,
      connected: true,
      accountId: stripeAccountId,
      onboardingComplete: status.onboardingComplete,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      requirementsDue: status.requirementsDue,
      disabledReason: status.disabledReason,
    });
  } catch (error) {
    console.error('[STRIPE CONNECT] status route failed', error);
    return NextResponse.json(
      { error: 'Failed to retrieve Connect account status' },
      { status: 500 }
    );
  }
}
