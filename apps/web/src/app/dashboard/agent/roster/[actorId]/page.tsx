'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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

export default function AgentActorDetailsPage() {
  const router = useRouter();
  const params = useParams<{ actorId: string }>();
  const searchParams = useSearchParams();

  const actorId = params.actorId;
  const relationshipId = searchParams.get('relationshipId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState<RosterActor | null>(null);
  const [consentLog, setConsentLog] = useState<Array<Record<string, unknown>>>([]);
  const [consentLedger, setConsentLedger] = useState<Array<Record<string, unknown>>>([]);
  const [licensingRequests, setLicensingRequests] = useState<Array<Record<string, unknown>>>([]);
  const [licenses, setLicenses] = useState<Array<Record<string, unknown>>>([]);
  const [unlinking, setUnlinking] = useState(false);

  const actorName = useMemo(() => {
    if (!actor) return 'Actor';
    return actor.stage_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'Actor';
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

        const matchedActor = (rosterData.roster || []).find((entry: RosterActor) => entry.id === actorId);
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

    const confirmed = window.confirm('Are you sure you want to remove this actor from your roster?');
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
          <p className="text-muted-foreground mt-2">Manage consent and licensing history for this actor.</p>
        </div>
        <Button variant="outline" disabled={unlinking} onClick={removeFromRoster}>
          {unlinking ? 'Removing...' : 'Remove from Roster'}
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Actor Summary</CardTitle>
          <CardDescription>
            Registry: {actor?.registry_id || 'N/A'} • Verification: {actor?.verification_status || 'unknown'}
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
              <CardDescription>Read-only history of versioned consent policies.</CardDescription>
            </CardHeader>
            <CardContent>
              {consentLedger.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consent ledger records found.</p>
              ) : (
                <div className="space-y-3">
                  {consentLedger.map((entry, index) => (
                    <div key={index} className="rounded-md border p-3 text-sm">
                      <pre className="overflow-x-auto">{JSON.stringify(entry, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consent Activity Log</CardTitle>
              <CardDescription>Read-only append-only consent actions.</CardDescription>
            </CardHeader>
            <CardContent>
              {consentLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consent activity found.</p>
              ) : (
                <div className="space-y-3">
                  {consentLog.map((entry, index) => (
                    <div key={index} className="rounded-md border p-3 text-sm">
                      <pre className="overflow-x-auto">{JSON.stringify(entry, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licensing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Licensing Requests</CardTitle>
              <CardDescription>Read-only historical requests for this actor.</CardDescription>
            </CardHeader>
            <CardContent>
              {licensingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licensing requests found.</p>
              ) : (
                <div className="space-y-3">
                  {licensingRequests.map((entry, index) => (
                    <div key={index} className="rounded-md border p-3 text-sm">
                      <pre className="overflow-x-auto">{JSON.stringify(entry, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Licenses</CardTitle>
              <CardDescription>Read-only license grants linked to this actor.</CardDescription>
            </CardHeader>
            <CardContent>
              {licenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses found.</p>
              ) : (
                <div className="space-y-3">
                  {licenses.map((entry, index) => (
                    <div key={index} className="rounded-md border p-3 text-sm">
                      <pre className="overflow-x-auto">{JSON.stringify(entry, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
