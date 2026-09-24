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

import type { BuildingIdentity } from '../app/lib/buemAdapter';
import { serializeToBuemFeature } from '../app/lib/buemAdapter';
import type { BuemSimulationResult, BuemThermalLoadProfile } from '../app/lib/buemApi';
import { toSimulationResult } from '../app/lib/buemApi';
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

/**
 * One envelope surface's polygon, as City2TABULA stores it: 3D coordinates in
 * the country's own CRS (EPSG:28992 for the Netherlands, 25832 for Germany),
 * named in the GeoJSON's own `crs` member. Nothing reprojects it on the way.
 *
 * `id` is the same id the enrich envelope element carries, so geometry joins
 * onto a BuildingState element without a second identifier. `geojson` is
 * absent for a surface row that holds no geometry.
 *
 * The id is a per-insert UUID, regenerated whenever City2TABULA's database is
 * rebuilt. It joins a geometry response to an enrich response fetched from the
 * same generation; it is not a durable key for stored per-surface state.
 */
export interface SurfaceGeometry {
  id: string;
  type: string;
  geojson?: {
    type: 'Polygon';
    crs?: { type: string; properties: { name: string } };
    /** [x, y, z] per vertex, ring closed (first vertex repeated last). */
    coordinates: number[][][];
  };
}

export interface BuildingGeometry {
  object_id: string;
  footprint_geojson?: unknown;
  surfaces?: SurfaceGeometry[];
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
  enrichBuildings(bbox: EnrichBbox, osmIds: string[], country?: string): Promise<EnrichResponse>;
  getSurfaceGeometry(objectId: string, country: string): Promise<BuildingGeometry | null>;
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
     * `country` is optional: left out, the backend resolves it from the bbox
     * centre through the same resolver a model run uses.
     *
     * status "running" means some osm_ids are unmatched in City2TABULA and a
     * background pipeline run was triggered to try to link them. It does not
     * mean the `data` in this response is incomplete or provisional: render it
     * immediately rather than waiting on run_id, since the run may never
     * resolve the missing ones (they can be genuinely unlinked).
     */
    enrichBuildings(bbox, osmIds, country) {
      return http.post<EnrichResponse>('/v1/city2tabula/enrich', {
        country: country ?? '',
        bbox,
        osm_ids: osmIds,
      });
    },

    /**
     * Returns one building's envelope surface polygons, for rendering it in 3D.
     *
     * `objectId` is City2TABULA's building id (EnrichEntry.object_id), not the
     * osm_id the rest of this client is keyed by. The query parameter is
     * plural because City2TABULA's own is, and the singular form is rejected,
     * but only one building may be asked for: a face count is unbounded, and
     * a response carrying several exceeds the size limit the request path
     * accepts.
     *
     * Returns null when City2TABULA holds no geometry for the id.
     */
    async getSurfaceGeometry(objectId, country) {
      const query = new URLSearchParams({ country, object_ids: objectId });
      const buildings = await http.get<BuildingGeometry[]>(`/v1/city2tabula/geometry?${query}`);
      return buildings?.[0] ?? null;
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
