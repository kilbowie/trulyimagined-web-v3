import { auth0 } from '@/lib/auth0';
import { headers } from 'next/headers';

/**
 * Comprehensive Auth0 Roles Diagnostic Page
 *
 * This page checks EVERYTHING to diagnose why roles aren't working
 */
export default async function SuperDebugPage() {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">🔍 Auth0 Roles Super Debug</h1>
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
            <p className="text-red-800">You need to be logged in to use this diagnostic tool.</p>
            <a
              href="/auth/login"
              className="inline-block mt-4 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Log In
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Check roles in JWT
  const rolesInJWT = (user['https://trulyimagined.com/roles'] as string[]) || [];
  const hasRoleInJWT = rolesInJWT.length > 0;

  // Check Auth0 Management API for roles
  let rolesInAuth0: any[] = [];
  let auth0CheckError = null;
  let managementApiWorking = false;

  try {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;

    if (domain && clientId && clientSecret) {
      // Get Management API token
      const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          audience: `https://${domain}/api/v2/`,
        }),
      });

      if (tokenResponse.ok) {
        const { access_token } = await tokenResponse.json();

        // Get user's roles from Auth0
        const rolesResponse = await fetch(
          `https://${domain}/api/v2/users/${encodeURIComponent(user.sub)}/roles`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        );

        if (rolesResponse.ok) {
          rolesInAuth0 = await rolesResponse.json();
          managementApiWorking = true;
        } else {
          auth0CheckError = `Failed to fetch roles from Auth0: ${rolesResponse.status}`;
        }
      } else {
        auth0CheckError = `Failed to get Management API token: ${tokenResponse.status}`;
      }
    } else {
      auth0CheckError = 'Missing Auth0 credentials in environment variables';
    }
  } catch (error: any) {
    auth0CheckError = error.message;
  }

  const hasRolesInAuth0 = rolesInAuth0.length > 0;

  // Determine the issue
  let diagnosis = '';
  let solution = '';
  let severity: 'success' | 'warning' | 'error' = 'success';

  if (hasRoleInJWT && hasRolesInAuth0) {
    diagnosis = '✅ Everything is working perfectly!';
    solution = 'Roles are in Auth0 and in your JWT token. No action needed.';
    severity = 'success';
  } else if (!hasRolesInAuth0) {
    diagnosis = '❌ No roles assigned in Auth0';
    solution = 'You need to assign a role to your user in the Auth0 Dashboard.';
    severity = 'error';
  } else if (hasRolesInAuth0 && !hasRoleInJWT) {
    diagnosis = '❌ CRITICAL: Roles in Auth0 but NOT in JWT token';
    solution = 'The Auth0 Action is missing, not deployed, or not in the Login Flow.';
    severity = 'error';
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">🔍 Auth0 Roles Super Debug</h1>
          <a
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </a>
        </div>

        {/* Diagnosis Box */}
        <div
          className={`rounded-lg border-2 p-6 ${
            severity === 'success'
              ? 'bg-green-50 border-green-500'
              : severity === 'warning'
                ? 'bg-yellow-50 border-yellow-500'
                : 'bg-red-50 border-red-500'
          }`}
        >
          <h2 className="text-2xl font-bold mb-2">{diagnosis}</h2>
          <p
            className={`text-lg ${
              severity === 'success'
                ? 'text-green-800'
                : severity === 'warning'
                  ? 'text-yellow-800'
                  : 'text-red-800'
            }`}
          >
            {solution}
          </p>
        </div>

        {/* JWT Token Check */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">1️⃣ JWT Token Check</h2>
          <div className={`p-4 rounded ${hasRoleInJWT ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">{hasRoleInJWT ? '✅' : '❌'}</span>
              <span className="font-semibold">
                {hasRoleInJWT ? 'Roles found in JWT token' : 'No roles in JWT token'}
              </span>
            </div>
            {hasRoleInJWT ? (
              <div>
                <p className="text-sm text-gray-700 mb-2">Roles in your current JWT:</p>
                <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
                  {JSON.stringify(rolesInJWT, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-red-700">
                Your JWT token does not contain the custom claim{' '}
                <code>https://trulyimagined.com/roles</code>
              </p>
            )}
          </div>
        </div>

        {/* Auth0 Database Check */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">2️⃣ Auth0 Database Check</h2>
          <div className={`p-4 rounded ${hasRolesInAuth0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">{hasRolesInAuth0 ? '✅' : '❌'}</span>
              <span className="font-semibold">
                {hasRolesInAuth0 ? 'Roles found in Auth0 database' : 'No roles in Auth0 database'}
              </span>
            </div>
            {managementApiWorking ? (
              hasRolesInAuth0 ? (
                <div>
                  <p className="text-sm text-gray-700 mb-2">
                    Roles assigned to your user in Auth0:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {rolesInAuth0.map((role: any) => (
                      <li key={role.id} className="text-sm">
                        <strong>{role.name}</strong> ({role.id})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-red-700">
                  No roles are assigned to your user in Auth0. Go to Auth0 Dashboard → User
                  Management → Users → {user.email} → Roles tab to assign a role.
                </p>
              )
            ) : (
              <div className="text-sm text-gray-700">
                <p className="mb-2">⚠️ Could not check Auth0 directly:</p>
                <code className="block bg-white p-2 rounded text-xs text-red-600">
                  {auth0CheckError}
                </code>
              </div>
            )}
          </div>
        </div>

        {/* The Problem */}
        {hasRolesInAuth0 && !hasRoleInJWT && (
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-800 mb-4">🚨 THE PROBLEM</h2>
            <div className="space-y-4 text-gray-800">
              <p className="text-lg">
                <strong>You have roles in Auth0, but they're NOT in your JWT token.</strong>
              </p>
              <p>
                This means the <strong>"Add Roles to Token"</strong> Auth0 Action is either:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>
                  <strong>Not created</strong> - You need to create it in Auth0 Dashboard
                </li>
                <li>
                  <strong>Not deployed</strong> - It exists but says "Draft" instead of "Deployed"
                </li>
                <li>
                  <strong>Not in the Login Flow</strong> - It's deployed but not added to the flow
                </li>
                <li>
                  <strong>Has an error</strong> - Check Auth0 Dashboard → Monitoring → Logs
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Solution Steps */}
        {hasRolesInAuth0 && !hasRoleInJWT && (
          <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-blue-800 mb-4">🔧 HOW TO FIX</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Step 1: Check if Action Exists</h3>
                <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
                  <li>
                    Go to{' '}
                    <a
                      href="https://manage.auth0.com/"
                      target="_blank"
                      className="text-blue-600 underline"
                    >
                      Auth0 Dashboard
                    </a>
                  </li>
                  <li>
                    Navigate to <strong>Actions → Library</strong>
                  </li>
                  <li>
                    Look for <strong>"Add Roles to Token"</strong>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">If Action DOES NOT Exist:</h3>
                <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
                  <li>
                    Click <strong>"+ Build Custom"</strong> (blue button)
                  </li>
                  <li>
                    Name: <code className="bg-white px-2 py-1 rounded">Add Roles to Token</code>
                  </li>
                  <li>
                    Trigger: <code className="bg-white px-2 py-1 rounded">Login / Post Login</code>
                  </li>
                  <li>
                    Paste the code from{' '}
                    <code className="bg-white px-2 py-1 rounded">docs/FIX_ROLES_NOT_IN_JWT.md</code>
                  </li>
                  <li>
                    Click <strong>"Deploy"</strong> (top right)
                  </li>
                  <li>
                    Go to <strong>Actions → Flows → Login</strong>
                  </li>
                  <li>
                    <strong>DRAG</strong> the action into the flow between Start and Complete
                  </li>
                  <li>
                    Click <strong>"Apply"</strong>
                  </li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">If Action EXISTS but says "Draft":</h3>
                <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
                  <li>Click on the action</li>
                  <li>
                    Click <strong>"Deploy"</strong> button (top right)
                  </li>
                  <li>Wait for green "Deployed" status</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">
                  If Action is Deployed but roles still missing:
                </h3>
                <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
                  <li>
                    Go to <strong>Actions → Flows → Login</strong>
                  </li>
                  <li>Check if "Add Roles to Token" is in the flow diagram</li>
                  <li>
                    If not, <strong>DRAG</strong> it from the Custom tab into the flow
                  </li>
                  <li>
                    Click <strong>"Apply"</strong>
                  </li>
                  <li>
                    Log out:{' '}
                    <a href="/auth/logout" className="text-blue-600 underline">
                      /auth/logout
                    </a>
                  </li>
                  <li>
                    Log in:{' '}
                    <a href="/auth/login" className="text-blue-600 underline">
                      /auth/login
                    </a>
                  </li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Alternative Solution */}
        {hasRolesInAuth0 && !hasRoleInJWT && (
          <div className="bg-purple-50 border-2 border-purple-500 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-purple-800 mb-4">🔀 ALTERNATIVE SOLUTION</h2>
            <p className="text-gray-800 mb-4">
              If you're having trouble with Auth0 Actions, we can implement a{' '}
              <strong>database-backed role system</strong> instead:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2 text-sm text-gray-700 mb-4">
              <li>Store roles in your PostgreSQL database</li>
              <li>Check roles server-side using Auth0 user ID</li>
              <li>No dependency on JWT custom claims</li>
              <li>More flexible and easier to debug</li>
            </ul>
            <p className="text-sm text-gray-600 italic">
              Let me know if you want to implement this alternative approach.
            </p>
          </div>
        )}

        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">ℹ️ Your Account Info</h2>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Email:</strong> {user.email}
            </div>
            <div>
              <strong>Auth0 ID:</strong>{' '}
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">{user.sub}</code>
            </div>
            <div>
              <strong>Logged in at:</strong> {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">⚡ Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="/auth/logout"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Log Out
            </a>
            <a
              href="/auth/profile"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              View Raw Profile
            </a>
            <a
              href="/select-role"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Role Selection Page
            </a>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh This Page
            </button>
          </div>
        </div>

        {/* Full Debug Data */}
        <details className="bg-white rounded-lg shadow p-6">
          <summary className="cursor-pointer text-lg font-semibold text-gray-700 hover:text-gray-900">
            🔬 Full Debug Data (Click to Expand)
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Raw User Object from JWT:</h3>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
            {managementApiWorking && (
              <div>
                <h3 className="font-semibold mb-2">Roles from Auth0 Management API:</h3>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                  {JSON.stringify(rolesInAuth0, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
