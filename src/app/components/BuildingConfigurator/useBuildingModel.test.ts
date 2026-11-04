import { describe, expect, it, vi } from 'vitest';
import { LOOKUP_DELAY_MS, runBlocker, scheduleLookup, withEdits } from './useBuildingModel';
import { DEFAULT_GENERAL } from './shared/buildingDefaults';
import type { BuildingElement } from './configure/model/buildingElements';
import type { BuildingState } from '../../lib/buemAdapter';
import { toBuem } from '../../lib/buemRun';

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
  identity,
  envelope: {},
  thermalSummary: null,
  timeseries: null,
  ignis: null,
};

const elements: Record<string, BuildingElement> = {
  wall_south: { id: 'wall_south', label: 'South Wall', type: 'wall', area: 40, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180 },
};

describe('withEdits', () => {
  it('writes the envelope and building parameters back, keeping the id', () => {
    const general = { ...DEFAULT_GENERAL, buildingName: 'Renamed', floorArea: 80, storeys: 2, constructionYear: 1975 };
    const result = withEdits(building, elements, general);

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
  });

  it('keeps the original label when the name is blank', () => {
    const result = withEdits(building, elements, { ...DEFAULT_GENERAL, buildingName: '' });
    expect(result.identity.label).toBe('Original');
  });

  it('keeps the storeys\' own heights, so a run sends their mean', () => {
    const general = { ...DEFAULT_GENERAL, buildingType: 'Single-family House', storeys: 3, roomHeight: 2.5, storeyHeights: { 3: 4 } };
    const blocks = toBuem(withEdits(building, elements, general));
    expect(blocks.building.h_room).toEqual({ value: 3, unit: 'm' });
    expect(blocks.configurator.storey_list?.[2]).toMatchObject({ storey: 3, height: 4 });
  });
});

describe('scheduleLookup', () => {
  it('looks up the building as opened at once', () => {
    const run = vi.fn();
    scheduleLookup(run, true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('looks up a typed year once, after it stays unchanged', () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      let cancel = () => {};
      for (const _year of [1, 19, 198, 1985]) {
        cancel();
        cancel = scheduleLookup(run, false);
        vi.advanceTimersByTime(LOOKUP_DELAY_MS / 5);
      }
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(LOOKUP_DELAY_MS);
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('runBlocker', () => {
  const general = (over: Record<string, unknown>) => ({ ...DEFAULT_GENERAL, buildingType: 'Single-family House', ...over });

  it('lets a building with valid values run', () => {
    expect(runBlocker(general({ comfortT_lb: 20, comfortT_ub: 26 }))).toBeNull();
  });

  it('stops a run while the cooling setpoint is not above the heating setpoint', () => {
    expect(runBlocker(general({ comfortT_lb: 18, comfortT_ub: 16.5 }))).toBe('model.error.coolingInverted');
    expect(runBlocker(general({ comfortT_lb: 18, comfortT_ub: 18 }))).toBe('model.error.coolingInverted');
  });

  it('stops a run while a multi-family house has no dwellings', () => {
    expect(runBlocker(general({ buildingType: 'Multi-family House', residential_units: null }))).toBe('model.error.dwellingsRequired');
  });

  it('stops a run while a modelled storey has no dwellings', () => {
    expect(runBlocker(general({
      buildingType: 'Multi-family House', residential_units: 6, storeysModelled: [1, 2], storeyDwellings: { 1: 3 },
    }))).toBe('model.error.dwellingsModelledRequired');
  });
});
