#!/usr/bin/env node
/**
 * Re-captures the dev shell's bundled Loenen fixtures from a running
 * EnerPlanET dev stack, so they follow changes in BuEM, ignis or City2TABULA.
 *
 *   FIXTURE_EMAIL=... FIXTURE_PASSWORD=... node scripts/capture-fixtures.mjs
 *
 * BACKEND_URL defaults to http://localhost:8000/api. REPOS_CONF, optional, is
 * the path to the EnerPlanET repos.conf whose release pins are stamped into
 * loenen_fixtures.meta.json beside BuEM's own version. The building footprints
 * (the PyLovo grid in loenen_live_fixture.json) are the input and stay as they
 * are; everything derived from them is captured again:
 *
 * - City2TABULA enrichment and each building's surface geometry
 * - the ignis variant matches and records those buildings resolve to
 * - each building's stored BuEM demand profile and one series CSV, from a
 *   temporary model that is deleted at the end, also on failure
 *
 * Files are written only once every capture has succeeded.
 */

import { readFile, writeFile } from 'node:fs/promises';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8000/api';
const DATA = new URL('../src/assets/data/', import.meta.url);
const COUNTRY = 'netherlands';
/** Must match LOENEN_BBOX in src/app/components/LoenenLiveMap.tsx. */
const BBOX = { xmin: 6.0162, ymin: 52.0988, xmax: 6.0384, ymax: 52.113 };
/** The building the single-building view opens; its series CSV is bundled. Must match src/demo/services.ts. */
const CSV_BUILDING = '268428620';
const POLL_MS = 5000;
const POLL_LIMIT = 180;

const cookies = new Map();

/** One backend request carrying the session cookies and, on a write, the CSRF header. */
async function request(method, path, body) {
  const headers = { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
  if (method !== 'GET' && cookies.has('csrf_token')) headers['X-CSRF-Token'] = cookies.get('csrf_token');
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BACKEND + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const cookie of res.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const at = pair.indexOf('=');
    cookies.set(pair.slice(0, at), pair.slice(at + 1));
  }
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${await res.text()}`);
  return res;
}

const getJson = async (path) => (await request('GET', path)).json();
const postJson = async (path, body) => (await request('POST', path, body)).json();

async function login() {
  const { FIXTURE_EMAIL: email, FIXTURE_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('FIXTURE_EMAIL and FIXTURE_PASSWORD must be set');
  await request('GET', '/csrf-token');
  await request('POST', '/login', { email, password });
}

/** City2TABULA's enrichment for the footprints, and each matched building's surfaces by object_id. */
async function captureCity2tabula(features) {
  const osmIds = features.map((f) => String(f.properties.osm_id));
  const enrich = await postJson('/v1/city2tabula/enrich', { country: COUNTRY, bbox: BBOX, osm_ids: osmIds });
  const surfaces = {};
  for (const { object_id: objectId } of Object.values(enrich.data)) {
    const query = new URLSearchParams({ country: COUNTRY, object_ids: objectId });
    const [building] = await getJson(`/v1/city2tabula/geometry?${query}`);
    if (building) surfaces[objectId] = building;
  }
  return { enrich, surfaces };
}

/**
 * ignis matches keyed "<country>/<type>/<year>" and records keyed by variant
 * code, for every variant the enriched buildings resolve to. The key matches
 * what src/demo/services.ts looks up; src/demo/services.test.ts fails on a gap.
 */
async function captureIgnis(enrichData) {
  const match = {};
  const codes = new Set();
  for (const entry of Object.values(enrichData)) {
    const [country, , type] = entry.tabula_variant_code.split('.');
    const key = `${country}/${type}/${entry.default_construction_year}`;
    codes.add(entry.tabula_variant_code);
    if (match[key]) continue;
    const query = new URLSearchParams({ type, year: String(entry.default_construction_year) });
    match[key] = (await getJson(`/v2/ignis/variants/${country}/match?${query}`)).data;
    for (const variant of match[key].data) codes.add(variant.code);
  }
  const data = {};
  for (const code of [...codes].sort()) data[code] = (await getJson(`/v2/ignis/data/${code}`)).data;
  return { match, data };
}

/** The footprints' bounding box as a closed GeoJSON polygon. */
function footprintPolygon(features) {
  const points = features.flatMap((f) => f.geometry.coordinates.flat(2));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] };
}

async function createModel(buildings) {
  const workspace = await getJson('/workspaces/preferred');
  const created = await postJson('/models', {
    title: 'Configurator fixtures Loenen (temporary)',
    from_date: '2018-01-01',
    to_date: '2018-12-31',
    resolution: 60,
    workspace_id: workspace.data.preferred_workspace_id,
    coordinates: footprintPolygon(buildings.features),
    config: { buildings, energyVectors: ['electricity'] },
  });
  return created.data.id;
}

async function waitForDemand(modelId) {
  for (let i = 0; i < POLL_LIMIT; i += 1) {
    const { status } = await getJson(`/models/${modelId}/demand-profiles`);
    if (status === 'completed') return;
    if (status === 'failed') throw new Error(`Demand profiles for model ${modelId} failed`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Demand profiles for model ${modelId} not completed after ${(POLL_MS * POLL_LIMIT) / 1000} s`);
}

/** Every building's stored demand profile and one series CSV, from a temporary model. */
async function captureDemand(buildings) {
  const modelId = await createModel(buildings);
  console.log(`created temporary model ${modelId}`);
  try {
    await waitForDemand(modelId);
    const demand = {};
    for (const feature of buildings.features) {
      const osmId = String(feature.properties.osm_id);
      demand[osmId] = await getJson(`/models/${modelId}/buildings/${osmId}/demand-profile`);
    }
    const csv = await (await request('GET', `/models/${modelId}/buildings/${CSV_BUILDING}/series.csv`)).text();
    return { demand, csv };
  } finally {
    await request('DELETE', `/models/${modelId}`);
    console.log(`deleted temporary model ${modelId}`);
  }
}

/** The *_REF and *_IMAGE_TAG pins from a repos.conf, or none when no path is given. */
async function releasePins(path) {
  if (!path) return undefined;
  const lines = (await readFile(path, 'utf8')).split('\n');
  return Object.fromEntries(lines
    .map((line) => line.trim().split('='))
    .filter(([key]) => /^[A-Z0-9_]+_(REF|IMAGE_TAG)$/.test(key)));
}

/** What produced the captures, so a version change shows a re-capture is due. */
async function metadata(demand) {
  const producers = Object.values(demand).flatMap((profile) => profile.series.map((s) => s.producer_version));
  return {
    captured_at: new Date().toISOString(),
    buem: [...new Set(producers)].sort(),
    pins: await releasePins(process.env.REPOS_CONF),
  };
}

async function main() {
  const live = JSON.parse(await readFile(new URL('loenen_live_fixture.json', DATA), 'utf8'));
  await login();
  const { enrich, surfaces } = await captureCity2tabula(live.buildings.features);
  const ignis = await captureIgnis(enrich.data);
  const { demand, csv } = await captureDemand(live.buildings);

  const write = (name, text) => writeFile(new URL(name, DATA), text);
  await write('loenen_live_fixture.json', `${JSON.stringify({ ...live, enrich }, null, 2)}\n`);
  await write('loenen_surfaces_fixture.json', JSON.stringify(surfaces));
  await write('loenen_ignis_fixture.json', `${JSON.stringify(ignis)}\n`);
  await write('loenen_demand_fixture.json', `${JSON.stringify(demand)}\n`);
  await write(`loenen_series_${CSV_BUILDING}.csv`, csv);
  await write('loenen_fixtures.meta.json', `${JSON.stringify(await metadata(demand), null, 2)}\n`);
  console.log(`captured ${Object.keys(enrich.data).length} buildings, ${Object.keys(ignis.data).length} ignis variants`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
