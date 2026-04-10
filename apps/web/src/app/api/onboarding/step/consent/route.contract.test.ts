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

describe('POST /api/onboarding/step/consent - Contract Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks consent before profile completion', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({ currentStep: 'profile', steps: [] } as any);
    vi.mocked(isStepCompleted).mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/consent', {
      method: 'POST',
      body: JSON.stringify({ workTypes: ['Film'], allowedTerritories: ['GB'] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });

  it('requires at least one territory', async () => {
    vi.mocked(readOnboardingStatus).mockResolvedValueOnce({ currentStep: 'consent', steps: [] } as any);
    vi.mocked(isStepCompleted)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/consent', {
      method: 'POST',
      body: JSON.stringify({ workTypes: ['Film'], allowedTerritories: [] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Select at least one allowed territory');
  });

  it('creates consent entry and returns performed', async () => {
    vi.mocked(readOnboardingStatus)
      .mockResolvedValueOnce({ currentStep: 'consent', steps: [] } as any)
      .mockResolvedValueOnce({ currentStep: 'complete', steps: [] } as any);
    vi.mocked(isStepCompleted)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    vi.mocked(forwardJson).mockResolvedValueOnce({
      ok: true,
      status: 200,
      payload: { entry: { id: 'entry-1', version: 1 } },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/onboarding/step/consent', {
      method: 'POST',
      body: JSON.stringify({
        workTypes: ['Film'],
        contentRestrictions: ['Political'],
        allowedTerritories: ['GB'],
        dataForTraining: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.action).toBe('performed');
    expect(vi.mocked(forwardJson)).toHaveBeenCalledWith(
      expect.anything(),
      '/api/consent-ledger/create',
      expect.objectContaining({ reason: 'Onboarding consent registration' })
    );
  });
});
