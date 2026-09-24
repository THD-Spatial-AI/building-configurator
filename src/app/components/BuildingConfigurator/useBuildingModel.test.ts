import { describe, expect, it } from 'vitest';
import { withEdits } from './useBuildingModel';
import { DEFAULT_GENERAL } from './shared/buildingDefaults';
import type { BuildingElement } from './configure/model/buildingElements';
import type { BuildingState, TechnologyState } from '../../lib/buemAdapter';
import { DEFAULT_BATTERY_CONFIG } from './shared/buildingDefaults';
import { DEFAULT_PV_TECHNOLOGY, createPvArray } from './shared/pvModel';

const identity = {
  id: 'building-1',
  label: 'Original',
  coordinates: [5.9, 52.2] as [number, number],
  buildingType: 'Single-family House',
  constructionYear: 1990,
  country: 'NL',
  floorArea: 100,
  roomHeight: 2.5,
  storeys: 1,
};

const building: BuildingState = {
  geometry: { buildingId: 'building-1', coordinates: [5.9, 52.2], buildingFootprint: null, buildingHeight: null },
  thematic: { identity, envelope: {}, thermalSummary: null, timeseries: null },
  technologies: { rawTechs: {}, installedTechIds: ['heat_pump'] },
  identity,
  envelope: {},
  thermalSummary: null,
  timeseries: null,
  installedTechIds: ['heat_pump'],
  ignis: null,
};

const elements: Record<string, BuildingElement> = {
  wall_south: { id: 'wall_south', label: 'South Wall', type: 'wall', area: 40, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180 },
};

const tech: TechnologyState = {
  pvTechnology: DEFAULT_PV_TECHNOLOGY,
  pvArrays: {},
  battery: DEFAULT_BATTERY_CONFIG,
  otherTechIds: ['heat_pump'],
};

describe('withEdits', () => {
  it('writes the envelope and building parameters back, keeping id and technologies', () => {
    const general = { ...DEFAULT_GENERAL, buildingName: 'Renamed', floorArea: 80, storeys: 2, constructionYear: 1975 };
    const result = withEdits(building, elements, general, tech);

    expect(result.envelope).toBe(elements);
    expect(result.thematic.envelope).toBe(elements);
    expect(result.identity).toEqual(result.thematic.identity);
    expect(result.identity).toMatchObject({
      id: 'building-1',
      coordinates: [5.9, 52.2],
      label: 'Renamed',
      constructionYear: 1975,
      floorArea: 160,
      storeys: 2,
    });
    expect(result.installedTechIds).toEqual(['heat_pump']);
  });

  it('carries the PV arrays and battery, which BUEM technology fields cannot hold', () => {
    const edited: TechnologyState = {
      ...tech,
      pvArrays: { wall_south: { ...createPvArray(elements.wall_south), installed: true, usable_area_pct: 55 } },
      battery: { ...DEFAULT_BATTERY_CONFIG, installed: true, cont_storage_cap_max: 12 },
    };
    const result = withEdits(building, elements, DEFAULT_GENERAL, edited);

    expect(result.technologyState).toEqual(edited);
    expect(result.technologyState?.pvArrays.wall_south.installed).toBe(true);
    expect(result.technologyState?.battery.cont_storage_cap_max).toBe(12);
  });

  it('keeps the original label when the name is blank', () => {
    const result = withEdits(building, elements, { ...DEFAULT_GENERAL, buildingName: '' }, tech);
    expect(result.identity.label).toBe('Original');
  });
});
