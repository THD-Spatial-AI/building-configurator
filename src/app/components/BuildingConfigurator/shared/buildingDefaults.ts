// Default seed data and shared type definitions for the building configurator.
// These values are placeholders until real building data is loaded from the API.

import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { BuildingState } from '@/app/lib/buemAdapter';
import type { OutputLevel, OutputProfile } from './buildingOptions';

// TODO:
export const DEFAULT_ELEMENTS: Record<string, BuildingElement> = {
  south_wall:     { id: 'south_wall',     label: 'South Wall',     type: 'wall',   area: 56.0, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180, source: 'default', customMode: false },
  east_wall:      { id: 'east_wall',      label: 'East Wall',      type: 'wall',   area: 37.8, uValue: 0.24, gValue: null, tilt: 90, azimuth: 90,  source: 'default', customMode: false },
  north_wall:     { id: 'north_wall',     label: 'North Wall',     type: 'wall',   area: 56.0, uValue: 0.24, gValue: null, tilt: 90, azimuth: 0,   source: 'default', customMode: false },
  west_wall:      { id: 'west_wall',      label: 'West Wall',      type: 'wall',   area: 37.8, uValue: 0.24, gValue: null, tilt: 90, azimuth: 270, source: 'default', customMode: false },
  roof:           { id: 'roof',           label: 'Roof',           type: 'roof',   area: 98.0, uValue: 0.18, gValue: null, tilt: 35, azimuth: 180, source: 'default', customMode: false },
  floor:          { id: 'floor',          label: 'Ground Floor',   type: 'floor',  area: 90.0, uValue: 0.30, gValue: null, tilt: 0,  azimuth: 0,   source: 'default', customMode: false },
  south_window_1: { id: 'south_window_1', label: 'South Window 1', type: 'window', area: 4.5,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 180, source: 'default', customMode: false },
  south_window_2: { id: 'south_window_2', label: 'South Window 2', type: 'window', area: 4.5,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 180, source: 'default', customMode: false },
  east_window:    { id: 'east_window',    label: 'East Window',    type: 'window', area: 3.0,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 90,  source: 'default', customMode: false },
  door:           { id: 'door',           label: 'Front Door',     type: 'door',   area: 2.1,  uValue: 1.80, gValue: null, tilt: 90, azimuth: 180, source: 'default', customMode: false },
};

// BuEM computes an omitted profile as an annual summary only; the overview's
// charts need the hourly series.
const DEFAULT_OUTPUTS: Record<OutputProfile, OutputLevel> = {
  heating: 'series', cooling: 'series', electricity: 'series', hot_water: 'series', kitchen: 'series',
};

// TODO: These defaults are purely illustrative and should be replaced with real building data from the API.
export const DEFAULT_GENERAL = {
  buildingName:       '',
  buildingType:       'Multi-family House',
  constructionYear:   2015,
  country:            'DE',
  floorArea:          90.9, // per-storey footprint; 4 storeys ≈ 363.4 m² total
  roomHeight:         2.7,
  storeys:            4,
  n_air_infiltration: 0.4,
  n_air_use:          0.4,
  massClass:          'Medium',
  c_m:                110,
  use_milp:           false,
  electricityDemand:  4000,
  spaceHeatingDemand: 15000,
  dhwDemand:          2500,
  // Household inputs, sent under their BuEM names. null or '' leaves the value
  // to BuEM's default; residential_units is required for MFH and AB.
  residential_units:  null as number | null,
  num_persons:        null as number | null,
  archetype:          '',
  region_code:        '',
  cooking_carrier:    '',
  include_dhw:        true,
  setback_profile:    'none',
  capacity:           null as number | null,
  /** Appliance ownership overrides; an absent id keeps BuEM's default probability. */
  equipment:          {} as Record<string, boolean>,
  outputs:            DEFAULT_OUTPUTS,
};

/**
 * The configurator's building parameters for a building: its identity and any
 * saved parameters over the defaults. identity.floorArea is the total
 * conditioned floor area (BuEM A_ref); general.floorArea is per storey.
 */
export function generalFrom(building?: BuildingState): typeof DEFAULT_GENERAL {
  if (!building) return DEFAULT_GENERAL;
  const identity = building.thematic?.identity ?? building.identity;
  const storeys = identity.storeys || DEFAULT_GENERAL.storeys;
  return {
    ...DEFAULT_GENERAL,
    ...building.parameters,
    buildingName:     identity.label ?? DEFAULT_GENERAL.buildingName,
    buildingType:     identity.buildingType ?? DEFAULT_GENERAL.buildingType,
    constructionYear: identity.constructionYear || DEFAULT_GENERAL.constructionYear,
    country:          identity.country ?? DEFAULT_GENERAL.country,
    floorArea:        identity.floorArea ? identity.floorArea / Math.max(1, storeys) : DEFAULT_GENERAL.floorArea,
    roomHeight:       identity.roomHeight || DEFAULT_GENERAL.roomHeight,
    storeys,
  };
}

// ─── Floor area / volume ──────────────────────────────────────────────────────
// `floorArea` (general state) is the per-storey footprint, not the whole
// building's total — the total conditioned floor area (used for ignis's A_ref
// override, BuEM's A_ref, and any kWh/m²·a normalization) is always
// `floorArea × storeys`.

/** Total conditioned floor area (m²) across all storeys. */
export function computeTotalFloorArea(floorArea: number, storeys: number): number {
  return floorArea * Math.max(1, storeys);
}

/** Building volume (m³) from per-storey floor area, storeys, and room height. */
export function computeVolume(floorArea: number, storeys: number, roomHeight: number): number {
  return computeTotalFloorArea(floorArea, storeys) * roomHeight;
}

export const DEFAULT_TOTAL_AREA = Object.values(DEFAULT_ELEMENTS).reduce(
  (sum, el) => sum + el.area,
  0,
);

export const DEFAULT_AVG_U_VALUE = DEFAULT_TOTAL_AREA > 0
  ? Object.values(DEFAULT_ELEMENTS).reduce((sum, el) => sum + el.uValue * el.area, 0) / DEFAULT_TOTAL_AREA
  : 0;
