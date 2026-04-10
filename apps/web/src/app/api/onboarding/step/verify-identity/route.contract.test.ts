import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../shared', () => ({
  readOnboardingStatus: vi.fn(),
  isStepCompleted: vi.fn(),
  forwardJson: vi.fn(),
  buildStepResponse: vi.fn((result: unknown) =>
    Response.json({ success: true, ...(result as Record<string, unknown>) })
  ),
}));

import { POST } from './route';
import { forwardJson, isStepCompleted, readOnboardingStatus } from '../shared';

describe('POST /api/onboarding/step/verify-identity - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks verification before profile completion', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({
      currentStep: 'profile',
      steps: [],
    } as any);
    vi.mocked(isStepCompleted).mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/verify-identity', {
      method: 'POST',
      body: JSON.stringify({ verificationMethod: 'stripe' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('Complete profile registration');
  });

  it('returns stripe options on stripe start failure', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({
      currentStep: 'verify-identity',
      steps: [],
    } as any);
    vi.mocked(isStepCompleted)
      .mockReturnValueOnce(true) // profile complete
      .mockReturnValueOnce(false); // verify step incomplete
    vi.mocked(forwardJson).mockResolvedValueOnce({
      ok: false,
      status: 500,
      payload: { message: 'Stripe unavailable' },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/verify-identity', {
      method: 'POST',
      body: JSON.stringify({ verificationMethod: 'stripe' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.options).toEqual(['retry-stripe', 'request-manual-video-call']);
  });

  it('requires manual fields for manual verification', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({
      currentStep: 'verify-identity',
      steps: [],
    } as any);
    vi.mocked(isStepCompleted).mockReturnValueOnce(true).mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/verify-identity', {
      method: 'POST',
      body: JSON.stringify({ verificationMethod: 'manual' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
