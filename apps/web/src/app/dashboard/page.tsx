import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

/**
 * Protected Dashboard Page
 *
 * Shows user info and role-based access
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const hasActorRole = roles.includes('Actor');
  const hasAgentRole = roles.includes('Agent');
  const hasAdminRole = roles.includes('Admin');
  const hasEnterpriseRole = roles.includes('Enterprise');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Link href="/" className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
            ← Home
          </Link>
        </div>

        {/* User Profile Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Profile</h2>

          <div className="space-y-2">
            <div>
              <span className="font-medium">Name:</span> {user.name || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Email:</span> {user.email}
            </div>
            <div>
              <span className="font-medium">Email Verified:</span>{' '}
              {user.email_verified ? '✅ Yes' : '❌ No'}
            </div>
          </div>
        </div>

        {/* Roles & Permissions Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Roles & Permissions</h2>

          {roles.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => {
                  const roleConfig: Record<string, { emoji: string; color: string }> = {
                    Actor: {
                      emoji: '🎭',
                      color: 'bg-purple-100 text-purple-800 border-purple-200',
                    },
                    Agent: { emoji: '👔', color: 'bg-blue-100 text-blue-800 border-blue-200' },
                    Enterprise: {
                      emoji: '🏢',
                      color: 'bg-green-100 text-green-800 border-green-200',
                    },
                    Admin: { emoji: '⚙️', color: 'bg-red-100 text-red-800 border-red-200' },
                  };

                  const config = roleConfig[role] || {
                    emoji: '👤',
                    color: 'bg-gray-100 text-gray-800 border-gray-200',
                  };

                  return (
                    <div
                      key={role}
                      className={`inline-flex items-center px-4 py-2 rounded-lg border ${config.color} font-medium`}
                    >
                      <span className="mr-2">{config.emoji}</span>
                      {role}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Your access level:</strong>
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  {hasActorRole && <li>• Register identity and manage consent</li>}
                  {hasAgentRole && <li>• Manage actor clients and licensing</li>}
                  {hasEnterpriseRole && <li>• Request licenses and view usage</li>}
                  {hasAdminRole && <li>• Full system administration access</li>}
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-500">No roles found in your session</p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 mb-3">
                  <strong>⚠️ Roles are missing from your JWT token</strong>
                </p>
                <p className="text-sm text-red-700 mb-4">
                  This usually means the Auth0 Action isn't set up correctly.
                </p>
                <Link
                  href="/debug-roles"
                  className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Debug Roles Issue →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Role-Specific Actions */}
        {roles.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Actor Actions */}
              {hasActorRole && (
                <>
                  <Link
                    href="/register-actor"
                    className="block p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
                  >
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">🎭</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">Register Identity</h3>
                        <p className="text-sm text-gray-600">
                          Add your profile to the Identity Registry
                        </p>
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/consents"
                    className="block p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
                  >
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">✅</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">Manage Consents</h3>
                        <p className="text-sm text-gray-600">
                          View and manage your identity usage permissions
                        </p>
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/verify-identity"
                    className="block p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all"
                  >
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">🔐</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">Verify Identity</h3>
                        <p className="text-sm text-gray-600">
                          Link external providers to increase verification level
                        </p>
                      </div>
                    </div>
                  </Link>
                </>
              )}

              {/* Agent Actions */}
              {hasAgentRole && (
                <div className="block p-4 border-2 border-blue-200 rounded-lg bg-gray-50">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">👔</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Agent Dashboard</h3>
                      <p className="text-sm text-gray-500">Coming soon...</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Enterprise Actions */}
              {hasEnterpriseRole && (
                <div className="block p-4 border-2 border-green-200 rounded-lg bg-gray-50">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">🏢</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">License Requests</h3>
                      <p className="text-sm text-gray-500">Coming soon...</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {hasAdminRole && (
                <div className="block p-4 border-2 border-red-200 rounded-lg bg-gray-50">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">⚙️</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Admin Panel</h3>
                      <p className="text-sm text-gray-500">Coming soon...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debug Links */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <Link href="/debug-roles" className="hover:text-gray-700 underline">
            Debug Roles
          </Link>
          {' • '}
          <Link href="/auth/profile" className="hover:text-gray-700 underline">
            View Raw Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
