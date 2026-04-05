// Converts a raw BUEM GeoJSON Feature into the typed BuildingState the UI consumes.
//
// All JSON path traversal is centralised here. UI components receive BuildingState
// and never access raw BUEM JSON directly. The paths themselves are documented in
// src/app/config/modelDataMap.ts.

import type { BuildingElement } from '../components/BuildingConfigurator/configure/BuildingVisualization';
import type { LoadDataPoint } from '../components/BuildingConfigurator/overview/LoadProfileViewer';

// ─── Exported types ───────────────────────────────────────────────────────────

export interface BuildingIdentity {
  id: string;
  /** Human-readable display label, e.g. "Building 1". */
  label: string;
  /** [longitude, latitude] in decimal degrees. */
  coordinates: [number, number];
  buildingType: string;        // localised label, e.g. "Multi-family House"
  constructionPeriod: string;
  country: string;
  floorArea: number;           // m²
  roomHeight: number;          // m
  storeys: number;
}

export interface ThermalSummary {
  heatingKwh: number;
  coolingKwh: number;
  electricityKwh: number;
  peakHeatingKw: number;
  peakCoolingKw: number;
  energyIntensityKwhM2: number;
}

export interface BuildingState {
  identity: BuildingIdentity;
  /** Envelope surfaces keyed by element id — same shape as the configurator UI. */
  envelope: Record<string, BuildingElement>;
  /** Annual summary from the model. Null when no results are present. */
  thermalSummary: ThermalSummary | null;
  /** Hourly load profile. Null when the request did not include timeseries. */
  timeseries: LoadDataPoint[] | null;
  /** UI technology IDs that are installed according to the model config. */
  installedTechIds: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Maps BUEM building_type codes to human-readable labels. */
const BUILDING_TYPE_LABELS: Record<string, string> = {
  MFH: 'Multi-family House',
  SFH: 'Single-family House',
  AB:  'Apartment Block',
  TH:  'Terraced House',
};

/**
 * Converts a BUEM element id to a readable label.
 * e.g. "Wall_1" → "Wall 1", "Window_S" → "Window S".
 */
function labelFromId(id: string): string {
  return id.replace(/_/g, ' ');
}

/**
 * Extracts the numeric value from a BUEM measurement object.
 * Returns `fallback` when the field is absent or not a valid number.
 */
function qty(obj: unknown, fallback = 0): number {
  if (obj && typeof obj === 'object' && 'value' in obj) {
    const n = Number((obj as { value: unknown }).value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Converts the raw BUEM envelope element array into a keyed BuildingElement map.
 * Elements with an unrecognised type are skipped.
 */
function adaptEnvelope(elements: unknown[]): Record<string, BuildingElement> {
  const valid: BuildingElement['type'][] = ['wall', 'window', 'roof', 'floor', 'door'];
  const result: Record<string, BuildingElement> = {};

  elements.forEach((el) => {
    if (!el || typeof el !== 'object') return;

    const raw = el as Record<string, unknown>;
    const id   = String(raw.id ?? '');
    const type = String(raw.type ?? '') as BuildingElement['type'];

    if (!id || !valid.includes(type)) return;

    const gRaw = raw.g_gl;
    const gValue = (gRaw && typeof gRaw === 'object' && 'value' in gRaw)
      ? Number((gRaw as { value: unknown }).value)
      : null;

    result[id] = {
      id,
      label:   labelFromId(id),
      type,
      area:    qty(raw.area),
      uValue:  qty(raw.U),
      gValue:  gValue !== null && Number.isFinite(gValue) ? gValue : null,
      tilt:    qty(raw.tilt),
      azimuth: qty(raw.azimuth),
      source: 'city',
      customMode: false,
    };
  });

  return result;
}

/**
 * Converts the BUEM timeseries object into the LoadDataPoint array the chart viewer
 * expects. BUEM has no DHW timeseries, so hotwater is set to 0.
 *
 * BUEM timeseries shape:
 *   { unit, timestamps: string[], heating: number[], cooling: number[], electricity: number[] }
 */
function adaptTimeseries(ts: unknown): LoadDataPoint[] | null {
  if (!ts || typeof ts !== 'object') return null;

  const raw = ts as Record<string, unknown>;
  const timestamps  = Array.isArray(raw.timestamps)  ? raw.timestamps  as string[] : [];
  const heating     = Array.isArray(raw.heating)     ? raw.heating     as number[] : [];
  const electricity = Array.isArray(raw.electricity) ? raw.electricity as number[] : [];

  if (timestamps.length === 0) return null;

  return timestamps.map((timestamp, i) => ({
    timestamp,
    heating:     Number.isFinite(heating[i])     ? heating[i]     : 0,
    hotwater:    0,    // BUEM does not model DHW in the hourly timeseries
    electricity: Number.isFinite(electricity[i]) ? electricity[i] : 0,
  }));
}

/** Maps EnerPlanET/Calliope tech keys to the UI technology IDs in TechnologiesSection. */
const TECH_KEY_TO_UI_ID: Record<string, string> = {
  pv_supply:        'solar_pv',
  battery_storage:  'battery',
  heat_pump_supply: 'heat_pump',
  heat_pump:        'heat_pump',
  ev_charger:       'ev_charger',
};

/**
 * Returns the list of UI technology IDs that are present in a `techs` object.
 * A technology is considered installed if its key appears in the object (regardless of values).
 */
function extractInstalledTechIds(techs: unknown): string[] {
  if (!techs || typeof techs !== 'object') return [];

  return Object.keys(techs as Record<string, unknown>)
    .map((key) => TECH_KEY_TO_UI_ID[key])
    .filter((id): id is string => !!id);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a single BUEM GeoJSON Feature into a BuildingState.
 * Throws if the input is not a valid BUEM Feature.
 */
export function adaptBuemFeature(feature: unknown): BuildingState {
  if (!feature || typeof feature !== 'object') {
    throw new Error('adaptBuemFeature: expected a GeoJSON Feature object.');
  }

  const f   = feature as Record<string, unknown>;
  const geo = f.geometry as { coordinates?: unknown[] } | undefined;
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const buem  = (props.buem ?? {}) as Record<string, unknown>;
  // techs is a sibling of properties in the EnerPlanET topology node
  const techs = f.techs ?? props.techs;
  const bldg  = (buem.building ?? {}) as Record<string, unknown>;
  const tlp   = (buem.thermal_load_profile ?? {}) as Record<string, unknown>;
  const summary = (tlp.summary ?? {}) as Record<string, unknown>;

  // ── Identity ────────────────────────────────────────────────────────────────
  const rawId = String(f.id ?? '');
  const coords = Array.isArray(geo?.coordinates) ? geo!.coordinates as number[] : [0, 0];
  const lon = Number(coords[0] ?? 0);
  const lat = Number(coords[1] ?? 0);

  // Support both BUEM response field name (building_type) and EnerPlanET config field name (type).
  const typeCode = String(bldg.building_type ?? bldg.type ?? '');
  const buildingType = BUILDING_TYPE_LABELS[typeCode] ?? typeCode;

  const identity: BuildingIdentity = {
    id:                 rawId,
    label:              rawId,
    coordinates:        [lon, lat],
    buildingType,
    constructionPeriod: String(bldg.construction_period ?? ''),
    country:            String(bldg.country ?? ''),
    floorArea:          qty(bldg.A_ref),
    roomHeight:         qty(bldg.h_room),
    storeys:            Number(bldg.n_storeys ?? 0),
  };

  // ── Envelope ────────────────────────────────────────────────────────────────
  const envelopeEl = (bldg.envelope as Record<string, unknown>)?.elements;
  const envelope = adaptEnvelope(Array.isArray(envelopeEl) ? envelopeEl : []);

  // ── Thermal summary ─────────────────────────────────────────────────────────
  const hasSummary = Object.keys(summary).length > 0;
  const thermalSummary: ThermalSummary | null = hasSummary ? {
    heatingKwh:           qty((summary.heating     as Record<string, unknown>)?.total),
    coolingKwh:           qty((summary.cooling     as Record<string, unknown>)?.total),
    electricityKwh:       qty((summary.electricity as Record<string, unknown>)?.total),
    peakHeatingKw:        qty(summary.peak_heating_load),
    peakCoolingKw:        qty(summary.peak_cooling_load),
    energyIntensityKwhM2: qty(summary.energy_intensity),
  } : null;

  // ── Timeseries ──────────────────────────────────────────────────────────────
  const timeseries = adaptTimeseries(tlp.timeseries);

  // ── Technologies ─────────────────────────────────────────────────────────────
  const installedTechIds = extractInstalledTechIds(techs);

  return { identity, envelope, thermalSummary, timeseries, installedTechIds };
}

/**
 * Formats a coordinate pair as a display string.
 * e.g. [11.582, 48.135] → "48.1350° N, 11.5820° E"
 */
export function formatCoordinates(lon: number, lat: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

/**
 * Parses a load-profile CSV into LoadDataPoint[].
 *
 * Expected columns (case-insensitive): timesteps | datetime | timestamp,
 * electricity, heating, dhw | hotwater.
 * Rows that cannot be parsed are silently skipped.
 */
export function parseLoadProfileCsv(csv: string): LoadDataPoint[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const tsIdx = headers.findIndex((h) => ['timesteps', 'datetime', 'timestamp', 'time', 'date'].includes(h));
  const elIdx = headers.findIndex((h) => ['electricity', 'power', 'el'].includes(h));
  const htIdx = headers.findIndex((h) => ['heating', 'heat'].includes(h));
  const hwIdx = headers.findIndex((h) => ['dhw', 'hotwater', 'hot_water'].includes(h));

  if (tsIdx === -1) return [];

  return lines.slice(1).flatMap((line) => {
    const cols = line.split(',');
    const timestamp = cols[tsIdx]?.trim() ?? '';
    if (!timestamp) return [];
    return [{
      timestamp,
      electricity: elIdx >= 0 ? (Number(cols[elIdx]) || 0) : 0,
      heating:     htIdx >= 0 ? (Number(cols[htIdx]) || 0) : 0,
      hotwater:    hwIdx >= 0 ? (Number(cols[hwIdx]) || 0) : 0,
    }];
  });
}

/**
 * Extracts building Features from an EnerPlanET config object.
 *
 * EnerPlanET topology format:
 *   { topology: [{ from: Feature, to: Feature }, ...] }
 *
 * Only `from` nodes with a `buem` block are treated as buildings.
 * Returns an empty array when no matching features are found.
 */
export function extractFeaturesFromConfig(config: unknown): unknown[] {
  if (!config || typeof config !== 'object') return [];

  const topology = (config as Record<string, unknown>).topology;
  if (!Array.isArray(topology)) return [];

  return topology
    .map((edge) => {
      if (!edge || typeof edge !== 'object') return null;
      return (edge as Record<string, unknown>).from ?? null;
    })
    .filter((node): node is Record<string, unknown> => {
      if (!node || typeof node !== 'object') return false;
      const props = (node as Record<string, unknown>).properties as Record<string, unknown> | undefined;
      return !!props?.buem;
    });
}
