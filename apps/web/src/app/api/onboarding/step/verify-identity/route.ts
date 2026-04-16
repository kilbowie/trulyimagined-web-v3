import { NextRequest, NextResponse } from 'next/server';
import { buildStepResponse, forwardJson, isStepCompleted, readOnboardingStatus } from '../shared';

export async function POST(request: NextRequest) {
  try {
    const status = await readOnboardingStatus(request);

    if (!isStepCompleted(status, 'profile')) {
      return NextResponse.json(
        {
          error: 'Complete profile registration before identity verification.',
          currentStep: status.currentStep,
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as {
      verificationMethod?: 'stripe' | 'manual';
      preferredTimezone?: string;
      phoneNumber?: string;
    };

    const method = body.verificationMethod || 'stripe';

    if (isStepCompleted(status, 'verify-identity') && method !== 'manual') {
      return buildStepResponse({
        step: 'verify-identity',
        action: 'already-complete',
        message: 'Identity verification is already in progress or complete.',
        status,
      });
    }

    if (method === 'stripe') {
      const stripeStart = await forwardJson(request, '/api/stripe/identity/session', {});

      if (!stripeStart.ok) {
        return NextResponse.json(
          {
            error:
              stripeStart.payload?.message ||
              stripeStart.payload?.error ||
              'Unable to start Stripe verification.',
            options: ['retry-stripe', 'request-manual-video-call'],
          },
          { status: stripeStart.status || 500 }
        );
      }

      const latestStatus = await readOnboardingStatus(request);

      return buildStepResponse({
        step: 'verify-identity',
        action: 'performed',
        message:
          'Stripe verification started. If Stripe fails, you can retry Stripe or request a manual video call.',
        status: latestStatus,
        details: {
          verificationMethod: 'stripe',
          stripeUrl: stripeStart.payload?.url || null,
          stripeStatus: stripeStart.payload?.status || null,
        },
      });
    }

    if (!body.preferredTimezone?.trim() || !body.phoneNumber?.trim()) {
      return NextResponse.json(
        { error: 'preferredTimezone and phoneNumber are required for manual verification.' },
        { status: 400 }
      );
    }

    const manualRequest = await forwardJson(request, '/api/verification/manual-request', {
      preferredTimezone: body.preferredTimezone,
      phoneNumber: body.phoneNumber,
    });

    if (!manualRequest.ok && manualRequest.status !== 409) {
      return NextResponse.json(
        {
          error:
            manualRequest.payload?.error ||
            manualRequest.payload?.message ||
            'Unable to request manual verification.',
        },
        { status: manualRequest.status || 500 }
      );
    }

    const latestStatus = await readOnboardingStatus(request);

    return buildStepResponse({
      step: 'verify-identity',
      action: manualRequest.status === 409 ? 'already-complete' : 'performed',
      message:
        manualRequest.status === 409
          ? 'A manual verification session already exists.'
          : 'Manual verification requested. You can proceed to consent while verification is pending.',
      status: latestStatus,
      details: {
        verificationMethod: 'manual',
        verificationRequestId: manualRequest.payload?.verificationRequestId || null,
      },
    });
  } catch (error) {
    console.error('[ONBOARDING_STEP_VERIFY_IDENTITY] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
