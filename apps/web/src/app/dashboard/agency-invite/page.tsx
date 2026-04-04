'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type InviteState = 'loading' | 'success' | 'error';

export default function AgencyInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('invite') || '', [searchParams]);

  const [state, setState] = useState<InviteState>('loading');
  const [message, setMessage] = useState('Confirming your invitation...');

  useEffect(() => {
    const acceptInvite = async () => {
      if (!token) {
        setState('error');
        setMessage('Missing invitation token. Please use the full link from your email.');
        return;
      }

      try {
        const response = await fetch('/api/agency-invite/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const payload = await response.json();

        if (response.status === 401) {
          const returnTo = `/dashboard/agency-invite?invite=${encodeURIComponent(token)}`;
          const loginUrl = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
          window.location.href = loginUrl;
          return;
        }

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to accept invitation');
        }

        setState('success');
        setMessage(payload.message || 'Invitation accepted successfully.');
      } catch (error) {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Failed to accept invitation');
      }
    };

    void acceptInvite();
  }, [token]);

  return (
    <div className="mx-auto max-w-2xl py-12">
      <Card>
        <CardHeader>
          <CardTitle>Agency Invitation</CardTitle>
          <CardDescription>Join your agency workspace securely.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'loading' && (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {message}
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-3">
              <p className="text-sm text-green-700">{message}</p>
              <Button onClick={() => router.push('/dashboard')}>Continue to Dashboard</Button>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-red-700">{message}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => {
                    const returnTo = token
                      ? `/dashboard/agency-invite?invite=${encodeURIComponent(token)}`
                      : '/dashboard/agency-invite';
                    window.location.href = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
                  }}
                >
                  Sign in again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
