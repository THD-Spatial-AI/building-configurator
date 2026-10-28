import { describe, expect, it } from 'vitest';
import { atticFloorArea, dwellingsTotal, hasAttic, heightLimits, meanStoreyHeight, modelledDwellings, storeyAt, storeyHeightList, tallerThanModel, storeyBands, storeyLines, storeyParts, storeyShares } from './storeys';
import type { SurfacePolygon } from './surfaceMesh';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

/** A 10 m wide wall in the x-z plane from z0 to z1. */
const wall = (id: string, z0: number, z1: number): SurfacePolygon => ({
  id, type: 'WallSurface', coordinates: [[[0, 0, z0], [10, 0, z0], [10, 0, z1], [0, 0, z1], [0, 0, z0]]],
});
/** A 10 x 10 m horizontal surface at height z. */
const flat = (id: string, type: string, z: number): SurfacePolygon => ({
  id, type, coordinates: [[[0, 0, z], [10, 0, z], [10, 10, z], [0, 10, z], [0, 0, z]]],
});
/** A gable triangle on top of a wall, from z0 up to the ridge at z1. */
const gable = (id: string, z0: number, z1: number): SurfacePolygon => ({
  id, type: 'WallSurface', coordinates: [[[0, 0, z0], [10, 0, z0], [5, 0, z1], [0, 0, z0]]],
});

const element = (id: string, type: BuildingElement['type'], extra: Partial<BuildingElement> = {}): BuildingElement => ({
  id, label: id, type, area: 30, uValue: 1, gValue: null, tilt: 90, azimuth: 180, ...extra,
});

/** A roof plane 10 m long rising from the eaves at z0 at y = 0 to the ridge at z1 at y = 5. */
const slope = (id: string, z0: number, z1: number): SurfacePolygon => ({
  id, type: 'RoofSurface', coordinates: [[[0, 0, z0], [10, 0, z0], [10, 5, z1], [0, 5, z1], [0, 0, z0]]],
});

// Three storeys of 3 m from ground at 0 to eaves at 9, a flat roof there.
const polygons = [wall('w1', 0, 9), gable('g1', 9, 12), flat('f1', 'GroundSurface', 0), flat('r1', 'RoofSurface', 9)];
// The same storeys under a pitched roof rising to a ridge at 12: an attic above the eaves.
const pitched = [wall('w1', 0, 9), gable('g1', 9, 12), flat('f1', 'GroundSurface', 0), slope('r1', 9, 12)];

describe('storeyBands', () => {
  it('splits the height from ground to eaves evenly by the storey count', () => {
    expect(storeyBands(polygons, 3)).toEqual({ ground: 0, height: 3, bounds: [0, 3, 6, 9], count: 3 });
  });

  it('gives each storey its share of that height in proportion to the storey heights', () => {
    expect(storeyBands(polygons, 3, [3, 3, 1.5]).bounds).toEqual([0, 3.6, 7.2, 9]);
    expect(storeyBands(polygons, 3, [2, 0, 2]).bounds).toEqual([0, 3, 6, 9]);
  });

  it('places storey lines and picks storeys at those heights', () => {
    const bands = storeyBands(polygons, 3, [3, 3, 1.5]);
    expect([3.5, 3.7, 7.1, 7.3].map((z) => storeyAt(z, bands))).toEqual([1, 2, 2, 3]);
    expect(storeyLines(polygons, 3, [3, 3, 1.5]).every(([a]) => [3.6, 7.2].some((z) => Math.abs(a[2] - z) < 1e-9))).toBe(true);
  });

  it('takes the eaves of the highest roof, not of a lower annex', () => {
    expect(storeyBands([...polygons, flat('annex', 'RoofSurface', 3)], 3).height).toBe(3);
  });
});

describe('storeyLines', () => {
  it('draws a line across every wall at each floor level, clipped to the wall', () => {
    const lines = storeyLines(polygons, 3);
    // w1 crosses z = 3 and z = 6 along its 10 m width; the gable, roof and floor have none.
    expect(lines).toHaveLength(2);
    expect(lines.map(([a, b]) => [a[2], Math.abs(b[0] - a[0])])).toEqual([[3, 10], [6, 10]]);
  });

  it('draws nothing for a building of one storey', () => {
    expect(storeyLines(polygons, 1)).toEqual([]);
  });
});

describe('storeyParts', () => {
  it('cuts each surface to the given storeys, for drawing them over the model', () => {
    const parts = storeyParts(polygons, 3, [2]);
    expect(parts.map((part) => part.id)).toEqual(['w1']);
    const zs = parts[0].coordinates[0].map((p) => p[2]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([3, 6]);
  });
});

describe('storeyAt', () => {
  it('finds the storey at a height, the outer storeys extending beyond the ground and eaves', () => {
    const bands = storeyBands(polygons, 3);
    expect([-1, 0, 2.9, 3, 7, 11].map((z) => storeyAt(z, bands))).toEqual([1, 1, 1, 2, 3, 3]);
  });
});

describe('the attic', () => {
  const elements = { w1: element('w1', 'wall'), g1: element('g1', 'wall'), f1: element('f1', 'floor'), r1: element('r1', 'roof') };

  it('is a band above the eaves under a pitched roof only', () => {
    expect(hasAttic(pitched)).toBe(true);
    expect(hasAttic(polygons)).toBe(false);
    expect(storeyBands(pitched, 3)).toMatchObject({ bounds: [0, 3, 6, 9], count: 4 });
    expect([8.9, 9, 11].map((z) => storeyAt(z, storeyBands(pitched, 3)))).toEqual([3, 4, 4]);
  });

  it('holds the roof and gables, so leaving it out takes them from the envelope', () => {
    const out = storeyShares(pitched, elements, 3, [1, 2, 3]);
    expect([out.w1, out.g1, out.r1, out.f1]).toEqual([1, 0, 0, 1]);
    const all = storeyShares(pitched, elements, 3, [1, 2, 3, 4]);
    expect([all.w1, all.g1, all.r1]).toEqual([1, 1, 1]);
    expect(storeyShares(pitched, elements, 3, [3]).r1).toBe(0);
  });

  it('scales a surface without a polygon by the storeys modelled, not the attic', () => {
    expect(storeyShares(pitched, { extra: element('extra', 'wall') }, 3, [1, 2, 3, 4]).extra).toBe(1);
  });

  it('measures its floor in full under 2 m of headroom or more, half from 1 m to 2 m', () => {
    // The slope rises 3 m over 5 m: 2 m and more over its last 5/3 m, 1 m to 2 m over the 5/3 m before.
    expect(atticFloorArea(pitched)).toBeCloseTo(10 * 5 / 3 + (10 * 5 / 3) / 2);
    expect(atticFloorArea(polygons)).toBe(0);
  });

  it('draws a line at the eaves, one storey or several', () => {
    expect(storeyLines(pitched, 1).map(([a]) => a[2])).toEqual([9]);
    expect(storeyLines(pitched, 3).map(([a]) => a[2])).toEqual([3, 6, 9]);
  });
});

describe('storeyShares', () => {
  const elements = {
    w1: element('w1', 'wall'), g1: element('g1', 'wall'), f1: element('f1', 'floor'), r1: element('r1', 'roof'),
    win: element('win', 'window', { parentId: 'w1' }), extra: element('extra', 'wall'),
  };

  it('counts each surface for its area inside the modelled storeys', () => {
    const shares = storeyShares(polygons, elements, 3, [1, 3]);
    expect(shares.w1).toBeCloseTo(2 / 3);
    expect(shares.f1).toBe(1);
  });

  it('gives the top storey everything above the eaves and the bottom one the ground floor', () => {
    const top = storeyShares(polygons, elements, 3, [3]);
    expect(top.g1).toBe(1);
    expect(top.r1).toBe(1);
    expect(top.f1).toBe(0);
    expect(storeyShares(polygons, elements, 3, [1]).r1).toBe(0);
  });

  it('holds at the magnitudes of a projected CRS', () => {
    const far = (polygon: SurfacePolygon): SurfacePolygon => ({
      ...polygon, coordinates: [polygon.coordinates[0].map(([x, y, z]) => [x + 712345.678, y + 5765432.123, z + 41.2])],
    });
    const shares = storeyShares(polygons.map(far), elements, 3, [1, 3]);
    expect(shares.w1).toBeCloseTo(2 / 3, 6);
    expect(shares.f1).toBe(1);
  });

  it('scales a window with its wall, and a surface without a polygon by the modelled share of storeys', () => {
    const shares = storeyShares(polygons, elements, 3, [2]);
    expect(shares.win).toBeCloseTo(shares.w1);
    expect(shares.extra).toBeCloseTo(1 / 3);
  });
});

describe('modelledDwellings', () => {
  it('sums the dwellings of the modelled storeys only', () => {
    expect(modelledDwellings([2, 3], { 1: 1, 2: 4, 3: 4 })).toBe(8);
  });

  it('is null while a modelled storey has no count', () => {
    expect(modelledDwellings([2, 3], { 2: 4 })).toBeNull();
    expect(modelledDwellings([], {})).toBeNull();
  });
});

describe('dwellingsTotal', () => {
  it('sums the counts given per storey', () => {
    expect(dwellingsTotal(3, { 1: 4, 2: 4 })).toBe(8);
    expect(dwellingsTotal(3, {})).toBeNull();
  });
});

describe('the model\'s height binds storeys and their heights', () => {
  it('allows another storey only while it fits at the room height, so a lower room height allows more', () => {
    expect(heightLimits(4, 1, 2.5).maxStoreys).toBe(1);
    expect(heightLimits(4, 1, 2).maxStoreys).toBe(2);
    expect(heightLimits(10, 3, 2.5).maxStoreys).toBe(4);
  });

  it('caps the shared room height and a storey\'s own height at what the rest leave', () => {
    const limits = heightLimits(5, 2, 2.5, { 2: 2 });
    expect(limits.maxRoomHeight).toBe(3.1);
    expect(limits.maxStoreyHeight(2)).toBe(2.6);
  });

  it('flags storeys taller than the model, and averages the included ones for BuEM', () => {
    expect(tallerThanModel(2.6, storeyHeightList(2, 2.5))).toBe(true);
    expect(tallerThanModel(6, storeyHeightList(2, 2.5, { 1: 3 }))).toBe(false);
    expect(meanStoreyHeight(storeyHeightList(3, 2.5, { 1: 3.1 }), [1, 2])).toBeCloseTo(2.8);
    expect(meanStoreyHeight(storeyHeightList(3, 2.5, { 1: 3.1 }), null)).toBeCloseTo(2.7);
  });
});
