'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface RepresentationRequest {
  id: string;
  actor_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  message: string | null;
  response_note: string | null;
  requested_at: string;
  responded_at: string | null;
  stage_name: string | null;
  first_name: string | null;
  last_name: string | null;
  actor_registry_id: string | null;
}

export default function RequestsContent() {
  const [requests, setRequests] = useState<RepresentationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/representation/requests');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load requests');
      }

      setRequests(data.requests || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pending = useMemo(() => requests.filter((item) => item.status === 'pending'), [requests]);
  const history = useMemo(() => requests.filter((item) => item.status !== 'pending'), [requests]);

  const updateRequest = async (id: string, action: 'approve' | 'reject') => {
    try {
      setSavingId(id);
      setError(null);
      const response = await fetch(`/api/representation/requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          responseNote: responseNote[id]?.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} request`);
      }

      await loadRequests();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update request');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading representation requests...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Representation Requests</h1>
        <p className="text-muted-foreground mt-2">Approve or reject incoming actor representation requests.</p>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No pending representation requests.
              </CardContent>
            </Card>
          ) : (
            pending.map((item) => {
              const actorName = item.stage_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Actor';
              const isSaving = savingId === item.id;

              return (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-xl">{actorName}</CardTitle>
                    <CardDescription>
                      Registry: {item.actor_registry_id || 'N/A'} • Requested {new Date(item.requested_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {item.message && (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground">
                        {item.message}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Response note (optional)</label>
                      <Textarea
                        value={responseNote[item.id] || ''}
                        onChange={(event) =>
                          setResponseNote((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        placeholder="Add context for approval or rejection"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} onClick={() => updateRequest(item.id, 'approve')}>
                        {isSaving ? 'Saving...' : 'Approve'}
                      </Button>
                      <Button variant="outline" disabled={isSaving} onClick={() => updateRequest(item.id, 'reject')}>
                        {isSaving ? 'Saving...' : 'Reject'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {history.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No completed request history yet.
              </CardContent>
            </Card>
          ) : (
            history.map((item) => {
              const actorName = item.stage_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Actor';

              return (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {actorName}
                      <Badge variant={item.status === 'approved' ? 'default' : 'secondary'} className="capitalize">
                        {item.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Requested {new Date(item.requested_at).toLocaleDateString()}
                      {item.responded_at ? ` • Responded ${new Date(item.responded_at).toLocaleDateString()}` : ''}
                    </CardDescription>
                  </CardHeader>
                  {item.response_note && (
                    <CardContent>
                      <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground">
                        {item.response_note}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
