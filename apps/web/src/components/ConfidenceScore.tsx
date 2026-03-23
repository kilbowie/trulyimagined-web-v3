'use client';

import { useEffect, useState } from 'react';

/**
 * Identity Confidence Score Badge
 *
 * Step 8: Identity Confidence Scoring
 * Displays user's overall identity confidence score
 */

interface ConfidenceData {
  confidencePercentage: number;
  assuranceLevel: string;
  linkedProvidersCount: number;
  hasGovernmentId: boolean;
  hasLivenessCheck: boolean;
  recommendations: string[];
}

export function ConfidenceScoreBadge() {
  const [confidence, setConfidence] = useState<ConfidenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfidence();
  }, []);

  async function fetchConfidence() {
    try {
      const response = await fetch('/api/identity/resolution');
      if (response.ok) {
        const data = await response.json();
        setConfidence(data);
      }
    } catch (error) {
      console.error('[CONFIDENCE BADGE] Error fetching confidence:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="inline-block px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  if (!confidence) {
    return (
      <div className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
        Not verified
      </div>
    );
  }

  // Determine badge color based on confidence level
  let badgeColor = 'bg-gray-200 text-gray-700';
  let emoji = '⚪';

  const { confidencePercentage, assuranceLevel } = confidence;

  if (assuranceLevel === 'very-high' || confidencePercentage >= 90) {
    badgeColor = 'bg-green-100 text-green-800 border border-green-300';
    emoji = '🟢';
  } else if (assuranceLevel === 'high' || confidencePercentage >= 70) {
    badgeColor = 'bg-blue-100 text-blue-800 border border-blue-300';
    emoji = '🔵';
  } else if (assuranceLevel === 'medium' || confidencePercentage >= 50) {
    badgeColor = 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    emoji = '🟡';
  } else if (confidencePercentage > 0) {
    badgeColor = 'bg-orange-100 text-orange-800 border border-orange-300';
    emoji = '🟠';
  } else {
    badgeColor = 'bg-gray-100 text-gray-600 border border-gray-300';
    emoji = '⚪';
  }

  return (
    <div
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${badgeColor}`}
    >
      <span className="mr-1.5">{emoji}</span>
      <span>{confidencePercentage}% Confidence</span>
      {confidence.hasGovernmentId && <span className="ml-2">✓ Gov ID</span>}
    </div>
  );
}

/**
 * Detailed Confidence Score Card
 * Shows full breakdown with recommendations
 */
export function ConfidenceScoreCard() {
  const [confidence, setConfidence] = useState<ConfidenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfidence();
  }, []);

  async function fetchConfidence() {
    try {
      const response = await fetch('/api/identity/resolution');
      if (response.ok) {
        const data = await response.json();
        setConfidence(data);
      }
    } catch (error) {
      console.error('[CONFIDENCE CARD] Error fetching confidence:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!confidence) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-2">Identity Confidence</h3>
        <p className="text-gray-500">No verification data available</p>
      </div>
    );
  }

  const {
    confidencePercentage,
    assuranceLevel,
    linkedProvidersCount,
    hasGovernmentId,
    hasLivenessCheck,
    recommendations,
  } = confidence;

  // Determine color scheme
  let colorScheme = {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700',
  };

  if (assuranceLevel === 'very-high' || confidencePercentage >= 90) {
    colorScheme = {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      badge: 'bg-green-100 text-green-800',
    };
  } else if (assuranceLevel === 'high' || confidencePercentage >= 70) {
    colorScheme = {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      badge: 'bg-blue-100 text-blue-800',
    };
  } else if (assuranceLevel === 'medium' || confidencePercentage >= 50) {
    colorScheme = {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      badge: 'bg-yellow-100 text-yellow-800',
    };
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-2 ${colorScheme.border}`}>
      <h3 className="text-lg font-semibold mb-4">Identity Confidence Score</h3>

      {/* Main Score */}
      <div className={`rounded-lg p-4 mb-4 ${colorScheme.bg}`}>
        <div className="text-center">
          <div className="text-4xl font-bold mb-2 ${colorScheme.text}">{confidencePercentage}%</div>
          <div
            className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${colorScheme.badge}`}
          >
            {(assuranceLevel || 'none').toUpperCase()} Assurance
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center text-sm">
        <div>
          <p className="text-gray-600">Providers</p>
          <p className="font-semibold text-lg">{linkedProvidersCount}</p>
        </div>
        <div>
          <p className="text-gray-600">Gov ID</p>
          <p className="text-lg">{hasGovernmentId ? '✅' : '❌'}</p>
        </div>
        <div>
          <p className="text-gray-600">Liveness</p>
          <p className="text-lg">{hasLivenessCheck ? '✅' : '❌'}</p>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-2">Recommendations:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            {recommendations.slice(0, 3).map((rec, idx) => (
              <li key={idx} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
