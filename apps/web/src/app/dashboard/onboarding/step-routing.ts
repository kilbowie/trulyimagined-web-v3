export type StepId = 'signup' | 'profile' | 'verify-identity' | 'consent' | 'complete';

export const STEP_ORDER: StepId[] = ['signup', 'profile', 'verify-identity', 'consent', 'complete'];

type ResolveStepRoutingInput = {
  selectedStep: StepId | null;
  currentStep: StepId;
};

type ResolveStepRoutingResult = {
  nextStep: StepId;
  shouldCanonicalizeUrl: boolean;
  lockMessage: string | null;
};

export function resolveStepRouting({
  selectedStep,
  currentStep,
}: ResolveStepRoutingInput): ResolveStepRoutingResult {
  const accessibleStepIndex = Math.max(0, STEP_ORDER.indexOf(currentStep));

  if (!selectedStep) {
    return {
      nextStep: currentStep,
      shouldCanonicalizeUrl: true,
      lockMessage: null,
    };
  }

  const selectedIndex = STEP_ORDER.indexOf(selectedStep);
  if (selectedIndex > accessibleStepIndex) {
    return {
      nextStep: currentStep,
      shouldCanonicalizeUrl: true,
      lockMessage: 'Complete your current onboarding step before opening later steps.',
    };
  }

  return {
    nextStep: selectedStep,
    shouldCanonicalizeUrl: false,
    lockMessage: null,
  };
}
