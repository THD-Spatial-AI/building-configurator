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
import type { BuildingDemandProfile } from './demandProfile';

/**
 * The overrides for a heat demand calculation, in the service's own field
 * names. Undefined when the user has overridden nothing and the variant's own
 * TABULA values stand.
 */
export type IgnisCalculatePayload = Record<string, unknown> | undefined;

/** One building's BuEM run, as the package builds it. */
export interface BuemBuildingRunRequest {
  osm_id: string;
  geometry: unknown;
  building: unknown;
  /** BuEM solver settings, forwarded as properties.buem.solver. */
  solver: { use_milp: boolean };
  /**
   * Load profiles to compute, forwarded as properties.buem.outputs. With
   * heating and cooling both none, building carries no envelope and the
   * request needs no weather.
   */
  outputs: Record<string, 'none' | 'summary' | 'series'>;
  start_date: string;
  end_date: string;
  resolution: number;
}

/** The building's stored demand after the run, the same body as its demand-profile route. */
export type BuemBuildingRunResponse = BuildingDemandProfile;

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
   * TABULA code (MFH, SFH, AB, TH); the package maps the label. `subtype` is
   * the TABULA building subtype (e.g. Deta, case as in TABULA codes), passed
   * when the building has a City2TABULA variant code; forward it to ignis as
   * the `subtype` query parameter. Expected budget: 8 s.
   */
  fetchMatchingVariants(
    countryIso2: string,
    typeCode: string,
    constructionYear: number,
    subtype?: string,
  ): Promise<IgnisMatchResponse>;

  /** One variant's full TABULA record. Expected budget: 8 s. */
  fetchVariantData(variantCode: string): Promise<IgnisDataResponse>;

  /**
   * Annual specific heat demand for a variant. `inputs` is undefined when
   * nothing was overridden, which is a calculation on the variant's own
   * values, not an error. Expected budget: 15 s.
   */
  calculateHeatDemand(
    variantCode: string,
    inputs: IgnisCalculatePayload,
  ): Promise<IgnisCalculateResponse>;

  /**
   * One building through BuEM. The package builds the request and maps the
   * response; this only carries it. Expected budget: 15 s.
   */
  runBuemBuilding(request: BuemBuildingRunRequest): Promise<BuemBuildingRunResponse>;

  /**
   * Optional. PV generation for the building's PV surfaces, run with Save &
   * Preview when the host passes pvSurfaceIds. Without it there is no PV run
   * and no PV row. Expected budget: 30 s.
   */
  runPvBuilding?(request: PvBuildingRunRequest): Promise<PvBuildingRunResponse>;
}

/** The host's PV surfaces on the open building, with the geometry as currently edited. */
export interface PvBuildingRunRequest {
  /** As in BuemBuildingRunRequest. */
  osm_id: string;
  surfaces: {
    id: string;
    /** m² */
    area: number;
    /** Degrees from horizontal, 0 to 90. */
    tilt: number;
    /** Degrees clockwise from north; 180 is south. */
    azimuth: number;
  }[];
}

export interface PvBuildingRunResponse {
  /** The building's PV generation over a full calendar year, the span of the BuEM totals, in kWh. */
  annualKwh: number;
}

/** The two lookups needed to resolve a building's TABULA archetype. */
export type VariantLookupServices = Pick<
  ConfiguratorServices,
  'fetchMatchingVariants' | 'fetchVariantData'
>;

export type { IgnisInputs };
