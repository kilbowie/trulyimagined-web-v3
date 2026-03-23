import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';

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
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        
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
              {user.email_verified ? 'Yes' : 'No'}
            </div>
            <div>
              <span className="font-medium">Auth0 ID:</span> {user.sub}
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Roles & Permissions</h2>
          
          {roles.length > 0 ? (
            <div className="space-y-2">
              {roles.map((role) => (
                <div
                  key={role}
                  className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mr-2"
                >
                  {role}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No roles assigned</p>
          )}
          
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> If you don't see any roles, make sure you've completed
              the Auth0 setup in <code className="bg-yellow-100 px-1">docs/AUTH0_SETUP.md</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
