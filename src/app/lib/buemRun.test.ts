import { describe, expect, it } from 'vitest';
import { runIdentity, toBuemBuilding } from './buemRun';
import { adaptBuemFeature, serializeToBuemFeature, type BuildingState } from './buemAdapter';
import { withEdits } from '../components/BuildingConfigurator/useBuildingModel';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_GENERAL,
  generalFrom,
} from '../components/BuildingConfigurator/shared/buildingDefaults';
import { DEFAULT_PV_TECHNOLOGY } from '../components/BuildingConfigurator/shared/pvModel';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

const identity = {
  id: 'osm-42',
  label: 'Original',
  coordinates: [5.9, 52.2] as [number, number],
  buildingType: 'Single-family House',
  constructionYear: 1990,
  country: 'NL',
  floorArea: 100,
  roomHeight: 2.5,
  storeys: 1,
};

const opened: BuildingState = {
  geometry: { buildingId: 'osm-42', coordinates: [5.9, 52.2], buildingFootprint: null, buildingHeight: null },
  thematic: { identity, envelope: {}, thermalSummary: null, timeseries: null },
  technologies: { rawTechs: {}, installedTechIds: [] },
  identity,
  envelope: {},
  thermalSummary: null,
  timeseries: null,
  installedTechIds: [],
  ignis: null,
};

const elements: Record<string, BuildingElement> = {
  wall_south: { id: 'wall_south', label: 'Garden wall', type: 'wall', area: 40, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180 },
  win_south: { id: 'win_south', label: 'Patio door', type: 'window', area: 6, uValue: 1.1, gValue: 0.5, tilt: 90, azimuth: 180 },
};

// Every building parameter moved off its default, including the expert-mode ones.
const general = {
  ...DEFAULT_GENERAL,
  buildingName: 'Renamed',
  buildingType: 'Terraced House',
  constructionYear: 1975,
  country: 'DE',
  floorArea: 80,
  roomHeight: 2.6,
  storeys: 2,
  n_air_infiltration: 0.7,
  n_air_use: 0.55,
  massClass: 'Heavy',
  c_m: 260,
  Code_AttachedNeighbours: 'B_N2',
};

const tech = {
  pvTechnology: DEFAULT_PV_TECHNOLOGY,
  pvArrays: {},
  battery: DEFAULT_BATTERY_CONFIG,
  otherTechIds: [],
};

const edited = withEdits(opened, elements, general, tech);

describe('toBuemBuilding', () => {
  it('sends the block a run with the same edits sends', () => {
    const run = serializeToBuemFeature(runIdentity(opened, general), elements, general).properties.buem.building;

    expect(toBuemBuilding(edited)).toEqual(run);
  });

  it('carries the expert-mode parameters into the block', () => {
    const building = toBuemBuilding(edited);
    expect(building.thermal).toEqual({
      n_air_infiltration: { value: 0.7, unit: '1/h' },
      n_air_use: { value: 0.55, unit: '1/h' },
      c_m: { value: 260, unit: 'kJ/(m2K)' },
      thermal_class: 'heavy',
    });
    expect(building.neighbour_status).toBe('B_N2');
    expect(building.name).toBe('Renamed');
  });
});

describe('adaptBuemFeature on a stored building block', () => {
  const reopened = adaptBuemFeature({
    type: 'Feature',
    id: 'osm-42',
    geometry: { type: 'Point', coordinates: [5.9, 52.2] },
    properties: { buem: { building: toBuemBuilding(edited) } },
  });

  it('reopens with the same building parameters', () => {
    const { buildingName, ...rest } = generalFrom(reopened);
    const { buildingName: savedName, ...expected } = general;
    expect(buildingName).toBe(savedName);
    expect(rest).toEqual(expected);
  });

  it('reopens with the same surfaces and their names', () => {
    expect(reopened.envelope.wall_south).toMatchObject({ label: 'Garden wall', area: 40, uValue: 0.24, tilt: 90, azimuth: 180 });
    expect(reopened.envelope.win_south).toMatchObject({ label: 'Patio door', area: 6, uValue: 1.1, gValue: 0.5 });
  });

  it('serialises to the block it was opened from', () => {
    expect(toBuemBuilding(reopened)).toEqual(toBuemBuilding(edited));
  });
});
