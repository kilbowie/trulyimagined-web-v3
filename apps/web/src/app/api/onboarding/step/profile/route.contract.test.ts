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
import { buildStepResponse, forwardJson, isStepCompleted, readOnboardingStatus } from '../shared';

describe('POST /api/onboarding/step/profile - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns already-complete when profile step is done', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({
      currentStep: 'verify-identity',
      steps: [],
    } as any);
    vi.mocked(isStepCompleted).mockReturnValueOnce(true);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/profile', {
      method: 'POST',
      body: JSON.stringify({ firstName: 'A', lastName: 'B' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.action).toBe('already-complete');
    expect(vi.mocked(buildStepResponse)).toHaveBeenCalled();
  });

  it('validates first and last names', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({
      currentStep: 'profile',
      steps: [],
    } as any);
    vi.mocked(isStepCompleted).mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/profile', {
      method: 'POST',
      body: JSON.stringify({ firstName: 'OnlyFirst' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('creates profile and returns performed response', async () => {
    vi.mocked(readOnboardingStatus)
      .mockResolvedValueOnce({ currentStep: 'profile', steps: [] } as any)
      .mockResolvedValueOnce({ currentStep: 'verify-identity', steps: [] } as any);
    vi.mocked(isStepCompleted).mockReturnValueOnce(false);
    vi.mocked(forwardJson).mockResolvedValueOnce({
      ok: true,
      status: 201,
      payload: { success: true },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/profile', {
      method: 'POST',
      body: JSON.stringify({ firstName: 'A', lastName: 'B' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.action).toBe('performed');
    expect(vi.mocked(forwardJson)).toHaveBeenCalledWith(
      expect.anything(),
      '/api/identity/register',
      expect.objectContaining({ firstName: 'A', lastName: 'B' })
    );
  });
});
