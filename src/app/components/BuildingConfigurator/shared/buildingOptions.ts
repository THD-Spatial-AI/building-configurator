// Predefined option lists for building parameters.

import type { Translate } from '@/app/i18n';

type Label = (t: Translate) => string;

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

const BUILDING_TYPE_NAMES: Record<string, Label> = {
  SFH: (t) => t('options.buildingType.sfh'),
  TH:  (t) => t('options.buildingType.th'),
  MFH: (t) => t('options.buildingType.mfh'),
  AB:  (t) => t('options.buildingType.ab'),
  bakery:      (t) => t('options.buildingType.bakery'),
  clinic:      (t) => t('options.buildingType.clinic'),
  hotel:       (t) => t('options.buildingType.hotel'),
  office:      (t) => t('options.buildingType.office'),
  restaurant:  (t) => t('options.buildingType.restaurant'),
  school:      (t) => t('options.buildingType.school'),
  supermarket: (t) => t('options.buildingType.supermarket'),
  warehouse:   (t) => t('options.buildingType.warehouse'),
};

/** A building type value (a BUILDING_TYPE_LABELS label) as shown in the UI; an unknown value is shown as given. */
export function buildingTypeName(t: Translate, label: string): string {
  const code = Object.keys(BUILDING_TYPE_LABELS).find((c) => BUILDING_TYPE_LABELS[c] === label);
  return code ? BUILDING_TYPE_NAMES[code](t) : label;
}

/** BUILDING_TYPE_OPTIONS with translated labels; the values stay the stored type labels. */
export function buildingTypeOptions(t: Translate) {
  return BUILDING_TYPE_OPTIONS.map(({ value }) => ({ value, label: buildingTypeName(t, value) }));
}

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
export function archetypeOptions(t: Translate) {
  return [
    { value: '',                     label: t('options.archetype.default') },
    { value: 'generic',              label: t('options.archetype.generic') },
    { value: 'working_couple',       label: t('options.archetype.workingCouple') },
    { value: 'family_with_children', label: t('options.archetype.familyWithChildren') },
    { value: 'retired_single',       label: t('options.archetype.retiredSingle') },
    { value: 'student_shared',       label: t('options.archetype.studentShared') },
  ];
}

export function setbackOptions(t: Translate) {
  return [
    { value: 'none',           label: t('options.setback.none') },
    { value: 'night_only',     label: t('options.setback.nightOnly') },
    { value: 'night_and_away', label: t('options.setback.nightAndAway') },
    { value: 'deep',           label: t('options.setback.deep') },
  ];
}

export function cookingCarrierOptions(t: Translate) {
  return [
    { value: '',         label: t('options.cookingCarrier.default') },
    { value: 'electric', label: t('options.cookingCarrier.electric') },
    { value: 'gas',      label: t('options.cookingCarrier.gas') },
    { value: 'none',     label: t('options.cookingCarrier.none') },
  ];
}

/** BuEM load profiles a run can return, in the order they are shown. */
export const OUTPUT_PROFILES = [
  { key: 'heating',     label: (t: Translate) => t('options.output.heating') },
  { key: 'cooling',     label: (t: Translate) => t('options.output.cooling') },
  { key: 'electricity', label: (t: Translate) => t('options.output.electricity') },
  { key: 'hot_water',   label: (t: Translate) => t('options.output.hotWater') },
  { key: 'kitchen',     label: (t: Translate) => t('options.output.kitchen') },
] as const;

export type OutputProfile = typeof OUTPUT_PROFILES[number]['key'];
export type OutputLevel = 'none' | 'summary' | 'series';

export function outputLevelOptions(t: Translate): { value: OutputLevel; label: string }[] {
  return [
    { value: 'none',    label: t('options.outputLevel.none') },
    { value: 'summary', label: t('options.outputLevel.summary') },
    { value: 'series',  label: t('options.outputLevel.series') },
  ];
}

/**
 * BuEM household appliances by group. Each id is one appliance: BuEM cannot
 * express counts, so TVs are the three ids tv_1, tv_2 and tv_3.
 */
export const EQUIPMENT_GROUPS: { id: string; label: Label; items: { id: string; label: Label }[] }[] = [
  { id: 'cooking', label: (t) => t('options.equipmentGroup.cooking'), items: [
    { id: 'hob', label: (t) => t('options.equipment.hob') },
    { id: 'oven', label: (t) => t('options.equipment.oven') },
    { id: 'microwave', label: (t) => t('options.equipment.microwave') },
    { id: 'kettle', label: (t) => t('options.equipment.kettle') },
    { id: 'small_cooking_group', label: (t) => t('options.equipment.smallCookingGroup') },
    { id: 'air_fryer', label: (t) => t('options.equipment.airFryer') },
    { id: 'coffee_machine', label: (t) => t('options.equipment.coffeeMachine') },
  ] },
  { id: 'cold', label: (t) => t('options.equipmentGroup.cold'), items: [
    { id: 'fridge_freezer', label: (t) => t('options.equipment.fridgeFreezer') },
    { id: 'refrigerator', label: (t) => t('options.equipment.refrigerator') },
    { id: 'chest_freezer', label: (t) => t('options.equipment.chestFreezer') },
    { id: 'upright_freezer', label: (t) => t('options.equipment.uprightFreezer') },
  ] },
  { id: 'laundry', label: (t) => t('options.equipmentGroup.laundry'), items: [
    { id: 'washing_machine', label: (t) => t('options.equipment.washingMachine') },
    { id: 'tumble_dryer', label: (t) => t('options.equipment.tumbleDryer') },
    { id: 'washer_dryer', label: (t) => t('options.equipment.washerDryer') },
    { id: 'dish_washer', label: (t) => t('options.equipment.dishWasher') },
    { id: 'iron', label: (t) => t('options.equipment.iron') },
    { id: 'vacuum', label: (t) => t('options.equipment.vacuum') },
    { id: 'robot_vacuum', label: (t) => t('options.equipment.robotVacuum') },
  ] },
  { id: 'electronics', label: (t) => t('options.equipmentGroup.electronics'), items: [
    { id: 'tv_receiver_box', label: (t) => t('options.equipment.tvReceiverBox') },
    { id: 'personal_computer', label: (t) => t('options.equipment.personalComputer') },
    { id: 'printer', label: (t) => t('options.equipment.printer') },
    { id: 'hi_fi', label: (t) => t('options.equipment.hiFi') },
    { id: 'cassette_cd_player', label: (t) => t('options.equipment.cassetteCdPlayer') },
    { id: 'vcr_dvd', label: (t) => t('options.equipment.vcrDvd') },
    { id: 'laptop', label: (t) => t('options.equipment.laptop') },
    { id: 'smart_speaker', label: (t) => t('options.equipment.smartSpeaker') },
    { id: 'streaming_stick', label: (t) => t('options.equipment.streamingStick') },
    { id: 'wifi_router', label: (t) => t('options.equipment.wifiRouter') },
  ] },
  { id: 'other', label: (t) => t('options.equipmentGroup.misc'), items: [
    { id: 'lighting', label: (t) => t('options.equipment.lighting') },
    { id: 'clock', label: (t) => t('options.equipment.clock') },
    { id: 'answer_machine', label: (t) => t('options.equipment.answerMachine') },
    { id: 'cordless_telephone', label: (t) => t('options.equipment.cordlessTelephone') },
    { id: 'fax', label: (t) => t('options.equipment.fax') },
    { id: 'ev_charger', label: (t) => t('options.equipment.evCharger') },
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

/** COUNTRY_OPTIONS with translated labels. */
export function countryOptions(t: Translate) {
  return [
    { value: 'DE', label: t('options.country.de') },
    { value: 'AT', label: t('options.country.at') },
    { value: 'NL', label: t('options.country.nl') },
    { value: 'CZ', label: t('options.country.cz') },
  ];
}

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
