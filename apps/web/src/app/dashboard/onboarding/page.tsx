'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ALL_COUNTRIES } from '@/components/TerritoryMap';

type StepId = 'signup' | 'profile' | 'verify-identity' | 'consent' | 'complete';

type OnboardingStep = {
  id: StepId;
  label: string;
  completed: boolean;
  href: string;
};

type OnboardingStatus = {
  success: boolean;
  data: {
    actorId: string | null;
    verificationStatus: string;
    canProfileGoLive: boolean;
    currentStep: StepId;
    steps: OnboardingStep[];
  };
};

type ProfileDraft = {
  firstName: string;
  lastName: string;
  stageName: string;
  location: string;
  bio: string;
};

type ConsentDraft = {
  workTypes: string[];
  contentRestrictions: string[];
  allowedTerritories: string[];
  dataForTraining: boolean;
};

const PROFILE_DRAFT_KEY = 'onboarding.profile.draft.v1';
const CONSENT_DRAFT_KEY = 'onboarding.consent.draft.v1';
const VERIFICATION_PROGRESS_KEY = 'onboarding.verify.progress.v1';

const WORK_TYPES = ['Film', 'TV', 'Commercial', 'VoiceOver', 'Gaming'] as const;
const CONTENT_RESTRICTIONS = [
  'Political',
  'Religious',
  'Explicit',
  'Drugs',
  'Alcohol',
  'Gambling',
] as const;
const DEFAULT_PROFILE_DRAFT: ProfileDraft = {
  firstName: '',
  lastName: '',
  stageName: '',
  location: '',
  bio: '',
};

const DEFAULT_CONSENT_DRAFT: ConsentDraft = {
  workTypes: [],
  contentRestrictions: [],
  allowedTerritories: [],
  dataForTraining: false,
};

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus['data'] | null>(null);
  const [activeStep, setActiveStep] = useState<StepId>('profile');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(DEFAULT_PROFILE_DRAFT);
  const [consentDraft, setConsentDraft] = useState<ConsentDraft>(DEFAULT_CONSENT_DRAFT);

  const [preferredTimezone, setPreferredTimezone] = useState('Europe/London');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [requestingManual, setRequestingManual] = useState(false);
  const [territoryQuery, setTerritoryQuery] = useState('');

  useEffect(() => {
    void loadStatus();

    const selectedStep = searchParams.get('step') as StepId | null;
    if (
      selectedStep &&
      ['signup', 'profile', 'verify-identity', 'consent', 'complete'].includes(selectedStep)
    ) {
      setActiveStep(selectedStep);
    }

    try {
      const profileRaw = localStorage.getItem(PROFILE_DRAFT_KEY);
      if (profileRaw) {
        setProfileDraft({ ...DEFAULT_PROFILE_DRAFT, ...JSON.parse(profileRaw) });
      }

      const consentRaw = localStorage.getItem(CONSENT_DRAFT_KEY);
      if (consentRaw) {
        setConsentDraft({ ...DEFAULT_CONSENT_DRAFT, ...JSON.parse(consentRaw) });
      }

      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTimezone) {
        setPreferredTimezone(detectedTimezone);
      }
    } catch {
      // Keep defaults when browser storage/timezone resolution is unavailable.
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(profileDraft));
  }, [profileDraft]);

  useEffect(() => {
    localStorage.setItem(CONSENT_DRAFT_KEY, JSON.stringify(consentDraft));
  }, [consentDraft]);

  const stepIndex = useMemo(() => {
    const order: StepId[] = ['signup', 'profile', 'verify-identity', 'consent', 'complete'];
    return Math.max(0, order.indexOf(activeStep));
  }, [activeStep]);

  const filteredCountries = useMemo(() => {
    const query = territoryQuery.trim().toLowerCase();
    if (!query) {
      return ALL_COUNTRIES.slice(0, 24);
    }

    return ALL_COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query)
    ).slice(0, 24);
  }, [territoryQuery]);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch('/api/onboarding/status');
      const payload = (await response.json()) as OnboardingStatus | { error?: string };

      if (!response.ok || !('success' in payload) || !payload.success) {
        throw new Error(
          'error' in payload
            ? payload.error || 'Failed to load onboarding status'
            : 'Failed to load onboarding status'
        );
      }

      setStatus(payload.data);

      const selectedStep = searchParams.get('step') as StepId | null;
      if (!selectedStep) {
        setActiveStep(payload.data.currentStep);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load onboarding status');
    } finally {
      setLoading(false);
    }
  }

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();

    if (!profileDraft.firstName.trim() || !profileDraft.lastName.trim()) {
      setError('Please provide both first name and last name.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/onboarding/step/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileDraft),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || payload.message || 'Failed to save profile');
      }

      setSuccessMessage(
        payload.action === 'already-complete'
          ? 'Profile already exists. Moving you to identity verification.'
          : 'Profile registered successfully. Continue to identity verification.'
      );

      localStorage.removeItem(PROFILE_DRAFT_KEY);
      await loadStatus();
      setActiveStep('verify-identity');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function startStripeVerification() {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/onboarding/step/verify-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationMethod: 'stripe',
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Unable to start Stripe verification.');
      }

      localStorage.setItem(VERIFICATION_PROGRESS_KEY, 'started');
      setSuccessMessage(
        'Stripe verification started. If you prefer, you can request a manual video call instead.'
      );

      if (payload.details?.stripeUrl) {
        window.location.href = payload.details.stripeUrl as string;
        return;
      }

      setActiveStep('consent');
    } catch (submitError) {
      setError(
        `${submitError instanceof Error ? submitError.message : 'Unable to start Stripe verification.'} You can retry Stripe or use the founder-led video call option below.`
      );
    } finally {
      setSaving(false);
    }
  }

  async function requestManualVerification() {
    try {
      setRequestingManual(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/onboarding/step/verify-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationMethod: 'manual',
          preferredTimezone,
          phoneNumber,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit manual verification request');
      }

      localStorage.setItem(VERIFICATION_PROGRESS_KEY, 'manual-requested');
      setSuccessMessage(
        'Manual verification request submitted. The founder will schedule your call. You can now continue to consent while your verification is pending.'
      );
      await loadStatus();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to submit manual request'
      );
    } finally {
      setRequestingManual(false);
    }
  }

  function toggleArrayValue(values: string[], value: string) {
    if (values.includes(value)) {
      return values.filter((item) => item !== value);
    }
    return [...values, value];
  }

  async function submitConsent(e: React.FormEvent) {
    e.preventDefault();

    if (consentDraft.workTypes.length === 0) {
      setError('Select at least one work type.');
      return;
    }

    if (consentDraft.allowedTerritories.length === 0) {
      setError('Select at least one allowed territory.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/onboarding/step/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workTypes: consentDraft.workTypes,
          contentRestrictions: consentDraft.contentRestrictions,
          allowedTerritories: consentDraft.allowedTerritories,
          dataForTraining: consentDraft.dataForTraining,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save consent preferences');
      }

      localStorage.removeItem(CONSENT_DRAFT_KEY);
      setSuccessMessage('Consent preferences saved successfully.');
      await loadStatus();
      setActiveStep('complete');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save consent');
    } finally {
      setSaving(false);
    }
  }

  function clearOnboardingDrafts() {
    localStorage.removeItem(PROFILE_DRAFT_KEY);
    localStorage.removeItem(CONSENT_DRAFT_KEY);
    localStorage.removeItem(VERIFICATION_PROGRESS_KEY);
  }

  async function finalizeOnboardingAndExit() {
    try {
      await fetch('/api/onboarding/step/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // Keep navigation resilient even if finalization call fails.
    }

    clearOnboardingDrafts();
    router.push('/dashboard');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Actor Onboarding Flow</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Complete each step in sequence. You can continue to consent while identity verification is
          pending, but your profile will only go live after verification is complete.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Progress
          </h2>
          <ol className="mt-4 space-y-3">
            {(status?.steps || []).map((step, index) => {
              const isActive = step.id === activeStep;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${isActive ? 'border-foreground bg-muted' : 'border-border bg-background hover:bg-muted/40'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {index + 1}. {step.label}
                      </span>
                      <span
                        className={`text-xs ${step.completed ? 'text-green-700' : 'text-muted-foreground'}`}
                      >
                        {step.completed ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 text-xs text-muted-foreground">
            Current server step:{' '}
            <span className="font-medium text-foreground">
              {status?.currentStep || 'loading...'}
            </span>
          </div>
        </aside>

        <section className="rounded-lg border border-border bg-card p-4 md:p-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading onboarding status...</p>
          ) : activeStep === 'signup' ? (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Step 1: Sign In</h3>
              <p className="text-sm text-muted-foreground">
                You are signed in and ready to start onboarding.
              </p>
              <button
                type="button"
                onClick={() => setActiveStep('profile')}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Continue to Profile
              </button>
            </div>
          ) : activeStep === 'profile' ? (
            <form className="space-y-4" onSubmit={submitProfile}>
              <h3 className="text-xl font-semibold">Step 2: Register Profile</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">First name</span>
                  <input
                    className="w-full rounded-md border border-input px-3 py-2"
                    value={profileDraft.firstName}
                    onChange={(event) =>
                      setProfileDraft((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Last name</span>
                  <input
                    className="w-full rounded-md border border-input px-3 py-2"
                    value={profileDraft.lastName}
                    onChange={(event) =>
                      setProfileDraft((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Professional/Stage name</span>
                <input
                  className="w-full rounded-md border border-input px-3 py-2"
                  value={profileDraft.stageName}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({ ...prev, stageName: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Location</span>
                <input
                  className="w-full rounded-md border border-input px-3 py-2"
                  value={profileDraft.location}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">Bio</span>
                <textarea
                  className="w-full rounded-md border border-input px-3 py-2"
                  rows={4}
                  value={profileDraft.bio}
                  onChange={(event) =>
                    setProfileDraft((prev) => ({ ...prev, bio: event.target.value }))
                  }
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          ) : activeStep === 'verify-identity' ? (
            <div className="space-y-5">
              <h3 className="text-xl font-semibold">Step 3: Verify Identity</h3>
              <p className="text-sm text-muted-foreground">
                Choose either Stripe verification or a founder-led manual video call. If Stripe
                fails, retry Stripe or request manual verification.
              </p>

              <div className="rounded-md border border-border p-4">
                <h4 className="font-semibold">Option A: Verify with Stripe</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fast self-service verification with official ID checks.
                </p>
                <button
                  type="button"
                  onClick={startStripeVerification}
                  disabled={saving}
                  className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? 'Starting...' : 'Start Stripe Verification'}
                </button>
              </div>

              <div className="rounded-md border border-border p-4">
                <h4 className="font-semibold">Option B: Request Founder Video Call</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submit your timezone and phone number, and we will schedule a manual verification
                  call.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Preferred timezone</span>
                    <input
                      className="w-full rounded-md border border-input px-3 py-2"
                      value={preferredTimezone}
                      onChange={(event) => setPreferredTimezone(event.target.value)}
                      placeholder="Europe/London"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Phone number</span>
                    <input
                      className="w-full rounded-md border border-input px-3 py-2"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      placeholder="+44 7700 900123"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={requestManualVerification}
                  disabled={requestingManual || !preferredTimezone.trim() || !phoneNumber.trim()}
                  className="mt-3 rounded-md border border-foreground px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
                >
                  {requestingManual ? 'Submitting...' : 'Request Video Call'}
                </button>
              </div>

              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                You can continue to consent now. Your profile will only go live once verification is
                fully completed.
              </div>

              <button
                type="button"
                onClick={() => setActiveStep('consent')}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Continue to Consent
              </button>
            </div>
          ) : activeStep === 'consent' ? (
            <form className="space-y-5" onSubmit={submitConsent}>
              <h3 className="text-xl font-semibold">Step 4: Register Consent Preferences</h3>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Work types (select all that you explicitly allow)
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {WORK_TYPES.map((workType) => (
                    <label key={workType} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={consentDraft.workTypes.includes(workType)}
                        onChange={() =>
                          setConsentDraft((prev) => ({
                            ...prev,
                            workTypes: toggleArrayValue(prev.workTypes, workType),
                          }))
                        }
                      />
                      <span>{workType}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Content restrictions</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {CONTENT_RESTRICTIONS.map((restriction) => (
                    <label key={restriction} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={consentDraft.contentRestrictions.includes(restriction)}
                        onChange={() =>
                          setConsentDraft((prev) => ({
                            ...prev,
                            contentRestrictions: toggleArrayValue(
                              prev.contentRestrictions,
                              restriction
                            ),
                          }))
                        }
                      />
                      <span>{restriction}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Territories (default is none; search and explicitly allow each territory)
                </p>
                <input
                  className="mb-3 w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={territoryQuery}
                  onChange={(event) => setTerritoryQuery(event.target.value)}
                  placeholder="Search countries, e.g. United Kingdom or GB"
                />
                {consentDraft.allowedTerritories.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {consentDraft.allowedTerritories.map((code) => {
                      const country = ALL_COUNTRIES.find((entry) => entry.code === code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() =>
                            setConsentDraft((prev) => ({
                              ...prev,
                              allowedTerritories: prev.allowedTerritories.filter(
                                (territoryCode) => territoryCode !== code
                              ),
                            }))
                          }
                          className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-800"
                        >
                          {country?.name || code} ({code}) x
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div className="grid gap-2 md:grid-cols-2">
                  {filteredCountries.map((country) => (
                    <label
                      key={country.code}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={consentDraft.allowedTerritories.includes(country.code)}
                        onChange={() =>
                          setConsentDraft((prev) => ({
                            ...prev,
                            allowedTerritories: toggleArrayValue(
                              prev.allowedTerritories,
                              country.code
                            ),
                          }))
                        }
                      />
                      <span>
                        {country.name} ({country.code})
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing up to 24 search matches from the full country list. Selected territories
                  remain allowed until removed.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consentDraft.dataForTraining}
                  onChange={(event) =>
                    setConsentDraft((prev) => ({
                      ...prev,
                      dataForTraining: event.target.checked,
                    }))
                  }
                />
                <span>Allow AI training data usage</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Consent'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Step 5: Complete</h3>
              <p className="text-sm text-muted-foreground">
                Onboarding is complete. If verification is still pending, your profile will remain
                non-live until verification is finalized.
              </p>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                Profile live status:{' '}
                <span className="font-semibold">
                  {status?.canProfileGoLive ? 'Live' : 'Pending verification'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={finalizeOnboardingAndExit}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Go to Dashboard
                </button>
                <Link
                  href="/dashboard/verify-identity"
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground"
                >
                  Check verification status
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
