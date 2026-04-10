import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../shared', () => ({
  readOnboardingStatus: vi.fn(),
  buildStepResponse: vi.fn((result: unknown) =>
    Response.json({ success: true, ...(result as Record<string, unknown>) })
  ),
}));

import { POST } from './route';
import { buildStepResponse, readOnboardingStatus } from '../shared';

describe('POST /api/onboarding/step/complete - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns performed when onboarding is complete', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({
      currentStep: 'complete',
      canProfileGoLive: true,
      verificationStatus: 'verified',
      steps: [],
    } as any);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/complete', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.action).toBe('performed');
    expect(data.details.canProfileGoLive).toBe(true);
    expect(vi.mocked(buildStepResponse)).toHaveBeenCalled();
  });
});
