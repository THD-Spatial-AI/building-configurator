import { describe, expect, it } from 'vitest';
import { leftOutParts, storeyBands, storeyLines, storeyShares } from './storeys';
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

// Three storeys of 3 m from ground at 0 to eaves at 9, a pitched roof above.
const polygons = [wall('w1', 0, 9), gable('g1', 9, 12), flat('f1', 'GroundSurface', 0), flat('r1', 'RoofSurface', 9)];

describe('storeyBands', () => {
  it('splits the height from ground to eaves evenly by the storey count', () => {
    expect(storeyBands(polygons, 3)).toEqual({ ground: 0, height: 3 });
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

describe('leftOutParts', () => {
  it('cuts each surface to the storeys left out, for drawing them lighter', () => {
    const parts = leftOutParts(polygons, 3, [1, 3]);
    expect(parts.map((part) => part.id)).toEqual(['w1']);
    const zs = parts[0].coordinates[0].map((p) => p[2]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([3, 6]);
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
