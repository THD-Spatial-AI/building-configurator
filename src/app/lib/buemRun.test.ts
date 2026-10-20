import { describe, expect, it, vi } from 'vitest';
import { runBuildingSimulation, runIdentity, toBuem, type RunContext } from './buemRun';
import type { BuemBuildingRunRequest } from './services';
import { adaptBuemFeature, serializeToBuemFeature, type BuildingState } from './buemAdapter';
import { withEdits } from '../components/BuildingConfigurator/useBuildingModel';
import { DEFAULT_GENERAL, generalFrom } from '../components/BuildingConfigurator/shared/buildingDefaults';
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
  identity,
  envelope: {},
  thermalSummary: null,
  timeseries: null,
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
  comfortT_lb: 20,
  comfortT_ub: 25,
  use_milp: true,
  residential_units: 2,
  num_persons: 3,
  archetype: 'family_with_children',
  region_code: 'GM0200',
  cooking_carrier: 'gas',
  include_dhw: false,
  setback_profile: 'night_only',
  equipment: { tv_1: true, tv_2: false, tumble_dryer: false },
  outputs: { heating: 'series', cooling: 'none', electricity: 'summary', hot_water: 'series', kitchen: 'summary' } as const,
};

const edited = withEdits(opened, elements, general);

describe('toBuem', () => {
  it('sends the blocks a run with the same edits sends', () => {
    const { buem } = serializeToBuemFeature(runIdentity(opened, general), elements, general).properties;

    expect(toBuem(edited)).toMatchObject({ building: buem.building, outputs: buem.outputs, solver: buem.solver });
  });

  it('keeps the construction year beside the building block, not in it', () => {
    const stored = toBuem(edited);
    expect(stored.building).not.toHaveProperty('construction_period');
    expect(stored.construction_year).toBe(general.constructionYear);
  });

  it('carries the expert-mode parameters and the solver choice', () => {
    const { building, solver } = toBuem(edited);
    expect(building.thermal).toEqual({
      n_air_infiltration: { value: 0.7, unit: '1/h' },
      n_air_use: { value: 0.55, unit: '1/h' },
      c_m: { value: 260, unit: 'kJ/(m2K)' },
      comfortT_lb: { value: 20, unit: 'degC' },
      comfortT_ub: { value: 25, unit: 'degC' },
      thermal_class: 'heavy',
    });
    expect(building.name).toBe('Renamed');
    expect(solver).toEqual({ use_milp: true });
  });
});

describe('runBuildingSimulation', () => {
  /** The request a run sends, with the transport failing after capturing it. */
  async function sentRequest(runContext?: RunContext): Promise<BuemBuildingRunRequest> {
    const requests: BuemBuildingRunRequest[] = [];
    const services = {
      runBuemBuilding: async (request: BuemBuildingRunRequest) => {
        requests.push(request);
        throw new Error('transport not under test');
      },
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await runBuildingSimulation(services, runIdentity(opened, general), elements, general, runContext);
    return requests[0];
  }

  it('sends the solver choice with the run', async () => {
    expect((await sentRequest()).solver).toEqual({ use_milp: true });
  });

  it('sends the output profiles the user chose', async () => {
    expect((await sentRequest()).outputs).toEqual(general.outputs);
  });

  it("sends the host's period and no model id", async () => {
    const request = await sentRequest({ startDate: '2019-01-01T00:00:00Z', endDate: '2019-12-31T23:00:00Z' });
    expect(request).toMatchObject({ start_date: '2019-01-01T00:00:00Z', end_date: '2019-12-31T23:00:00Z' });
    expect(request).not.toHaveProperty('model_id');
  });

  it("returns the host's stored demand profile", async () => {
    const profile = { building_ref: 'osm-42', series: [] };
    const services = { runBuemBuilding: async () => profile };
    expect(await runBuildingSimulation(services, runIdentity(opened, general), elements, general)).toBe(profile);
  });

  it('leaves surfaces with no area out of the envelope it sends', async () => {
    const requests: BuemBuildingRunRequest[] = [];
    const services = {
      runBuemBuilding: async (request: BuemBuildingRunRequest) => {
        requests.push(request);
        return { building_ref: 'osm-42', series: [] };
      },
    };
    const sliver: BuildingElement = { ...elements.wall_south, id: 'wall_sliver', label: 'Sliver', area: 0 };
    await runBuildingSimulation(services, runIdentity(opened, general), { ...elements, wall_sliver: sliver }, general);
    const sent = (requests[0].building as { envelope: { elements: { id: string }[] } }).envelope.elements.map((el) => el.id);
    expect(sent).toContain('wall_south');
    expect(sent).not.toContain('wall_sliver');
  });

  it('runs the default year and sends no model id without a run context', async () => {
    const request = await sentRequest();
    expect(request).toMatchObject({ start_date: '2018-01-01T00:00:00Z', end_date: '2018-12-31T23:00:00Z' });
    expect(request).not.toHaveProperty('model_id');
  });
});

describe('adaptBuemFeature on stored blocks', () => {
  const reopened = adaptBuemFeature({
    type: 'Feature',
    id: 'osm-42',
    geometry: { type: 'Point', coordinates: [5.9, 52.2] },
    properties: { buem: toBuem(edited) },
  });

  it('reopens an older block with the year in construction_period', () => {
    const { construction_year: _year, ...older } = toBuem(edited);
    const legacy = adaptBuemFeature({
      type: 'Feature',
      id: 'osm-42',
      geometry: { type: 'Point', coordinates: [5.9, 52.2] },
      properties: { buem: { ...older, building: { ...older.building, construction_period: '1962' } } },
    });
    expect(generalFrom(legacy).constructionYear).toBe(1962);
  });

  it('reopens with the same building parameters and solver choice', () => {
    const { floorArea, storeys, ...rest } = general;
    expect(generalFrom(reopened)).toMatchObject(rest);
  });

  // v6-draft deprecates n_storeys, so the block keeps the total floor area but
  // not how it splits across storeys.
  it('reopens with the same total floor area but the default storey count', () => {
    const reopenedGeneral = generalFrom(reopened);
    expect(reopenedGeneral.floorArea * reopenedGeneral.storeys).toBe(general.floorArea * general.storeys);
    expect(reopenedGeneral.storeys).toBe(DEFAULT_GENERAL.storeys);
    expect(toBuem(edited).building).not.toHaveProperty('n_storeys');
  });

  it('reopens with the same surfaces and their names', () => {
    expect(reopened.envelope.wall_south).toMatchObject({ label: 'Garden wall', area: 40, uValue: 0.24, tilt: 90, azimuth: 180 });
    expect(reopened.envelope.win_south).toMatchObject({ label: 'Patio door', area: 6, uValue: 1.1, gValue: 0.5 });
  });

  it('serialises to the blocks it was opened from', () => {
    expect(toBuem(reopened)).toEqual(toBuem(edited));
  });
});
