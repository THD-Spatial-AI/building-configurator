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
 * Every refurbishment level for a building classification: one match call for
 * the codes, then one data call per code.
 */
export async function loadVariantLevels(
  services: VariantLookupServices,
  countryIso2: string,
  buildingTypeLabel: string,
  constructionYear: number,
): Promise<IgnisVariantLevel[]> {
  const typeCode = toBuildingTypeCode(buildingTypeLabel);
  if (!typeCode) return [];

  let codes;
  try {
    const match = await services.fetchMatchingVariants(countryIso2, typeCode, constructionYear);
    codes = match?.data ?? [];
  } catch {
    return [];
  }
  if (codes.length === 0) return [];

  const levels = await Promise.all(codes.map(async (entry) => {
    const inputs = await fetchVariantInputs(services, entry.code);
    return inputs ? { code: entry.code, label: entry.label, data: inputs } : null;
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
