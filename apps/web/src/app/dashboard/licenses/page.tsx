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
      
      const url = activeFilter === 'all' 
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
      case 'active': return 'text-green-400 bg-green-500/20 border-green-500';
      case 'revoked': return 'text-red-400 bg-red-500/20 border-red-500';
      case 'expired': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      case 'suspended': return 'text-orange-400 bg-orange-500/20 border-orange-500';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading licenses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-purple-300 hover:text-purple-100 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">License Tracker</h1>
          <p className="text-gray-300">
            Monitor and manage licenses granted to API clients for your data and content.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="text-3xl font-bold text-white mb-2">{stats.total}</div>
            <div className="text-gray-300 text-sm">Total Licenses</div>
          </div>
          <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-6 border border-green-500">
            <div className="text-3xl font-bold text-green-300 mb-2">{stats.active}</div>
            <div className="text-green-200 text-sm">Active</div>
          </div>
          <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-6 border border-red-500">
            <div className="text-3xl font-bold text-red-300 mb-2">{stats.revoked}</div>
            <div className="text-red-200 text-sm">Revoked</div>
          </div>
          <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-6 border border-yellow-500">
            <div className="text-3xl font-bold text-yellow-300 mb-2">{stats.expired}</div>
            <div className="text-yellow-200 text-sm">Expired</div>
          </div>
          <div className="bg-orange-500/20 backdrop-blur-sm rounded-xl p-6 border border-orange-500">
            <div className="text-3xl font-bold text-orange-300 mb-2">{stats.suspended}</div>
            <div className="text-orange-200 text-sm">Suspended</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'active', 'revoked', 'expired', 'suspended'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                activeFilter === filter
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Licenses List */}
        {licenses.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 border border-white/20 text-center">
            <p className="text-gray-300 text-lg">No licenses found.</p>
            <p className="text-gray-400 text-sm mt-2">
              Licenses will appear here when API clients request access to your data.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {licenses.map((license) => (
              <div
                key={license.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-purple-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {license.api_client_name}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Type: <span className="text-gray-300">{license.license_type}</span>
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(license.status)}`}>
                    {license.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <div className="text-gray-400">Issued</div>
                    <div className="text-white">{formatDate(license.issued_at)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Expires</div>
                    <div className="text-white">{formatDate(license.expires_at)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Usage Count</div>
                    <div className="text-white">{license.usage_count}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Last Used</div>
                    <div className="text-white">{formatDate(license.last_used_at)}</div>
                  </div>
                </div>

                {/* Permissions Snapshot */}
                <details className="group">
                  <summary className="cursor-pointer text-purple-300 hover:text-purple-100 text-sm mb-2 list-none flex items-center gap-2">
                    <span className="transform transition-transform group-open:rotate-90">▶</span>
                    View Granted Permissions
                  </summary>
                  <div className="bg-black/30 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(license.granted_permissions_snapshot, null, 2)}
                    </pre>
                  </div>
                </details>

                {/* Revocation Info */}
                {license.status === 'revoked' && license.revocation_reason && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-sm text-red-300">
                    <strong>Revoked:</strong> {license.revocation_reason}
                    {license.revoked_at && ` on ${formatDate(license.revoked_at)}`}
                  </div>
                )}

                {/* Actions */}
                {license.status === 'active' && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => {
                        // TODO: Implement revoke functionality
                        alert('Revoke license functionality coming soon');
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
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
