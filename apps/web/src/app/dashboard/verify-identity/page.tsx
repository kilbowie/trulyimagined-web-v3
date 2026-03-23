'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch verification status
      const statusRes = await fetch('/api/verification/status');
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

  async function startVerification(provider: 'stripe' | 'mock' | 'onfido' | 'yoti' = 'stripe') {
    try {
      setVerifying(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/verification/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          verificationType: 'identity',
          documents: ['passport'],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      // Handle Stripe Identity redirect
      if (provider === 'stripe' && data.url) {
        // Redirect user to Stripe Identity hosted page
        window.location.href = data.url;
        return;
      }

      setSuccessMessage(data.message || `Verification started with ${provider}`);

      // Refresh data
      await fetchData();

      setVerifying(false);
    } catch (err) {
      console.error('[VERIFY-IDENTITY] Verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading verification data...</p>
        </div>
      </div>
    );
  }

  const statusColor =
    {
      unverified: 'text-gray-600 bg-gray-100',
      'partially-verified': 'text-yellow-700 bg-yellow-100',
      verified: 'text-blue-700 bg-blue-100',
      'fully-verified': 'text-green-700 bg-green-100',
    }[verificationStatus?.status || 'unverified'] || 'text-gray-600 bg-gray-100';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Verify Your Identity</h1>
          <p className="mt-2 text-gray-600">
            Link external identity providers to increase your verification level and unlock features
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

        {/* Verification Status Card */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Verification Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Overall Status</p>
              <p className={`text-lg font-semibold px-3 py-1 rounded inline-block ${statusColor}`}>
                {verificationStatus?.status?.replace('-', ' ').toUpperCase() || 'UNVERIFIED'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Verification Level (GPG 45)</p>
              <p className="text-lg font-semibold text-gray-900">
                {verificationStatus?.verificationLevel?.toUpperCase() || 'None'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Assurance Level (eIDAS)</p>
              <p className="text-lg font-semibold text-gray-900">
                {verificationStatus?.assuranceLevel?.toUpperCase() || 'None'}
              </p>
            </div>
          </div>

          {verificationStatus?.lastVerified && (
            <p className="mt-4 text-sm text-gray-500">
              Last verified: {new Date(verificationStatus.lastVerified).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Linked Providers */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Linked Identity Providers</h2>

          {identityLinks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No identity providers linked yet. Start verification to link your first provider.
            </p>
          ) : (
            <div className="space-y-3">
              {identityLinks.map((link) => (
                <div
                  key={link.linkId}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-gray-900">{link.provider}</p>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        {link.providerType}
                      </span>
                      {link.verificationLevel && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {link.verificationLevel.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Linked: {new Date(link.linkedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => unlinkProvider(link.linkId, link.provider)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start Verification */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Start New Verification</h2>

          <div className="space-y-4">
            {/* Stripe Identity (Primary) */}
            <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Stripe Identity Verification</h3>
                    <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-semibold">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">
                    <strong>Official government ID verification</strong> with liveness detection.
                    Fast, secure, and globally certified.
                  </p>
                  <ul className="text-sm text-gray-600 mt-3 space-y-1">
                    <li>✓ Government-issued ID (passport, driver's license, national ID)</li>
                    <li>✓ Liveness check (selfie verification)</li>
                    <li>✓ GPG 45 & eIDAS compliant</li>
                    <li>✓ Instant verification (usually &lt; 1 minute)</li>
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      ~1 min
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      HIGH verification
                    </span>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                      $1.50-$3.00 per verification
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => startVerification('stripe')}
                  disabled={verifying}
                  className="ml-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold shadow-md"
                >
                  {verifying ? 'Processing...' : 'Start Verification'}
                </button>
              </div>
            </div>

            {/* Development/Testing Options */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Development & Testing Options
              </h3>

              {/* Mock Verification (Development) */}
              <div className="border border-gray-200 rounded-lg p-4 mb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Mock Verification</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Instantly create a high-assurance identity link for testing purposes
                      (development only)
                    </p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                        Instant
                      </span>
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                        HIGH verification
                      </span>
                      <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                        Development only
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => startVerification('mock')}
                    disabled={verifying}
                    className="ml-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {verifying ? 'Processing...' : 'Start Mock'}
                  </button>
                </div>
              </div>

              {/* Onfido (Legacy, requires API key) */}
              <div className="border border-gray-200 rounded-lg p-4 mb-3 opacity-60">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Onfido KYC (Legacy)</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Professional identity verification - requires ONFIDO_API_TOKEN
                    </p>
                    <div className="mt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        Not configured
                      </span>
                    </div>
                  </div>
                  <button
                    disabled
                    className="ml-4 px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
                  >
                    Not Available
                  </button>
                </div>
              </div>

              {/* Yoti (Legacy, requires API key) */}
              <div className="border border-gray-200 rounded-lg p-4 opacity-60">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Yoti Digital Identity (Legacy)</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Government-certified digital identity - requires YOTI_CLIENT_SDK_ID
                    </p>
                    <div className="mt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        Not configured
                      </span>
                    </div>
                  </div>
                  <button
                    disabled
                    className="ml-4 px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
                  >
                    Not Available
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">About Verification Levels</h3>
          <div className="text-sm text-blue-800 space-y-2">
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
