/**
 * EnerPlanET backend API client — session auth, PyLovo grid generation,
 * City2TABULA envelope enrichment and the per-building BuEM run.
 *
 * Unlike ignisApi.ts (a documented demo-only shortcut around a not-yet-built
 * Orchestrator), calling this backend directly from the browser *is* the
 * real architecture — the EnerPlanET frontend calls its own backend directly
 * in production too. Building Configurator is a second, independent
 * frontend against the same backend, used here to exercise it ahead of any
 * UI migration.
 *
 * BASE_URL defaults to '' (relative /api/... calls) so requests go through
 * Vite's dev proxy (see vite.config.ts) to http://localhost:8000, keeping
 * the browser same-origin with the backend — the session and csrf_token
 * cookies the backend sets are otherwise third-party cookies a browser may
 * refuse to store/send.
 */

import type { BuildingIdentity } from './buemAdapter';
import { serializeToBuemFeature } from './buemAdapter';
import type { BuemSimulationResult, BuemThermalLoadProfile } from './buemApi';
import { toSimulationResult } from './buemApi';

const BASE_URL = (import.meta.env.VITE_ENERPLANET_API_URL as string | undefined) ?? '';

/** Minimal GeoJSON shapes — avoids pulling in @types/geojson for two types. */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}
export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{ type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }>;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');

  // CSRF double-submit: only mutating requests are checked (see auth-service's
  // CSRFMiddleware), and only once a csrf_token cookie exists (issued by
  // /csrf-token or any prior response after login).
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = readCookie('csrf_token');
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }

  return fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
}

/**
 * Logs in with the given credentials, establishing the session_id cookie
 * every other call in this module depends on. Local dev seed account only
 * (see enerplanet/backend cmd/seed/user.go) — never call this with anything
 * else.
 */
export async function login(email: string, password: string): Promise<void> {
  // Seeds the csrf_token cookie the login POST itself must present.
  await apiFetch('/api/csrf-token');

  const res = await apiFetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`EnerPlanET login failed: HTTP ${res.status}`);
  }
}

export interface GenerateGridOptions {
  includePublicBuildings?: boolean;
  includePrivateBuildings?: boolean;
}

/**
 * Runs a PyLovo grid generation for the given area, returning its buildings,
 * transformers, lines and grids as GeoJSON FeatureCollections (WGS84).
 *
 * The backend wraps PyLovo's response as { success, data } (see
 * internal/handler/pylovo/pylovo.go's use of httputil.SuccessResponse) —
 * unwrapped here so callers only ever see the FeatureCollections.
 */
export async function generateGrid(
  geom: GeoJsonPolygon,
  options: GenerateGridOptions = {},
): Promise<{
  buildings: GeoJsonFeatureCollection;
  transformers: GeoJsonFeatureCollection;
  lines: GeoJsonFeatureCollection;
  mv_lines: GeoJsonFeatureCollection;
  grids: GeoJsonFeatureCollection;
}> {
  const res = await apiFetch('/api/v2/pylovo/generate-grid', {
    method: 'POST',
    body: JSON.stringify({
      geom,
      include_public_buildings: options.includePublicBuildings ?? true,
      include_private_buildings: options.includePrivateBuildings ?? true,
    }),
  });
  if (!res.ok) {
    throw new Error(`generate-grid failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.data;
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
 * Resolves City2TABULA envelope data for the given osm_ids.
 *
 * status "running" means some osm_ids are unmatched in City2TABULA and a
 * background pipeline run was triggered to try to link them — it does NOT
 * mean the `data` in this response is incomplete or provisional. Render
 * `data` immediately; do not wait on run_id to "finish" before showing it,
 * since the run may never resolve the missing ones (they can be genuinely
 * unlinked). Polling /enrich/{run_id} is only useful if you want to pick up
 * newly-linked buildings later, which this client does not do.
 */
export async function enrichBuildings(
  country: string,
  bbox: EnrichBbox,
  osmIds: string[],
): Promise<EnrichResponse> {
  const res = await apiFetch('/api/v1/city2tabula/enrich', {
    method: 'POST',
    body: JSON.stringify({ country, bbox, osm_ids: osmIds }),
  });
  // 200 (completed/partial) and 202 (running) both carry a usable body.
  if (!res.ok && res.status !== 202) {
    throw new Error(`city2tabula enrich failed: HTTP ${res.status}`);
  }
  return res.json();
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

/**
 * Runs the caller's own envelope through BuEM for one building (POST
 * /api/v1/buem/building) — the interactive counterpart to a full model run:
 * one building, the caller's envelope instead of a City2TABULA lookup, the
 * hourly series returned inline. Weather is resolved server-side from
 * `geometry`, so none is sent. `building` is forwarded to buem-gateway
 * verbatim and must be complete: no U-value resolution or archetype default
 * is applied here.
 */
export async function runBuemBuilding(request: BuemBuildingRunRequest): Promise<BuemBuildingRunResponse> {
  const res = await apiFetch('/api/v1/buem/building', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`buem/building failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Runs BuEM for one building via the EnerPlanET backend and converts the
 * result into the UI's LoadDataPoint / thermal summary shapes.
 *
 * Establishes a session on every call, same as LoenenLiveTest.tsx — this
 * client has no persisted-login concept elsewhere, and re-authenticating is
 * cheap next to the BuEM solve itself.
 *
 * Returns null on any failure — no session credentials, backend or BuEM
 * unreachable, BuEM rejected the request (e.g. incomplete envelope) — so
 * callers can surface a clear message without crashing. The request can
 * legitimately take several seconds: BuEM runs a real physics solve, not a
 * lookup.
 *
 * Known gap: the backend's contract has no field for the UI's MILP-solver
 * toggle (general.use_milp) — the direct buem-gateway call used to forward
 * it, this path silently ignores it until the backend contract grows one.
 */
export async function runBuildingSimulation(
  identity: BuildingIdentity,
  elements: Record<string, any>,
  general: Record<string, any>,
  modelId: string,
  batteryConfig?: Record<string, any>,
): Promise<BuemSimulationResult | null> {
  const feature = serializeToBuemFeature(
    identity, elements, general,
    undefined, undefined, undefined, undefined,
    batteryConfig,
  );

  try {
    const email = import.meta.env.VITE_ENERPLANET_DEV_EMAIL as string | undefined;
    const password = import.meta.env.VITE_ENERPLANET_DEV_PASSWORD as string | undefined;
    if (!email || !password) throw new Error('VITE_ENERPLANET_DEV_EMAIL/PASSWORD not set in .env.local');
    await login(email, password);

    const response = await runBuemBuilding({
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
}
