'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type License = {
  id: string;
  actor_id: string;
  api_client_id: string;
  api_client_name: string;
  consent_ledger_id: string;
  license_type: string;
  granted_permissions_snapshot: Record<string, unknown>;
  status: 'active' | 'revoked' | 'expired' | 'suspended';
  revocation_reason?: string;
  issued_at: string;
  expires_at?: string;
  revoked_at?: string;
  revoked_by?: string;
  usage_count: number;
  first_used_at?: string;
  last_used_at?: string;
};

type LicenseStats = {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  suspended: number;
};

export default function LicenseTrackerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState<LicenseStats>({
    total: 0,
    active: 0,
    revoked: 0,
    expired: 0,
    suspended: 0,
  });
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadLicenses();
  }, [activeFilter]);

  const loadLicenses = async () => {
    try {
      setLoading(true);
      setError(null);

      const url =
        activeFilter === 'all'
          ? '/api/licenses/actor'
          : `/api/licenses/actor?status=${activeFilter}`;

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to load licenses');
      }

      const data = await res.json();
      setLicenses(data.licenses);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
      case 'revoked':
        return 'text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/30';
      case 'expired':
        return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
      case 'suspended':
        return 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/30';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-8">
        <div className="rounded-xl border border-border bg-card px-6 py-5 text-center text-base text-foreground md:text-lg">
          Loading licenses...
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 md:text-base"
          >
            ← Back to Dashboard
          </button>
          <h1 className="mb-2 text-2xl font-bold text-foreground md:text-4xl">License Tracker</h1>
          <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
            Monitor and manage licenses granted to API clients for your data and content.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive md:text-base">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          <div className="rounded-xl border border-border bg-card p-4 md:p-5">
            <div className="mb-1 text-2xl font-bold text-foreground md:text-3xl">{stats.total}</div>
            <div className="text-xs text-muted-foreground md:text-sm">Total Licenses</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 md:p-5">
            <div className="mb-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300 md:text-3xl">{stats.active}</div>
            <div className="text-xs text-emerald-700/90 dark:text-emerald-300 md:text-sm">Active</div>
          </div>
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 md:p-5">
            <div className="mb-1 text-2xl font-bold text-red-700 dark:text-red-300 md:text-3xl">{stats.revoked}</div>
            <div className="text-xs text-red-700/90 dark:text-red-300 md:text-sm">Revoked</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 md:p-5">
            <div className="mb-1 text-2xl font-bold text-amber-700 dark:text-amber-300 md:text-3xl">{stats.expired}</div>
            <div className="text-xs text-amber-700/90 dark:text-amber-300 md:text-sm">Expired</div>
          </div>
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 md:p-5">
            <div className="mb-1 text-2xl font-bold text-orange-700 dark:text-orange-300 md:text-3xl">{stats.suspended}</div>
            <div className="text-xs text-orange-700/90 dark:text-orange-300 md:text-sm">Suspended</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['all', 'active', 'revoked', 'expired', 'suspended'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors md:px-4 ${
                activeFilter === filter
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Licenses List */}
        {licenses.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center md:p-12">
            <p className="text-lg font-semibold text-foreground">No licenses found.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Licenses will appear here when API clients request access to your data.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {licenses.map((license) => (
              <div
                key={license.id}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 md:p-6"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="mb-1 text-lg font-bold text-foreground md:text-xl">{license.api_client_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Type: <span className="text-foreground">{license.license_type}</span>
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold md:text-sm ${getStatusColor(license.status)}`}
                  >
                    {license.status.toUpperCase()}
                  </span>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-muted-foreground">Issued</div>
                    <div className="text-foreground">{formatDate(license.issued_at)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Expires</div>
                    <div className="text-foreground">{formatDate(license.expires_at)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Usage Count</div>
                    <div className="text-foreground">{license.usage_count}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Used</div>
                    <div className="text-foreground">{formatDate(license.last_used_at)}</div>
                  </div>
                </div>

                {/* Permissions Snapshot */}
                <details className="group">
                  <summary className="mb-2 flex list-none cursor-pointer items-center gap-2 text-sm text-primary hover:text-primary/80">
                    <span className="transform transition-transform group-open:rotate-90">▶</span>
                    View Granted Permissions
                  </summary>
                  <div className="mt-2 rounded-lg border border-border bg-muted p-4">
                    <pre className="overflow-x-auto text-xs text-foreground">
                      {JSON.stringify(license.granted_permissions_snapshot, null, 2)}
                    </pre>
                  </div>
                </details>

                {/* Revocation Info */}
                {license.status === 'revoked' && license.revocation_reason && (
                  <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                    <strong>Revoked:</strong> {license.revocation_reason}
                    {license.revoked_at && ` on ${formatDate(license.revoked_at)}`}
                  </div>
                )}

                {/* Actions */}
                {license.status === 'active' && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => {
                        // TODO: Implement revoke functionality
                        alert('Revoke license functionality coming soon');
                      }}
                      className="w-full rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 sm:w-auto"
                    >
                      Revoke License
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
