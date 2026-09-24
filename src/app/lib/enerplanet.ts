// The shapes EnerPlanET's building services speak in: a PyLovo grid, a
// City2TABULA enrich entry, one building's surface geometry. Types only — the
// requests that carry them belong to whoever holds the URLs.

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
