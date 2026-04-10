'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, CheckCircle2, Loader2, XCircle } from 'lucide-react';

type PendingVerification = {
  actor_id: string;
  registry_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  stage_name: string | null;
  verification_status: string;
  verification_request_id: string | null;
  request_status: string | null;
  preferred_timezone: string | null;
  phone_number: string | null;
  scheduled_at: string | null;
};

function toIsoFromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

export default function VerificationDashboard() {
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<PendingVerification | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const [scheduledAt, setScheduledAt] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingPlatform, setMeetingPlatform] = useState('google-meet');
  const [preferredTimezone, setPreferredTimezone] = useState('Europe/London');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [completionNotes, setCompletionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pendingCount = useMemo(
    () => items.filter((item) => item.verification_status === 'pending').length,
    [items]
  );

  async function fetchPending() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/verification/pending');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load pending verifications');
      }

      setItems(data.data.verifications || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPending();
  }, []);

  function openSchedule(item: PendingVerification) {
    setSelectedItem(item);
    setScheduledAt('');
    setMeetingLink('');
    setMeetingPlatform('google-meet');
    setPreferredTimezone(item.preferred_timezone || 'Europe/London');
    setPhoneNumber(item.phone_number || '');
    setScheduleOpen(true);
  }

  function openComplete(item: PendingVerification) {
    setSelectedItem(item);
    setCompletionNotes('');
    setCompleteOpen(true);
  }

  async function submitSchedule() {
    if (!selectedItem || !scheduledAt || !meetingLink) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/admin/verification/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: selectedItem.actor_id,
          scheduledAt: toIsoFromLocalInput(scheduledAt),
          meetingLink,
          meetingPlatform,
          preferredTimezone,
          phoneNumber,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule verification');
      }

      setScheduleOpen(false);
      await fetchPending();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Scheduling failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCompletion(verified: boolean) {
    if (!selectedItem) return;

    try {
      setSubmitting(true);

      const response = await fetch('/api/admin/verification/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationRequestId: selectedItem.verification_request_id,
          actorId: selectedItem.actor_id,
          verified,
          notes: completionNotes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete verification');
      }

      setCompleteOpen(false);
      await fetchPending();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Completion failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manual Verification</h1>
        <p className="text-muted-foreground mt-2">
          Schedule and complete founder-led actor verification calls.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Actors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Queue Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Verification Queue</CardTitle>
          <CardDescription>Only actors with pending verification status are shown.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading pending verifications...
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No pending verifications.</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.actor_id}
                  className="border rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {item.stage_name || `${item.first_name} ${item.last_name}`}
                    </div>
                    <div className="text-sm text-muted-foreground">{item.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.registry_id || 'No registry id yet'}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Badge variant="secondary">{item.verification_status}</Badge>
                      {item.request_status ? <Badge>{item.request_status}</Badge> : null}
                      {item.scheduled_at ? (
                        <Badge variant="outline">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(item.scheduled_at).toLocaleString()}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openSchedule(item)}>
                      Schedule
                    </Button>
                    <Button onClick={() => openComplete(item)}>Complete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Verification Call</DialogTitle>
            <DialogDescription>
              Set date/time and call link for this actor's manual verification session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <Input
              placeholder="Meeting link"
              value={meetingLink}
              onChange={(event) => setMeetingLink(event.target.value)}
            />
            <Input
              placeholder="Meeting platform"
              value={meetingPlatform}
              onChange={(event) => setMeetingPlatform(event.target.value)}
            />
            <Input
              placeholder="Preferred timezone"
              value={preferredTimezone}
              onChange={(event) => setPreferredTimezone(event.target.value)}
            />
            <Input
              placeholder="Phone number"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitSchedule} disabled={submitting || !scheduledAt || !meetingLink}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Verification</DialogTitle>
            <DialogDescription>
              Confirm whether the actor passed manual verification and add optional notes.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Completion notes (optional)"
            value={completionNotes}
            onChange={(event) => setCompletionNotes(event.target.value)}
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCompleteOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitCompletion(false)}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="ml-2">Mark Failed</span>
            </Button>
            <Button onClick={() => submitCompletion(true)} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span className="ml-2">Mark Verified</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
