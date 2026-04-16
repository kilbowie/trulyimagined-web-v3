'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface IdentityLink {
  linkId: string;
  provider: string;
  providerType: string;
  verificationLevel: string | null;
  assuranceLevel: string | null;
  verifiedAt: string | null;
  linkedAt: string;
  isActive: boolean;
  isExpired: boolean;
  metadata: Record<string, unknown> | null;
}

interface VerificationStatus {
  status: string;
  verificationLevel: string | null;
  assuranceLevel: string | null;
  lastVerified: string | null;
  providers: Array<{
    provider: string;
    providerType: string;
    verificationLevel: string | null;
    assuranceLevel: string | null;
    verifiedAt: string | null;
  }>;
}

export default function VerifyIdentityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [identityLinks, setIdentityLinks] = useState<IdentityLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requestingManual, setRequestingManual] = useState(false);
  const [preferredTimezone, setPreferredTimezone] = useState('Europe/London');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    fetchData();

    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTimezone) {
        setPreferredTimezone(detectedTimezone);
      }
    } catch {
      // Fall back to Europe/London when timezone detection is unavailable.
    }
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch verification status
      const statusRes = await fetch('/api/stripe/identity/status');
      if (statusRes.status === 401) {
        router.push('/auth/login');
        return;
      }
      const statusData = await statusRes.json();
      setVerificationStatus(statusData);

      // Fetch identity links
      const linksRes = await fetch('/api/identity/links?activeOnly=true');
      const linksData = await linksRes.json();
      setIdentityLinks(linksData.links || []);

      setLoading(false);
    } catch (err) {
      console.error('[VERIFY-IDENTITY] Fetch error:', err);
      setError('Failed to load verification data');
      setLoading(false);
    }
  }

  async function startVerification() {
    try {
      setVerifying(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/stripe/identity/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      // Handle Stripe Identity redirect
      if (data.url) {
        // Redirect user to Stripe Identity hosted page
        window.location.href = data.url;
        return;
      }

      setSuccessMessage(data.message || 'Verification started with Stripe');

      // Refresh data
      await fetchData();

      setVerifying(false);
    } catch (err) {
      console.error('[VERIFY-IDENTITY] Verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(
        `${errorMessage}. You can retry Stripe verification or request a founder-led video call below.`
      );
      setVerifying(false);
    }
  }

  async function unlinkProvider(linkId: string, provider: string) {
    if (!confirm(`Are you sure you want to unlink ${provider}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/identity/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to unlink provider');
      }

      setSuccessMessage(`Successfully unlinked ${provider}`);
      await fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    }
  }

  async function requestManualVerification() {
    try {
      setRequestingManual(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/verification/manual-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredTimezone,
          phoneNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request manual verification');
      }

      setSuccessMessage(
        'Your manual verification request has been sent. The founder team will contact you to schedule the call.'
      );
      await fetchData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setRequestingManual(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading verification data...</p>
        </div>
      </div>
    );
  }

  const statusColor =
    {
      unverified: 'text-muted-foreground bg-muted border-border',
      'partially-verified':
        'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800',
      verified:
        'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800',
      'fully-verified':
        'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800',
    }[verificationStatus?.status || 'unverified'] || 'text-muted-foreground bg-muted border-border';

  return (
    <div className="min-h-screen bg-background py-6 md:py-8 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Verify Your Identity</h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            Link external identity providers to increase your verification level and unlock features
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-card border border-red-500/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-card border border-green-500/50 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        {/* Verification Status Card */}
        <div className="bg-card border border-border shadow-sm rounded-lg p-4 md:p-6 mb-6">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">
            Current Verification Status
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Overall Status</p>
              <p
                className={`text-base md:text-lg font-semibold px-3 py-1 rounded inline-block border ${statusColor}`}
              >
                {verificationStatus?.status?.replace('-', ' ').toUpperCase() || 'UNVERIFIED'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Verification Level (GPG 45)</p>
              <p className="text-base md:text-lg font-semibold text-foreground">
                {verificationStatus?.verificationLevel?.toUpperCase() || 'None'}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Assurance Level (eIDAS)</p>
              <p className="text-base md:text-lg font-semibold text-foreground">
                {verificationStatus?.assuranceLevel?.toUpperCase() || 'None'}
              </p>
            </div>
          </div>

          {verificationStatus?.lastVerified && (
            <p className="mt-4 text-sm text-muted-foreground">
              Last verified: {new Date(verificationStatus.lastVerified).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Linked Providers */}
        <div className="bg-card border border-border shadow-sm rounded-lg p-4 md:p-6 mb-6">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">
            Linked Identity Providers
          </h2>

          {identityLinks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No identity providers linked yet. Start verification to link your first provider.
            </p>
          ) : (
            <div className="space-y-3">
              {identityLinks.map((link) => (
                <div
                  key={link.linkId}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-border rounded-lg bg-background"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{link.provider}</p>
                      <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded border border-border">
                        {link.providerType}
                      </span>
                      {link.verificationLevel && (
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded border border-blue-300 dark:border-blue-800">
                          {link.verificationLevel.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Linked: {new Date(link.linkedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => unlinkProvider(link.linkId, link.provider)}
                    className="text-sm text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 font-medium self-start sm:self-auto"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start Verification */}
        <div className="bg-card border border-border shadow-sm rounded-lg p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-4">
            Start New Verification
          </h2>

          <div className="space-y-4">
            {/* Stripe Identity (Primary) */}
            <div className="border-2 border-blue-500/60 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">Stripe Identity Verification</h3>
                    <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-semibold">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-2">
                    <strong>Official government ID verification</strong> with liveness detection.
                    Fast, secure, and globally certified.
                  </p>
                  <ul className="text-sm text-muted-foreground mt-3 space-y-1">
                    <li>✓ Government-issued ID (passport, driver's license, national ID)</li>
                    <li>✓ Liveness check (selfie verification)</li>
                    <li>✓ GPG 45 & eIDAS compliant</li>
                    <li>✓ Instant verification (usually &lt; 1 minute)</li>
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded border border-green-300 dark:border-green-800">
                      ~1 min
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded border border-purple-300 dark:border-purple-800">
                      HIGH verification
                    </span>
                    <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 rounded border border-yellow-300 dark:border-yellow-800">
                      $1.50-$3.00 per verification
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => startVerification()}
                  disabled={verifying}
                  className="w-full md:w-auto md:ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed font-semibold shadow-sm"
                >
                  {verifying ? 'Processing...' : 'Start Verification'}
                </button>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 bg-background">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    Request a founder-led video call
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Prefer a manual review instead of self-service Stripe verification? Send your
                    timezone and contact number and the founder team will schedule a call.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Preferred timezone
                      </label>
                      <input
                        value={preferredTimezone}
                        onChange={(event) => setPreferredTimezone(event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Europe/London"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Phone number
                      </label>
                      <input
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="+44 7700 900123"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={requestManualVerification}
                  disabled={requestingManual || !preferredTimezone.trim() || !phoneNumber.trim()}
                  className="w-full lg:w-auto lg:ml-4 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed font-semibold"
                >
                  {requestingManual ? 'Submitting...' : 'Request Video Call'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You can continue to consent preferences while verification is pending, but your
              profile will only go live once verification is complete.
              <div className="mt-2">
                <Link
                  href="/dashboard/consent-preferences"
                  className="font-semibold underline underline-offset-2"
                >
                  Continue to consent preferences
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            About Verification Levels
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
            <p>
              <strong>GPG 45 (UK Trust Framework):</strong> Low, Medium, High, Very High
            </p>
            <p>
              <strong>eIDAS (EU Standard):</strong> Low, Substantial, High
            </p>
            <p className="mt-3">
              Higher verification levels unlock more features and increase trust with agencies and
              studios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
