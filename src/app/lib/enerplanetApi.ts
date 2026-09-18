/**
 * EnerPlanET backend API client: PyLovo grid generation, City2TABULA
 * envelope enrichment and the per-building BuEM run.
 *
 * The backend is the only service this component calls. It resolves weather,
 * holds the credentials for BuEM, ignis and City2TABULA, and routes each
 * request on through the orchestrator, so a client needs one origin and one
 * session rather than one per model.
 *
 * The transport is supplied by the host application (see http.ts). Paths here
 * are relative to the API root.
 */

import type { BuildingIdentity } from './buemAdapter';
import { serializeToBuemFeature } from './buemAdapter';
import type { BuemSimulationResult, BuemThermalLoadProfile } from './buemApi';
import { toSimulationResult } from './buemApi';
import type { HttpClient } from './http';

/** Minimal GeoJSON shapes, which avoids pulling in @types/geojson for two types. */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}
export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }>;
}

export interface GenerateGridOptions {
  includePublicBuildings?: boolean;
  includePrivateBuildings?: boolean;
}

export interface EnrichBbox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface EnrichEntry {
  object_id: string;
  match_type: number;
  tabula_variant_code?: string;
  default_construction_year?: number;
  buem: {
    building: {
      n_storeys?: number;
      h_room?: { value: number; unit: string };
      footprint_area?: { value: number; unit: string };
      envelope: { elements: unknown[] };
    };
  };
}

export interface EnrichResponse {
  status: 'completed' | 'running' | 'partial';
  run_id?: string;
  resolved: number;
  total: number;
  missing?: string[];
  data: Record<string, EnrichEntry>;
}

export interface BuemBuildingRunRequest {
  osm_id: string;
  geometry: unknown;
  building: unknown;
  start_date: string;
  end_date: string;
  resolution: number;
  model_id?: string;
}

export interface BuemBuildingRunResponse {
  osm_id: string;
  buem: { thermal_load_profile: BuemThermalLoadProfile };
}

export interface GridResult {
  buildings: GeoJsonFeatureCollection;
  transformers: GeoJsonFeatureCollection;
  lines: GeoJsonFeatureCollection;
  mv_lines: GeoJsonFeatureCollection;
  grids: GeoJsonFeatureCollection;
}

export interface EnerplanetApi {
  generateGrid(geom: GeoJsonPolygon, options?: GenerateGridOptions): Promise<GridResult>;
  enrichBuildings(country: string, bbox: EnrichBbox, osmIds: string[]): Promise<EnrichResponse>;
  runBuemBuilding(request: BuemBuildingRunRequest): Promise<BuemBuildingRunResponse>;
  runBuildingSimulation(
    identity: BuildingIdentity,
    elements: Record<string, any>,
    general: Record<string, any>,
    modelId: string,
    batteryConfig?: Record<string, any>,
  ): Promise<BuemSimulationResult | null>;
}

export function createEnerplanetApi(http: HttpClient): EnerplanetApi {
  const api: EnerplanetApi = {
    /**
     * Runs a PyLovo grid generation for the given area, returning its
     * buildings, transformers, lines and grids as GeoJSON FeatureCollections
     * (WGS84).
     *
     * The backend wraps PyLovo's response as { success, data }, unwrapped here
     * so callers only ever see the FeatureCollections.
     */
    async generateGrid(geom, options = {}) {
      const body = await http.post<{ data: GridResult }>('/v2/pylovo/generate-grid', {
        geom,
        include_public_buildings: options.includePublicBuildings ?? true,
        include_private_buildings: options.includePrivateBuildings ?? true,
      });
      return body.data;
    },

    /**
     * Resolves City2TABULA envelope data for the given osm_ids.
     *
     * status "running" means some osm_ids are unmatched in City2TABULA and a
     * background pipeline run was triggered to try to link them. It does not
     * mean the `data` in this response is incomplete or provisional: render it
     * immediately rather than waiting on run_id, since the run may never
     * resolve the missing ones (they can be genuinely unlinked).
     */
    enrichBuildings(country, bbox, osmIds) {
      return http.post<EnrichResponse>('/v1/city2tabula/enrich', { country, bbox, osm_ids: osmIds });
    },

    /**
     * Runs the caller's own envelope through BuEM for one building: the
     * interactive counterpart to a full model run, with the hourly series
     * returned inline. Weather is resolved server-side from `geometry`, so
     * none is sent. `building` is forwarded verbatim and must be complete: no
     * U-value resolution or archetype default is applied on the way.
     */
    runBuemBuilding(request) {
      return http.post<BuemBuildingRunResponse>('/v1/buem/building', request);
    },

    /**
     * Runs BuEM for one building and converts the result into the UI's
     * LoadDataPoint and thermal summary shapes.
     *
     * Returns null on any failure, so a backend that is unreachable or a BuEM
     * that rejected an incomplete envelope surfaces as a clear message rather
     * than a crash. The request can legitimately take several seconds: BuEM
     * runs a physics solve, not a lookup.
     *
     * Known gap: the backend's contract has no field for the MILP-solver
     * toggle (general.use_milp), so it is dropped here until the contract
     * grows one.
     */
    async runBuildingSimulation(identity, elements, general, modelId, batteryConfig) {
      const feature = serializeToBuemFeature(
        identity, elements, general,
        undefined, undefined, undefined, undefined,
        batteryConfig,
      );

      try {
        const response = await api.runBuemBuilding({
          osm_id:     String(feature.id),
          geometry:   feature.geometry,
          building:   feature.properties.buem.building,
          start_date: feature.properties.start_time,
          end_date:   feature.properties.end_time,
          resolution: Number(feature.properties.resolution),
          model_id:   modelId,
        });
        return toSimulationResult(response.buem.thermal_load_profile);
      } catch (err) {
        console.error('[buem/building] request failed', err);
        return null;
      }
    },
  };

  return api;
}

/**
 * Establishes a session against a local development backend.
 *
 * For standalone development only, where this component runs as its own
 * application and has to log itself in. An application hosting the component
 * has already authenticated its user, and its client carries that session, so
 * it must never call this.
 */
export async function devLogin(http: HttpClient, email: string, password: string): Promise<void> {
  // Seeds the csrf_token cookie the login POST itself must present.
  await http.get('/csrf-token');
  await http.post('/login', { email, password });
}
