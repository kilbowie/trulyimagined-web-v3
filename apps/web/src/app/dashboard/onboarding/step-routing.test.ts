import { describe, expect, it } from 'vitest';
import { resolveStepRouting } from './step-routing';

describe('resolveStepRouting', () => {
  it('canonicalizes to current step when no step query param is provided', () => {
    const result = resolveStepRouting({
      selectedStep: null,
      currentStep: 'verify-identity',
    });

    expect(result).toEqual({
      nextStep: 'verify-identity',
      shouldCanonicalizeUrl: true,
      lockMessage: null,
    });
  });

  it('redirects locked future steps back to current step', () => {
    const result = resolveStepRouting({
      selectedStep: 'complete',
      currentStep: 'consent',
    });

    expect(result.nextStep).toBe('consent');
    expect(result.shouldCanonicalizeUrl).toBe(true);
    expect(result.lockMessage).toBe(
      'Complete your current onboarding step before opening later steps.'
    );
  });

  it('keeps selected step when already accessible', () => {
    const result = resolveStepRouting({
      selectedStep: 'profile',
      currentStep: 'consent',
    });

    expect(result).toEqual({
      nextStep: 'profile',
      shouldCanonicalizeUrl: false,
      lockMessage: null,
    });
  });
});
