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
        const countries = COUNTRIES_BY_CONTINENT[continent as keyof typeof COUNTRIES_BY_CONTINENT];
        const isExpanded = expandedContinent === continent;
        const allowedCount = getContinentAllowedCount(continent);
        const deniedCount = getContinentDeniedCount(continent);

        return (
          <div
            key={continent}
            className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => toggleContinent(continent)}
              className="w-full bg-card hover:bg-muted border-b border-border p-4 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 md:gap-4">
                <span className="text-lg md:text-xl text-foreground">{isExpanded ? '▼' : '▶'}</span>
                <div className="text-left">
                  <h3 className="text-lg md:text-xl font-bold text-foreground">{continent}</h3>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    {countries.length} countries •{' '}
                    <span className="text-green-600 dark:text-green-400">{allowedCount} allowed</span> •{' '}
                    <span className="text-red-600 dark:text-red-400">{deniedCount} denied</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onContinentAction(continent, 'allow')}
                  className="px-3 md:px-4 py-2 bg-green-600 hover:bg-green-700 dark:hover:bg-green-500 text-white rounded-lg text-xs md:text-sm font-semibold transition-colors"
                >
                  ALLOW ALL
                </button>
                <button
                  type="button"
                  onClick={() => onContinentAction(continent, 'deny')}
                  className="px-3 md:px-4 py-2 bg-red-600 hover:bg-red-700 dark:hover:bg-red-500 text-white rounded-lg text-xs md:text-sm font-semibold transition-colors"
                >
                  DENY ALL
                </button>
                <button
                  type="button"
                  onClick={() => onContinentAction(continent, 'clear')}
                  className="px-3 md:px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs md:text-sm font-semibold transition-colors"
                >
                  CLEAR
                </button>
              </div>
            </button>

            {/* Accordion Content */}
            {isExpanded && (
              <div className="p-4 md:p-6 bg-muted/30 border-t border-border">
                <h4 className="text-foreground font-semibold mb-4 text-sm md:text-base">Select Countries in {continent}</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                  {countries.map((country) => {
                    const status = getCountryStatus(country.code);
                    return (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => onCountryToggle(country.code)}
                        className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-all border ${
                          status === 'allowed'
                            ? 'bg-green-600 border-green-400 text-white hover:bg-green-700'
                            : status === 'denied'
                              ? 'bg-red-600 border-red-400 text-white hover:bg-red-700'
                              : 'bg-muted border-border text-foreground hover:border-primary hover:bg-muted/80'
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
