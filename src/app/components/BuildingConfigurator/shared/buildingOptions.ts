// Predefined option lists for building parameters.

/** BuEM building_type code to UI label. Residential types first, then service types. */
export const BUILDING_TYPE_LABELS: Record<string, string> = {
  SFH: 'Single-family House',
  TH:  'Terraced House',
  MFH: 'Multi-family House',
  AB:  'Apartment Block',
  bakery:      'Bakery',
  clinic:      'Clinic',
  hotel:       'Hotel',
  office:      'Office',
  restaurant:  'Restaurant',
  school:      'School',
  supermarket: 'Supermarket',
  warehouse:   'Warehouse',
};

const RESIDENTIAL_CODES = ['SFH', 'TH', 'MFH', 'AB'];

export const BUILDING_TYPE_OPTIONS = Object.values(BUILDING_TYPE_LABELS).map((label) => ({ value: label, label }));

const SERVICE_LABELS = Object.entries(BUILDING_TYPE_LABELS)
  .filter(([code]) => !RESIDENTIAL_CODES.includes(code))
  .map(([, label]) => label);

/** Service buildings take a capacity instead of households: no occupancy or equipment inputs. */
export function isServiceBuildingType(label: string): boolean {
  return SERVICE_LABELS.includes(label);
}

/** Building types BuEM needs a dwelling count for. */
export function requiresResidentialUnits(label: string): boolean {
  return label === BUILDING_TYPE_LABELS.MFH || label === BUILDING_TYPE_LABELS.AB;
}

/** Household composition driving BuEM's occupancy schedule. Empty means BuEM's per-type default. */
export const ARCHETYPE_OPTIONS = [
  { value: '',                     label: 'Default for the building type' },
  { value: 'generic',              label: 'Generic household' },
  { value: 'working_couple',       label: 'Working couple' },
  { value: 'family_with_children', label: 'Family with children' },
  { value: 'retired_single',       label: 'Retired, living alone' },
  { value: 'student_shared',       label: 'Students sharing' },
];

export const SETBACK_OPTIONS = [
  { value: 'none',           label: 'None' },
  { value: 'night_only',     label: 'At night' },
  { value: 'night_and_away', label: 'At night and when away' },
  { value: 'deep',           label: 'Deep setback' },
];

export const COOKING_CARRIER_OPTIONS = [
  { value: '',         label: 'Model default' },
  { value: 'electric', label: 'Electric' },
  { value: 'gas',      label: 'Gas' },
  { value: 'none',     label: 'Not reported' },
];

/** BuEM load profiles a run can return, in the order they are shown. */
export const OUTPUT_PROFILES = [
  { key: 'heating',     label: 'Space heating' },
  { key: 'cooling',     label: 'Space cooling' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'hot_water',   label: 'Hot water' },
  { key: 'kitchen',     label: 'Cooking gas' },
] as const;

export type OutputProfile = typeof OUTPUT_PROFILES[number]['key'];
export type OutputLevel = 'none' | 'summary' | 'series';

export const OUTPUT_LEVEL_OPTIONS: { value: OutputLevel; label: string }[] = [
  { value: 'none',    label: 'Off' },
  { value: 'summary', label: 'Annual' },
  { value: 'series',  label: 'Hourly' },
];

/**
 * BuEM household appliances by group. Each id is one appliance: BuEM cannot
 * express counts, so TVs are the three ids tv_1, tv_2 and tv_3.
 */
export const EQUIPMENT_GROUPS: { label: string; items: { id: string; label: string }[] }[] = [
  { label: 'Cooking', items: [
    { id: 'hob', label: 'Hob' },
    { id: 'oven', label: 'Oven' },
    { id: 'microwave', label: 'Microwave' },
    { id: 'kettle', label: 'Kettle' },
    { id: 'small_cooking_group', label: 'Small cooking appliances' },
  ] },
  { label: 'Cold', items: [
    { id: 'fridge_freezer', label: 'Fridge-freezer' },
    { id: 'refrigerator', label: 'Refrigerator' },
    { id: 'chest_freezer', label: 'Chest freezer' },
    { id: 'upright_freezer', label: 'Upright freezer' },
  ] },
  { label: 'Laundry and cleaning', items: [
    { id: 'washing_machine', label: 'Washing machine' },
    { id: 'tumble_dryer', label: 'Tumble dryer' },
    { id: 'washer_dryer', label: 'Washer-dryer' },
    { id: 'dish_washer', label: 'Dishwasher' },
    { id: 'iron', label: 'Iron' },
    { id: 'vacuum', label: 'Vacuum cleaner' },
  ] },
  { label: 'Electronics', items: [
    { id: 'tv_receiver_box', label: 'TV receiver box' },
    { id: 'personal_computer', label: 'Personal computer' },
    { id: 'printer', label: 'Printer' },
    { id: 'hi_fi', label: 'Hi-fi' },
    { id: 'cassette_cd_player', label: 'Cassette or CD player' },
    { id: 'vcr_dvd', label: 'VCR or DVD player' },
  ] },
  { label: 'Other', items: [
    { id: 'lighting', label: 'Lighting' },
    { id: 'clock', label: 'Clock' },
    { id: 'answer_machine', label: 'Answering machine' },
    { id: 'cordless_telephone', label: 'Cordless telephone' },
    { id: 'fax', label: 'Fax' },
  ] },
];

export const TV_IDS = ['tv_1', 'tv_2', 'tv_3'];

/** Earliest construction year the year input accepts. */
export const MIN_CONSTRUCTION_YEAR = 1850;

export const COUNTRY_OPTIONS = [
  { value: 'DE', label: 'DE - Germany'     },
  { value: 'AT', label: 'AT - Austria'     },
  { value: 'NL', label: 'NL - Netherlands' },
  { value: 'CZ', label: 'CZ - Czechia'     },
];

/**
 * Maps a construction year to the TABULA period label it falls in. The label is
 * a UI/ignis-lookup concept only; `general.constructionYear` is the stored value.
 * Every year resolves to a period, so callers never need a fallback.
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
