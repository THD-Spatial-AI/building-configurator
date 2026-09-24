import { describe, it, expect } from 'vitest';
import { renewableKpis } from './renewableKpis';
import { DEFAULT_BATTERY_CONFIG, DEFAULT_PV_CONFIG } from './buildingDefaults';
import type { BuildingElement } from '../configure/model/buildingElements';

function surface(id: string, type: BuildingElement['type'], area: number): BuildingElement {
  return { id, label: id, type, area, uValue: 1, gValue: null, tilt: 0, azimuth: 0 };
}

const roofA = surface('roof_a', 'roof', 60);
const roofB = surface('roof_b', 'roof', 40);
const wall = surface('wall_a', 'wall', 50);
const elements = { roof_a: roofA, roof_b: roofB, wall_a: wall };
const pv = (capacity: number) => ({ ...DEFAULT_PV_CONFIG, installed: true, system_capacity: capacity });

describe('renewableKpis', () => {
  it('reports nothing installed for an empty building', () => {
    const kpis = renewableKpis([], elements, DEFAULT_BATTERY_CONFIG);
    expect(kpis.installed).toBe(false);
    expect(kpis.pvCapacityKwp).toBe(0);
    expect(kpis.roofSharePercent).toBe(0);
  });

  it('measures roof coverage against the roof area', () => {
    const kpis = renewableKpis([{ element: roofA, pv: pv(8) }], elements, DEFAULT_BATTERY_CONFIG);
    expect(kpis.roofAreaWithPv).toBe(60);
    expect(kpis.roofArea).toBe(100);
    expect(kpis.roofSharePercent).toBe(60);
  });

  it('keeps PV on a wall out of roof coverage but in total capacity', () => {
    const kpis = renewableKpis(
      [{ element: roofA, pv: pv(8) }, { element: wall, pv: pv(3) }],
      elements,
      DEFAULT_BATTERY_CONFIG,
    );
    expect(kpis.pvCapacityKwp).toBe(11);
    expect(kpis.pvSurfaceCount).toBe(2);
    // Not (60 + 50) / 100 = 110%.
    expect(kpis.roofSharePercent).toBe(60);
    expect(kpis.nonRoofCapacityKwp).toBe(3);
  });

  it('reports no roof coverage when every panel is on a wall', () => {
    const kpis = renewableKpis([{ element: wall, pv: pv(3) }], elements, DEFAULT_BATTERY_CONFIG);
    expect(kpis.roofSharePercent).toBe(0);
    expect(kpis.nonRoofCapacityKwp).toBe(3);
    expect(kpis.installed).toBe(true);
  });

  it('reports battery capacity only while it is installed', () => {
    expect(renewableKpis([], elements, DEFAULT_BATTERY_CONFIG).batteryStorageKwh).toBe(0);
    const on = renewableKpis([], elements, { ...DEFAULT_BATTERY_CONFIG, installed: true });
    expect(on.batteryStorageKwh).toBe(DEFAULT_BATTERY_CONFIG.cont_storage_cap_max);
    expect(on.batteryPowerKw).toBe(DEFAULT_BATTERY_CONFIG.cont_energy_cap_max);
    expect(on.installed).toBe(true);
  });
});
