import { describe, it, expect } from 'vitest';
import {
  createPvArray, DEFAULT_PV_TECHNOLOGY, fittedCapacityKwp, resolvePvArray, splitPvPatch,
} from './pvModel';
import type { BuildingElement } from '../configure/model/buildingElements';

const roof: BuildingElement = {
  id: 'roof', label: 'Roof', type: 'roof', area: 50, uValue: 1,
  gValue: null, tilt: 35, azimuth: 180,
};

describe('resolvePvArray', () => {
  it('sizes the array to the surface it covers', () => {
    const array = { ...createPvArray(roof), installed: true };
    // 50 m² at 80% coverage, 0.2 kWp/m²
    expect(fittedCapacityKwp(array, roof)).toBe(8);
    expect(resolvePvArray(array, DEFAULT_PV_TECHNOLOGY, roof).system_capacity).toBe(8);
  });

  it('follows the usable share until a capacity is set by hand', () => {
    const array = { ...createPvArray(roof), installed: true, usable_area_pct: 60 };
    expect(resolvePvArray(array, DEFAULT_PV_TECHNOLOGY, roof).system_capacity).toBe(6);

    const overridden = { ...array, capacityOverrideKwp: 6.5 };
    expect(resolvePvArray(overridden, DEFAULT_PV_TECHNOLOGY, roof).system_capacity).toBe(6.5);
  });

  it('takes its angles from the array and its module from the building', () => {
    const array = { ...createPvArray(roof), installed: true, tilt: 12, azimuth: 200 };
    const technology = { ...DEFAULT_PV_TECHNOLOGY, cost_energy_cap: 400, cont_lifetime: 30 };
    const config = resolvePvArray(array, technology, roof);
    expect(config).toMatchObject({ tilt: 12, azimuth: 200, cost_energy_cap: 400, cont_lifetime: 30 });
  });

  it('is empty without a surface to sit on', () => {
    expect(resolvePvArray(createPvArray(), DEFAULT_PV_TECHNOLOGY, undefined).system_capacity).toBe(0);
  });
});

describe('splitPvPatch', () => {
  it('sends the module and its cost to the building', () => {
    const { technology, array } = splitPvPatch({ cost_energy_cap: 500, cont_energy_eff: 0.95 });
    expect(technology).toEqual({ cost_energy_cap: 500, cont_energy_eff: 0.95 });
    expect(array).toEqual({});
  });

  it('keeps geometry and sizing on the array being edited', () => {
    const { technology, array } = splitPvPatch({ tilt: 20, usable_area_pct: 70, installed: true });
    expect(technology).toEqual({});
    expect(array).toEqual({ tilt: 20, usable_area_pct: 70, capacityOverrideKwp: null, installed: true });
  });

  it('reads a capacity edit as a hand-set override', () => {
    expect(splitPvPatch({ system_capacity: 6 }).array).toEqual({ capacityOverrideKwp: 6 });
    expect(splitPvPatch({ cont_energy_cap_max: 9 }).array).toEqual({ capacityOverrideKwp: 9 });
  });

  it('lets a coverage change re-size an array that had a capacity set', () => {
    expect(splitPvPatch({ usable_area_pct: 50 }))
      .toEqual({ technology: {}, array: { usable_area_pct: 50, capacityOverrideKwp: null } });
  });

  it('splits an edit that touches both halves', () => {
    const { technology, array } = splitPvPatch({ cost_om_annual: 12, azimuth: 150 });
    expect(technology).toEqual({ cost_om_annual: 12 });
    expect(array).toEqual({ azimuth: 150 });
  });
});
