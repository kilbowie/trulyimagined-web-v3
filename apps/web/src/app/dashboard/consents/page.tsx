'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Consent Management Dashboard
 * 
 * Allows actors to:
 * - View all consents (active, revoked, expired)
 * - Revoke active consents
 * - See consent scope details (project, territories, usage types, duration)
 */

interface Consent {
  consentId: string;
  consentType: string;
  action: string;
  scope: {
    projectName?: string;
    projectId?: string;
    duration?: {
      startDate?: string;
      endDate?: string;
    };
    usageTypes?: string[];
    territories?: string[];
    exclusions?: string[];
  };
  projectName?: string;
  grantedAt?: string;
  revokedAt?: string;
  expiredAt?: string;
  expiresAt?: string | null;
}

interface ConsentSummary {
  active: number;
  revoked: number;
  expired: number;
  totalRecords: number;
}

export default function ConsentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actorId, setActorId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConsentSummary | null>(null);
  const [activeConsents, setActiveConsents] = useState<Consent[]>([]);
  const [revokedConsents, setRevokedConsents] = useState<Consent[]>([]);
  const [expiredConsents, setExpiredConsents] = useState<Consent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConsents();
  }, []);

  const fetchConsents = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user's profile to find actorId
      const meResponse = await fetch('/api/me');
      const meData = await meResponse.json();
      
      if (!meData.user) {
        router.push('/api/auth/login');
        return;
      }

      const userId = meData.user.sub;
      
      // Get actor profile
      const actorResponse = await fetch(`/api/profile/${userId}`);
      const actorData = await actorResponse.json();
      
      if (!actorData.actor) {
        setError('No actor profile found. Please register as an actor first.');
        setLoading(false);
        return;
      }

      const currentActorId = actorData.actor.id;
      setActorId(currentActorId);

      // Fetch consents from API
      const consentsResponse = await fetch(`/api/consent/${currentActorId}`);
      const data = await consentsResponse.json();

      if (!consentsResponse.ok) {
        throw new Error(data.error || 'Failed to fetch consents');
      }

      setSummary(data.summary);
      setActiveConsents(data.consents.active || []);
      setRevokedConsents(data.consents.revoked || []);
      setExpiredConsents(data.consents.expired || []);
    } catch (err: any) {
      console.error('[CONSENTS] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeConsent = async (consentId: string, consentType: string) => {
    if (!actorId) return;

    const confirmed = confirm('Are you sure you want to revoke this consent? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const response = await fetch('/api/consent/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actorId,
          consentId,
          consentType,
          reason: 'User requested revocation via dashboard',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke consent');
      }

      alert('Consent revoked successfully!');
      
      // Refresh consents list
      fetchConsents();
    } catch (err: any) {
      console.error('[CONSENTS] Revoke error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Consent Management</h1>
          <p className="text-gray-600">Loading your consents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Consent Management</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-semibold">Error</p>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Consent Management</h1>
        <p className="text-gray-600 mb-8">
          Manage your digital identity usage permissions
        </p>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">Active Consents</p>
              <p className="text-3xl font-bold text-green-600">{summary.active}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">Revoked</p>
              <p className="text-3xl font-bold text-red-600">{summary.revoked}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">Expired</p>
              <p className="text-3xl font-bold text-orange-600">{summary.expired}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">Total Records</p>
              <p className="text-3xl font-bold text-gray-800">{summary.totalRecords}</p>
            </div>
          </div>
        )}

        {/* Active Consents */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-green-700">✓ Active Consents</h2>
          {activeConsents.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500">No active consents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeConsents.map((consent) => (
                <div
                  key={consent.consentId}
                  className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{consent.consentType}</h3>
                      {consent.scope.projectName && (
                        <p className="text-gray-600">Project: {consent.scope.projectName}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {consent.scope.usageTypes && (
                          <p className="text-sm text-gray-500">
                            <span className="font-semibold">Usage:</span>{' '}
                            {consent.scope.usageTypes.join(', ')}
                          </p>
                        )}
                        {consent.scope.territories && (
                          <p className="text-sm text-gray-500">
                            <span className="font-semibold">Territories:</span>{' '}
                            {consent.scope.territories.join(', ')}
                          </p>
                        )}
                        {consent.expiresAt && (
                          <p className="text-sm text-gray-500">
                            <span className="font-semibold">Expires:</span>{' '}
                            {new Date(consent.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                        {consent.grantedAt && (
                          <p className="text-sm text-gray-400">
                            Granted: {new Date(consent.grantedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeConsent(consent.consentId, consent.consentType)}
                      className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Revoked Consents */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-red-700">✗ Revoked Consents</h2>
          {revokedConsents.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500">No revoked consents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {revokedConsents.map((consent) => (
                <div
                  key={consent.consentId}
                  className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500 opacity-75"
                >
                  <h3 className="text-lg font-semibold">{consent.consentType}</h3>
                  {consent.scope.projectName && (
                    <p className="text-gray-600">Project: {consent.scope.projectName}</p>
                  )}
                  {consent.revokedAt && (
                    <p className="text-sm text-gray-500 mt-2">
                      Revoked: {new Date(consent.revokedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Expired Consents */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-orange-700">⏱ Expired Consents</h2>
          {expiredConsents.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500">No expired consents</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expiredConsents.map((consent) => (
                <div
                  key={consent.consentId}
                  className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500 opacity-75"
                >
                  <h3 className="text-lg font-semibold">{consent.consentType}</h3>
                  {consent.scope.projectName && (
                    <p className="text-gray-600">Project: {consent.scope.projectName}</p>
                  )}
                  {consent.expiredAt && (
                    <p className="text-sm text-gray-500 mt-2">
                      Expired: {new Date(consent.expiredAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Immutable Ledger Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            <span className="font-semibold">🔒 Immutable Ledger:</span> All consent actions are
            permanently recorded and cannot be modified or deleted. This provides a complete audit
            trail for compliance and transparency.
          </p>
        </div>
      </div>
    </div>
  );
}
