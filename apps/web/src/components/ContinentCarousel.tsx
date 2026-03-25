'use client';

import { useState } from 'react';
import { COUNTRIES_BY_CONTINENT } from './TerritoryMap';

interface ContinentAccordionProps {
  allowedCountries: string[];
  deniedCountries: string[];
  onCountryToggle: (countryCode: string) => void;
  onContinentAction: (continent: string, action: 'allow' | 'deny' | 'clear') => void;
}

export default function ContinentCarousel({
  allowedCountries,
  deniedCountries,
  onCountryToggle,
  onContinentAction,
}: ContinentAccordionProps) {
  // Sort continents alphabetically
  const continents = Object.keys(COUNTRIES_BY_CONTINENT).sort();
  const [expandedContinent, setExpandedContinent] = useState<string | null>(continents[0]);

  const getCountryStatus = (code: string): 'allowed' | 'denied' | 'neutral' => {
    if (allowedCountries.includes(code)) return 'allowed';
    if (deniedCountries.includes(code)) return 'denied';
    return 'neutral';
  };

  const getContinentAllowedCount = (continent: string) => {
    const countries = COUNTRIES_BY_CONTINENT[continent as keyof typeof COUNTRIES_BY_CONTINENT];
    return countries.filter((c) => allowedCountries.includes(c.code)).length;
  };

  const getContinentDeniedCount = (continent: string) => {
    const countries = COUNTRIES_BY_CONTINENT[continent as keyof typeof COUNTRIES_BY_CONTINENT];
    return countries.filter((c) => deniedCountries.includes(c.code)).length;
  };

  const toggleContinent = (continent: string) => {
    setExpandedContinent(expandedContinent === continent ? null : continent);
  };

  return (
    <div className="w-full space-y-3">
      {continents.map((continent) => {
        const countries =
          COUNTRIES_BY_CONTINENT[continent as keyof typeof COUNTRIES_BY_CONTINENT];
        const isExpanded = expandedContinent === continent;
        const allowedCount = getContinentAllowedCount(continent);
        const deniedCount = getContinentDeniedCount(continent);

        return (
          <div
            key={continent}
            className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden"
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => toggleContinent(continent)}
              className="w-full bg-gradient-to-r from-purple-600/30 to-blue-600/30 p-4 flex items-center justify-between hover:from-purple-600/40 hover:to-blue-600/40 transition-all"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl text-white">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-white">{continent}</h3>
                  <p className="text-gray-300 text-sm">
                    {countries.length} countries •{' '}
                    <span className="text-green-400">{allowedCount} allowed</span> •{' '}
                    <span className="text-red-400">{deniedCount} denied</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onContinentAction(continent, 'allow')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  ALLOW ALL
                </button>
                <button
                  type="button"
                  onClick={() => onContinentAction(continent, 'deny')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  DENY ALL
                </button>
                <button
                  type="button"
                  onClick={() => onContinentAction(continent, 'clear')}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  CLEAR
                </button>
              </div>
            </button>

            {/* Accordion Content */}
            {isExpanded && (
              <div className="p-6 bg-black/30">
                <h4 className="text-white font-semibold mb-4">
                  Select Countries in {continent}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {countries.map((country) => {
                    const status = getCountryStatus(country.code);
                    return (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => onCountryToggle(country.code)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                          status === 'allowed'
                            ? 'bg-green-600 border-green-400 text-white'
                            : status === 'denied'
                            ? 'bg-red-600 border-red-400 text-white'
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {country.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

