import { describe, expect, it } from 'vitest';
import { pvGeometry, pvSummary } from './pvSurfaces';
import type { PvSurface } from '../components/workspace/PvMode';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

const roof: BuildingElement = { id: 'r1', label: 'Roof', type: 'roof', area: 50, uValue: 0.2, gValue: null, tilt: 32, azimuth: 205 };

function surface(state: PvSurface['state'], extra: Partial<PvSurface> = {}): PvSurface {
  return { state, usableShare: 0.8, maxKwp: 8, ...extra };
}

describe('pvGeometry', () => {
  it('takes the building\'s own element, as edited, over the host\'s values', () => {
    expect(pvGeometry('r1', { r1: roof }, surface('installed', { tilt: 10, azimuth: 90, area: 20 })))
      .toEqual({ tilt: 32, azimuth: 205, area: 50 });
  });

  it('falls back to the host\'s values for a surface that is not an element', () => {
    expect(pvGeometry('garage', {}, surface('suggested', { tilt: 0, azimuth: 180, area: 24 })))
      .toEqual({ tilt: 0, azimuth: 180, area: 24 });
  });

  it('gives nothing when neither holds the geometry', () => {
    expect(pvGeometry('garage', {}, surface('available'))).toBeNull();
  });
});

describe('pvSummary', () => {
  it('sums capacity and panel area of the installed surfaces and counts them', () => {
    const surfaces = {
      r1: surface('installed', { maxKwp: 8.3 }),
      r2: surface('installed', { maxKwp: 6.2, area: 40, usableShare: 0.5 }),
      r3: surface('suggested', { maxKwp: 3.8 }),
    };
    const summary = pvSummary(surfaces, { r1: roof });
    expect(summary.kwp).toBeCloseTo(14.5);
    expect(summary.installed).toBe(2);
    expect(summary.total).toBe(3);
    expect(summary.panelArea).toBeCloseTo(50 * 0.8 + 40 * 0.5);
  });

  it('leaves out the panel area of an installed surface without geometry', () => {
    expect(pvSummary({ x: surface('installed') }, {}).panelArea).toBe(0);
  });
});
