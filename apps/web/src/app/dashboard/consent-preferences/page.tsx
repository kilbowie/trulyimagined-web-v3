'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { COUNTRIES_BY_CONTINENT } from '@/components/TerritoryMap';
import ContinentCarousel from '@/components/ContinentCarousel';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  usageBlocked?: boolean;
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
  const sectionValues = ['media-usage', 'content-types', 'territories', 'ai-controls'];
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
  const [usageChangeDialogOpen, setUsageChangeDialogOpen] = useState(false);
  const [pendingUsageBlocked, setPendingUsageBlocked] = useState<boolean | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(sectionValues);

  const getBaselinePolicy = (): ConsentPolicy => {
    if (!currentConsent?.policy) {
      return {
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
        usageBlocked: false,
      };
    }

    return {
      ...currentConsent.policy,
      usageBlocked: currentConsent.policy.usageBlocked ?? false,
    };
  };

  const normalizedPolicyString = (value: ConsentPolicy) =>
    JSON.stringify({
      ...value,
      usageBlocked: value.usageBlocked ?? false,
      territories: {
        allowed: [...value.territories.allowed].sort(),
        denied: [...value.territories.denied].sort(),
      },
    });

  const hasPolicyChanges =
    normalizedPolicyString(policy) !== normalizedPolicyString(getBaselinePolicy());

  const getPermissionCounts = (values: PermissionLevel[]) => {
    return values.reduce(
      (acc, item) => {
        acc[item] += 1;
        return acc;
      },
      { allow: 0, require_approval: 0, deny: 0 }
    );
  };

  const mediaUsageCounts = getPermissionCounts(Object.values(policy.mediaUsage));
  const contentTypeCounts = getPermissionCounts(Object.values(policy.contentTypes));
  const aiControlsCounts = {
    allow: Object.values(policy.aiControls).filter(Boolean).length,
    deny: Object.values(policy.aiControls).filter((value) => !value).length,
  };
  const geographicCounts = {
    allow: policy.territories.allowed.length,
    deny: policy.territories.denied.length,
  };

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
          usageBlocked: loadedPolicy.usageBlocked ?? false,
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

  const persistConsent = async (policyToSave: ConsentPolicy, reasonToSave: string = reason) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/consent-ledger/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: policyToSave, reason: reasonToSave }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update consent');
      }

      const data = await res.json();
      setSuccess(`Consent updated successfully! Version ${data.entry.version} created.`);
      setReason('');
      setPendingUsageBlocked(null);
      setUsageChangeDialogOpen(false);

      // Reload current consent
      await loadCurrentConsent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update consent');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPolicyChanges) {
      return;
    }
    await persistConsent(policy);
  };

  const handleCancelChanges = () => {
    setPolicy(getBaselinePolicy());
    setReason('');
    setError(null);
    setSuccess(null);
  };

  const requestUsageModeChange = (nextBlocked: boolean) => {
    const currentBlocked = policy.usageBlocked ?? false;
    if (currentBlocked === nextBlocked) {
      return;
    }
    setPendingUsageBlocked(nextBlocked);
    setUsageChangeDialogOpen(true);
  };

  const confirmUsageModeChange = async () => {
    if (pendingUsageBlocked === null) {
      return;
    }

    const updatedPolicy = {
      ...policy,
      usageBlocked: pendingUsageBlocked,
    };

    setPolicy(updatedPolicy);
    const usageReason = pendingUsageBlocked
      ? 'Usage blocked by actor preference'
      : 'Usage permitted by actor preference';
    await persistConsent(updatedPolicy, usageReason);
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
    <div className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-border last:border-0 gap-4">
      <span className="text-foreground font-medium text-sm md:text-base">{label}</span>
      <div className="flex gap-2 md:gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            checked={value === 'allow'}
            onChange={() => onChange('allow')}
            className="w-4 h-4"
          />
          <span
            className={`text-sm ${value === 'allow' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-muted-foreground group-hover:text-foreground'}`}
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
            className={`text-sm ${value === 'require_approval' ? 'text-yellow-600 dark:text-yellow-400 font-semibold' : 'text-muted-foreground group-hover:text-foreground'}`}
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
            className={`text-sm ${value === 'deny' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground group-hover:text-foreground'}`}
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
        newTerritories.allowed = Array.from(new Set([...newTerritories.allowed, ...countryCodes]));
        newTerritories.denied = newTerritories.denied.filter((c) => !countryCodes.includes(c));
      } else if (action === 'deny') {
        // Add all continent countries to denied, remove from allowed
        newTerritories.denied = Array.from(new Set([...newTerritories.denied, ...countryCodes]));
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

  const handleQuickNavClick = (sectionId: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setOpenSections((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]));

    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-900 text-xl">Loading consent preferences...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-primary hover:text-primary/80 mb-4 flex items-center gap-2 font-medium"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Image & Likeness Consent Preferences
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Control how your image and likeness can be used. Set non-negotiable boundaries for
            different media types and content.
          </p>
        </div>

        {/* Current Version Section - Prominent */}
        {currentConsent && (
          <div className="mb-8 bg-card rounded-xl p-6 border border-border">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Current Version</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <div className="text-muted-foreground text-xs md:text-sm mb-1">Version</div>
                <div className="text-2xl md:text-3xl font-bold text-primary">
                  {currentConsent.version}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs md:text-sm mb-1">Last Updated</div>
                <div className="text-lg md:text-xl font-semibold text-foreground">
                  {new Date(currentConsent.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs md:text-sm mb-1">
                  Licenses on this Version
                </div>
                <div className="text-2xl md:text-3xl font-bold text-accent">
                  {licenseCount} <span className="text-sm text-muted-foreground">Total</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage Mode Toggle */}
        <div className="mb-8 bg-card rounded-xl p-6 border border-border shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">Usage Status</h2>
          <p className="text-muted-foreground text-sm mb-5">
            Choose whether all usage is globally permitted (subject to your section settings) or
            fully blocked.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => requestUsageModeChange(false)}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                !(policy.usageBlocked ?? false)
                  ? 'bg-green-600/15 text-green-600 dark:text-green-400 border-green-500/40'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              Permit Usage
            </button>
            <button
              type="button"
              onClick={() => requestUsageModeChange(true)}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                (policy.usageBlocked ?? false)
                  ? 'bg-red-600/15 text-red-600 dark:text-red-400 border-red-500/40'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              Block Usage
            </button>
          </div>

          {(policy.usageBlocked ?? false) && (
            <div className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                Usage is currently blocked.
              </p>
              <p className="text-xs text-red-600/90 dark:text-red-300 mt-1">
                No media usage is permitted while block mode is active.
              </p>
            </div>
          )}
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-card border border-green-500/50 rounded-lg text-green-600 dark:text-green-400 text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-card border border-red-500/50 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Main Content - Two Column Layout on Desktop, Single Column on Mobile */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Left Sidebar - Navigation (Hidden on mobile, shown on lg) */}
          <div
            className={`hidden lg:block lg:w-64 flex-shrink-0 ${(policy.usageBlocked ?? false) ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <div className="bg-card rounded-xl p-4 border border-border sticky top-8 shadow-sm">
              <h3 className="text-foreground font-bold mb-4 text-sm">Quick Navigation</h3>
              <nav className="space-y-2">
                <a
                  href="#media-usage"
                  onClick={(e) => handleQuickNavClick('media-usage', e)}
                  className="block px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                >
                  Media Usage Categories
                </a>
                <a
                  href="#content-types"
                  onClick={(e) => handleQuickNavClick('content-types', e)}
                  className="block px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                >
                  Content Type Restrictions
                </a>
                <a
                  href="#territories"
                  onClick={(e) => handleQuickNavClick('territories', e)}
                  className="block px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                >
                  Geographic Territories
                </a>
                <a
                  href="#ai-controls"
                  onClick={(e) => handleQuickNavClick('ai-controls', e)}
                  className="block px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm"
                >
                  AI Controls
                </a>
              </nav>
            </div>
          </div>

          {/* Right Content - Form */}
          <div className="flex-1 min-w-0">
            <form
              id="consent-preferences-form"
              onSubmit={handleSubmit}
              className={`space-y-6 md:space-y-8 ${hasPolicyChanges ? 'pb-28' : ''}`}
            >
              {(policy.usageBlocked ?? false) ? (
                <div className="bg-card rounded-xl p-6 border border-red-500/40 shadow-sm">
                  <h2 className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400 mb-3">
                    Usage is Blocked
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Detailed consent sections are hidden while block mode is active. Switch to
                    Permit Usage to view and edit your detailed preferences.
                  </p>
                </div>
              ) : (
                <Accordion
                  type="multiple"
                  value={openSections}
                  onValueChange={setOpenSections}
                  className="space-y-6"
                >
                  <AccordionItem
                    value="media-usage"
                    id="media-usage"
                    className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                  >
                    <AccordionTrigger className="px-6 py-5 hover:no-underline">
                      <div className="flex flex-wrap items-center gap-2 text-left">
                        <span className="text-xl md:text-2xl font-bold text-foreground">
                          Media Usage Categories
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-green-500/30 text-green-600 dark:text-green-400">
                          Allowed: {mediaUsageCounts.allow}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                          Requires Approval: {mediaUsageCounts.require_approval}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-red-500/30 text-red-600 dark:text-red-400">
                          Denied: {mediaUsageCounts.deny}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <p className="text-muted-foreground mb-6 text-sm">
                        Control how your image and likeness can be used across different media
                        types. Choose Allow for blanket approval, Require Approval for case-by-case
                        review, or Deny to reject usage.
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
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="content-types"
                    id="content-types"
                    className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                  >
                    <AccordionTrigger className="px-6 py-5 hover:no-underline">
                      <div className="flex flex-wrap items-center gap-2 text-left">
                        <span className="text-xl md:text-2xl font-bold text-foreground">
                          Content Type Restrictions
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-green-500/30 text-green-600 dark:text-green-400">
                          Allowed: {contentTypeCounts.allow}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                          Requires Approval: {contentTypeCounts.require_approval}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-red-500/30 text-red-600 dark:text-red-400">
                          Denied: {contentTypeCounts.deny}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <p className="text-muted-foreground mb-6 text-sm">
                        Set permissions for different types of content. These restrictions apply
                        across all media usage categories above.
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
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="territories"
                    id="territories"
                    className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                  >
                    <AccordionTrigger className="px-6 py-5 hover:no-underline">
                      <div className="flex flex-wrap items-center gap-2 text-left">
                        <span className="text-xl md:text-2xl font-bold text-foreground">
                          Geographic Territories
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-green-500/30 text-green-600 dark:text-green-400">
                          Allowed: {geographicCounts.allow}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-red-500/30 text-red-600 dark:text-red-400">
                          Denied: {geographicCounts.deny}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <p className="text-muted-foreground mb-6 text-sm">
                        Select which regions can use your image and likeness. Use the continent
                        carousel below to manage territories by continent. Click individual
                        countries or use bulk actions.
                      </p>

                      <ContinentCarousel
                        allowedCountries={policy.territories.allowed}
                        deniedCountries={policy.territories.denied}
                        onCountryToggle={handleCountryClick}
                        onContinentAction={handleContinentAction}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem
                    value="ai-controls"
                    id="ai-controls"
                    className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                  >
                    <AccordionTrigger className="px-6 py-5 hover:no-underline">
                      <div className="flex flex-wrap items-center gap-2 text-left">
                        <span className="text-xl md:text-2xl font-bold text-foreground">
                          AI Controls
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-green-500/30 text-green-600 dark:text-green-400">
                          Allowed: {aiControlsCounts.allow}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full border border-red-500/30 text-red-600 dark:text-red-400">
                          Denied: {aiControlsCounts.deny}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <p className="text-muted-foreground mb-6 text-sm">
                        Control how your image and likeness can be used with AI systems and
                        technologies.
                      </p>
                      <div className="space-y-4">
                        <label className="flex items-center gap-3 text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={policy.aiControls.trainingAllowed}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                aiControls: {
                                  ...policy.aiControls,
                                  trainingAllowed: e.target.checked,
                                },
                              })
                            }
                            className="w-5 h-5 rounded border-border"
                          />
                          <span>Allow AI Training</span>
                        </label>
                        <label className="flex items-center gap-3 text-foreground cursor-pointer">
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
                            className="w-5 h-5 rounded border-border"
                          />
                          <span>Allow Synthetic Generation</span>
                        </label>
                        <label className="flex items-center gap-3 text-foreground cursor-pointer">
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
                            className="w-5 h-5 rounded border-border"
                          />
                          <span>Allow Biometric Analysis</span>
                        </label>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              {/* Reason */}
              <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
                <label className="block text-foreground mb-2 font-medium">
                  Reason for Update{' '}
                  <span className="text-muted-foreground text-sm">(Optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-background border border-border text-foreground placeholder-muted-foreground"
                  rows={3}
                  placeholder="e.g., Updated commercial terms for new licensing model"
                />
              </div>

            </form>
          </div>
          {/* End Right Content */}
        </div>
        {/* End Two Column Layout */}
      </div>

      {hasPolicyChanges && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="hidden sm:block text-sm text-muted-foreground">
                You have unsaved changes.
              </p>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelChanges}
                  disabled={saving}
                  className="px-4 md:px-6 py-2 md:py-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold transition-colors text-sm md:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="consent-preferences-form"
                  disabled={saving || !hasPolicyChanges}
                  className="px-4 md:px-6 py-2 md:py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-semibold transition-colors text-sm md:text-base"
                >
                  {saving ? 'Saving...' : 'Update Consent Preferences'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={usageChangeDialogOpen}
        onOpenChange={(open) => {
          setUsageChangeDialogOpen(open);
          if (!open) {
            setPendingUsageBlocked(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingUsageBlocked ? 'Confirm Block Usage' : 'Confirm Permit Usage'}
            </DialogTitle>
            <DialogDescription>
              {pendingUsageBlocked
                ? 'This will immediately block all usage, create a new consent version, and add it to your consent history. Are you sure you want to continue?'
                : 'This will permit usage mode, create a new consent version, and add it to your consent history. Are you sure you want to continue?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setUsageChangeDialogOpen(false);
                setPendingUsageBlocked(null);
              }}
              className="px-4 py-2 rounded-lg bg-muted text-foreground font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmUsageModeChange}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:bg-muted"
            >
              {saving ? 'Updating...' : 'Confirm and Update'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
