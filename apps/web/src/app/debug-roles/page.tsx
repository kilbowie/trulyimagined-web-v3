import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * Roles Debug Page
 *
 * Shows raw user session data to diagnose role assignment issues
 */
export default async function DebugRolesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();

  // Check for roles in different possible locations
  const customClaimsRoles = user['https://trulyimagined.com/roles'];
  const customClaimsHasRole = user['https://trulyimagined.com/hasRole'];

  // Get all custom claims (keys that look like URLs)
  const customClaims = Object.keys(user).filter((key) => key.startsWith('http'));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🔍 Roles Debug Page</h1>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </a>
        </div>

        {/* Diagnosis Result */}
        <div
          className={`rounded-lg shadow p-6 mb-6 ${
            roles.length > 0
              ? 'bg-green-50 border-2 border-green-500'
              : 'bg-red-50 border-2 border-red-500'
          }`}
        >
          <h2 className="text-2xl font-bold mb-2">
            {roles.length > 0 ? '✅ Roles Found!' : '❌ No Roles Found'}
          </h2>
          <p className="text-gray-700">
            {roles.length > 0
              ? `Your account has ${roles.length} role(s) assigned: ${roles.join(', ')}`
              : 'Your account has no roles assigned in the JWT token.'}
          </p>
        </div>

        {/* What roles are detected */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">getUserRoles() Result</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify(roles, null, 2)}
          </pre>
        </div>

        {/* Custom Claims Check */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Custom Claims Check</h2>

          <div className="space-y-4">
            <div>
              <div className="font-medium mb-2">
                Looking for:{' '}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  https://trulyimagined.com/roles
                </code>
              </div>
              <div className={`p-3 rounded ${customClaimsRoles ? 'bg-green-50' : 'bg-red-50'}`}>
                {customClaimsRoles ? (
                  <>
                    <div className="font-semibold text-green-700 mb-2">✅ Found!</div>
                    <pre className="bg-white p-2 rounded text-sm overflow-x-auto">
                      {JSON.stringify(customClaimsRoles, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div className="font-semibold text-red-700">❌ Not found in token</div>
                )}
              </div>
            </div>

            <div>
              <div className="font-medium mb-2">
                Looking for:{' '}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  https://trulyimagined.com/hasRole
                </code>
              </div>
              <div
                className={`p-3 rounded ${customClaimsHasRole !== undefined ? 'bg-green-50' : 'bg-gray-50'}`}
              >
                {customClaimsHasRole !== undefined ? (
                  <>
                    <div className="font-semibold text-green-700 mb-2">✅ Found!</div>
                    <pre className="bg-white p-2 rounded text-sm">
                      {JSON.stringify(customClaimsHasRole, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div className="font-semibold text-gray-700">⚠️ Not found (optional)</div>
                )}
              </div>
            </div>

            {customClaims.length > 0 && (
              <div>
                <div className="font-medium mb-2">All Custom Claims Found:</div>
                <div className="bg-blue-50 p-3 rounded">
                  <ul className="list-disc list-inside space-y-1">
                    {customClaims.map((claim) => (
                      <li key={claim} className="text-sm">
                        <code className="bg-white px-2 py-1 rounded">{claim}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Full User Object */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Full User Session Object</h2>
          <details className="cursor-pointer">
            <summary className="text-blue-600 hover:text-blue-700 mb-2">
              Click to expand raw user data
            </summary>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-xs">
              {JSON.stringify(user, null, 2)}
            </pre>
          </details>
        </div>

        {/* Troubleshooting Guide */}
        {roles.length === 0 && (
          <div className="bg-orange-50 border-2 border-orange-500 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-orange-800">
              🔧 Troubleshooting: Why aren't my roles showing?
            </h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold mb-2">1. Have you logged out and back in?</h3>
                <p className="mb-2">
                  Roles are added to your JWT token during login. If you assigned roles in Auth0 but
                  are still logged in, you need to:
                </p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>
                    Click here:{' '}
                    <a href="/auth/logout" className="text-blue-600 underline">
                      /auth/logout
                    </a>
                  </li>
                  <li>
                    Then log back in:{' '}
                    <a href="/auth/login" className="text-blue-600 underline">
                      /auth/login
                    </a>
                  </li>
                  <li>Come back to this page to check again</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">
                  2. Did you create the "Add Roles to Token" Action?
                </h3>
                <p className="mb-2">Required steps in Auth0 Dashboard:</p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>Go to Actions → Library → Build Custom</li>
                  <li>Name: "Add Roles to Token"</li>
                  <li>Trigger: Login / Post Login</li>
                  <li>
                    Add the code from{' '}
                    <code className="bg-white px-2 py-1 rounded">docs/AUTH0_ROLE_SETUP.md</code>
                  </li>
                  <li>
                    Click <strong>Deploy</strong> (top right)
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Did you add the Action to the Login Flow?</h3>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>Go to Actions → Flows → Login</li>
                  <li>Drag "Add Roles to Token" between Start and Complete</li>
                  <li>
                    Click <strong>Apply</strong>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4. Are roles assigned in Auth0?</h3>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>Go to User Management → Users</li>
                  <li>
                    Find your user: <strong>{user.email}</strong>
                  </li>
                  <li>Click Roles tab</li>
                  <li>Make sure at least one role is assigned</li>
                </ol>
              </div>

              <div className="mt-6 p-4 bg-white rounded border border-orange-300">
                <p className="font-semibold mb-2">📋 Quick Checklist:</p>
                <ul className="space-y-1">
                  <li>☐ Roles created in Auth0 (Admin, Actor, Agent, Enterprise)</li>
                  <li>
                    ☐ Role assigned to user <strong>{user.email}</strong> in Auth0 Dashboard
                  </li>
                  <li>☐ "Add Roles to Token" Action created</li>
                  <li>☐ Action deployed (green Deploy button)</li>
                  <li>☐ Action added to Login Flow</li>
                  <li>☐ Logged out and logged back in</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {roles.length > 0 && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-800">
              ✅ Everything is working correctly!
            </h2>
            <p className="text-gray-800 mb-4">
              Your roles are properly configured and showing in the JWT token. The dashboard should
              display your role(s).
            </p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Go to Dashboard
            </a>
          </div>
        )}

        {/* Meta Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Auth0 ID: {user.sub}</p>
          <p>Email: {user.email}</p>
        </div>
      </div>
    </div>
  );
}
