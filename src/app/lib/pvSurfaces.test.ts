import { describe, expect, it } from 'vitest';
import { pvGeometry, pvLayouts, pvSummary } from './pvSurfaces';
import type { PvLayout } from './pvLayout';
import type { TechnologyProduct } from './pvProducts';
import type { SurfacePolygon } from './surfaceMesh';
import type { PvSurface } from '../components/workspace/PvMode';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

const roof: BuildingElement = { id: 'r1', label: 'Roof', type: 'roof', area: 50, uValue: 0.2, gValue: null, tilt: 32, azimuth: 205 };

function surface(state: PvSurface['state'], extra: Partial<PvSurface> = {}): PvSurface {
  return { state, usableShare: 0.8, maxKwp: 8, ...extra };
}

describe('pvGeometry', () => {
  it('takes the building\'s own element, as edited, over the host\'s values', () => {
    expect(pvGeometry('r1', { r1: roof }, surface('installed', { tilt: 10, azimuth: 90, area: 20 })))
      .toEqual({ tilt: 32, azimuth: 205, area: 50, flat: false });
  });

  it('falls back to the host\'s values for a surface that is not an element', () => {
    expect(pvGeometry('garage', {}, surface('suggested', { tilt: 25, azimuth: 180, area: 24 })))
      .toEqual({ tilt: 25, azimuth: 180, area: 24, flat: false });
  });

  it('calls a surface under 10°, or one City2TABULA marks as horizontal, flat', () => {
    expect(pvGeometry('garage', {}, surface('suggested', { tilt: 3, azimuth: 0, area: 24 }))?.flat).toBe(true);
    expect(pvGeometry('r1', { r1: { ...roof, azimuth: -1 } }, undefined)?.flat).toBe(true);
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

  it('takes capacity and panel area from a surface\'s module layout where it has one', () => {
    const layout = { count: 20, kwp: 8, area: 40 } as PvLayout;
    const summary = pvSummary({ r1: surface('installed', { maxKwp: 99 }) }, { r1: roof }, { r1: layout });
    expect(summary.kwp).toBe(8);
    expect(summary.panelArea).toBe(40);
  });

  it('adds up each installed surface\'s investment and O&M from its own product', () => {
    const priced = (id: string, cost: number): TechnologyProduct => ({
      id, key: id, type: 'pv_supply',
      constraints: [{ key: 'cost_energy_cap', default_value: cost }, { key: 'cost_om_annual', default_value: 10 }],
    });
    const products: Record<string, TechnologyProduct> = { r1: priced('a', 500), r2: priced('b', 600) };
    const summary = pvSummary(
      { r1: surface('installed'), r2: surface('installed'), r3: surface('suggested') },
      {},
      { r1: { kwp: 4 } as PvLayout, r2: { kwp: 2 } as PvLayout, r3: { kwp: 9 } as PvLayout },
      (id) => products[id],
    );
    expect(summary.investment).toBe(4 * 500 + 2 * 600);
    expect(summary.omPerYear).toBe(6 * 10);
    expect(pvSummary({ r1: surface('installed') }, {}).investment).toBeUndefined();
  });

  it('leaves out the panel area of an installed surface without geometry', () => {
    expect(pvSummary({ x: surface('installed') }, {}).panelArea).toBe(0);
  });
});

describe('pvLayouts', () => {
  const flat: SurfacePolygon = { id: 'f', type: 'RoofSurface', coordinates: [[[0, 0, 3], [10, 0, 3], [10, 6, 3], [0, 6, 3], [0, 0, 3]]] };

  it('lays out each offered surface that has a polygon, with its own settings', () => {
    const layouts = pvLayouts([flat], {
      f: { usableShare: 1, mounting: { kind: 'flush' }, orientation: 'portrait' },
      elsewhere: { usableShare: 1 },
    }, { width: 1, height: 1.7, kwp: 0.4 });
    expect(Object.keys(layouts)).toEqual(['f']);
    expect(layouts.f.count).toBe(27);
    expect(layouts.f.area).toBeCloseTo(27 * 1.7);
  });

  it('takes each surface\'s own module where a function gives one per surface', () => {
    const layouts = pvLayouts([flat], { f: { usableShare: 1, mounting: { kind: 'flush' } } }, () => ({ width: 2, height: 2, kwp: 1 }));
    expect(layouts.f.kwp).toBe(layouts.f.count);
  });
});
