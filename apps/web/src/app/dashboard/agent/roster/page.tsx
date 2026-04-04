'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export default function AgentRosterPage() {
  const [roster, setRoster] = useState<RosterActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRoster = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/agent/roster');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load roster');
        }

        setRoster(data.roster || []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load roster');
      } finally {
        setLoading(false);
      }
    };

    loadRoster();
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading roster...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Roster</h1>
        <p className="text-muted-foreground mt-2">Actors currently linked to your agency.</p>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {roster.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No represented actors yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((actor) => {
            const displayName =
              actor.stage_name ||
              `${actor.first_name || ''} ${actor.last_name || ''}`.trim() ||
              'Actor';

            return (
              <Card key={actor.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-lg">
                    <span className="truncate">{displayName}</span>
                    <Badge variant="outline" className="capitalize">
                      {actor.verification_status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Registry: {actor.registry_id || 'N/A'}
                    {actor.location ? ` • ${actor.location}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/dashboard/agent/roster/${actor.id}?relationshipId=${actor.relationship_id}`}
                    className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Manage Actor
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
