// What the configurator needs from the outside world, as four functions the
// host supplies. The package holds no URL, session or transport of its own:
// the host knows where its services live, and this file says what it must be
// able to reach.
//
// The seam is transport, not domain. Serialisation, orchestration, response
// mapping and the TABULA code mapping stay in the package; a callback does
// nothing but carry one request.

import type {
  IgnisCalculateResponse,
  IgnisDataResponse,
  IgnisInputs,
  IgnisMatchResponse,
} from './ignisAdapter';
import type { BuemThermalLoadProfile } from './buemApi';

/** One building's BuEM run, as the package builds it. */
export interface BuemBuildingRunRequest {
  osm_id: string;
  geometry: unknown;
  building: unknown;
  start_date: string;
  end_date: string;
  resolution: number;
  model_id: string;
}

export interface BuemBuildingRunResponse {
  osm_id: string;
  buem: { thermal_load_profile: BuemThermalLoadProfile };
}

/**
 * Every call rejects on failure; the package catches and decides what the
 * failure means on screen, so a host never reimplements that policy.
 *
 * Hold this object and each function in a module constant, a useMemo or a
 * useCallback. An object written inline is a new identity on every render,
 * and effects here key on the individual callbacks they use.
 */
export interface ConfiguratorServices {
  /**
   * TABULA variants for a building classification. `typeCode` is already a
   * TABULA code (MFH, SFH, AB, TH); the package maps the label.
   * Expected budget: 8 s.
   */
  fetchMatchingVariants(
    countryIso2: string,
    typeCode: string,
    constructionYear: number,
  ): Promise<IgnisMatchResponse>;

  /** One variant's full TABULA record. Expected budget: 8 s. */
  fetchVariantData(variantCode: string): Promise<IgnisDataResponse>;

  /**
   * Annual specific heat demand for a variant with the given overrides.
   * The payload is already in the service's own field names.
   * Expected budget: 15 s.
   */
  calculateHeatDemand(
    variantCode: string,
    inputs: Record<string, unknown>,
  ): Promise<IgnisCalculateResponse>;

  /**
   * One building through BuEM. The package builds the request and maps the
   * response; this only carries it. Expected budget: 15 s.
   */
  runBuemBuilding(request: BuemBuildingRunRequest): Promise<BuemBuildingRunResponse>;
}

/** The two lookups needed to resolve a building's TABULA archetype. */
export type VariantLookupServices = Pick<
  ConfiguratorServices,
  'fetchMatchingVariants' | 'fetchVariantData'
>;

export type { IgnisInputs };
