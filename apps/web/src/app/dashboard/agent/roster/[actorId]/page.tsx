'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  policy: Record<string, unknown>;
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

  const actorName = useMemo(() => {
    if (!actor) return 'Actor';
    return (
      actor.stage_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'Actor'
    );
  }, [actor]);

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

    const confirmed = window.confirm(
      'Are you sure you want to remove this actor from your roster?'
    );
    if (!confirmed) {
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
        <Button variant="outline" disabled={unlinking} onClick={removeFromRoster}>
          {unlinking ? 'Removing...' : 'Remove from Roster'}
        </Button>
      </div>

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
