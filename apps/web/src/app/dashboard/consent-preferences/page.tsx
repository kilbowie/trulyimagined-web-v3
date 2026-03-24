'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TerritoryMap, { COUNTRIES_BY_CONTINENT } from '@/components/TerritoryMap';

type PermissionLevel = 'allow' | 'require_approval' | 'deny';

type ConsentPolicy = {
  mediaUsage: {
    film: PermissionLevel;
    television: PermissionLevel;
    streaming: PermissionLevel;
    gaming: PermissionLevel;
    voiceReplication: PermissionLevel;
    virtualReality: PermissionLevel;
    socialMedia: PermissionLevel;
    advertising: PermissionLevel;
    merchandise: PermissionLevel;
    livePerformance: PermissionLevel;
  };
  contentTypes: {
    explicit: PermissionLevel;
    political: PermissionLevel;
    religious: PermissionLevel;
    violence: PermissionLevel;
    alcohol: PermissionLevel;
    tobacco: PermissionLevel;
    gambling: PermissionLevel;
    pharmaceutical: PermissionLevel;
    firearms: PermissionLevel;
    adultContent: PermissionLevel;
  };
  territories: {
    allowed: string[];
    denied: string[];
  };
  aiControls: {
    trainingAllowed: boolean;
    syntheticGenerationAllowed: boolean;
    biometricAnalysisAllowed: boolean;
  };
  commercial: {
    paymentRequired: boolean;
    minFee?: number;
    revenueShare?: number;
  };
  attributionRequired: boolean;
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
  const [licenseCount, setLicenseCount] = useState<number>(0);

  const [policy, setPolicy] = useState<ConsentPolicy>({
    mediaUsage: {
      film: 'require_approval',
      television: 'require_approval',
      streaming: 'require_approval',
      gaming: 'require_approval',
      voiceReplication: 'deny',
      virtualReality: 'require_approval',
      socialMedia: 'require_approval',
      advertising: 'require_approval',
      merchandise: 'require_approval',
      livePerformance: 'require_approval',
    },
    contentTypes: {
      explicit: 'deny',
      political: 'require_approval',
      religious: 'require_approval',
      violence: 'require_approval',
      alcohol: 'require_approval',
      tobacco: 'deny',
      gambling: 'deny',
      pharmaceutical: 'require_approval',
      firearms: 'deny',
      adultContent: 'deny',
    },
    territories: {
      allowed: [],
      denied: [],
    },
    aiControls: {
      trainingAllowed: false,
      syntheticGenerationAllowed: false,
      biometricAnalysisAllowed: false,
    },
    commercial: {
      paymentRequired: true,
      minFee: undefined,
      revenueShare: undefined,
    },
    attributionRequired: true,
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
        // Merge loaded policy with defaults to ensure all fields exist (backward compatibility)
        const loadedPolicy = data.current.policy;
        setPolicy({
          mediaUsage: loadedPolicy.mediaUsage || {
            film: 'require_approval',
            television: 'require_approval',
            streaming: 'require_approval',
            gaming: 'require_approval',
            voiceReplication: 'deny',
            virtualReality: 'require_approval',
            socialMedia: 'require_approval',
            advertising: 'require_approval',
            merchandise: 'require_approval',
            livePerformance: 'require_approval',
          },
          contentTypes: loadedPolicy.contentTypes || {
            explicit: 'deny',
            political: 'require_approval',
            religious: 'require_approval',
            violence: 'require_approval',
            alcohol: 'require_approval',
            tobacco: 'deny',
            gambling: 'deny',
            pharmaceutical: 'require_approval',
            firearms: 'deny',
            adultContent: 'deny',
          },
          territories: loadedPolicy.territories || { allowed: [], denied: [] },
          aiControls: loadedPolicy.aiControls || {
            trainingAllowed: false,
            syntheticGenerationAllowed: false,
            biometricAnalysisAllowed: false,
          },
          commercial: loadedPolicy.commercial || {
            paymentRequired: true,
            minFee: undefined,
            revenueShare: undefined,
          },
          attributionRequired: loadedPolicy.attributionRequired ?? true,
        });
      }
      if (data.licensesOnCurrentVersion !== undefined) {
        setLicenseCount(data.licensesOnCurrentVersion);
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

  const PermissionSelector = ({
    value,
    onChange,
    label,
  }: {
    value: PermissionLevel;
    onChange: (level: PermissionLevel) => void;
    label: string;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
      <span className="text-white font-medium">{label}</span>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            checked={value === 'allow'}
            onChange={() => onChange('allow')}
            className="w-4 h-4"
          />
          <span
            className={`text-sm ${value === 'allow' ? 'text-green-300 font-semibold' : 'text-gray-400 group-hover:text-gray-200'}`}
          >
            Allow
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            checked={value === 'require_approval'}
            onChange={() => onChange('require_approval')}
            className="w-4 h-4"
          />
          <span
            className={`text-sm ${value === 'require_approval' ? 'text-yellow-300 font-semibold' : 'text-gray-400 group-hover:text-gray-200'}`}
          >
            Require Approval
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            checked={value === 'deny'}
            onChange={() => onChange('deny')}
            className="w-4 h-4"
          />
          <span
            className={`text-sm ${value === 'deny' ? 'text-red-300 font-semibold' : 'text-gray-400 group-hover:text-gray-200'}`}
          >
            Deny
          </span>
        </label>
      </div>
    </div>
  );

  const toggleTerritory = (code: string, list: 'allowed' | 'denied') => {
    setPolicy((prev) => {
      const newTerritories = { ...prev.territories };
      const otherList = list === 'allowed' ? 'denied' : 'allowed';

      // Remove from other list if present
      newTerritories[otherList] = newTerritories[otherList].filter((c) => c !== code);

      // Toggle in current list
      if (newTerritories[list].includes(code)) {
        newTerritories[list] = newTerritories[list].filter((c) => c !== code);
      } else {
        newTerritories[list] = [...newTerritories[list], code];
      }

      return { ...prev, territories: newTerritories };
    });
  };

  const getTerritoryStatus = (code: string): 'allowed' | 'denied' | 'neutral' => {
    if (policy.territories.allowed.includes(code)) return 'allowed';
    if (policy.territories.denied.includes(code)) return 'denied';
    return 'neutral';
  };

  const handleContinentAction = (continent: string, action: 'allow' | 'deny' | 'clear') => {
    const countries = COUNTRIES_BY_CONTINENT[continent as keyof typeof COUNTRIES_BY_CONTINENT];
    const countryCodes = countries.map((c) => c.code);

    setPolicy((prev) => {
      const newTerritories = { ...prev.territories };

      if (action === 'allow') {
        // Add all continent countries to allowed, remove from denied
        newTerritories.allowed = Array.from(
          new Set([...newTerritories.allowed, ...countryCodes])
        );
        newTerritories.denied = newTerritories.denied.filter((c) => !countryCodes.includes(c));
      } else if (action === 'deny') {
        // Add all continent countries to denied, remove from allowed
        newTerritories.denied = Array.from(
          new Set([...newTerritories.denied, ...countryCodes])
        );
        newTerritories.allowed = newTerritories.allowed.filter((c) => !countryCodes.includes(c));
      } else if (action === 'clear') {
        // Remove all continent countries from both lists
        newTerritories.allowed = newTerritories.allowed.filter((c) => !countryCodes.includes(c));
        newTerritories.denied = newTerritories.denied.filter((c) => !countryCodes.includes(c));
      }

      return { ...prev, territories: newTerritories };
    });
  };

  const handleCountryClick = (countryCode: string) => {
    const status = getTerritoryStatus(countryCode);

    if (status === 'neutral') {
      // First click: Add to allowed
      toggleTerritory(countryCode, 'allowed');
    } else if (status === 'allowed') {
      // Second click: Move to denied
      toggleTerritory(countryCode, 'denied');
    } else {
      // Third click: Remove from denied (back to neutral)
      setPolicy((prev) => ({
        ...prev,
        territories: {
          ...prev.territories,
          denied: prev.territories.denied.filter((c) => c !== countryCode),
        },
      }));
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-purple-300 hover:text-purple-100 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">
            Image & Likeness Consent Preferences
          </h1>
          <p className="text-gray-300">
            Control how your image and likeness can be used. Set non-negotiable boundaries for
            different media types and content.
          </p>
        </div>

        {/* Current Version Section - Prominent */}
        {currentConsent && (
          <div className="mb-8 bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-sm rounded-xl p-6 border-2 border-purple-500/50">
            <h2 className="text-2xl font-bold text-white mb-4">Current Version</h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-gray-400 text-sm mb-1">Version</div>
                <div className="text-3xl font-bold text-purple-300">{currentConsent.version}</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm mb-1">Last Updated</div>
                <div className="text-xl font-semibold text-white">
                  {new Date(currentConsent.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm mb-1">Licenses on this Version</div>
                <div className="text-3xl font-bold text-green-400">
                  {licenseCount} <span className="text-lg text-gray-400">Total</span>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Main Content - Two Column Layout */}
        <div className="flex gap-8">
          {/* Left Sidebar - Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 sticky top-8">
              <h3 className="text-white font-bold mb-4">Quick Navigation</h3>
              <nav className="space-y-2">
                <a
                  href="#media-usage"
                  className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Media Usage Categories
                </a>
                <a
                  href="#content-types"
                  className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Content Type Restrictions
                </a>
                <a
                  href="#territories"
                  className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Geographic Territories
                </a>
                <a
                  href="#ai-controls"
                  className="block px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  AI Controls
                </a>
              </nav>
            </div>
          </div>

          {/* Right Content - Form */}
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Media Usage Categories */}
              <div
                id="media-usage"
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
              >
                <h2 className="text-2xl font-bold text-white mb-4">Media Usage Categories</h2>
                <p className="text-gray-300 mb-6 text-sm">
                  Control how your image and likeness can be used across different media types.
                  Choose Allow for blanket approval, Require Approval for case-by-case review, or
                  Deny to reject usage.
                </p>
                <div className="space-y-1">
                  <PermissionSelector
                    label="Film / Theatrical"
                    value={policy.mediaUsage.film}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, film: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Television"
                    value={policy.mediaUsage.television}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, television: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Streaming Platforms"
                    value={policy.mediaUsage.streaming}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, streaming: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Gaming / Interactive Media"
                    value={policy.mediaUsage.gaming}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, gaming: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Voice Replication / AI Voice"
                    value={policy.mediaUsage.voiceReplication}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, voiceReplication: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Virtual Reality / Metaverse"
                    value={policy.mediaUsage.virtualReality}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, virtualReality: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Social Media"
                    value={policy.mediaUsage.socialMedia}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, socialMedia: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Advertising / Commercials"
                    value={policy.mediaUsage.advertising}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, advertising: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Merchandise / Products"
                    value={policy.mediaUsage.merchandise}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, merchandise: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Live Performance / Events"
                    value={policy.mediaUsage.livePerformance}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        mediaUsage: { ...policy.mediaUsage, livePerformance: value },
                      })
                    }
                  />
                </div>
              </div>

              {/* Content Type Restrictions */}
              <div
                id="content-types"
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
              >
                <h2 className="text-2xl font-bold text-white mb-4">Content Type Restrictions</h2>
                <p className="text-gray-300 mb-6 text-sm">
                  Set permissions for different types of content. These restrictions apply across
                  all media usage categories above.
                </p>
                <div className="space-y-1">
                  <PermissionSelector
                    label="Explicit Content"
                    value={policy.contentTypes.explicit}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, explicit: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Political Content"
                    value={policy.contentTypes.political}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, political: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Religious Content"
                    value={policy.contentTypes.religious}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, religious: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Violent Content"
                    value={policy.contentTypes.violence}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, violence: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Alcohol-Related Content"
                    value={policy.contentTypes.alcohol}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, alcohol: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Tobacco-Related Content"
                    value={policy.contentTypes.tobacco}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, tobacco: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Gambling-Related Content"
                    value={policy.contentTypes.gambling}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, gambling: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Pharmaceutical / Medical Content"
                    value={policy.contentTypes.pharmaceutical}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, pharmaceutical: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Firearms-Related Content"
                    value={policy.contentTypes.firearms}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, firearms: value },
                      })
                    }
                  />
                  <PermissionSelector
                    label="Adult Content"
                    value={policy.contentTypes.adultContent}
                    onChange={(value) =>
                      setPolicy({
                        ...policy,
                        contentTypes: { ...policy.contentTypes, adultContent: value },
                      })
                    }
                  />
                </div>
              </div>

              {/* Geographic Territories */}
              <div
                id="territories"
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
              >
                <h2 className="text-2xl font-bold text-white mb-4">Geographic Territories</h2>
                <p className="text-gray-300 mb-6 text-sm">
                  Control usage by geographic region. Click on countries on the map to toggle
                  between Allowed (green), Denied (red), and Neutral (gray). Use continent controls
                  below for bulk actions.
                </p>

                {/* World Map */}
                <div className="mb-6">
                  <TerritoryMap
                    allowedCountries={policy.territories.allowed}
                    deniedCountries={policy.territories.denied}
                    onCountryClick={handleCountryClick}
                  />
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 mb-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-gray-300">Allowed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-gray-300">Denied</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-700 rounded"></div>
                    <span className="text-gray-300">Neutral</span>
                  </div>
                </div>

                {/* Continent Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Quick Actions by Continent</h3>
                  {Object.entries(COUNTRIES_BY_CONTINENT).map(([continent, countries]) => (
                    <div
                      key={continent}
                      className="bg-black/30 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white font-semibold">{continent}</div>
                        <div className="text-gray-400 text-sm">{countries.length} countries</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleContinentAction(continent, 'allow')}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          ALLOW ALL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleContinentAction(continent, 'deny')}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          DENY ALL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleContinentAction(continent, 'clear')}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          CLEAR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Controls */}
              <div
                id="ai-controls"
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
              >
                <h2 className="text-2xl font-bold text-white mb-4">AI Controls</h2>
                <p className="text-gray-300 mb-6 text-sm">
                  Control how your image and likeness can be used with AI systems and technologies.
                </p>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policy.aiControls.trainingAllowed}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          aiControls: { ...policy.aiControls, trainingAllowed: e.target.checked },
                        })
                      }
                      className="w-5 h-5 rounded border-gray-300"
                    />
                    <span>Allow AI Training</span>
                  </label>
                  <label className="flex items-center gap-3 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policy.aiControls.syntheticGenerationAllowed}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          aiControls: {
                            ...policy.aiControls,
                            syntheticGenerationAllowed: e.target.checked,
                          },
                        })
                      }
                      className="w-5 h-5 rounded border-gray-300"
                    />
                    <span>Allow Synthetic Generation</span>
                  </label>
                  <label className="flex items-center gap-3 text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policy.aiControls.biometricAnalysisAllowed}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          aiControls: {
                            ...policy.aiControls,
                            biometricAnalysisAllowed: e.target.checked,
                          },
                        })
                      }
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
          {/* End Right Content */}
        </div>
        {/* End Two Column Layout */}
      </div>
    </div>
  );
}
