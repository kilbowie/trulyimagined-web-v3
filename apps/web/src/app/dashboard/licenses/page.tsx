'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface License {
  id: string;
  actor_id: string;
  requester_name: string;
  requester_email: string;
  requester_organization?: string;
  project_name: string;
  project_description: string;
  usage_type: string;
  intended_use: string;
  duration_start?: string;
  duration_end?: string;
  compensation_offered?: string;
  compensation_currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'expired' | 'revoked';
  requested_at: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  approved_by?: string;
  rejected_reason?: string;
  issued_at?: string;
  expires_at?: string;
  revoked_at?: string;
  revocation_reason?: string;
  granted_permissions_snapshot?: Record<string, unknown>;
  usage_count: number;
  last_used_at?: string;
}

interface LicenseStats {
  total: number;
  pending: number;
  approved: number;
  active: number;
  expired: number;
  revoked: number;
}

export default function LicensesPage() {
  const router = useRouter();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/licenses/actor?limit=100', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch licenses');
      }

      setLicenses(data.data?.licenses || []);
    } catch (err) {
      console.error('[LICENSES_PAGE] Error fetching licenses:', err);
      setError(err instanceof Error ? err.message : 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  };

  const stats: LicenseStats = useMemo(() => {
    return {
      total: licenses.length,
      pending: licenses.filter((l) => l.status === 'pending').length,
      approved: licenses.filter((l) => l.status === 'approved').length,
      active: licenses.filter((l) => l.status === 'active').length,
      expired: licenses.filter((l) => l.status === 'expired').length,
      revoked: licenses.filter((l) => l.status === 'revoked').length,
    };
  }, [licenses]);

  const getStatusBadgeClass = (status: License['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'expired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      case 'revoked':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-slate-100 dark:from-slate-950 dark:via-background dark:to-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-20">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 text-sm text-primary hover:text-primary/80"
          >
            ← Back to Dashboard
          </button>

          <h1 className="mb-2 text-3xl font-bold text-foreground">License Management</h1>
          <p className="text-muted-foreground">
            Manage licenses granted for your digital likeness and voice
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.expired}</div>
            <div className="text-sm text-muted-foreground">Expired</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-bold text-red-600">{stats.revoked}</div>
            <div className="text-sm text-muted-foreground">Revoked</div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : licenses.length === 0 ? (
          /* Empty State */
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="mb-4 text-4xl">📜</div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">No Licenses Yet</h3>
            <p className="text-muted-foreground">
              You haven&apos;t granted any licenses for your digital likeness yet.
            </p>
          </div>
        ) : (
          /* License List */
          <div className="space-y-4">
            {licenses.map((license) => (
              <div
                key={license.id}
                className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
              >
                {/* License Header */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="mb-1 text-lg font-semibold text-foreground">
                      {license.project_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Requested by {license.requester_name}
                      {license.requester_organization && ` (${license.requester_organization})`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${getStatusBadgeClass(license.status)}`}
                  >
                    {license.status}
                  </span>
                </div>

                {/* License Details */}
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <div className="text-muted-foreground">Usage Type</div>
                    <div className="text-foreground capitalize">{license.usage_type.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Compensation</div>
                    <div className="text-foreground">
                      {license.compensation_offered
                        ? `${license.compensation_currency} ${license.compensation_offered}`
                        : 'Not specified'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Requested</div>
                    <div className="text-foreground">{formatDate(license.requested_at)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Status Updated</div>
                    <div className="text-foreground">{formatDate(license.reviewed_at || license.issued_at)}</div>
                  </div>
                </div>

                {/* Active License Metadata */}
                {(license.status === 'active' || license.status === 'expired') && (
                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm md:grid-cols-4">
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
                )}

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
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="w-full cursor-not-allowed rounded-lg bg-destructive/60 px-4 py-2 text-sm font-semibold text-destructive-foreground opacity-70 sm:w-auto"
                      title="Manual revocation flow is not in launch scope."
                    >
                      Revoke License (Post-Launch)
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Manual revocation is intentionally deferred from launch scope and is tracked for the next delivery phase.
                    </p>
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
