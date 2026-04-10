import { NextRequest, NextResponse } from 'next/server';
import { buildStepResponse, readOnboardingStatus } from '../shared';

export async function POST(request: NextRequest) {
  try {
    const status = await readOnboardingStatus(request);

    return buildStepResponse({
      step: 'complete',
      action: status.currentStep === 'complete' ? 'performed' : 'already-complete',
      message: status.canProfileGoLive
        ? 'Onboarding complete and profile is live.'
        : 'Onboarding complete. Profile will go live after verification is completed.',
      status,
      details: {
        canProfileGoLive: status.canProfileGoLive,
        verificationStatus: status.verificationStatus,
      },
    });
  } catch (error) {
    console.error('[ONBOARDING_STEP_COMPLETE] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
