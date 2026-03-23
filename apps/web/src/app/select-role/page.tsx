'use client';

import { useState, useEffect } from 'react';

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
  const [step, setStep] = useState<'role' | 'details'>('role');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [legalName, setLegalName] = useState('');
  const [professionalName, setProfessionalName] = useState('');
  const [useLegalAsProfessional, setUseLegalAsProfessional] = useState(false);
  const [spotlightId, setSpotlightId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [profNameError, setProfNameError] = useState<string | null>(null);

  // Auto-fill professional name when checkbox is toggled
  useEffect(() => {
    if (useLegalAsProfessional && legalName) {
      setProfessionalName(legalName);
    }
  }, [useLegalAsProfessional, legalName]);

  // Validate username format
  function validateUsername(value: string): string | null {
    if (!value) return 'Username is required';
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 50) return 'Username must be 50 characters or less';
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Username can only contain letters, numbers, underscores, and hyphens';
    return null;
  }

  // Validate Spotlight ID format
  function validateSpotlightId(value: string): string | null {
    if (!value) return null; // Optional field
    if (!value.match(/^https?:\/\/.+/)) return 'Must be a valid URL (starting with http:// or https://)';
    return null;
  }

  async function handleRoleSelect(roleId: string) {
    setSelectedRole(roleId);
    setError(null);
    setStep('details');
  }

  async function handleSubmit() {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    // Validate required fields
    const usernameValidation = validateUsername(username);
    if (usernameValidation) {
      setUsernameError(usernameValidation);
      return;
    }

    if (!legalName.trim()) {
      setError('Legal name is required');
      return;
    }

    const finalProfessionalName = useLegalAsProfessional ? legalName : professionalName;
    if (!finalProfessionalName.trim()) {
      setError('Professional name is required');
      return;
    }

    // Validate Spotlight ID if provided
    const spotlightValidation = validateSpotlightId(spotlightId);
    if (spotlightValidation) {
      setError(spotlightValidation);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: selectedRole,
          username,
          legalName,
          professionalName: finalProfessionalName,
          useLegalAsProfessional,
          spotlightId: spotlightId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create profile');
      }

      // Success! Profile created
      setSuccess(true);

      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
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
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Profile Created Successfully!</h2>
            <p className="text-lg text-gray-600 mb-2">
              Welcome to Truly Imagined, <strong>{username}</strong>!
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Redirecting you to your dashboard...
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
        ) : step === 'role' ? (
          // Step 1: Role Selection
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to Truly Imagined</h1>
              <p className="text-lg text-gray-600">
                Let's set up your profile. First, please select your role:
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-6">
              {AVAILABLE_ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  disabled={loading}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <div className="text-5xl mb-3">{role.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{role.name}</h3>
                  <p className="text-sm text-gray-600">{role.description}</p>
                </button>
              ))}
            </div>
          </>
        ) : (
          // Step 2: Profile Details
          <>
            <div className="mb-8">
              <button
                onClick={() => setStep('role')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to role selection
              </button>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
              <p className="text-lg text-gray-600">
                You selected: <strong>{AVAILABLE_ROLES.find(r => r.id === selectedRole)?.name}</strong>
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(null);
                  }}
                  onBlur={() => setUsernameError(validateUsername(username))}
                  placeholder="johndoe"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    usernameError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
                {usernameError && (
                  <p className="mt-1 text-sm text-red-600">{usernameError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  3-50 characters. Letters, numbers, underscores, and hyphens only.
                </p>
              </div>

              {/* Legal Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your legal name as it appears on official documents.
                </p>
              </div>

              {/* Professional Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Professional Name <span className="text-red-500">*</span>
                </label>
                <div className="mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useLegalAsProfessional}
                      onChange={(e) => setUseLegalAsProfessional(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                      disabled={loading}
                    />
                    <span className="text-sm text-gray-700">Same as legal name</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={professionalName}
                  onChange={(e) => {
                    setProfessionalName(e.target.value);
                    setProfNameError(null);
                  }}
                  placeholder="John Doe"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    profNameError ? 'border-red-300' : 'border-gray-300'
                  }`}
                  disabled={loading || useLegalAsProfessional}
                />
                {profNameError && (
                  <p className="mt-1 text-sm text-red-600">{profNameError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  The name you use professionally (stage name, business name, etc.)
                </p>
              </div>

              {/* Spotlight ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Spotlight ID <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="url"
                  value={spotlightId}
                  onChange={(e) => setSpotlightId(e.target.value)}
                  placeholder="https://www.spotlight.com/..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your Spotlight profile URL (if applicable)
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`
                    px-8 py-3 rounded-lg font-semibold text-white text-lg
                    transition-all duration-200
                    ${
                      loading
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
                      Creating profile...
                  </span>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
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
