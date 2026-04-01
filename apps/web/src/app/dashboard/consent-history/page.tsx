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
  usageBlocked?: boolean;
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
        return 'bg-muted-foreground border-muted';
      case 'revoked':
        return 'bg-red-500 border-red-400';
      default:
        return 'bg-muted-foreground border-muted';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-700 dark:text-green-300 bg-green-500/10 dark:bg-green-500/20 border-green-500/50';
      case 'superseded':
        return 'text-muted-foreground bg-muted border-border';
      case 'revoked':
        return 'text-red-700 dark:text-red-300 bg-red-500/10 dark:bg-red-500/20 border-red-500/50';
      default:
        return 'text-muted-foreground bg-muted border-border';
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
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-foreground text-lg md:text-xl">Loading consent history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-primary hover:text-primary/80 mb-4 flex items-center gap-2 font-medium"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Consent Ledger History
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Complete version history of your consent preferences. Each update creates a new
            immutable entry.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-card border border-red-500/50 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard/consent-preferences')}
            className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors text-sm md:text-base"
          >
            Update Consent Preferences
          </button>
        </div>

        {/* Timeline */}
        {history.length === 0 ? (
          <div className="bg-card rounded-xl p-8 md:p-12 border border-border shadow-sm text-center">
            <p className="text-muted-foreground text-base md:text-lg">No consent history found.</p>
            <p className="text-muted-foreground text-sm mt-2">
              Your consent preferences will appear here once you create or update them.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="hidden md:block absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>

            {/* Entries */}
            <div className="space-y-4 md:space-y-6">
              {history.map((entry) => {
                const isExpanded = expandedVersions.has(entry.version);
                const permissions = countEnabledPermissions(entry.policy);

                return (
                  <div key={entry.id} className="relative pl-0 md:pl-20">
                    {/* Timeline Dot */}
                    <div
                      className={`hidden md:block absolute left-6 top-7 w-5 h-5 rounded-full border-4 ${getStatusColor(entry.status)}`}
                    ></div>

                    {/* Entry Card */}
                    <div className="bg-card rounded-xl p-4 md:p-6 border border-border hover:border-primary/40 transition-colors shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                            <h3 className="text-xl md:text-2xl font-bold text-foreground">
                              Version {entry.version}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(entry.status)}`}
                            >
                              {entry.status.toUpperCase()}
                            </span>
                            {entry.policy.usageBlocked && (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold border border-red-500/50 text-red-700 dark:text-red-300 bg-red-500/10 dark:bg-red-500/20">
                                BLOCKED
                              </span>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {formatDate(entry.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="mb-4">
                        {entry.policy.usageBlocked && (
                          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                            <span>Usage Status</span>
                            <span className="rounded-full border border-red-500/50 px-2 py-0.5">BLOCKED</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Media Usage Allowed</div>
                            <div className="text-foreground font-semibold">
                              {permissions.media}/10 Categories
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Content Types Allowed</div>
                            <div className="text-foreground font-semibold">
                              {permissions.content}/10 Types
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">AI Controls Enabled</div>
                            <div className="text-foreground font-semibold">
                              {permissions.ai}/3 Active
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reason */}
                      {entry.reason && (
                        <div className="mb-4 p-3 bg-muted/40 rounded-lg border border-border">
                          <div className="text-muted-foreground text-xs mb-1">Reason:</div>
                          <div className="text-foreground text-sm">{entry.reason}</div>
                        </div>
                      )}

                      {/* Expand/Collapse */}
                      <button
                        onClick={() => toggleExpanded(entry.version)}
                        className="text-primary hover:text-primary/80 text-sm font-semibold flex items-center gap-2"
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
                          {entry.policy.usageBlocked ? (
                            <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-lg">
                              <h4 className="text-red-700 dark:text-red-300 font-semibold">
                                No Usage Permitted
                              </h4>
                            </div>
                          ) : (
                            <>
                          {/* Media Usage Categories */}
                          {entry.policy.mediaUsage && (
                            <div className="p-4 bg-muted/40 border border-border rounded-lg">
                              <h4 className="text-foreground font-semibold mb-3">
                                Media Usage Categories
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
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
                                    <span className="text-foreground capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      ({value.replace('_', ' ')})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Content Type Restrictions */}
                          {entry.policy.contentTypes && (
                            <div className="p-4 bg-muted/40 border border-border rounded-lg">
                              <h4 className="text-foreground font-semibold mb-3">
                                Content Type Restrictions
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
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
                                    <span className="text-foreground capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      ({value.replace('_', ' ')})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Commercial Terms */}
                          <div className="p-4 bg-muted/40 border border-border rounded-lg">
                            <h4 className="text-foreground font-semibold mb-3">Commercial Terms</h4>
                            <div className="text-sm space-y-2 text-foreground">
                              <div>
                                Payment Required:{' '}
                                <span className="font-medium text-foreground">
                                  {entry.policy.commercial.paymentRequired ? 'Yes' : 'No'}
                                </span>
                              </div>
                              {entry.policy.commercial.minFee !== undefined && (
                                <div>
                                  Minimum Fee:{' '}
                                  <span className="font-medium text-foreground">
                                    ${entry.policy.commercial.minFee}
                                  </span>
                                </div>
                              )}
                              {entry.policy.commercial.revenueShare !== undefined && (
                                <div>
                                  Revenue Share:{' '}
                                  <span className="font-medium text-foreground">
                                    {entry.policy.commercial.revenueShare}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Territories */}
                          {entry.policy.territories && (
                            <div className="p-4 bg-muted/40 border border-border rounded-lg">
                              <h4 className="text-foreground font-semibold mb-3">
                                Geographic Territories
                              </h4>
                              <div className="text-sm space-y-2 text-foreground break-words">
                                {entry.policy.territories.allowed?.length > 0 && (
                                  <div>
                                    Allowed:{' '}
                                    <span className="text-green-700 dark:text-green-400">
                                      {entry.policy.territories.allowed.join(', ')}
                                    </span>
                                  </div>
                                )}
                                {entry.policy.territories.denied?.length > 0 && (
                                  <div>
                                    Denied:{' '}
                                    <span className="text-red-700 dark:text-red-400">
                                      {entry.policy.territories.denied.join(', ')}
                                    </span>
                                  </div>
                                )}
                                {(!entry.policy.territories.allowed ||
                                  entry.policy.territories.allowed.length === 0) &&
                                  (!entry.policy.territories.denied ||
                                    entry.policy.territories.denied.length === 0) && (
                                    <div className="text-muted-foreground">
                                      Worldwide (no restrictions)
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}

                          {/* Attribution */}
                          {entry.policy.attributionRequired !== undefined && (
                            <div className="p-4 bg-muted/40 border border-border rounded-lg">
                              <h4 className="text-foreground font-semibold mb-3">Attribution</h4>
                              <div className="text-sm text-muted-foreground">
                                Attribution Required:{' '}
                                <span className="font-medium text-foreground">
                                  {entry.policy.attributionRequired ? 'Yes' : 'No'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* AI Controls */}
                          {entry.policy.aiControls && (
                            <div className="p-4 bg-muted/40 border border-border rounded-lg">
                              <h4 className="text-foreground font-semibold mb-3">AI Controls</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {Object.entries(entry.policy.aiControls).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${value ? 'bg-green-400' : 'bg-red-400'}`}
                                    ></span>
                                    <span className="text-foreground">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {value ? '✓' : '✗'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {(entry.ip_address || entry.user_agent) && (
                            <details className="group">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-xs list-none flex items-center gap-2">
                                <span className="transform transition-transform group-open:rotate-90">
                                  ▶
                                </span>
                                Technical Metadata
                              </summary>
                              <div className="mt-2 p-3 bg-muted/40 border border-border rounded-lg text-xs">
                                {entry.ip_address && (
                                  <div className="text-muted-foreground break-all">
                                    IP: <span className="text-foreground">{entry.ip_address}</span>
                                  </div>
                                )}
                                {entry.user_agent && (
                                  <div className="text-muted-foreground mt-1 break-words">
                                    User Agent:{' '}
                                    <span className="text-foreground">{entry.user_agent}</span>
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                            </>
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
