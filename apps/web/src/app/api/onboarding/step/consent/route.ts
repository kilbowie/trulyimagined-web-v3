import { NextRequest, NextResponse } from 'next/server';
import { buildStepResponse, forwardJson, isStepCompleted, readOnboardingStatus } from '../shared';

type ConsentDraftPayload = {
  workTypes?: string[];
  contentRestrictions?: string[];
  allowedTerritories?: string[];
  dataForTraining?: boolean;
};

function toConsentLedgerPolicy(input: Required<ConsentDraftPayload>) {
  const workTypes = input.workTypes;
  const restrictions = input.contentRestrictions;

  return {
    mediaUsage: {
      film: workTypes.includes('Film') ? 'allow' : 'require_approval',
      television: workTypes.includes('TV') ? 'allow' : 'require_approval',
      streaming: 'require_approval',
      gaming: workTypes.includes('Gaming') ? 'allow' : 'require_approval',
      voiceReplication: workTypes.includes('VoiceOver') ? 'allow' : 'deny',
      virtualReality: 'require_approval',
      socialMedia: 'require_approval',
      advertising: workTypes.includes('Commercial') ? 'allow' : 'require_approval',
      merchandise: 'require_approval',
      livePerformance: 'require_approval',
    },
    contentTypes: {
      explicit: restrictions.includes('Explicit') ? 'deny' : 'allow',
      political: restrictions.includes('Political') ? 'deny' : 'allow',
      religious: restrictions.includes('Religious') ? 'deny' : 'allow',
      violence: 'require_approval',
      alcohol: restrictions.includes('Alcohol') ? 'deny' : 'allow',
      tobacco: 'require_approval',
      gambling: restrictions.includes('Gambling') ? 'deny' : 'allow',
      pharmaceutical: restrictions.includes('Drugs') ? 'deny' : 'require_approval',
      firearms: 'require_approval',
      adultContent: restrictions.includes('Explicit') ? 'deny' : 'require_approval',
    },
    territories: {
      allowed: input.allowedTerritories,
      denied: [],
    },
    aiControls: {
      trainingAllowed: input.dataForTraining,
      syntheticGenerationAllowed: input.dataForTraining,
      biometricAnalysisAllowed: false,
    },
    commercial: {
      paymentRequired: true,
    },
    attributionRequired: true,
    usageBlocked: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const status = await readOnboardingStatus(request);

    if (!isStepCompleted(status, 'profile')) {
      return NextResponse.json(
        {
          error: 'Complete profile registration before consent setup.',
          currentStep: status.currentStep,
        },
        { status: 409 }
      );
    }

    if (isStepCompleted(status, 'consent')) {
      return buildStepResponse({
        step: 'consent',
        action: 'already-complete',
        message: 'Consent step is already complete.',
        status,
      });
    }

    const body = (await request.json()) as ConsentDraftPayload;

    const workTypes = body.workTypes || [];
    const contentRestrictions = body.contentRestrictions || [];
    const allowedTerritories = body.allowedTerritories || [];
    const dataForTraining = Boolean(body.dataForTraining);

    if (workTypes.length === 0) {
      return NextResponse.json({ error: 'Select at least one work type.' }, { status: 400 });
    }

    if (allowedTerritories.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one allowed territory (default is none).' },
        { status: 400 }
      );
    }

    const consentCreate = await forwardJson(request, '/api/consent-ledger/create', {
      reason: 'Onboarding consent registration',
      policy: toConsentLedgerPolicy({
        workTypes,
        contentRestrictions,
        allowedTerritories,
        dataForTraining,
      }),
    });

    if (!consentCreate.ok) {
      return NextResponse.json(
        {
          error:
            consentCreate.payload?.error ||
            consentCreate.payload?.message ||
            'Unable to create consent preferences.',
        },
        { status: consentCreate.status || 500 }
      );
    }

    const latestStatus = await readOnboardingStatus(request);

    return buildStepResponse({
      step: 'consent',
      action: 'performed',
      message: 'Consent preferences saved successfully.',
      status: latestStatus,
      details: {
        consentEntryId: consentCreate.payload?.entry?.id || null,
        consentVersion: consentCreate.payload?.entry?.version || null,
      },
    });
  } catch (error) {
    console.error('[ONBOARDING_STEP_CONSENT] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
