// TABULA archetype lookups and the annual heat demand calculation, over the
// host's transport callbacks.
//
// Each function answers null or an empty list rather than throwing: every one
// has a usable fallback on screen (no variants offered, the previous demand
// figure), and none is a write. The host's job is to reject on failure; this
// file decides what a failure means.

import {
  ignisInputsFromTabulaData,
  toIgnisApiPayload,
  type IgnisCalculateResponse,
  type IgnisInputs,
  type IgnisVariantLevel,
} from './ignisAdapter';
import type { ConfiguratorServices, VariantLookupServices } from './services';
import { TABULA_VARIANT_NAMES, variantNumber, variantSubtype, variantType } from './refurbishment';

/** Maps UI building type labels to TABULA building type codes. */
const BUILDING_TYPE_TO_TABULA: Record<string, string> = {
  'Single-family House': 'SFH',
  'Terraced House':      'TH',
  'Multi-family House':  'MFH',
  'Apartment Block':     'AB',
};

/** The TABULA code for a UI building type label, or null if unsupported. */
export function toBuildingTypeCode(label: string): string | null {
  return BUILDING_TYPE_TO_TABULA[label] ?? null;
}

/** Whether TABULA covers this building type. */
export function isBuildingTypeSupported(label: string): boolean {
  return label in BUILDING_TYPE_TO_TABULA;
}

/**
 * The TABULA type the levels are looked up for: the building type's own, else,
 * for a type TABULA lacks such as a school, the residential type of the
 * building's own variant code. Null when there is neither.
 */
export function lookupTypeCode(label: string, variantCode?: string): string | null {
  const own = toBuildingTypeCode(label);
  if (own) return own;
  const fromCode = variantType(variantCode);
  return fromCode && Object.values(BUILDING_TYPE_TO_TABULA).includes(fromCode) ? fromCode : null;
}

/** TABULA's refurbishment variants: existing state, usual and advanced refurbishment. */
const MAX_VARIANT_NUMBER = 3;

/** ignis's label, or TABULA's name for the number where ignis gives a generic one. */
function variantLabel(label: string, number: number): string {
  const generic = /^(Existing state|Medium refurbishment|Advanced refurbishment|Refurbishment level \d+)$/;
  return generic.test(label) ? TABULA_VARIANT_NAMES[number - 1] : label;
}

/**
 * The refurbishment variants 1 to 3 of a building classification, ordered by
 * number: one match call for the codes, then one data call per code.
 * `subtype` (e.g. Deta) narrows the match to the building's own subtype;
 * without it ignis matches its default subtype. `variantCode`, the building's
 * own, gives the type for a building type TABULA lacks (see lookupTypeCode).
 */
export async function loadVariantLevels(
  services: VariantLookupServices,
  countryIso2: string,
  buildingTypeLabel: string,
  constructionYear: number,
  subtype?: string,
  variantCode?: string,
): Promise<IgnisVariantLevel[]> {
  const typeCode = lookupTypeCode(buildingTypeLabel, variantCode);
  if (!typeCode) return [];

  let entries;
  try {
    const match = await services.fetchMatchingVariants(countryIso2, typeCode, constructionYear, subtype);
    entries = match?.data ?? [];
  } catch {
    return [];
  }

  // ignis releases before the subtype filter list every subtype of the period,
  // labelled as further levels; they are not deeper refurbishment.
  const kept = subtype ?? variantSubtype(entries[0]?.code);
  const numbered = entries
    .filter((entry) => variantSubtype(entry.code) === kept)
    .map((entry) => ({ entry, number: entry.number ?? variantNumber(entry.code) }))
    .filter((v): v is { entry: typeof v.entry; number: number } => v.number !== null && v.number <= MAX_VARIANT_NUMBER)
    .sort((a, b) => a.number - b.number);

  const levels = await Promise.all(numbered.map(async ({ entry, number }) => {
    const inputs = await fetchVariantInputs(services, entry.code);
    return inputs ? { code: entry.code, number, label: variantLabel(entry.label, number), data: inputs } : null;
  }));

  return levels.filter((level): level is IgnisVariantLevel => level !== null);
}

/** One variant's TABULA values, or null when the lookup failed. */
export async function fetchVariantInputs(
  services: Pick<ConfiguratorServices, 'fetchVariantData'>,
  variantCode: string,
): Promise<IgnisInputs | null> {
  try {
    const res = await services.fetchVariantData(variantCode);
    return res ? ignisInputsFromTabulaData(res.tabula_data) : null;
  } catch {
    return null;
  }
}

/** The annual demand for a variant and the current envelope, or null when it failed. */
export async function calculateHeatDemand(
  services: Pick<ConfiguratorServices, 'calculateHeatDemand'>,
  variantCode: string,
  inputs: IgnisInputs,
): Promise<IgnisCalculateResponse | null> {
  try {
    return await services.calculateHeatDemand(variantCode, toIgnisApiPayload(inputs));
  } catch {
    return null;
  }
}
