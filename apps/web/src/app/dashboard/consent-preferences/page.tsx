'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ConsentPolicy = {
  usage: {
    streaming: boolean;
    theatrical: boolean;
    commercial: boolean;
    educational: boolean;
    archival: boolean;
  };
  commercial: {
    paymentRequired: boolean;
    minFee?: number;
    revenueShare?: number;
  };
  constraints: {
    durationInDays?: number;
    expiryDate?: string;
    territory?: string[];
  };
  attributionRequired: boolean;
  aiControls: {
    trainingAllowed: boolean;
    syntheticGenerationAllowed: boolean;
    biometricAnalysisAllowed: boolean;
  };
};

type ConsentLedgerEntry = {
  id: string;
  actor_id: string;
  version: number;
  policy: ConsentPolicy;
  status: string;
  reason?: string;
  created_at: string;
};

export default function ConsentPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentConsent, setCurrentConsent] = useState<ConsentLedgerEntry | null>(null);

  const [policy, setPolicy] = useState<ConsentPolicy>({
    usage: {
      streaming: false,
      theatrical: false,
      commercial: false,
      educational: false,
      archival: false,
    },
    commercial: {
      paymentRequired: true,
      minFee: undefined,
      revenueShare: undefined,
    },
    constraints: {
      durationInDays: undefined,
      expiryDate: undefined,
      territory: [],
    },
    attributionRequired: true,
    aiControls: {
      trainingAllowed: false,
      syntheticGenerationAllowed: false,
      biometricAnalysisAllowed: false,
    },
  });

  const [reason, setReason] = useState('');

  // Load current consent on mount
  useEffect(() => {
    loadCurrentConsent();
  }, []);

  const loadCurrentConsent = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/consent-ledger/current');
      
      if (!res.ok) {
        throw new Error('Failed to load consent preferences');
      }

      const data = await res.json();
      
      if (data.current) {
        setCurrentConsent(data.current);
        setPolicy(data.current.policy);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/consent-ledger/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update consent');
      }

      const data = await res.json();
      setSuccess(`Consent updated successfully! Version ${data.entry.version} created.`);
      setReason('');
      
      // Reload current consent
      await loadCurrentConsent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update consent');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading consent preferences...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-purple-300 hover:text-purple-100 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">Consent Preferences</h1>
          <p className="text-gray-300">
            Manage how your digital identity and data can be used. Each change creates a new version.
          </p>
          {currentConsent && (
            <div className="mt-4 text-sm text-gray-400">
              Current Version: <span className="text-purple-300 font-semibold">{currentConsent.version}</span>
              {' • '}
              Updated: {new Date(currentConsent.created_at).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-300">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Usage Permissions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Usage Permissions</h2>
            <p className="text-gray-300 mb-6 text-sm">
              Select the types of usage you permit for your content and identity.
            </p>
            <div className="space-y-4">
              {Object.entries(policy.usage).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setPolicy({
                      ...policy,
                      usage: { ...policy.usage, [key]: e.target.checked }
                    })}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                  <span className="capitalize">{key}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Commercial Terms */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Commercial Terms</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.commercial.paymentRequired}
                  onChange={(e) => setPolicy({
                    ...policy,
                    commercial: { ...policy.commercial, paymentRequired: e.target.checked }
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span>Payment Required</span>
              </label>

              {policy.commercial.paymentRequired && (
                <div className="space-y-4 ml-8">
                  <div>
                    <label className="block text-white mb-2">Minimum Fee (USD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={policy.commercial.minFee || ''}
                      onChange={(e) => setPolicy({
                        ...policy,
                        commercial: {
                          ...policy.commercial,
                          minFee: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                      placeholder="e.g., 100.00"
                    />
                  </div>
                  <div>
                    <label className="block text-white mb-2">Revenue Share (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={policy.commercial.revenueShare || ''}
                      onChange={(e) => setPolicy({
                        ...policy,
                        commercial: {
                          ...policy.commercial,
                          revenueShare: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                      placeholder="e.g., 10.5"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Constraints */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Constraints</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-white mb-2">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={policy.constraints.durationInDays || ''}
                  onChange={(e) => setPolicy({
                    ...policy,
                    constraints: {
                      ...policy.constraints,
                      durationInDays: e.target.value ? parseInt(e.target.value) : undefined
                    }
                  })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  placeholder="e.g., 365"
                />
              </div>
              <div>
                <label className="block text-white mb-2">Expiry Date</label>
                <input
                  type="date"
                  value={policy.constraints.expiryDate || ''}
                  onChange={(e) => setPolicy({
                    ...policy,
                    constraints: {
                      ...policy.constraints,
                      expiryDate: e.target.value || undefined
                    }
                  })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-white mb-2">Territory (Comma-separated countries)</label>
                <input
                  type="text"
                  value={policy.constraints.territory?.join(', ') || ''}
                  onChange={(e) => setPolicy({
                    ...policy,
                    constraints: {
                      ...policy.constraints,
                      territory: e.target.value ? e.target.value.split(',').map(t => t.trim()) : []
                    }
                  })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
                  placeholder="e.g., USA, CAN, GBR"
                />
              </div>
            </div>
          </div>

          {/* Attribution */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Attribution</h2>
            <label className="flex items-center gap-3 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={policy.attributionRequired}
                onChange={(e) => setPolicy({
                  ...policy,
                  attributionRequired: e.target.checked
                })}
                className="w-5 h-5 rounded border-gray-300"
              />
              <span>Attribution Required</span>
            </label>
          </div>

          {/* AI Controls */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">AI Controls</h2>
            <p className="text-gray-300 mb-6 text-sm">
              Control how your data can be used with AI systems.
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-3 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.aiControls.trainingAllowed}
                  onChange={(e) => setPolicy({
                    ...policy,
                    aiControls: { ...policy.aiControls, trainingAllowed: e.target.checked }
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span>Allow AI Training</span>
              </label>
              <label className="flex items-center gap-3 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.aiControls.syntheticGenerationAllowed}
                  onChange={(e) => setPolicy({
                    ...policy,
                    aiControls: { ...policy.aiControls, syntheticGenerationAllowed: e.target.checked }
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span>Allow Synthetic Generation</span>
              </label>
              <label className="flex items-center gap-3 text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.aiControls.biometricAnalysisAllowed}
                  onChange={(e) => setPolicy({
                    ...policy,
                    aiControls: { ...policy.aiControls, biometricAnalysisAllowed: e.target.checked }
                  })}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span>Allow Biometric Analysis</span>
              </label>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <label className="block text-white mb-2">
              Reason for Update <span className="text-gray-400 text-sm">(Optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white"
              rows={3}
              placeholder="e.g., Updated commercial terms for new licensing model"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              {saving ? 'Saving...' : 'Update Consent Preferences'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/consent-history')}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-colors"
            >
              View History
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
