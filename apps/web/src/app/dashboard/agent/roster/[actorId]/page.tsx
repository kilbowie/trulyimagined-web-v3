'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PermissionLevel = 'allow' | 'require_approval' | 'deny';

interface ConsentPolicy {
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
  territories?: {
    allowed: string[];
    denied: string[];
  };
  aiControls?: {
    trainingAllowed: boolean;
    syntheticGenerationAllowed: boolean;
    biometricAnalysisAllowed: boolean;
  };
  usageBlocked?: boolean;
}

interface RosterActor {
  relationship_id: string;
  id: string;
  registry_id: string | null;
  stage_name: string | null;
  first_name: string | null;
  last_name: string | null;
  verification_status: string;
  profile_image_url: string | null;
  location: string | null;
}

interface ConsentLogEntry {
  id: string;
  action: string;
  consent_type: string;
  project_name: string | null;
  requester_type: string | null;
  created_at: string;
}

interface ConsentLedgerEntry {
  id: string;
  version: number;
  status: string;
  reason: string | null;
  created_at: string;
  policy: ConsentPolicy;
}

interface LicensingRequest {
  id: string;
  requester_name: string;
  requester_organization: string | null;
  project_name: string;
  usage_type: string;
  status: string;
  compensation_offered: number | null;
  compensation_currency: string;
  duration_start: string | null;
  duration_end: string | null;
  created_at: string;
}

interface License {
  id: string;
  api_client_name: string | null;
  license_type: string;
  status: string;
  issued_at: string;
  expires_at: string | null;
  usage_count: number;
  revocation_reason: string | null;
}

const MEDIA_USAGE_LABELS: Record<string, string> = {
  film: 'Film',
  television: 'Television',
  streaming: 'Streaming Platforms',
  gaming: 'Gaming',
  voiceReplication: 'Voice Replication',
  virtualReality: 'Virtual Reality',
  socialMedia: 'Social Media',
  advertising: 'Advertising',
  merchandise: 'Merchandise',
  livePerformance: 'Live Performance',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  explicit: 'Explicit Content',
  political: 'Political Content',
  religious: 'Religious Content',
  violence: 'Violence',
  alcohol: 'Alcohol',
  tobacco: 'Tobacco',
  gambling: 'Gambling',
  pharmaceutical: 'Pharmaceutical',
  firearms: 'Firearms',
  adultContent: 'Adult Content',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'active' || status === 'approved' || status === 'granted'
      ? 'default'
      : status === 'pending'
        ? 'secondary'
        : 'destructive';
  return <Badge variant={variant}>{status}</Badge>;
}

function DonutChart({
  label,
  counts,
  total,
}: {
  label: string;
  counts: { allow: number; require_approval: number; deny: number };
  total: number;
}) {
  const allowPct = (counts.allow / total) * 100;
  const approvalPct = (counts.require_approval / total) * 100;

  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{label}</h3>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20" aria-hidden="true">
          <svg viewBox="0 0 42 42" className="h-20 w-20 -rotate-90">
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="hsl(var(--muted))"
              strokeWidth="6"
            />
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="#22c55e"
              strokeWidth="6"
              strokeDasharray={`${allowPct} ${100 - allowPct}`}
              strokeDashoffset="0"
            />
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="#f59e0b"
              strokeWidth="6"
              strokeDasharray={`${approvalPct} ${100 - approvalPct}`}
              strokeDashoffset={`-${allowPct}`}
            />
            <circle
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke="#ef4444"
              strokeWidth="6"
              strokeDasharray={`${100 - allowPct - approvalPct} ${allowPct + approvalPct}`}
              strokeDashoffset={`-${allowPct + approvalPct}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-foreground">{total}</span>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>Allowed: {counts.allow}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Requires Approval: {counts.require_approval}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span>Denied: {counts.deny}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionList({
  items,
  labels,
}: {
  items: Record<string, PermissionLevel>;
  labels: Record<string, string>;
}) {
  const allowed = Object.entries(items)
    .filter(([, v]) => v === 'allow')
    .map(([k]) => labels[k] ?? k);
  const requiresApproval = Object.entries(items)
    .filter(([, v]) => v === 'require_approval')
    .map(([k]) => labels[k] ?? k);
  const denied = Object.entries(items)
    .filter(([, v]) => v === 'deny')
    .map(([k]) => labels[k] ?? k);

  return (
    <div className="mt-3 space-y-2 text-sm">
      <div>
        <span className="font-medium text-green-600 dark:text-green-400">Allowed: </span>
        {allowed.length > 0 ? (
          <span className="text-muted-foreground">{allowed.join(', ')}</span>
        ) : (
          <span className="text-muted-foreground italic">None</span>
        )}
      </div>
      <div>
        <span className="font-medium text-amber-600 dark:text-amber-400">Requires Approval: </span>
        {requiresApproval.length > 0 ? (
          <span className="text-muted-foreground">{requiresApproval.join(', ')}</span>
        ) : (
          <span className="text-muted-foreground italic">None</span>
        )}
      </div>
      <div>
        <span className="font-medium text-red-600 dark:text-red-400">Denied: </span>
        {denied.length > 0 ? (
          <span className="text-muted-foreground">{denied.join(', ')}</span>
        ) : (
          <span className="text-muted-foreground italic">None</span>
        )}
      </div>
    </div>
  );
}

function getPermissionCounts(values: PermissionLevel[]) {
  return values.reduce(
    (acc, item) => {
      acc[item] += 1;
      return acc;
    },
    { allow: 0, require_approval: 0, deny: 0 }
  );
}

export default function AgentActorDetailsPage() {
  const router = useRouter();
  const params = useParams<{ actorId: string }>();
  const searchParams = useSearchParams();

  const actorId = params.actorId;
  const relationshipId = searchParams.get('relationshipId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState<RosterActor | null>(null);
  const [consentLog, setConsentLog] = useState<ConsentLogEntry[]>([]);
  const [consentLedger, setConsentLedger] = useState<ConsentLedgerEntry[]>([]);
  const [licensingRequests, setLicensingRequests] = useState<LicensingRequest[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [unlinking, setUnlinking] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const actorName = useMemo(() => {
    if (!actor) return 'Actor';
    return (
      actor.stage_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'Actor'
    );
  }, [actor]);

  // The current consent version is the one with the highest version number (first in DESC order)
  const currentConsent = useMemo(() => {
    if (consentLedger.length === 0) return null;
    return consentLedger[0];
  }, [consentLedger]);

  const currentMediaCounts = useMemo(() => {
    if (!currentConsent?.policy?.mediaUsage) return { allow: 0, require_approval: 0, deny: 0 };
    return getPermissionCounts(Object.values(currentConsent.policy.mediaUsage));
  }, [currentConsent]);

  const currentContentCounts = useMemo(() => {
    if (!currentConsent?.policy?.contentTypes) return { allow: 0, require_approval: 0, deny: 0 };
    return getPermissionCounts(Object.values(currentConsent.policy.contentTypes));
  }, [currentConsent]);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const [rosterResponse, consentResponse, licensesResponse] = await Promise.all([
          fetch('/api/agent/roster'),
          fetch(`/api/agent/actors/${actorId}/consent`),
          fetch(`/api/agent/actors/${actorId}/licenses`),
        ]);

        const rosterData = await rosterResponse.json();
        const consentData = await consentResponse.json();
        const licensesData = await licensesResponse.json();

        if (!rosterResponse.ok) {
          throw new Error(rosterData.error || 'Failed to load actor roster details');
        }

        if (!consentResponse.ok) {
          throw new Error(consentData.error || 'Failed to load consent history');
        }

        if (!licensesResponse.ok) {
          throw new Error(licensesData.error || 'Failed to load license history');
        }

        const matchedActor = (rosterData.roster || []).find(
          (entry: RosterActor) => entry.id === actorId
        );
        setActor(matchedActor || null);
        setConsentLog(consentData.consentLog || []);
        setConsentLedger(consentData.consentLedger || []);
        setLicensingRequests(licensesData.licensingRequests || []);
        setLicenses(licensesData.licenses || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load actor details');
      } finally {
        setLoading(false);
      }
    };

    if (actorId) {
      loadDetails();
    }
  }, [actorId]);

  const removeFromRoster = async () => {
    if (!relationshipId) {
      setError('Missing relationship ID for unlink operation.');
      return;
    }

    try {
      setUnlinking(true);
      setError(null);

      const response = await fetch(`/api/representation/${relationshipId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove actor from roster');
      }

      router.push('/dashboard/agent/roster');
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'Failed to unlink actor');
    } finally {
      setUnlinking(false);
      setRemoveDialogOpen(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading actor details...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{actorName}</h1>
          <p className="text-muted-foreground mt-2">
            Manage consent and licensing history for this actor.
          </p>
        </div>
        <Button
          variant="destructive"
          disabled={unlinking}
          onClick={() => setRemoveDialogOpen(true)}
        >
          {unlinking ? 'Removing...' : 'Remove from Roster'}
        </Button>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Roster</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-foreground">{actorName}</span> from your roster?
              This will end the representation relationship. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={unlinking}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={removeFromRoster} disabled={unlinking}>
              {unlinking ? 'Removing...' : 'Yes, Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Actor Summary</CardTitle>
          <CardDescription>
            Registry: {actor?.registry_id || 'N/A'} • Verification:{' '}
            {actor?.verification_status || 'unknown'}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="consent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consent">Consent</TabsTrigger>
          <TabsTrigger value="licensing">Licensing</TabsTrigger>
        </TabsList>

        <TabsContent value="consent" className="space-y-4">
          {/* Current Consent Version */}
          {currentConsent && (
            <Card>
              <CardHeader>
                <CardTitle>Current Consent Version</CardTitle>
                <CardDescription>
                  Active consent policy for this actor — read-only view.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Version</div>
                    <div className="text-2xl font-bold text-primary">v{currentConsent.version}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
                    <div className="text-base font-semibold">
                      {formatDate(currentConsent.created_at)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <StatusBadge status={currentConsent.status} />
                  </div>
                </div>

                {currentConsent.policy?.usageBlocked && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Usage is currently blocked by this actor.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <DonutChart
                      label="Media Usage Categories"
                      counts={currentMediaCounts}
                      total={10}
                    />
                    {currentConsent.policy?.mediaUsage && (
                      <PermissionList
                        items={currentConsent.policy.mediaUsage}
                        labels={MEDIA_USAGE_LABELS}
                      />
                    )}
                  </div>
                  <div>
                    <DonutChart
                      label="Content Type Restrictions"
                      counts={currentContentCounts}
                      total={10}
                    />
                    {currentConsent.policy?.contentTypes && (
                      <PermissionList
                        items={currentConsent.policy.contentTypes}
                        labels={CONTENT_TYPE_LABELS}
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                  <h3 className="text-sm font-semibold mb-3">Geographic Territories</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-green-600 dark:text-green-400">Allowed: </span>
                      {currentConsent.policy?.territories?.allowed?.length ? (
                        <span className="text-muted-foreground">
                          {currentConsent.policy.territories.allowed.join(', ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">No explicit allowed list</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-red-600 dark:text-red-400">Denied: </span>
                      {currentConsent.policy?.territories?.denied?.length ? (
                        <span className="text-muted-foreground">
                          {currentConsent.policy.territories.denied.join(', ')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">No denied territories</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Current Consent Ledger Entries</CardTitle>
              <CardDescription>Versioned, read-only consent policy history.</CardDescription>
            </CardHeader>
            <CardContent>
              {consentLedger.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consent ledger records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Version</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Reason</th>
                        <th className="pb-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consentLedger.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">v{entry.version}</td>
                          <td className="py-2 pr-4">
                            <StatusBadge status={entry.status} />
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{entry.reason || '—'}</td>
                          <td className="py-2 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consent Activity Log</CardTitle>
              <CardDescription>Append-only record of consent actions.</CardDescription>
            </CardHeader>
            <CardContent>
              {consentLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consent activity found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Action</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">Project</th>
                        <th className="pb-2 pr-4 font-medium">By</th>
                        <th className="pb-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consentLog.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <StatusBadge status={entry.action} />
                          </td>
                          <td className="py-2 pr-4">{entry.consent_type}</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {entry.project_name || '—'}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {entry.requester_type || '—'}
                          </td>
                          <td className="py-2 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licensing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Licensing Requests</CardTitle>
              <CardDescription>Historical licensing requests for this actor.</CardDescription>
            </CardHeader>
            <CardContent>
              {licensingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licensing requests found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Requester</th>
                        <th className="pb-2 pr-4 font-medium">Project</th>
                        <th className="pb-2 pr-4 font-medium">Usage</th>
                        <th className="pb-2 pr-4 font-medium">Compensation</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licensingRequests.map((req) => (
                        <tr key={req.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <div>{req.requester_name}</div>
                            {req.requester_organization && (
                              <div className="text-xs text-muted-foreground">
                                {req.requester_organization}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-4">{req.project_name}</td>
                          <td className="py-2 pr-4">{req.usage_type}</td>
                          <td className="py-2 pr-4">
                            {req.compensation_offered != null
                              ? `${req.compensation_currency} ${Number(req.compensation_offered).toLocaleString()}`
                              : '—'}
                          </td>
                          <td className="py-2 pr-4">
                            <StatusBadge status={req.status} />
                          </td>
                          <td className="py-2 whitespace-nowrap">{formatDate(req.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Licenses</CardTitle>
              <CardDescription>
                Active and historical license grants for this actor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {licenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Client</th>
                        <th className="pb-2 pr-4 font-medium">Type</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Issued</th>
                        <th className="pb-2 pr-4 font-medium">Expires</th>
                        <th className="pb-2 font-medium">Uses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licenses.map((lic) => (
                        <tr key={lic.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">{lic.api_client_name || '—'}</td>
                          <td className="py-2 pr-4">{lic.license_type}</td>
                          <td className="py-2 pr-4">
                            <StatusBadge status={lic.status} />
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {formatDate(lic.issued_at)}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {formatDate(lic.expires_at)}
                          </td>
                          <td className="py-2">{lic.usage_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
