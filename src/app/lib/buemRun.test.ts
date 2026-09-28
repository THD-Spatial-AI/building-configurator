import { describe, expect, it, vi } from 'vitest';
import { runBuildingSimulation, runIdentity, toBuem } from './buemRun';
import type { BuemBuildingRunRequest } from './services';
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
  use_milp: true,
};

const tech = {
  pvTechnology: DEFAULT_PV_TECHNOLOGY,
  pvArrays: {},
  battery: DEFAULT_BATTERY_CONFIG,
  otherTechIds: [],
};

const edited = withEdits(opened, elements, general, tech);

describe('toBuem', () => {
  it('sends the blocks a run with the same edits sends', () => {
    const { buem } = serializeToBuemFeature(runIdentity(opened, general), elements, general).properties;

    expect(toBuem(edited)).toEqual({ building: buem.building, solver: buem.solver });
  });

  it('carries the expert-mode parameters and the solver choice', () => {
    const { building, solver } = toBuem(edited);
    expect(building.thermal).toEqual({
      n_air_infiltration: { value: 0.7, unit: '1/h' },
      n_air_use: { value: 0.55, unit: '1/h' },
      c_m: { value: 260, unit: 'kJ/(m2K)' },
      thermal_class: 'heavy',
    });
    expect(building.neighbour_status).toBe('B_N2');
    expect(building.name).toBe('Renamed');
    expect(solver).toEqual({ use_milp: true });
  });
});

describe('runBuildingSimulation', () => {
  it('sends the solver choice with the run', async () => {
    const requests: BuemBuildingRunRequest[] = [];
    const services = {
      runBuemBuilding: async (request: BuemBuildingRunRequest) => {
        requests.push(request);
        throw new Error('transport not under test');
      },
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await runBuildingSimulation(services, runIdentity(opened, general), elements, general, 'model-1');

    expect(requests[0].solver).toEqual({ use_milp: true });
  });
});

describe('adaptBuemFeature on stored blocks', () => {
  const reopened = adaptBuemFeature({
    type: 'Feature',
    id: 'osm-42',
    geometry: { type: 'Point', coordinates: [5.9, 52.2] },
    properties: { buem: toBuem(edited) },
  });

  it('reopens with the same building parameters and solver choice', () => {
    expect(generalFrom(reopened)).toEqual(general);
  });

  it('reopens with the same surfaces and their names', () => {
    expect(reopened.envelope.wall_south).toMatchObject({ label: 'Garden wall', area: 40, uValue: 0.24, tilt: 90, azimuth: 180 });
    expect(reopened.envelope.win_south).toMatchObject({ label: 'Patio door', area: 6, uValue: 1.1, gValue: 0.5 });
  });

  it('serialises to the blocks it was opened from', () => {
    expect(toBuem(reopened)).toEqual(toBuem(edited));
  });
});
