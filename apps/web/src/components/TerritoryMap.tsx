'use client';

import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Comprehensive country list organized by continent
export const COUNTRIES_BY_CONTINENT = {
  'North America': [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'MX', name: 'Mexico' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'BZ', name: 'Belize' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'HN', name: 'Honduras' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'PA', name: 'Panama' },
    { code: 'CU', name: 'Cuba' },
    { code: 'JM', name: 'Jamaica' },
    { code: 'HT', name: 'Haiti' },
    { code: 'DO', name: 'Dominican Republic' },
    { code: 'BS', name: 'Bahamas' },
    { code: 'TT', name: 'Trinidad and Tobago' },
  ],
  'South America': [
    { code: 'BR', name: 'Brazil' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' },
    { code: 'PE', name: 'Peru' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'GY', name: 'Guyana' },
    { code: 'SR', name: 'Suriname' },
  ],
  Europe: [
    { code: 'GB', name: 'United Kingdom' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'AT', name: 'Austria' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'PL', name: 'Poland' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'HU', name: 'Hungary' },
    { code: 'RO', name: 'Romania' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'GR', name: 'Greece' },
    { code: 'PT', name: 'Portugal' },
    { code: 'IE', name: 'Ireland' },
    { code: 'HR', name: 'Croatia' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LV', name: 'Latvia' },
    { code: 'EE', name: 'Estonia' },
    { code: 'IS', name: 'Iceland' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'MT', name: 'Malta' },
    { code: 'CY', name: 'Cyprus' },
    { code: 'RS', name: 'Serbia' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'BY', name: 'Belarus' },
    { code: 'RU', name: 'Russia' },
    { code: 'MD', name: 'Moldova' },
    { code: 'AL', name: 'Albania' },
    { code: 'MK', name: 'North Macedonia' },
    { code: 'BA', name: 'Bosnia and Herzegovina' },
    { code: 'ME', name: 'Montenegro' },
  ],
  Asia: [
    { code: 'CN', name: 'China' },
    { code: 'JP', name: 'Japan' },
    { code: 'IN', name: 'India' },
    { code: 'KR', name: 'South Korea' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'TH', name: 'Thailand' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'PH', name: 'Philippines' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'SG', name: 'Singapore' },
    { code: 'BD', name: 'Bangladesh' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'TR', name: 'Turkey' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'IL', name: 'Israel' },
    { code: 'IQ', name: 'Iraq' },
    { code: 'IR', name: 'Iran' },
    { code: 'KW', name: 'Kuwait' },
    { code: 'QA', name: 'Qatar' },
    { code: 'OM', name: 'Oman' },
    { code: 'JO', name: 'Jordan' },
    { code: 'LB', name: 'Lebanon' },
    { code: 'SY', name: 'Syria' },
    { code: 'AF', name: 'Afghanistan' },
    { code: 'NP', name: 'Nepal' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'MM', name: 'Myanmar' },
    { code: 'KH', name: 'Cambodia' },
    { code: 'LA', name: 'Laos' },
    { code: 'MN', name: 'Mongolia' },
    { code: 'KZ', name: 'Kazakhstan' },
    { code: 'UZ', name: 'Uzbekistan' },
    { code: 'TM', name: 'Turkmenistan' },
    { code: 'KG', name: 'Kyrgyzstan' },
    { code: 'TJ', name: 'Tajikistan' },
    { code: 'GE', name: 'Georgia' },
    { code: 'AM', name: 'Armenia' },
    { code: 'AZ', name: 'Azerbaijan' },
  ],
  Africa: [
    { code: 'ZA', name: 'South Africa' },
    { code: 'EG', name: 'Egypt' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'KE', name: 'Kenya' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'GH', name: 'Ghana' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'UG', name: 'Uganda' },
    { code: 'DZ', name: 'Algeria' },
    { code: 'MA', name: 'Morocco' },
    { code: 'AO', name: 'Angola' },
    { code: 'SD', name: 'Sudan' },
    { code: 'MZ', name: 'Mozambique' },
    { code: 'CM', name: 'Cameroon' },
    { code: 'CI', name: "Côte d'Ivoire" },
    { code: 'NE', name: 'Niger' },
    { code: 'BF', name: 'Burkina Faso' },
    { code: 'ML', name: 'Mali' },
    { code: 'MW', name: 'Malawi' },
    { code: 'ZM', name: 'Zambia' },
    { code: 'SN', name: 'Senegal' },
    { code: 'SO', name: 'Somalia' },
    { code: 'TD', name: 'Chad' },
    { code: 'ZW', name: 'Zimbabwe' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'BJ', name: 'Benin' },
    { code: 'TN', name: 'Tunisia' },
    { code: 'BI', name: 'Burundi' },
    { code: 'SS', name: 'South Sudan' },
    { code: 'TG', name: 'Togo' },
    { code: 'LY', name: 'Libya' },
    { code: 'LR', name: 'Liberia' },
    { code: 'MR', name: 'Mauritania' },
    { code: 'SL', name: 'Sierra Leone' },
    { code: 'CF', name: 'Central African Republic' },
    { code: 'ER', name: 'Eritrea' },
    { code: 'GM', name: 'Gambia' },
    { code: 'BW', name: 'Botswana' },
    { code: 'NA', name: 'Namibia' },
    { code: 'GA', name: 'Gabon' },
    { code: 'LS', name: 'Lesotho' },
    { code: 'GW', name: 'Guinea-Bissau' },
    { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'MU', name: 'Mauritius' },
  ],
  Oceania: [
    { code: 'AU', name: 'Australia' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'PG', name: 'Papua New Guinea' },
    { code: 'FJ', name: 'Fiji' },
    { code: 'NC', name: 'New Caledonia' },
    { code: 'PF', name: 'French Polynesia' },
    { code: 'SB', name: 'Solomon Islands' },
    { code: 'VU', name: 'Vanuatu' },
    { code: 'WS', name: 'Samoa' },
  ],
};

// ISO codes mapping for react-simple-maps (3-digit codes)
const ISO_CODE_MAP: Record<string, string> = {
  US: 'USA',
  CA: 'CAN',
  MX: 'MEX',
  GB: 'GBR',
  FR: 'FRA',
  DE: 'DEU',
  IT: 'ITA',
  ES: 'ESP',
  NL: 'NLD',
  BE: 'BEL',
  CH: 'CHE',
  AT: 'AUT',
  SE: 'SWE',
  NO: 'NOR',
  DK: 'DNK',
  FI: 'FIN',
  PL: 'POL',
  CZ: 'CZE',
  HU: 'HUN',
  RO: 'ROU',
  BG: 'BGR',
  GR: 'GRC',
  PT: 'PRT',
  IE: 'IRL',
  HR: 'HRV',
  SK: 'SVK',
  SI: 'SVN',
  LT: 'LTU',
  LV: 'LVA',
  EE: 'EST',
  IS: 'ISL',
  LU: 'LUX',
  MT: 'MLT',
  CY: 'CYP',
  RS: 'SRB',
  UA: 'UKR',
  BY: 'BLR',
  MD: 'MDA',
  AL: 'ALB',
  MK: 'MKD',
  BA: 'BIH',
  ME: 'MNE',
  CN: 'CHN',
  JP: 'JPN',
  IN: 'IND',
  KR: 'KOR',
  ID: 'IDN',
  TH: 'THA',
  VN: 'VNM',
  PH: 'PHL',
  MY: 'MYS',
  SG: 'SGP',
  BD: 'BGD',
  PK: 'PAK',
  TR: 'TUR',
  SA: 'SAU',
  AE: 'ARE',
  IL: 'ISR',
  IQ: 'IRQ',
  IR: 'IRN',
  KW: 'KWT',
  QA: 'QAT',
  OM: 'OMN',
  JO: 'JOR',
  LB: 'LBN',
  SY: 'SYR',
  AF: 'AFG',
  NP: 'NPL',
  LK: 'LKA',
  MM: 'MMR',
  KH: 'KHM',
  LA: 'LAO',
  MN: 'MNG',
  KZ: 'KAZ',
  UZ: 'UZB',
  TM: 'TKM',
  KG: 'KGZ',
  TJ: 'TJK',
  GE: 'GEO',
  AM: 'ARM',
  AZ: 'AZE',
  BR: 'BRA',
  AR: 'ARG',
  CL: 'CHL',
  CO: 'COL',
  PE: 'PER',
  VE: 'VEN',
  EC: 'ECU',
  BO: 'BOL',
  PY: 'PRY',
  UY: 'URY',
  GY: 'GUY',
  SR: 'SUR',
  GT: 'GTM',
  BZ: 'BLZ',
  SV: 'SLV',
  HN: 'HND',
  NI: 'NIC',
  CR: 'CRI',
  PA: 'PAN',
  CU: 'CUB',
  JM: 'JAM',
  HT: 'HTI',
  DO: 'DOM',
  BS: 'BHS',
  TT: 'TTO',
  ZA: 'ZAF',
  EG: 'EGY',
  NG: 'NGA',
  KE: 'KEN',
  ET: 'ETH',
  GH: 'GHA',
  TZ: 'TZA',
  UG: 'UGA',
  DZ: 'DZA',
  MA: 'MAR',
  AO: 'AGO',
  SD: 'SDN',
  MZ: 'MOZ',
  CM: 'CMR',
  CI: 'CIV',
  NE: 'NER',
  BF: 'BFA',
  ML: 'MLI',
  MW: 'MWI',
  ZM: 'ZMB',
  SN: 'SEN',
  SO: 'SOM',
  TD: 'TCD',
  ZW: 'ZWE',
  RW: 'RWA',
  BJ: 'BEN',
  TN: 'TUN',
  BI: 'BDI',
  SS: 'SSD',
  TG: 'TGO',
  LY: 'LBY',
  LR: 'LBR',
  MR: 'MRT',
  SL: 'SLE',
  CF: 'CAF',
  ER: 'ERI',
  GM: 'GMB',
  BW: 'BWA',
  NA: 'NAM',
  GA: 'GAB',
  LS: 'LSO',
  GW: 'GNB',
  GQ: 'GNQ',
  MU: 'MUS',
  AU: 'AUS',
  NZ: 'NZL',
  PG: 'PNG',
  FJ: 'FJI',
  NC: 'NCL',
  PF: 'PYF',
  SB: 'SLB',
  VU: 'VUT',
  WS: 'WSM',
  RU: 'RUS',
};

// Reverse lookup: 3-digit to 2-digit
const ISO_CODE_REVERSE: Record<string, string> = {};
Object.entries(ISO_CODE_MAP).forEach(([twoDigit, threeDigit]) => {
  ISO_CODE_REVERSE[threeDigit] = twoDigit;
});

// Calculate total countries in our database
export const getTotalCountries = () => {
  return Object.values(COUNTRIES_BY_CONTINENT).reduce(
    (total, countries) => total + countries.length,
    0
  );
};

interface Geography {
  id: string;
  rsmKey: string;
  properties: {
    ISO_A2: string;
    [key: string]: string | number | boolean | null | undefined;
  };
}

interface TerritoryMapProps {
  allowedCountries: string[];
  deniedCountries: string[];
  onCountryClick: (countryCode: string) => void;
}

export default function TerritoryMap({
  allowedCountries,
  deniedCountries,
  onCountryClick,
}: TerritoryMapProps) {
  const getCountryFill = (geo: Geography) => {
    const isoCode = ISO_CODE_REVERSE[geo.id] || geo.properties.ISO_A2;

    if (allowedCountries.includes(isoCode)) {
      return '#10b981'; // Green
    }
    if (deniedCountries.includes(isoCode)) {
      return '#ef4444'; // Red
    }
    return '#374151'; // Gray (neutral)
  };

  const handleGeographyClick = (geo: Geography) => {
    const isoCode = ISO_CODE_REVERSE[geo.id] || geo.properties.ISO_A2;
    if (isoCode) {
      onCountryClick(isoCode);
    }
  };

  const totalCountries = getTotalCountries();
  const allowedCount = allowedCountries.length;
  const deniedCount = deniedCountries.length;
  const selectedCount = allowedCount + deniedCount;

  return (
    <div className="w-full bg-gray-900 rounded-lg p-4 border border-white/20 relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 120,
        }}
        style={{
          width: '100%',
          height: 'auto',
        }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const fillColor = getCountryFill(geo);
              return (
                <Geography
                  key={`${geo.rsmKey}-${fillColor}`}
                  geography={geo}
                  fill={fillColor}
                  stroke="#1f2937"
                  strokeWidth={0.5}
                  style={{
                    default: {
                      outline: 'none',
                    },
                    hover: {
                      fill: '#6366f1',
                      outline: 'none',
                      cursor: 'pointer',
                    },
                    pressed: {
                      fill: '#4f46e5',
                      outline: 'none',
                    },
                  }}
                  onClick={() => handleGeographyClick(geo)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Statistics Display */}
      <div className="mt-4 flex items-center gap-6 text-sm font-semibold">
        <div className="flex items-center gap-2">
          <span className="text-green-400">{allowedCount} ALLOWED</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">{deniedCount} DENIED</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white">
            {selectedCount}/{totalCountries} TOTAL
          </span>
        </div>
      </div>
    </div>
  );
}
