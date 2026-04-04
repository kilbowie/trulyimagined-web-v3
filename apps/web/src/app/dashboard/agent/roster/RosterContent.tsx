'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

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
  consent_version: number | null;
  consent_policy: {
    mediaUsage?: Record<string, 'allow' | 'require_approval' | 'deny'>;
    contentTypes?: Record<string, 'allow' | 'require_approval' | 'deny'>;
    usageBlocked?: boolean;
  } | null;
  consent_usage_blocked: boolean;
}

const MEDIA_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'film', label: 'Film' },
  { key: 'television', label: 'Television' },
  { key: 'streaming', label: 'Streaming Platforms' },
  { key: 'gaming', label: 'Gaming' },
  { key: 'voiceReplication', label: 'Voice Replication' },
  { key: 'virtualReality', label: 'Virtual Reality' },
  { key: 'socialMedia', label: 'Social Media' },
  { key: 'advertising', label: 'Advertising' },
  { key: 'merchandise', label: 'Merchandise' },
  { key: 'livePerformance', label: 'Live Performance' },
];

const CONTENT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'explicit', label: 'Explicit Content' },
  { key: 'political', label: 'Political Content' },
  { key: 'religious', label: 'Religious Content' },
  { key: 'violence', label: 'Violence' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'tobacco', label: 'Tobacco' },
  { key: 'gambling', label: 'Gambling' },
  { key: 'pharmaceutical', label: 'Pharmaceutical' },
  { key: 'firearms', label: 'Firearms' },
  { key: 'adultContent', label: 'Adult Content' },
];

export default function RosterContent() {
  const [roster, setRoster] = useState<RosterActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [usageModeFilter, setUsageModeFilter] = useState('all');
  const [consentGroupFilter, setConsentGroupFilter] = useState<
    'all' | 'mediaUsage' | 'contentTypes'
  >('all');
  const [consentFieldFilter, setConsentFieldFilter] = useState('all');
  const [consentLevelFilter, setConsentLevelFilter] = useState('all');

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

  const uniqueStatuses = useMemo(() => {
    const statuses = Array.from(new Set(roster.map((a) => a.verification_status).filter(Boolean)));
    return statuses.sort();
  }, [roster]);

  const filteredRoster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const activeConsentFields =
      consentGroupFilter === 'mediaUsage'
        ? MEDIA_FIELDS
        : consentGroupFilter === 'contentTypes'
          ? CONTENT_FIELDS
          : [];

    return roster.filter((actor) => {
      const displayName = (
        actor.stage_name ||
        `${actor.first_name || ''} ${actor.last_name || ''}`.trim() ||
        ''
      ).toLowerCase();
      const registryId = (actor.registry_id || '').toLowerCase();
      const location = (actor.location || '').toLowerCase();
      const verificationStatus = (actor.verification_status || '').toLowerCase();
      const matchesQuery =
        !q ||
        displayName.includes(q) ||
        registryId.includes(q) ||
        location.includes(q) ||
        verificationStatus.includes(q);
      const matchesStatus = statusFilter === 'all' || actor.verification_status === statusFilter;

      const matchesUsageMode =
        usageModeFilter === 'all' ||
        (usageModeFilter === 'blocked' && actor.consent_usage_blocked) ||
        (usageModeFilter === 'permitted' && !actor.consent_usage_blocked);

      let matchesConsentPreference = true;
      if (
        consentGroupFilter !== 'all' &&
        consentFieldFilter !== 'all' &&
        consentLevelFilter !== 'all'
      ) {
        const bucket = actor.consent_policy?.[consentGroupFilter] as
          | Record<string, string>
          | undefined;
        matchesConsentPreference = bucket?.[consentFieldFilter] === consentLevelFilter;
      } else if (consentGroupFilter !== 'all' && consentFieldFilter === 'all') {
        const bucket = actor.consent_policy?.[consentGroupFilter] as
          | Record<string, string>
          | undefined;
        const bucketFields = activeConsentFields.map((entry) => entry.key);
        matchesConsentPreference = bucketFields.some(
          (field) => bucket?.[field] === consentLevelFilter || consentLevelFilter === 'all'
        );
      }

      return matchesQuery && matchesStatus && matchesUsageMode && matchesConsentPreference;
    });
  }, [
    roster,
    searchQuery,
    statusFilter,
    usageModeFilter,
    consentGroupFilter,
    consentFieldFilter,
    consentLevelFilter,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    usageModeFilter !== 'all' ||
    consentGroupFilter !== 'all' ||
    consentFieldFilter !== 'all' ||
    consentLevelFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setUsageModeFilter('all');
    setConsentGroupFilter('all');
    setConsentFieldFilter('all');
    setConsentLevelFilter('all');
  };

  const consentFieldOptions =
    consentGroupFilter === 'mediaUsage'
      ? MEDIA_FIELDS
      : consentGroupFilter === 'contentTypes'
        ? CONTENT_FIELDS
        : [];

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading roster...</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Roster</h1>
        <p className="text-muted-foreground mt-2">Actors currently linked to your agency.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Search & Filter Bar */}
      {roster.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, registry ID, location…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {uniqueStatuses.map((status) => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={usageModeFilter} onValueChange={setUsageModeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Usage mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All usage modes</SelectItem>
                <SelectItem value="permitted">Usage permitted</SelectItem>
                <SelectItem value="blocked">Usage blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select
              value={consentGroupFilter}
              onValueChange={(value) => {
                setConsentGroupFilter(value as 'all' | 'mediaUsage' | 'contentTypes');
                setConsentFieldFilter('all');
              }}
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Consent category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="mediaUsage">Media Usage</SelectItem>
                <SelectItem value="contentTypes">Content Types</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={consentFieldFilter}
              onValueChange={setConsentFieldFilter}
              disabled={consentGroupFilter === 'all'}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Consent field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any field</SelectItem>
                {consentFieldOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={consentLevelFilter}
              onValueChange={setConsentLevelFilter}
              disabled={consentGroupFilter === 'all'}
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Permission level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any permission</SelectItem>
                <SelectItem value="allow">Allowed</SelectItem>
                <SelectItem value="require_approval">Requires Approval</SelectItem>
                <SelectItem value="deny">Denied</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}

            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {filteredRoster.length} of {roster.length} actors
            </span>
          </div>
        </div>
      )}

      {roster.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No represented actors yet.
          </CardContent>
        </Card>
      ) : filteredRoster.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No actors match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRoster.map((actor) => {
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
