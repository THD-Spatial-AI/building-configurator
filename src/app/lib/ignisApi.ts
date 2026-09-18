/**
 * ignis API client.
 *
 * Loads TABULA refurbishment variants and runs the annual heat demand
 * pipeline. Every call goes through the EnerPlanET backend's ignis routes
 * rather than to ignis itself: the backend is the single entry point a client
 * talks to, and it holds the credential for the service behind it.
 *
 * The transport is supplied by the host application (see http.ts), so this
 * module reads no environment variable and carries no API key.
 *
 * The backend returns ignis's body verbatim inside its own {success, data}
 * envelope, so every reader here unwraps one level.
 */

import type {
  IgnisCalculateResponse,
  IgnisDataResponse,
  IgnisFieldMetadata,
  IgnisFieldMetadataResponse,
  IgnisInputs,
  IgnisMatchResponse,
  IgnisVariantLevel,
} from './ignisAdapter';
import { ignisInputsFromTabulaData, toIgnisApiPayload } from './ignisAdapter';
import type { HttpClient } from './http';

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

/** Converts a UI building type label to the TABULA code, or null if unsupported. */
export function toBuildingTypeCode(label: string): string | null {
  return BUILDING_TYPE_TO_TABULA[label] ?? null;
}

/** Returns true if the building type is supported by TABULA. */
export function isBuildingTypeSupported(label: string): boolean {
  return label in BUILDING_TYPE_TO_TABULA;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export interface IgnisApi {
  fetchMatchingVariants(
    countryIso2: string,
    buildingTypeLabel: string,
    constructionYear: number,
  ): Promise<IgnisMatchResponse | null>;
  fetchVariantData(variantCode: string): Promise<IgnisDataResponse | null>;
  loadVariantLevels(
    countryIso2: string,
    buildingTypeLabel: string,
    constructionYear: number,
  ): Promise<IgnisVariantLevel[]>;
  fetchFieldMetadata(): Promise<IgnisFieldMetadata[]>;
  calculateHeatDemand(
    variantCode: string,
    calcDemand: IgnisInputs,
  ): Promise<IgnisCalculateResponse | null>;
}

/**
 * Ceilings on a lookup and on the calculation respectively. These bound the
 * UI's wait, not the work: ignis answers a lookup from its own database and
 * the calculation is a closed-form pipeline, so anything slower than this is
 * a service in trouble rather than a long job to wait out.
 */
const LOOKUP_TIMEOUT_MS = 8000;
const CALCULATE_TIMEOUT_MS = 15000;

/** The backend's envelope around a verbatim upstream body. */
interface Enveloped<T> {
  data: T;
}

export function createIgnisApi(http: HttpClient): IgnisApi {
  /**
   * Every call here answers null or an empty list rather than throwing: each
   * one has a usable fallback in the UI (no variants offered, the component's
   * own tooltip text, the previous demand figure), and none is a write.
   */
  const api: IgnisApi = {
    async fetchMatchingVariants(countryIso2, buildingTypeLabel, constructionYear) {
      const typeCode = toBuildingTypeCode(buildingTypeLabel);
      if (!typeCode) return null;

      const path = `/v2/ignis/variants/${encodeURIComponent(countryIso2)}/match`
        + `?type=${encodeURIComponent(typeCode)}&year=${encodeURIComponent(String(constructionYear))}`;
      try {
        const res = await http.get<Enveloped<IgnisMatchResponse>>(path, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
        return res.data;
      } catch {
        return null;
      }
    },

    async fetchVariantData(variantCode) {
      try {
        const res = await http.get<Enveloped<IgnisDataResponse>>(
          `/v2/ignis/data/${encodeURIComponent(variantCode)}`,
          { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
        );
        return res.data;
      } catch {
        return null;
      }
    },

    /**
     * Loads all refurbishment levels for a building classification: /match for
     * the list of codes, then /data for each.
     */
    async loadVariantLevels(countryIso2, buildingTypeLabel, constructionYear) {
      const matchRes = await api.fetchMatchingVariants(countryIso2, buildingTypeLabel, constructionYear);
      if (!matchRes || matchRes.data.length === 0) return [];

      const levels = await Promise.all(
        matchRes.data.map(async (entry) => {
          const dataRes = await api.fetchVariantData(entry.code);
          if (!dataRes) return null;

          const inputs: IgnisInputs = ignisInputsFromTabulaData(
            dataRes.tabula_data as Record<string, unknown>,
          );
          return { code: entry.code, label: entry.label, data: inputs };
        }),
      );

      return levels.filter((level): level is IgnisVariantLevel => level !== null);
    },

    /** Labels and descriptions for every TABULA input field, used to enrich form tooltips. */
    async fetchFieldMetadata() {
      try {
        const res = await http.get<Enveloped<IgnisFieldMetadataResponse>>(
          '/v2/ignis/fields',
          { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
        );
        return res.data?.data ?? [];
      } catch {
        return [];
      }
    },

    /** Runs the calculation against the current working copy, returning the q_h_nd result. */
    async calculateHeatDemand(variantCode, calcDemand) {
      try {
        const res = await http.post<Enveloped<IgnisCalculateResponse>>(
          `/v2/ignis/calculate/${encodeURIComponent(variantCode)}`,
          toIgnisApiPayload(calcDemand),
          { signal: AbortSignal.timeout(CALCULATE_TIMEOUT_MS) },
        );
        return res.data;
      } catch {
        return null;
      }
    },
  };

  return api;
}
