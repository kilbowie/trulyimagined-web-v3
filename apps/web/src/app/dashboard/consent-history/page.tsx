'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type PermissionLevel = 'allow' | 'require_approval' | 'deny';

type ConsentPolicy = {
  mediaUsage: {
    film: PermissionLevel;
    television: PermissionLevel;
    streaming: PermissionLevel;
    gaming: PermissionLevel;
    voiceReplication: PermissionLevel;
    virtualReality: PermissionLevel;
    socialMedia: PermissionLevel;
    advertising: PermissionLevel;
    merchandise: PermissionLevel;
    livePerformance: PermissionLevel;
  };
  contentTypes: {
    explicit: PermissionLevel;
    political: PermissionLevel;
    religious: PermissionLevel;
    violence: PermissionLevel;
    alcohol: PermissionLevel;
    tobacco: PermissionLevel;
    gambling: PermissionLevel;
    pharmaceutical: PermissionLevel;
    firearms: PermissionLevel;
    adultContent: PermissionLevel;
  };
  territories: {
    allowed: string[];
    denied: string[];
  };
  aiControls: {
    trainingAllowed: boolean;
    syntheticGenerationAllowed: boolean;
    biometricAnalysisAllowed: boolean;
  };
  commercial: {
    paymentRequired: boolean;
    minFee?: number;
    revenueShare?: number;
  };
  attributionRequired: boolean;
};

type ConsentLedgerEntry = {
  id: string;
  actor_id: string;
  version: number;
  policy: ConsentPolicy;
  status: 'active' | 'superseded' | 'revoked';
  reason?: string;
  updated_by?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};

export default function ConsentHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setCurrentEntry] = useState<ConsentLedgerEntry | null>(null);
  const [history, setHistory] = useState<ConsentLedgerEntry[]>([]);
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/consent-ledger/current?includeHistory=true');

      if (!res.ok) {
        throw new Error('Failed to load consent history');
      }

      const data = await res.json();
      setCurrentEntry(data.current);
      setHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (version: number) => {
    const newSet = new Set(expandedVersions);
    if (newSet.has(version)) {
      newSet.delete(version);
    } else {
      newSet.add(version);
    }
    setExpandedVersions(newSet);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 border-green-400';
      case 'superseded':
        return 'bg-gray-500 border-gray-400';
      case 'revoked':
        return 'bg-red-500 border-red-400';
      default:
        return 'bg-gray-500 border-gray-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-300 bg-green-500/20 border-green-500';
      case 'superseded':
        return 'text-gray-300 bg-gray-500/20 border-gray-500';
      case 'revoked':
        return 'text-red-300 bg-red-500/20 border-red-500';
      default:
        return 'text-gray-300 bg-gray-500/20 border-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const countEnabledPermissions = (policy: ConsentPolicy) => {
    const mediaCount = Object.values(policy.mediaUsage || {}).filter((v) => v === 'allow').length;
    const contentAllowed = Object.values(policy.contentTypes || {}).filter(
      (v) => v === 'allow'
    ).length;
    const aiCount = Object.values(policy.aiControls || {}).filter(Boolean).length;
    return { media: mediaCount, content: contentAllowed, ai: aiCount };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-900 text-xl">Loading consent history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-purple-600 hover:text-purple-800 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Consent Ledger History</h1>
          <p className="text-gray-600">
            Complete version history of your consent preferences. Each update creates a new
            immutable entry.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/consent-preferences')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
          >
            Update Consent Preferences
          </button>
        </div>

        {/* Timeline */}
        {history.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-200 shadow-sm text-center">
            <p className="text-gray-600 text-lg">No consent history found.</p>
            <p className="text-gray-500 text-sm mt-2">
              Your consent preferences will appear here once you create or update them.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>

            {/* Entries */}
            <div className="space-y-6">
              {history.map((entry) => {
                const isExpanded = expandedVersions.has(entry.version);
                const permissions = countEnabledPermissions(entry.policy);

                return (
                  <div key={entry.id} className="relative pl-20">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute left-6 w-5 h-5 rounded-full border-4 ${getStatusColor(entry.status)}`}
                    ></div>

                    {/* Entry Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-purple-500 transition-colors shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-2xl font-bold text-gray-900">
                              Version {entry.version}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(entry.status)}`}
                            >
                              {entry.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm">{formatDate(entry.created_at)}</p>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                        <div>
                          <div className="text-gray-500">Media Usage Allowed</div>
                          <div className="text-gray-900 font-semibold">
                            {permissions.media}/10 Categories
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Content Types Allowed</div>
                          <div className="text-gray-900 font-semibold">
                            {permissions.content}/10 Types
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">AI Controls Enabled</div>
                          <div className="text-gray-900 font-semibold">
                            {permissions.ai}/3 Active
                          </div>
                        </div>
                      </div>

                      {/* Reason */}
                      {entry.reason && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <div className="text-gray-500 text-xs mb-1">Reason:</div>
                          <div className="text-gray-900 text-sm">{entry.reason}</div>
                        </div>
                      )}

                      {/* Expand/Collapse */}
                      <button
                        onClick={() => toggleExpanded(entry.version)}
                        className="text-purple-600 hover:text-purple-800 text-sm font-semibold flex items-center gap-2"
                      >
                        <span
                          className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        >
                          ▶
                        </span>
                        {isExpanded ? 'Hide' : 'Show'} Full Policy
                      </button>

                      {/* Full Policy Details */}
                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          {/* Media Usage Categories */}
                          {entry.policy.mediaUsage && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="text-gray-900 font-semibold mb-3">
                                Media Usage Categories
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(entry.policy.mediaUsage).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        value === 'allow'
                                          ? 'bg-green-400'
                                          : value === 'require_approval'
                                            ? 'bg-yellow-400'
                                            : 'bg-red-400'
                                      }`}
                                    ></span>
                                    <span className="text-gray-700 capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className="text-gray-500 text-xs">
                                      ({value.replace('_', ' ')})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Content Type Restrictions */}
                          {entry.policy.contentTypes && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="text-gray-900 font-semibold mb-3">
                                Content Type Restrictions
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(entry.policy.contentTypes).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        value === 'allow'
                                          ? 'bg-green-400'
                                          : value === 'require_approval'
                                            ? 'bg-yellow-400'
                                            : 'bg-red-400'
                                      }`}
                                    ></span>
                                    <span className="text-gray-700 capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className="text-gray-500 text-xs">
                                      ({value.replace('_', ' ')})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Commercial Terms */}
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <h4 className="text-gray-900 font-semibold mb-3">Commercial Terms</h4>
                            <div className="text-sm space-y-2 text-gray-700">
                              <div>
                                Payment Required:{' '}
                                <span className="text-gray-900">
                                  {entry.policy.commercial.paymentRequired ? 'Yes' : 'No'}
                                </span>
                              </div>
                              {entry.policy.commercial.minFee !== undefined && (
                                <div>
                                  Minimum Fee:{' '}
                                  <span className="text-gray-900">
                                    ${entry.policy.commercial.minFee}
                                  </span>
                                </div>
                              )}
                              {entry.policy.commercial.revenueShare !== undefined && (
                                <div>
                                  Revenue Share:{' '}
                                  <span className="text-gray-900">
                                    {entry.policy.commercial.revenueShare}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Territories */}
                          {entry.policy.territories && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="text-gray-900 font-semibold mb-3">
                                Geographic Territories
                              </h4>
                              <div className="text-sm space-y-2 text-gray-700">
                                {entry.policy.territories.allowed?.length > 0 && (
                                  <div>
                                    Allowed:{' '}
                                    <span className="text-green-600">
                                      {entry.policy.territories.allowed.join(', ')}
                                    </span>
                                  </div>
                                )}
                                {entry.policy.territories.denied?.length > 0 && (
                                  <div>
                                    Denied:{' '}
                                    <span className="text-red-600">
                                      {entry.policy.territories.denied.join(', ')}
                                    </span>
                                  </div>
                                )}
                                {(!entry.policy.territories.allowed ||
                                  entry.policy.territories.allowed.length === 0) &&
                                  (!entry.policy.territories.denied ||
                                    entry.policy.territories.denied.length === 0) && (
                                    <div className="text-gray-500">Worldwide (no restrictions)</div>
                                  )}
                              </div>
                            </div>
                          )}

                          {/* Attribution */}
                          {entry.policy.attributionRequired !== undefined && (
                            <div className="p-4 bg-black/30 rounded-lg">
                              <h4 className="text-white font-semibold mb-3">Attribution</h4>
                              <div className="text-sm text-gray-300">
                                Attribution Required:{' '}
                                <span className="text-white">
                                  {entry.policy.attributionRequired ? 'Yes' : 'No'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* AI Controls */}
                          {entry.policy.aiControls && (
                            <div className="p-4 bg-black/30 rounded-lg">
                              <h4 className="text-white font-semibold mb-3">AI Controls</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(entry.policy.aiControls).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${value ? 'bg-green-400' : 'bg-red-400'}`}
                                    ></span>
                                    <span className="text-gray-300">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className="text-gray-500">{value ? '✓' : '✗'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {(entry.ip_address || entry.user_agent) && (
                            <details className="group">
                              <summary className="cursor-pointer text-gray-400 hover:text-gray-200 text-xs list-none flex items-center gap-2">
                                <span className="transform transition-transform group-open:rotate-90">
                                  ▶
                                </span>
                                Technical Metadata
                              </summary>
                              <div className="mt-2 p-3 bg-black/50 rounded-lg text-xs">
                                {entry.ip_address && (
                                  <div className="text-gray-400">
                                    IP: <span className="text-gray-300">{entry.ip_address}</span>
                                  </div>
                                )}
                                {entry.user_agent && (
                                  <div className="text-gray-400 mt-1">
                                    User Agent:{' '}
                                    <span className="text-gray-300">{entry.user_agent}</span>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
