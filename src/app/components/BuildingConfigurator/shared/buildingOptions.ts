// Predefined option lists for building parameters.
// Used by both the full Configure view (GeneralConfig) and the Overview quick-edit.

export const BUILDING_TYPE_OPTIONS = [
  { value: 'Single-family House', label: 'Single-family House' },
  { value: 'Terraced House',      label: 'Terraced House'      },
  { value: 'Multi-family House',  label: 'Multi-family House'  },
  { value: 'Apartment Block',     label: 'Apartment Block'     },
  { value: 'Office',              label: 'Office'              },
  { value: 'School',              label: 'School'              },
  { value: 'Retail',              label: 'Retail'              },
  { value: 'Hotel',               label: 'Hotel'               },
];

/** TABULA-aligned construction periods supported by the BUEM model. */
export const CONSTRUCTION_PERIOD_OPTIONS = [
  { value: 'Pre-1919',  label: 'Pre-1919'  },
  { value: '1919-1948', label: '1919-1948' },
  { value: '1949-1957', label: '1949-1957' },
  { value: '1958-1968', label: '1958-1968' },
  { value: '1969-1978', label: '1969-1978' },
  { value: '1979-1983', label: '1979-1983' },
  { value: '1984-1994', label: '1984-1994' },
  { value: '1995-2001', label: '1995-2001' },
  { value: '2002-2009', label: '2002-2009' },
  { value: 'Post-2010', label: 'Post-2010' },
];

export const COUNTRY_OPTIONS = [
  { value: 'DE', label: 'DE - Germany'     },
  { value: 'AT', label: 'AT - Austria'     },
  { value: 'NL', label: 'NL - Netherlands' },
  { value: 'CZ', label: 'CZ - Czechia'     },
];

/**
 * Maps a specific construction year to its TABULA period string.
 * Returns the period label that should be stored in `general.constructionPeriod`.
 */
export function yearToConstructionPeriod(year: number): string {
  if (year < 1919) return 'Pre-1919';
  if (year <= 1948) return '1919-1948';
  if (year <= 1957) return '1949-1957';
  if (year <= 1968) return '1958-1968';
  if (year <= 1978) return '1969-1978';
  if (year <= 1983) return '1979-1983';
  if (year <= 1994) return '1984-1994';
  if (year <= 2001) return '1995-2001';
  if (year <= 2009) return '2002-2009';
  return 'Post-2010';
}
