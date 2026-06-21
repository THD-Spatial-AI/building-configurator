/**
 * HDCP API client.
 *
 * Calls hdcp-go endpoints to load TABULA variant lists and run the annual
 * heat demand calculation pipeline. The base URL is configured via the
 * VITE_HDCP_API_URL environment variable (default: http://localhost:8080).
 */

import type {
  HdcpCalculateResponse,
  HdcpDataResponse,
  HdcpInputs,
  HdcpMatchResponse,
  HdcpVariantLevel,
} from './hdcpAdapter';
import { hdcpInputsFromTabulaData, toHdcpApiPayload } from './hdcpAdapter';

const BASE_URL = (import.meta.env.VITE_HDCP_API_URL as string | undefined) ?? 'http://localhost:8080';

// ─── TABULA code mappings ─────────────────────────────────────────────────────

/**
 * Maps UI building type labels to TABULA building type codes.
 * Only residential building types supported by TABULA are included.
 */
const BUILDING_TYPE_TO_TABULA: Record<string, string> = {
  'Single-family House': 'SFH',
  'Terraced House':      'TH',
  'Multi-family House':  'MFH',
  'Apartment Block':     'AB',
};

/**
 * Maps UI construction period strings to TABULA period indices.
 * Period numbering follows the TABULA workbook column order.
 */
const CONSTRUCTION_PERIOD_TO_TABULA: Record<string, string> = {
  'Pre-1919':  '01',
  '1919-1948': '02',
  '1949-1957': '03',
  '1958-1968': '04',
  '1969-1978': '05',
  '1979-1983': '06',
  '1984-1994': '07',
  '1995-2001': '08',
  '2002-2009': '09',
  'Post-2010': '10',
};

/** Converts a UI building type label to the TABULA code, or null if unsupported. */
export function toBuildingTypeCode(label: string): string | null {
  return BUILDING_TYPE_TO_TABULA[label] ?? null;
}

/** Converts a UI construction period string to the TABULA period index, or null. */
export function toConstructionPeriodCode(period: string): string | null {
  return CONSTRUCTION_PERIOD_TO_TABULA[period] ?? null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Fetches all refurbishment variants that match a building's country, type,
 * and construction period from the HDCP /variants/:country/match endpoint.
 *
 * Returns an empty array if the building type is not supported by TABULA,
 * the service is unreachable, or no variants are found.
 */
export async function fetchMatchingVariants(
  countryIso2: string,
  buildingTypeLabel: string,
  constructionPeriod: string,
): Promise<HdcpMatchResponse | null> {
  const typeCode   = toBuildingTypeCode(buildingTypeLabel);
  const periodCode = toConstructionPeriodCode(constructionPeriod);

  if (!typeCode || !periodCode) return null;

  const url = `${BASE_URL}/api/v1/variants/${encodeURIComponent(countryIso2)}/match`
    + `?type=${encodeURIComponent(typeCode)}&period=${encodeURIComponent(periodCode)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as HdcpMatchResponse;
  } catch {
    return null;
  }
}

/**
 * Fetches the full TABULA record for a given variant code.
 * Returns null on error so callers can skip gracefully.
 */
export async function fetchVariantData(variantCode: string): Promise<HdcpDataResponse | null> {
  const url = `${BASE_URL}/api/v1/data/${encodeURIComponent(variantCode)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as HdcpDataResponse;
  } catch {
    return null;
  }
}

/**
 * Loads all refurbishment levels for a building classification.
 * Calls /match to get the list of codes, then /data for each code.
 * Returns an empty array if the service is unreachable or no variants exist.
 */
export async function loadVariantLevels(
  countryIso2: string,
  buildingTypeLabel: string,
  constructionPeriod: string,
): Promise<HdcpVariantLevel[]> {
  const matchRes = await fetchMatchingVariants(countryIso2, buildingTypeLabel, constructionPeriod);
  if (!matchRes || matchRes.data.length === 0) return [];

  const levels: HdcpVariantLevel[] = [];

  await Promise.all(
    matchRes.data.map(async (entry) => {
      const dataRes = await fetchVariantData(entry.code);
      if (!dataRes) return;

      const inputs: HdcpInputs = hdcpInputsFromTabulaData(
        dataRes.tabula_data as Record<string, unknown>,
      );
      levels.push({ code: entry.code, label: entry.label, data: inputs });
    }),
  );

  // Restore original order (Promise.all may resolve out of order).
  return matchRes.data
    .map((entry) => levels.find((l) => l.code === entry.code))
    .filter((l): l is HdcpVariantLevel => l !== undefined);
}

/**
 * Calls the HDCP calculate endpoint with the current calcDemand working copy.
 * Returns the q_h_nd result or null on error.
 */
export async function calculateHeatDemand(
  variantCode: string,
  calcDemand: HdcpInputs,
): Promise<HdcpCalculateResponse | null> {
  const url     = `${BASE_URL}/api/v1/calculate/${encodeURIComponent(variantCode)}`;
  const payload = toHdcpApiPayload(calcDemand);

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    payload ? JSON.stringify(payload) : undefined,
      signal:  AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as HdcpCalculateResponse;
  } catch {
    return null;
  }
}
