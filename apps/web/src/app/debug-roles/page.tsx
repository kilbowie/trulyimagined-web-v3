import { getCurrentUser, getUserRoles, getUserProfile } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';

/**
 * Roles Debug Page
 *
 * Shows raw user session data to diagnose role assignment issues
 */
export default async function DebugRolesPage() {
  // Prevent access in production
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const profile = await getUserProfile();

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

        {/* Important Notice */}
        <div className="bg-blue-50 border-2 border-blue-500 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-blue-800">
            ℹ️ Important: Roles Now Stored in PostgreSQL
          </h2>
          <p className="text-gray-700">
            As of the latest update, <strong>roles are stored in the PostgreSQL database</strong>,
            not in JWT tokens. The application checks your role from the{' '}
            <code className="bg-white px-1 py-0.5 rounded">user_profiles</code> table. JWT roles (if
            present) are shown below for reference only.
          </p>
        </div>

        {/* Diagnosis Result - Database */}
        <div
          className={`rounded-lg shadow p-6 mb-6 ${
            profile && profile.role
              ? 'bg-green-50 border-2 border-green-500'
              : 'bg-red-50 border-2 border-red-500'
          }`}
        >
          <h2 className="text-2xl font-bold mb-2">
            {profile && profile.role ? '✅ Database Role Found!' : '❌ No Database Role Found'}
          </h2>
          <p className="text-gray-700">
            {profile && profile.role
              ? `Your account has the role: ${profile.role} (stored in PostgreSQL)`
              : 'Your account has no role assigned in the database. You may need to complete profile setup.'}
          </p>
        </div>

        {/* Database Profile */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📊 Database Profile (Primary Source)</h2>
          {profile ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-medium">Role:</div>
                <div className="bg-green-100 px-2 py-1 rounded inline-block font-semibold">
                  {profile.role}
                </div>

                <div className="font-medium">Username:</div>
                <div>{profile.username || 'N/A'}</div>

                <div className="font-medium">Legal Name:</div>
                <div>{profile.legal_name || 'N/A'}</div>

                <div className="font-medium">Professional Name:</div>
                <div>{profile.professional_name || 'N/A'}</div>

                <div className="font-medium">Spotlight ID:</div>
                <div>{profile.spotlight_id || 'N/A'}</div>
              </div>

              <details className="mt-4">
                <summary className="text-blue-600 hover:text-blue-700 cursor-pointer">
                  View full profile data
                </summary>
                <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-xs mt-2">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-300 rounded p-4">
              <p className="text-orange-800">
                No profile found in database. Please complete your profile setup at{' '}
                <a href="/select-role" className="text-blue-600 underline">
                  /select-role
                </a>
              </p>
            </div>
          )}
        </div>

        {/* What roles are detected */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">getUserRoles() Result (Database)</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify(roles, null, 2)}
          </pre>
        </div>

        {/* Custom Claims Check */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            JWT Custom Claims (Deprecated - Reference Only)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            ⚠️ The application no longer uses JWT roles for authorization. This section shows JWT
            claims for debugging purposes only.
          </p>

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
        {(!profile || !profile.role) && (
          <div className="bg-orange-50 border-2 border-orange-500 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-orange-800">
              🔧 Troubleshooting: Why is my role not showing?
            </h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold mb-2">1. Have you completed your profile setup?</h3>
                <p className="mb-2">
                  Roles are now stored in the PostgreSQL database, not in JWT tokens. To set your
                  role:
                </p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>
                    Go to{' '}
                    <a href="/select-role" className="text-blue-600 underline">
                      /select-role
                    </a>
                  </li>
                  <li>Choose your role (Actor, Agent, Enterprise)</li>
                  <li>Complete the profile form with your details</li>
                  <li>Submit the form to save your profile and role to the database</li>
                  <li>Come back to this page to verify your role is saved</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. Did the profile form submission succeed?</h3>
                <p className="mb-2">Check that:</p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>You received a success message after submitting the form</li>
                  <li>You were redirected to the dashboard</li>
                  <li>No errors appeared during submission</li>
                  <li>The database connection is working (check server logs for SSL errors)</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Is the database connection working?</h3>
                <p className="mb-2">
                  The application needs to connect to PostgreSQL to retrieve your role. Check:
                </p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>TI_DATABASE_URL is configured in .env.local (or legacy DATABASE_URL)</li>
                  <li>SSL configuration is enabled for AWS RDS connection</li>
                  <li>Server logs don't show "no pg_hba.conf entry" errors</li>
                  <li>The user_profiles table exists in the database</li>
                </ol>
              </div>

              <div className="mt-6 p-4 bg-white rounded border border-orange-300">
                <p className="font-semibold mb-2">📋 Quick Checklist:</p>
                <ul className="space-y-1">
                  <li>☐ Profile form completed at /select-role</li>
                  <li>☐ Role selected (Actor, Agent, or Enterprise)</li>
                  <li>☐ Form submitted successfully without errors</li>
                  <li>☐ Database connection working (no SSL errors)</li>
                  <li>☐ user_profiles table has your record</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {profile && profile.role && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-800">
              ✅ Everything is working correctly!
            </h2>
            <p className="text-gray-800 mb-4">
              Your role is properly configured and stored in the PostgreSQL database. The dashboard
              and feature access control will use this role from the database.
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
