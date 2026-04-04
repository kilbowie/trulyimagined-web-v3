'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

interface LicensingRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  requester_organization: string | null;
  project_name: string;
  project_description: string;
  usage_type: string;
  intended_use: string;
  duration_start: string | null;
  duration_end: string | null;
  compensation_offered: number | null;
  compensation_currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'approved') return 'default';
  if (status === 'pending') return 'secondary';
  if (status === 'rejected' || status === 'expired') return 'destructive';
  return 'outline';
}

function RequestCard({
  req,
  onApprove,
  onReject,
}: {
  req: LicensingRequest;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleApprove = async () => {
    setSubmitting(true);
    setLocalError(null);
    try {
      await onApprove(req.id);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    setLocalError(null);
    try {
      await onReject(req.id, rejectionReason);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{req.project_name}</CardTitle>
            <CardDescription>
              {req.requester_name}
              {req.requester_organization ? ` · ${req.requester_organization}` : ''}
            </CardDescription>
          </div>
          <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Usage type</p>
            <p className="font-medium capitalize">{req.usage_type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Compensation</p>
            <p className="font-medium">
              {req.compensation_offered != null
                ? `${req.compensation_currency} ${Number(req.compensation_offered).toLocaleString()}`
                : 'Not specified'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Duration</p>
            <p className="font-medium">
              {req.duration_start || req.duration_end
                ? `${formatDate(req.duration_start)} – ${formatDate(req.duration_end)}`
                : 'Not specified'}
            </p>
          </div>
        </div>

        <div className="text-sm">
          <p className="text-muted-foreground mb-1">Project description</p>
          <p className="whitespace-pre-wrap">{req.project_description}</p>
        </div>

        <div className="text-sm">
          <p className="text-muted-foreground mb-1">Intended use</p>
          <p className="whitespace-pre-wrap">{req.intended_use}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Submitted {formatDate(req.created_at)} · Contact:{' '}
          <span className="font-medium">{req.requester_email}</span>
        </p>

        {localError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {localError}
          </div>
        )}

        {req.status === 'pending' && (
          <div className="space-y-3 border-t pt-3">
            {rejecting ? (
              <div className="space-y-2">
                <Label htmlFor={`reason-${req.id}`}>Rejection reason (optional)</Label>
                <Textarea
                  id={`reason-${req.id}`}
                  placeholder="Explain why you are declining this request..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  maxLength={1000}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={submitting}
                    onClick={handleReject}
                  >
                    {submitting ? 'Rejecting...' : 'Confirm Reject'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => setRejecting(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" disabled={submitting} onClick={handleApprove}>
                  {submitting ? 'Approving...' : 'Approve'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setRejecting(true)}
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}

        {req.status === 'rejected' && req.rejection_reason && (
          <div className="border-t pt-3 text-sm">
            <p className="text-muted-foreground mb-1">Rejection reason</p>
            <p>{req.rejection_reason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LicensingRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<LicensingRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/actor/licensing-requests');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load requests');
      setRequests(data.requests || []);
      setPendingCount(data.pendingCount || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/actor/licensing-requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to approve');
    await loadRequests();
  };

  const handleReject = async (id: string, rejectionReason: string) => {
    const res = await fetch(`/api/actor/licensing-requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', rejectionReason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reject');
    await loadRequests();
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const historyRequests = requests.filter((r) => r.status !== 'pending');

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading licensing requests...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Licensing Requests</h1>
        <p className="mt-2 text-muted-foreground">
          Review and respond to requests from studios and creators to use your identity.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending licensing requests.
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No licensing request history yet.
              </CardContent>
            </Card>
          ) : (
            historyRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
