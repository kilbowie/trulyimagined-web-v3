import { NextRequest, NextResponse } from 'next/server';
import { buildStepResponse, forwardJson, isStepCompleted, readOnboardingStatus } from '../shared';

export async function POST(request: NextRequest) {
  try {
    const status = await readOnboardingStatus(request);

    if (isStepCompleted(status, 'profile')) {
      return buildStepResponse({
        step: 'profile',
        action: 'already-complete',
        message: 'Profile step is already complete.',
        status,
      });
    }

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      stageName?: string;
      location?: string;
      bio?: string;
    };

    if (!body.firstName?.trim() || !body.lastName?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName' },
        { status: 400 }
      );
    }

    const registration = await forwardJson(request, '/api/identity/register', {
      firstName: body.firstName,
      lastName: body.lastName,
      stageName: body.stageName || '',
      location: body.location || '',
      bio: body.bio || '',
    });

    if (!registration.ok && registration.status !== 409) {
      return NextResponse.json(
        {
          error:
            registration.payload?.error ||
            registration.payload?.message ||
            'Failed to register profile',
        },
        { status: registration.status || 500 }
      );
    }

    const latestStatus = await readOnboardingStatus(request);

    return buildStepResponse({
      step: 'profile',
      action: registration.status === 409 ? 'already-complete' : 'performed',
      message:
        registration.status === 409
          ? 'Profile is already registered.'
          : 'Profile registered successfully.',
      status: latestStatus,
      details: {
        registrationStatusCode: registration.status,
      },
    });
  } catch (error) {
    console.error('[ONBOARDING_STEP_PROFILE] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
