import { NextRequest, NextResponse } from 'next/server';

type StepId = 'signup' | 'profile' | 'verify-identity' | 'consent' | 'complete';

type OnboardingStep = {
  id: StepId;
  label: string;
  completed: boolean;
  href: string;
};

type OnboardingStatusPayload = {
  success: boolean;
  data: {
    actorId: string | null;
    verificationStatus: string;
    canProfileGoLive: boolean;
    currentStep: StepId;
    steps: OnboardingStep[];
    progress: {
      completed: number;
      total: number;
    };
  };
};

export type StepRouteResult = {
  step: StepId;
  action: 'performed' | 'already-complete';
  message: string;
  status: OnboardingStatusPayload['data'];
  details?: Record<string, unknown>;
};

export async function readOnboardingStatus(
  request: NextRequest
): Promise<OnboardingStatusPayload['data']> {
  const response = await fetch(`${request.nextUrl.origin}/api/onboarding/status`, {
    method: 'GET',
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as
    | OnboardingStatusPayload
    | { error?: string; success?: false };

  if (!response.ok || !('success' in payload) || !payload.success) {
    throw new Error(
      'error' in payload
        ? payload.error || 'Unable to read onboarding status'
        : 'Unable to read onboarding status'
    );
  }

  return payload.data;
}

export async function forwardJson(
  request: NextRequest,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; payload: any }> {
  const response = await fetch(`${request.nextUrl.origin}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') || '',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

export function isStepCompleted(status: OnboardingStatusPayload['data'], stepId: StepId): boolean {
  return Boolean(status.steps.find((step) => step.id === stepId)?.completed);
}

export function buildStepResponse(result: StepRouteResult) {
  return NextResponse.json({
    success: true,
    ...result,
  });
}
