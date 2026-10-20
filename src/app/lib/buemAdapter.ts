// Converts a raw BUEM GeoJSON Feature into the typed BuildingState the UI consumes.
//
// All JSON path traversal is centralised here. UI components receive BuildingState
// and never access raw BUEM JSON directly. The paths themselves are documented in
// src/app/config/modelDataMap.ts.

import { MODEL_DATA_MAP } from '../config/modelDataMap';
import {
  getMappedArray,
  getMappedNumber,
  getMappedValue,
  hasMappedValue,
} from '../config/modelDataResolver';
import { faceFromAzimuth, type BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import {
  BUILDING_TYPE_LABELS,
  OUTPUT_PROFILES,
  isServiceBuildingType,
  requiresResidentialUnits,
  type OutputLevel,
  type OutputProfile,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import type { LoadDataPoint } from './loadProfile';
import { REFURB_TYPES, type RefurbElementType, type Refurbishment } from './refurbishment';

// ─── Exported types ───────────────────────────────────────────────────────────

export interface BuildingIdentity {
  id: string;
  /** Human-readable display label, e.g. "Building 1". */
  label: string;
  /** [longitude, latitude] in decimal degrees. */
  coordinates: [number, number];
  buildingType: string;        // localised label, e.g. "Multi-family House"
  constructionYear: number;
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
  /** Absent when the source carries none, as the stored demand profile does not. */
  energyIntensityKwhM2?: number;
  /** Domestic hot water, kWh — absent (0) on results predating BuEM's v6-draft hot_water/kitchen fields. */
  dhwKwh: number;
  /** Cooking gas demand, a different fuel channel from the electric kWh above, kept in kWh_gas rather than summed with it. Absent when BuEM computed none. */
  kitchenGasKwh?: number;
  /** BuEM's own heating+cooling+electricity+hot_water total — gas deliberately excluded. */
  totalEnergyKwh: number;
}

export interface GeometryData {
  buildingId: string;
  coordinates: [number, number];
  buildingFootprint: unknown | null;
  buildingHeight: number | null;
}

export interface ThematicData {
  identity: BuildingIdentity;
  envelope: Record<string, BuildingElement>;
  thermalSummary: ThermalSummary | null;
  timeseries: LoadDataPoint[] | null;
}

export interface BuildingState {
  /** Centralised geometry domain for embedding this dashboard in external apps. */
  geometry: GeometryData;
  /** Centralised thematic domain for identity, envelope and results. */
  thematic: ThematicData;
  identity: BuildingIdentity;
  /** Envelope surfaces keyed by element id — same shape as the configurator UI. */
  envelope: Record<string, BuildingElement>;
  /** Annual summary from the model. Null when no results are present. */
  thermalSummary: ThermalSummary | null;
  /** Hourly load profile. Null when the request did not include timeseries. */
  timeseries: LoadDataPoint[] | null;
  /**
   * HDCP (ISO 13790 annual heat demand) state.
   * Null until the building's country + type + construction period resolve
   * to at least one TABULA variant in the HDCP service.
   */
  ignis: import('./ignisAdapter').IgnisState | null;
  /** Building parameters the source or a saved edit set; the configurator defaults the rest. */
  parameters?: BuildingParameters;
  /** The building's TABULA variant and the refurbishment state chosen per element type. */
  refurbishment?: Refurbishment;
}

/** The building parameters BuEM reads beyond identity and envelope, named as the configurator holds them. */
export interface BuildingParameters {
  n_air_infiltration?: number;      // 1/h
  n_air_use?: number;               // 1/h
  c_m?: number;                     // kJ/(m2K)
  massClass?: string;               // Light | Medium | Heavy; VeryLight and VeryHeavy from older exports
  comfortT_lb?: number;             // degC, heating setpoint
  comfortT_ub?: number;             // degC, cooling setpoint
  /** The windows BuEM adds when the envelope has none; null leaves each to BuEM. */
  window_to_wall_ratio?: number | null;
  window_U?: number | null;         // W/(m2K)
  window_g_gl?: number | null;
  /** Whether BuEM solves with MILP rather than its default sparse solver. */
  use_milp?: boolean;
  residential_units?: number | null;
  num_persons?: number | null;      // per dwelling
  archetype?: string;
  region_code?: string;             // CBS municipality code, e.g. GM0200
  cooking_carrier?: string;         // electric | gas | none
  include_dhw?: boolean;
  setback_profile?: string;
  capacity?: number | null;         // occupants, service types only
  equipment?: Record<string, boolean>;
  outputs?: Record<OutputProfile, OutputLevel>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Reverse of BUILDING_TYPE_LABELS, for serializing a label back to its BUEM code. */
const BUILDING_TYPE_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(BUILDING_TYPE_LABELS).map(([code, label]) => [label, code]),
);

/**
 * Converts a BUEM element id to a readable label.
 * e.g. "Wall_1" -> "Wall 1", "Window_S" -> "Window S".
 */
function labelFromId(id: string): string {
  return id.replace(/_/g, ' ');
}

const UUID_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "South wall", "Flat roof", "Floor": what a surface is and which way it faces. */
function orientationLabel(el: Pick<BuildingElement, 'type' | 'tilt' | 'azimuth'>): string {
  if (el.type === 'floor') return 'Floor';
  // Same flat-roof threshold as roofFaceFromElement.
  if (el.type === 'roof' && el.tilt <= 10) return 'Flat roof';
  const face = faceFromAzimuth(el.azimuth).replace('_wall', '');
  return `${face[0].toUpperCase()}${face.slice(1)} ${el.type}`;
}

/**
 * Display labels for surfaces, in input order. A UUID id (City2TABULA) says
 * nothing to a reader, so those surfaces are named by type and orientation,
 * numbered where several share a name; other ids keep labelFromId.
 */
export function readableSurfaceLabels(
  elements: Pick<BuildingElement, 'id' | 'type' | 'tilt' | 'azimuth'>[],
): string[] {
  const names = elements.map((el) => (UUID_ID.test(el.id) ? orientationLabel(el) : null));
  const totals = new Map<string, number>();
  names.forEach((name) => { if (name) totals.set(name, (totals.get(name) ?? 0) + 1); });
  const seen = new Map<string, number>();
  return elements.map((el, i) => {
    const name = names[i];
    if (!name) return labelFromId(el.id);
    if (totals.get(name) === 1) return name;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return `${name} ${n}`;
  });
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
  const names: Record<string, string> = {};

  elements.forEach((el) => {
    if (!el || typeof el !== 'object') return;

    const raw = el as Record<string, unknown>;
    const id   = String(raw.id ?? '');
    const type = String(raw.type ?? '') as BuildingElement['type'];

    if (!id || !valid.includes(type)) return;
    if (typeof raw.name === 'string' && raw.name) names[id] = raw.name;

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
      ...transmissionFrom(raw),
      ...(typeof raw.parent_id === 'string' && raw.parent_id ? { parentId: raw.parent_id } : {}),
      source: 'city',
      customMode: false,
    };
  });

  const surfaces = Object.values(result);
  readableSurfaceLabels(surfaces).forEach((label, i) => { surfaces[i].label = names[surfaces[i].id] ?? label; });
  return result;
}

/** The element's b_transmission, when the source sets one; 0 marks a party wall. */
function transmissionFrom(raw: Record<string, unknown>): Pick<BuildingElement, 'bTransmission'> {
  const b = raw.b_transmission;
  return b && typeof b === 'object' && 'value' in b ? { bTransmission: qty(b) } : {};
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

  // BUEM convention: demand is negative. Store as positive magnitudes so that
  // future production series (e.g. PV) can be overlaid on the same positive axis.
  return timestamps.map((timestamp, i) => ({
    timestamp,
    heating:     Number.isFinite(heating[i])     ? Math.abs(heating[i])     : 0,
    hotwater:    0,
    electricity: Number.isFinite(electricity[i]) ? Math.abs(electricity[i]) : 0,
    dhw:         0,
    kitchen:     0,
  }));
}

function coordsFromFeature(feature: unknown): [number, number] {
  const coords = getMappedValue<unknown[]>(feature, MODEL_DATA_MAP.thematic.coordinates) ?? [];
  const lon = Number(coords[0] ?? 0);
  const lat = Number(coords[1] ?? 0);
  return [lon, lat];
}

function adaptGeometryData(feature: unknown): GeometryData {
  const [lon, lat] = coordsFromFeature(feature);
  const buildingHeight = getMappedValue<unknown>(feature, MODEL_DATA_MAP.geometry.buildingHeight);

  return {
    buildingId: String(getMappedValue(feature, MODEL_DATA_MAP.geometry.buildingId) ?? ''),
    coordinates: [lon, lat],
    buildingFootprint: getMappedValue(feature, MODEL_DATA_MAP.geometry.buildingFootprint) ?? null,
    buildingHeight: typeof buildingHeight === 'number' && Number.isFinite(buildingHeight)
      ? buildingHeight
      : null,
  };
}

function adaptThematicData(feature: unknown): ThematicData {
  const descriptor = MODEL_DATA_MAP.thematic.descriptor;
  const results = MODEL_DATA_MAP.thematic.results;
  const [lon, lat] = coordsFromFeature(feature);
  const rawId = String(getMappedValue(feature, MODEL_DATA_MAP.thematic.buildingId) ?? '');

  const typeCode = String(getMappedValue(feature, descriptor.buildingTypeCode) ?? '');
  const buildingType = BUILDING_TYPE_LABELS[typeCode] ?? typeCode;
  const identity: BuildingIdentity = {
    id: rawId,
    label: String(getMappedValue(feature, MODEL_DATA_MAP.thematic.label) ?? rawId),
    coordinates: [lon, lat],
    buildingType,
    constructionYear: Number(getMappedValue(feature, descriptor.constructionYear)) || 0,
    country: String(getMappedValue(feature, descriptor.country) ?? ''),
    floorArea: getMappedNumber(feature, descriptor.floorArea),
    roomHeight: getMappedNumber(feature, descriptor.roomHeight),
    storeys: getMappedNumber(feature, descriptor.storeys),
  };

  const envelope = adaptEnvelope(getMappedArray(feature, MODEL_DATA_MAP.thematic.envelope.elements));
  const hasSummary = [
    results.heatingTotal,
    results.coolingTotal,
    results.electricityTotal,
    results.peakHeatingLoad,
    results.peakCoolingLoad,
    results.energyIntensity,
  ].some((path) => hasMappedValue(feature, path));
  const thermalSummary: ThermalSummary | null = hasSummary ? {
    heatingKwh: getMappedNumber(feature, results.heatingTotal),
    coolingKwh: getMappedNumber(feature, results.coolingTotal),
    electricityKwh: getMappedNumber(feature, results.electricityTotal),
    peakHeatingKw: getMappedNumber(feature, results.peakHeatingLoad),
    peakCoolingKw: getMappedNumber(feature, results.peakCoolingLoad),
    energyIntensityKwhM2: getMappedNumber(feature, results.energyIntensity),
    dhwKwh: getMappedNumber(feature, results.dhwTotal),
    kitchenGasKwh: hasMappedValue(feature, results.kitchenTotal)
      ? getMappedNumber(feature, results.kitchenTotal)
      : undefined,
    totalEnergyKwh: hasMappedValue(feature, results.totalEnergyDemand)
      ? getMappedNumber(feature, results.totalEnergyDemand)
      : getMappedNumber(feature, results.heatingTotal) + getMappedNumber(feature, results.coolingTotal)
        + getMappedNumber(feature, results.electricityTotal) + getMappedNumber(feature, results.dhwTotal),
  } : null;

  return {
    identity,
    envelope,
    thermalSummary,
    timeseries: adaptTimeseries(getMappedValue(feature, results.timeseries) ?? null),
  };
}

/** Extracts the geometry and thematic domains from a single feature. */
export function extractBuildingDashboardData(feature: unknown): Pick<BuildingState, 'geometry' | 'thematic'> {
  return {
    geometry: adaptGeometryData(feature),
    thematic: adaptThematicData(feature),
  };
}

const MASS_CLASS_LABELS: Record<string, string> = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };

// The editor offers BuEM's three classes. VeryLight and VeryHeavy still arrive
// from older configurator exports and are sent as the nearest BuEM class.
const THERMAL_CLASSES: Record<string, string> = {
  VeryLight: 'light', Light: 'light', Medium: 'medium', Heavy: 'heavy', VeryHeavy: 'heavy',
};

/** The building parameters the feature sets, or undefined when it sets none. */
function adaptParameters(feature: unknown): BuildingParameters | undefined {
  const paths = MODEL_DATA_MAP.thematic.parameters;
  const parameters: BuildingParameters = {};
  if (hasMappedValue(feature, paths.nAirInfiltration)) parameters.n_air_infiltration = getMappedNumber(feature, paths.nAirInfiltration);
  if (hasMappedValue(feature, paths.nAirUse)) parameters.n_air_use = getMappedNumber(feature, paths.nAirUse);
  if (hasMappedValue(feature, paths.cM)) parameters.c_m = getMappedNumber(feature, paths.cM);
  if (hasMappedValue(feature, paths.comfortTLb)) parameters.comfortT_lb = getMappedNumber(feature, paths.comfortTLb);
  if (hasMappedValue(feature, paths.comfortTUb)) parameters.comfortT_ub = getMappedNumber(feature, paths.comfortTUb);
  if (hasMappedValue(feature, paths.windowToWallRatio)) parameters.window_to_wall_ratio = getMappedNumber(feature, paths.windowToWallRatio);
  if (hasMappedValue(feature, paths.windowU)) parameters.window_U = getMappedNumber(feature, paths.windowU);
  if (hasMappedValue(feature, paths.windowGGl)) parameters.window_g_gl = getMappedNumber(feature, paths.windowGGl);
  const massClass = MASS_CLASS_LABELS[String(getMappedValue(feature, paths.thermalClass))];
  if (massClass) parameters.massClass = massClass;
  const useMilp = getMappedValue(feature, paths.useMilp);
  if (typeof useMilp === 'boolean') parameters.use_milp = useMilp;
  Object.assign(parameters, householdParameters(feature));
  return Object.keys(parameters).length > 0 ? parameters : undefined;
}

/** The household and output fields the feature sets, each absent unless set. */
function householdParameters(feature: unknown): BuildingParameters {
  const paths = MODEL_DATA_MAP.thematic.household;
  const parameters: BuildingParameters = {};
  for (const key of ['residential_units', 'num_persons', 'capacity'] as const) {
    const value = getMappedValue(feature, paths[key]);
    if (typeof value === 'number') parameters[key] = value;
  }
  for (const key of ['archetype', 'region_code', 'cooking_carrier', 'setback_profile'] as const) {
    const value = getMappedValue(feature, paths[key]);
    if (typeof value === 'string') parameters[key] = value;
  }
  const includeDhw = getMappedValue(feature, paths.include_dhw);
  if (typeof includeDhw === 'boolean') parameters.include_dhw = includeDhw;
  const equipment = getMappedValue(feature, paths.equipment);
  if (equipment && typeof equipment === 'object') parameters.equipment = { ...(equipment as Record<string, boolean>) };
  const outputs = getMappedValue(feature, paths.outputs);
  if (outputs && typeof outputs === 'object') {
    parameters.outputs = Object.fromEntries(OUTPUT_PROFILES.map(({ key }) => (
      [key, (outputs as Record<string, OutputLevel>)[key] ?? 'summary']
    ))) as Record<OutputProfile, OutputLevel>;
  }
  return parameters;
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

  const { geometry, thematic } = extractBuildingDashboardData(feature);
  const parameters = adaptParameters(feature);
  const refurbishment = adaptRefurbishment(feature);

  return {
    geometry,
    thematic,
    identity: thematic.identity,
    envelope: thematic.envelope,
    thermalSummary: thematic.thermalSummary,
    timeseries: thematic.timeseries,
    ignis: null,
    ...(parameters ? { parameters } : {}),
    ...(refurbishment ? { refurbishment } : {}),
  };
}

/** The stored refurbishment block, or undefined when the feature has none. */
function adaptRefurbishment(feature: unknown): Refurbishment | undefined {
  const raw = getMappedValue(feature, MODEL_DATA_MAP.thematic.refurbishment);
  if (!raw || typeof raw !== 'object') return undefined;
  const { variant_code: variantCode, states } = raw as { variant_code?: unknown; states?: unknown };
  const refurbishment: Refurbishment = {};
  if (typeof variantCode === 'string' && variantCode) refurbishment.variantCode = variantCode;
  if (states && typeof states === 'object') {
    refurbishment.states = Object.fromEntries(
      Object.entries(states).filter(([type, n]) => REFURB_TYPES.includes(type as RefurbElementType) && Number.isInteger(n)),
    );
  }
  return Object.keys(refurbishment).length > 0 ? refurbishment : undefined;
}

/** The refurbishment block as stored beside the building block, or undefined when there is nothing to keep. */
function serializeRefurbishment(refurbishment: Refurbishment | undefined): Record<string, unknown> | undefined {
  if (!refurbishment?.variantCode && !refurbishment?.states) return undefined;
  return {
    ...(refurbishment.variantCode ? { variant_code: refurbishment.variantCode } : {}),
    ...(refurbishment.states ? { states: refurbishment.states } : {}),
  };
}

/**
 * Formats a coordinate pair as a display string.
 * e.g. [11.582, 48.135] -> "48.1350° N, 11.5820° E"
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

  // BUEM convention: demand is negative. Negate here so all values are positive
  // magnitudes. When PV production is added it will also be stored as positive,
  // so overlapping lines on the chart directly show demand coverage.
  return lines.slice(1).flatMap((line) => {
    const cols = line.split(',');
    const timestamp = cols[tsIdx]?.trim() ?? '';
    if (!timestamp) return [];
    return [{
      timestamp,
      electricity: elIdx >= 0 ? Math.abs(Number(cols[elIdx]) || 0) : 0,
      heating:     htIdx >= 0 ? Math.abs(Number(cols[htIdx]) || 0) : 0,
      hotwater:    hwIdx >= 0 ? Math.abs(Number(cols[hwIdx]) || 0) : 0,
      dhw:         0,
      kitchen:     0,
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

// ─── Export to BUEM API schema ─────────────────────────────────────────────────

/**
 * Serializes UI building element data to BUEM envelope element format.
 * Maps BuildingElement[] to BUEM's envelope.elements[] schema. A surface with
 * no area is left out, since BuEM rejects one; ventilation carries no area.
 */
function buildElementsToBuemEnvelope(elements: Record<string, any>): Array<Record<string, any>> {
  const sent = Object.values(elements)
    .filter((el) => el && typeof el === 'object')
    .filter((el) => el.type === 'ventilation' || Number(el.area) > 0);
  return sent
    .map((el) => {
      const base: Record<string, any> = {
        id: String(el.id ?? ''),
        type: String(el.type ?? ''),
      };

      // Human-readable display label — echoed by the server, not used in simulation.
      if (el.label) base.name = el.label;

      // Geometry fields: required for non-ventilation elements
      if (el.type !== 'ventilation') {
        base.area = { value: Number(el.area ?? 0), unit: 'm2' };
        base.azimuth = { value: Number(el.azimuth ?? 0), unit: 'deg' };
        base.tilt = { value: Number(el.tilt ?? 0), unit: 'deg' };
      }

      // Thermal properties
      if (typeof el.uValue === 'number') {
        base.U = { value: el.uValue, unit: 'W/(m2K)' };
      }

      // Solar gain (window-specific)
      if (el.type === 'window' && typeof el.gValue === 'number') {
        base.g_gl = { value: el.gValue, unit: '-' };
      }

      // BuEM counts a wall with b_transmission 0 as shared with a neighbour.
      if (typeof el.bTransmission === 'number') {
        base.b_transmission = { value: el.bTransmission, unit: '-' };
      }

      if (el.type === 'window' || el.type === 'door') base.parent_id = parentOf(el, sent);

      return base;
    });
}

/** Below this tilt a window is a skylight and sits in a roof. */
const SKYLIGHT_MAX_TILT = 60;

/**
 * The id of the surface a window or door sits in: the one it names when that
 * surface is sent, else the largest wall (roof, for a skylight) on the same
 * face, else the one closest in azimuth. The schema requires one.
 */
function parentOf(opening: Record<string, any>, sent: Array<Record<string, any>>): string {
  const ids = new Set(sent.map((el) => el.id));
  if (opening.parentId && ids.has(opening.parentId)) return opening.parentId;
  const hostType = opening.type === 'window' && Number(opening.tilt) < SKYLIGHT_MAX_TILT ? 'roof' : 'wall';
  const face = faceFromAzimuth(Number(opening.azimuth));
  const gap = (el: Record<string, any>) => {
    const d = Math.abs(Number(el.azimuth) - Number(opening.azimuth)) % 360;
    return Math.min(d, 360 - d);
  };
  const hosts = sent.filter((el) => el.type === hostType);
  const sameFace = hosts.filter((el) => faceFromAzimuth(Number(el.azimuth)) === face);
  const host = sameFace.length > 0
    ? sameFace.reduce((a, b) => (Number(b.area) > Number(a.area) ? b : a))
    : hosts.reduce<Record<string, any> | undefined>((a, b) => (!a || gap(b) < gap(a) ? b : a), undefined);
  if (!host) throw new Error(`serializeToBuemFeature: no ${hostType} for ${opening.type} "${opening.id}" to sit in`);
  return String(host.id);
}

/**
 * Converts the current UI state (elements + general config) to a complete BUEM GeoJSON Feature.
 * The feature can be exported and sent to the BUEM API for processing.
 *
 * @param identity - Building identity (id, coordinates, etc.)
 * @param elements - UI element record
 * @param general - General building config
 * @param startTime - ISO 8601 start time (e.g. "2018-01-01T00:00:00Z")
 * @param endTime - ISO 8601 end time
 * @param resolution - Time resolution value (default: 60)
 * @param resolutionUnit - Time resolution unit (default: "minutes")
 * @returns A BUEM GeoJSON Feature ready for export or API submission
 */
export function serializeToBuemFeature(
  identity: BuildingIdentity,
  elements: Record<string, any>,
  general: Record<string, any>,
  startTime: string = '2018-01-01T00:00:00Z',
  endTime: string = '2018-12-31T23:00:00Z',
  resolution: string | number = '60',
  resolutionUnit: string = 'minutes',
): Record<string, any> {
  const [lon, lat] = identity.coordinates;

  // Build the building block, preferring passed identity over general config
  const building: Record<string, any> = {};
  if (identity.label) building.name = identity.label;
  if (identity.buildingType) building.building_type = BUILDING_TYPE_CODES[identity.buildingType] ?? identity.buildingType;
  else if (general.buildingType) building.building_type = BUILDING_TYPE_CODES[general.buildingType] ?? general.buildingType.replace(/\s+/g, '_').toUpperCase();

  // construction_period is a per-country TABULA class code, never a year, so it
  // is not sent. The year travels beside the block as buem.construction_year.
  const constructionYear = Number(identity.constructionYear || general.constructionYear) || 0;

  if (identity.country) building.country = identity.country;
  else if (general.country) building.country = general.country;

  if (typeof identity.floorArea === 'number') {
    // identity.floorArea is already the total conditioned floor area (BuEM A_ref semantics).
    building.A_ref = { value: identity.floorArea, unit: 'm2' };
  } else if (typeof general.floorArea === 'number') {
    // general.floorArea is per-storey; A_ref needs the whole-building total.
    building.A_ref = { value: general.floorArea * (Number(general.storeys) || 1), unit: 'm2' };
  }

  if (typeof identity.roomHeight === 'number') {
    building.h_room = { value: identity.roomHeight, unit: 'm' };
  } else if (typeof general.roomHeight === 'number') {
    building.h_room = { value: general.roomHeight, unit: 'm' };
  }

  Object.assign(building, householdFields(identity.buildingType || general.buildingType, general));

  const outputs = { ...general.outputs };
  if (isServiceBuildingType(identity.buildingType || general.buildingType)) {
    outputs.hot_water = 'none';
    outputs.kitchen = 'none';
  }
  // With neither heating nor cooling selected BuEM skips the thermal solve and
  // the contract drops the envelope requirement.
  if (needsEnvelope(outputs)) {
    building.envelope = { elements: buildElementsToBuemEnvelope(elements) };
  }

  // Thermal parameters
  const thermal: Record<string, any> = {};
  if (typeof general.n_air_infiltration === 'number') {
    thermal.n_air_infiltration = { value: general.n_air_infiltration, unit: '1/h' };
  }
  if (typeof general.n_air_use === 'number') {
    thermal.n_air_use = { value: general.n_air_use, unit: '1/h' };
  }
  if (typeof general.c_m === 'number') {
    thermal.c_m = { value: general.c_m, unit: 'kJ/(m2K)' };
  }
  for (const key of ['comfortT_lb', 'comfortT_ub'] as const) {
    if (typeof general[key] === 'number') thermal[key] = { value: general[key], unit: 'degC' };
  }
  if (general.massClass) {
    const thermalClass = THERMAL_CLASSES[general.massClass];
    if (!thermalClass) throw new Error(`serializeToBuemFeature: no BuEM thermal_class for mass class "${general.massClass}"`);
    thermal.thermal_class = thermalClass;
  }
  if (Object.keys(thermal).length > 0) {
    building.thermal = thermal;
  }

  if (typeof general.window_to_wall_ratio === 'number') building.window_to_wall_ratio = general.window_to_wall_ratio;
  if (typeof general.window_U === 'number') building.window_U = { value: general.window_U, unit: 'W/(m2K)' };
  if (typeof general.window_g_gl === 'number') building.window_g_gl = general.window_g_gl;

  const refurbishment = serializeRefurbishment(general.refurbishment);

  // Build the complete feature
  const feature: Record<string, any> = {
    type: 'Feature',
    id: identity.id,
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
    properties: {
      start_time: startTime,
      end_time: endTime,
      resolution: String(resolution),
      resolution_unit: resolutionUnit,
      buem: {
        building,
        ...(constructionYear ? { construction_year: constructionYear } : {}),
        ...(refurbishment ? { refurbishment } : {}),
        outputs,
        solver: {
          use_milp: general.use_milp ?? false,
          // compute_cooling is schema-only in the current BuEM release and
          // rejected if sent at all — heating and cooling are both always
          // computed unconditionally. Omit until BuEM wires the flag up.
        },
      },
    },
  };

  return feature;
}

/** Whether the selected profiles need BuEM's thermal solve, and so the envelope and weather. */
export function needsEnvelope(outputs: Partial<Record<OutputProfile, OutputLevel>>): boolean {
  return outputs.heating !== 'none' || outputs.cooling !== 'none';
}

/**
 * The household fields of the building block for a building type label. The
 * contract rejects household inputs on a service building, which takes a
 * capacity instead, and requires a dwelling count for MFH and AB.
 */
function householdFields(typeLabel: string, general: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = { setback_profile: general.setback_profile };
  if (isServiceBuildingType(typeLabel)) {
    if (general.capacity) fields.capacity = general.capacity;
    return fields;
  }
  if (general.residential_units) fields.residential_units = general.residential_units;
  else if (requiresResidentialUnits(typeLabel)) {
    throw new Error(`serializeToBuemFeature: building type "${typeLabel}" needs a number of dwellings`);
  }
  if (general.num_persons) fields.num_persons = general.num_persons;
  if (general.archetype) fields.archetype = general.archetype;
  if (general.region_code) fields.region_code = general.region_code;
  if (general.cooking_carrier) fields.cooking_carrier = general.cooking_carrier;
  fields.include_dhw = general.include_dhw;
  if (general.equipment && Object.keys(general.equipment).length > 0) fields.equipment = { ...general.equipment };
  return fields;
}

/**
 * Exports the current UI state as a BUEM API-compliant GeoJSON FeatureCollection.
 * This is the format expected by the BUEM microservice.
 */
export function exportToBuemGeojson(
  identity: BuildingIdentity,
  elements: Record<string, any>,
  general: Record<string, any>,
  startTime?: string,
  endTime?: string,
): string {
  const feature = serializeToBuemFeature(identity, elements, general, startTime, endTime, '60', 'minutes');
  const featureCollection = {
    type: 'FeatureCollection',
    features: [feature],
  };
  return JSON.stringify(featureCollection, null, 2);
}

// ─── Import from BUEM API schema ──────────────────────────────────────────────

/**
 * Represents both legacy export format and new BUEM API format.
 */
export interface ImportedBuildingData {
  elements: Record<string, any>;
  general: Record<string, any>;
  roofConfig?: Record<string, any>;
  isBuemFormat: boolean;
}

/**
 * Parses a BUEM API Feature into the UI's element and general config format.
 * Handles both v3 unified building type codes and legacy separate fields.
 *
 * Throws if the input is not a valid BUEM Feature.
 */
export function parseBuemFeatureForImport(feature: unknown): ImportedBuildingData {
  if (!feature || typeof feature !== 'object') {
    throw new Error('parseBuemFeatureForImport: expected a GeoJSON Feature object.');
  }

  const f = feature as Record<string, unknown>;
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const buem = (props.buem ?? {}) as Record<string, unknown>;
  const bldg = (buem.building ?? {}) as Record<string, unknown>;
  const envelopeBlk = (bldg.envelope ?? {}) as Record<string, unknown>;
  const elements: Record<string, any> = {};

  // Parse envelope elements
  if (Array.isArray(envelopeBlk.elements)) {
    envelopeBlk.elements.forEach((el: any) => {
      if (!el || typeof el !== 'object') return;
      const id = String(el.id ?? '');
      if (!id) return;

      elements[id] = {
        id,
        label: id.replace(/_/g, ' '),
        type: String(el.type ?? ''),
        area: qty(el.area),
        uValue: qty(el.U),
        gValue: (el.g_gl && typeof el.g_gl === 'object' && 'value' in el.g_gl)
          ? Number((el.g_gl as any).value)
          : null,
        tilt: qty(el.tilt),
        azimuth: qty(el.azimuth),
        ...transmissionFrom(el),
        ...(typeof el.parent_id === 'string' && el.parent_id ? { parentId: el.parent_id } : {}),
        source: 'city',
        customMode: false,
      };
    });
  }

  // Parse general config. bldg.A_ref is the total conditioned floor area; general.floorArea
  // is per-storey, so divide by the building's own storey count.
  const importedStoreys = Number(bldg.n_storeys ?? 0);
  const importedYear = Number(buem.construction_year ?? bldg.construction_period) || 0;
  const general: Record<string, any> = {
    // Omitted when unparseable so a { ...DEFAULT_GENERAL, ...general } merge keeps the default.
    ...(importedYear ? { constructionYear: importedYear } : {}),
    buildingType: String(bldg.building_type ?? bldg.type ?? ''),
    country: String(bldg.country ?? ''),
    floorArea: qty(bldg.A_ref) / Math.max(1, importedStoreys),
    roomHeight: qty(bldg.h_room),
    storeys: importedStoreys,
    use_milp: ((buem.solver ?? {}) as Record<string, unknown>).use_milp === true,
    compute_cooling: ((buem.solver ?? {}) as Record<string, unknown>).compute_cooling !== false,
    // Only the values the feature sets: the caller merges over DEFAULT_GENERAL.
    ...adaptParameters(feature),
  };

  return { elements, general, isBuemFormat: true };
}

/**
 * Imports building data from either:
 * 1. Legacy configurator export format (with 'elements', 'generalConfig', 'roofConfig')
 * 2. BUEM API GeoJSON Feature or FeatureCollection
 * 3. EnerPlanET config.json topology
 *
 * Returns parsed element and general config, ignoring unrecognized fields.
 */
export function importBuildingData(json: unknown): ImportedBuildingData {
  if (!json || typeof json !== 'object') {
    throw new Error('importBuildingData: expected a JSON object.');
  }

  const data = json as Record<string, unknown>;

  // Check for legacy configurator format first
  if ('elements' in data || 'generalConfig' in data) {
    return {
      elements: (data.elements ?? {}) as Record<string, any>,
      general: (data.generalConfig ?? data.general ?? {}) as Record<string, any>,
      roofConfig: (data.roofConfig ?? {}) as Record<string, any>,
      isBuemFormat: false,
    };
  }

  // Check for BUEM FeatureCollection
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    const features = data.features as unknown[];
    if (features.length > 0) {
      return parseBuemFeatureForImport(features[0]);
    }
    throw new Error('importBuildingData: FeatureCollection contains no features.');
  }

  // Check for single BUEM Feature
  if (data.type === 'Feature') {
    return parseBuemFeatureForImport(data);
  }

  // Check for EnerPlanET config with topology
  if ('topology' in data && Array.isArray(data.topology)) {
    const features = extractFeaturesFromConfig(data);
    if (features.length > 0 && features[0]) {
      return parseBuemFeatureForImport(features[0]);
    }
  }

  throw new Error(
    'importBuildingData: unrecognized format. '
    + 'Expected legacy configurator JSON, BUEM GeoJSON Feature, FeatureCollection, or EnerPlanET config.json.',
  );
}
