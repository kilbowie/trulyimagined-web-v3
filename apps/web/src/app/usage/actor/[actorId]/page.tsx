/**
 * Actor Usage Page
 *
 * View usage history for a specific actor
 * /usage/actor/[actorId]
 */

'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';

interface UsageRecord {
  id: string;
  usage_type: string;
  quantity: number;
  unit: string;
  project_name?: string;
  generated_by?: string;
  created_at: string;
  licensing_request_id?: string;
}

interface UsageStats {
  usage_type: string;
  unit: string;
  total_quantity: number;
  total_records: number;
  first_usage: string;
  last_usage: string;
}

interface ActorUsageData {
  actor: {
    id: string;
    name: string;
  };
  usage: UsageRecord[];
  stats: UsageStats[];
  totalMinutes: number;
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}

export default function ActorUsagePage({ params }: { params: { actorId: string } }) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [data, setData] = useState<ActorUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/api/auth/login');
      return;
    }

    if (user && params.actorId) {
      fetchActorUsage();
    }
  }, [user, isLoading, params.actorId, router]);

  async function fetchActorUsage() {
    try {
      const response = await fetch(`/api/usage/actor/${params.actorId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Actor not found');
        }
        throw new Error('Failed to fetch usage data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading usage data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <div className="text-red-600 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={() => router.push('/usage')}
              className="mt-4 text-blue-600 hover:underline"
            >
              Return to Usage Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { actor, usage, stats, totalMinutes } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{actor.name}</h1>
              <p className="mt-1 text-sm text-gray-600">Usage History</p>
            </div>
            <button
              onClick={() => router.push('/usage')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Voice Minutes</h3>
            <div className="text-3xl font-bold text-gray-900 mt-2">
              {totalMinutes.toLocaleString()}
            </div>
            <p className="text-sm text-gray-500 mt-1">across all projects</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600">Total Usage Events</h3>
            <div className="text-3xl font-bold text-gray-900 mt-2">{usage.length}</div>
            <p className="text-sm text-gray-500 mt-1">tracked records</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-600">Usage Types</h3>
            <div className="text-3xl font-bold text-gray-900 mt-2">{stats.length}</div>
            <p className="text-sm text-gray-500 mt-1">different types</p>
          </div>
        </div>

        {/* Stats by Type */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage Breakdown</h2>
          <div className="space-y-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-gray-900">
                    {stat.usage_type.replace('_', ' ').toUpperCase()}
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">
                    {parseFloat(stat.total_quantity.toString()).toLocaleString()} {stat.unit}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{stat.total_records} records</span>
                  <span>
                    {new Date(stat.first_usage).toLocaleDateString()} -{' '}
                    {new Date(stat.last_usage).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage History */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage History</h2>
          {usage.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-500">No usage records yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Generated By
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usage.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {record.usage_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.quantity} {record.unit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.project_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.generated_by || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
