/**
 * EnerPlanET backend API client — session auth, PyLovo grid generation and
 * City2TABULA envelope enrichment.
 *
 * Unlike buemApi.ts/ignisApi.ts (documented demo-only shortcuts around a
 * not-yet-built Orchestrator), calling this backend directly from the
 * browser *is* the real architecture — see App[EnerPlanET frontend] -> [backend]
 * in the workspace CLAUDE.md diagram. Building Configurator is a second,
 * independent frontend against the same backend, used here to exercise it
 * ahead of any UI migration.
 *
 * BASE_URL defaults to '' (relative /api/... calls) so requests go through
 * Vite's dev proxy (see vite.config.ts) to http://localhost:8000, keeping
 * the browser same-origin with the backend — the session and csrf_token
 * cookies the backend sets are otherwise third-party cookies a browser may
 * refuse to store/send.
 */

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
