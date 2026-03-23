'use client';

import { useState } from 'react';

interface Role {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const AVAILABLE_ROLES: Role[] = [
  {
    id: 'Actor',
    name: 'Actor',
    description: 'I am a performer or talent seeking to manage my digital identity and consent',
    icon: '🎭',
  },
  {
    id: 'Agent',
    name: 'Agent',
    description: 'I represent talent and help manage their professional relationships',
    icon: '👔',
  },
  {
    id: 'Enterprise',
    name: 'Enterprise',
    description: 'I represent a production company, studio, or corporate entity',
    icon: '🏢',
  },
];

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selectedRole) {
      setError('Please select a role to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to assign role');
      }

      // Success! Role assigned in Auth0
      setSuccess(true);
      
      // Wait 2 seconds to show success message, then log out to refresh JWT token
      setTimeout(() => {
        // Redirect to logout - this will clear the session and redirect to homepage
        // User can then log in again to get a fresh JWT with the new role
        window.location.href = '/auth/logout';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl p-8">
        {success ? (
          // Success State
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Role Assigned Successfully!</h2>
            <p className="text-lg text-gray-600 mb-2">
              Your <strong>{selectedRole}</strong> role has been activated in Auth0.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Logging you out to refresh your credentials...
            </p>
            <p className="text-xs text-gray-400 mb-6">
              You'll be able to log back in immediately with the same credentials.
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Please wait...</span>
            </div>
          </div>
        ) : (
          // Role Selection State
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to Truly Imagined</h1>
              <p className="text-lg text-gray-600">
                Let's set up your profile. Please select your role:
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {AVAILABLE_ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  disabled={loading}
                  className={`
                    p-6 rounded-xl border-2 transition-all duration-200
                    ${
                      selectedRole === role.id
                        ? 'border-blue-600 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }
                    ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="text-5xl mb-3">{role.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{role.name}</h3>
                  <p className="text-sm text-gray-600">{role.description}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleSubmit}
                disabled={!selectedRole || loading}
                className={`
                  px-8 py-3 rounded-lg font-semibold text-white text-lg
                  transition-all duration-200
                  ${
                    !selectedRole || loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
                  }
                `}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Assigning role...
                  </span>
                ) : (
                  'Continue'
                )}
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              <p>You can change your role later in your profile settings</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
