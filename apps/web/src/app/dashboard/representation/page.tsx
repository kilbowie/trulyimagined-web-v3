'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ActiveRepresentation {
  id: string;
  agency_name: string;
  registry_id: string;
  verification_status: string;
  profile_image_url: string | null;
  location: string | null;
  website_url: string | null;
}

interface ActorRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  message: string | null;
  response_note: string | null;
  requested_at: string;
  responded_at: string | null;
  agency_name: string;
  agent_registry_id: string | null;
}

export default function RepresentationPage() {
  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeRepresentation, setActiveRepresentation] = useState<ActiveRepresentation | null>(null);
  const [requests, setRequests] = useState<ActorRequest[]>([]);
  const [registryIdInput, setRegistryIdInput] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [matchedAgent, setMatchedAgent] = useState<{ agency_name: string; registry_id: string; verification_status: string } | null>(null);

  const pendingRequest = useMemo(
    () => requests.find((item) => item.status === 'pending') || null,
    [requests]
  );

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [representationResponse, requestsResponse] = await Promise.all([
        fetch('/api/representation/my-agent'),
        fetch('/api/representation/requests'),
      ]);

      const representationData = await representationResponse.json();
      const requestsData = await requestsResponse.json();

      if (!representationResponse.ok) {
        throw new Error(representationData.error || 'Failed to load representation');
      }

      if (!requestsResponse.ok) {
        throw new Error(requestsData.error || 'Failed to load requests');
      }

      setActiveRepresentation(representationData.representation || null);
      setRequests(requestsData.requests || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load representation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const lookupAgent = async () => {
    if (!registryIdInput.trim()) {
      setError('Enter an agent registry ID.');
      return;
    }

    try {
      setLookupLoading(true);
      setError(null);
      setSuccess(null);
      const response = await fetch(
        `/api/representation/lookup?registryId=${encodeURIComponent(registryIdInput.trim())}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Agent lookup failed');
      }

      setMatchedAgent({
        agency_name: data.agent.agency_name,
        registry_id: data.agent.registry_id,
        verification_status: data.agent.verification_status,
      });
    } catch (lookupError) {
      setMatchedAgent(null);
      setError(lookupError instanceof Error ? lookupError.message : 'Agent lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!matchedAgent) {
      setError('Lookup an agent before sending a request.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/representation/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentRegistryId: matchedAgent.registry_id,
          message: requestMessage.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send representation request');
      }

      setSuccess(data.message || 'Representation request sent.');
      setRequestMessage('');
      setMatchedAgent(null);
      setRegistryIdInput('');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawPending = async (requestId: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`/api/representation/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'withdraw', responseNote: 'Withdrawn by actor' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to withdraw request');
      }
      await loadData();
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Failed to withdraw request');
    } finally {
      setSubmitting(false);
    }
  };

  const endRepresentation = async () => {
    if (!activeRepresentation?.id) return;
    const confirmed = window.confirm('Are you sure you want to remove your representation?');
    if (!confirmed) return;

    try {
      setSubmitting(true);
      setError(null);
      const response = await fetch(`/api/representation/${activeRepresentation.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to end representation');
      }

      setSuccess('Representation removed successfully.');
      await loadData();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'Failed to end representation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading representation...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Representation</h1>
        <p className="text-muted-foreground mt-2">
          Connect with an agent by registry ID and manage your representation relationship.
        </p>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

      {activeRepresentation ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeRepresentation.agency_name}
              <Badge variant="outline" className="capitalize">
                {activeRepresentation.verification_status}
              </Badge>
            </CardTitle>
            <CardDescription>
              Registry ID: {activeRepresentation.registry_id}
              {activeRepresentation.location ? ` • ${activeRepresentation.location}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeRepresentation.website_url && (
              <a
                href={activeRepresentation.website_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:text-primary/80"
              >
                Visit agency website
              </a>
            )}
            <div>
              <Button variant="outline" disabled={submitting} onClick={endRepresentation}>
                {submitting ? 'Processing...' : 'Remove Representation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Request Representation</CardTitle>
            <CardDescription>
              Enter an agent registry ID in the format shown by agents in their dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitRequest}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={registryIdInput}
                  onChange={(event) => setRegistryIdInput(event.target.value)}
                  placeholder="e.g. 1234-5678-9010"
                />
                <Button type="button" onClick={lookupAgent} disabled={lookupLoading}>
                  {lookupLoading ? 'Looking up...' : 'Lookup Agent'}
                </Button>
              </div>

              {matchedAgent && (
                <div className="rounded-md border bg-muted/40 p-4">
                  <p className="font-medium">{matchedAgent.agency_name}</p>
                  <p className="text-sm text-muted-foreground">Registry: {matchedAgent.registry_id}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    Verification: {matchedAgent.verification_status}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Message (optional)</label>
                <textarea
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                  className="min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Share context about your representation request"
                />
              </div>

              <div>
                <Button type="submit" disabled={submitting || !matchedAgent}>
                  {submitting ? 'Sending...' : 'Send Representation Request'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {pendingRequest && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Request</CardTitle>
            <CardDescription>
              You have a pending request with {pendingRequest.agency_name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => withdrawPending(pendingRequest.id)}
            >
              {submitting ? 'Processing...' : 'Withdraw Pending Request'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
          <CardDescription>All representation requests sent from your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No representation requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((item) => (
                <div key={item.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.agency_name}</p>
                    <Badge variant={item.status === 'approved' ? 'default' : 'secondary'} className="capitalize">
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requested {new Date(item.requested_at).toLocaleDateString()}
                    {item.responded_at ? ` • Responded ${new Date(item.responded_at).toLocaleDateString()}` : ''}
                  </p>
                  {item.response_note && (
                    <p className="text-sm text-muted-foreground mt-2">{item.response_note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
