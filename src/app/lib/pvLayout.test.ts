import { describe, expect, it } from 'vitest';
import { pvLayout, type PvModule } from './pvLayout';
import type { SurfacePolygon } from './surfaceMesh';

const module: PvModule = { width: 1.0, height: 1.7, kwp: 0.4 };

/** A 10 m (east-west) by 6 m (up the slope) roof facing south at `tilt`, eaves at z = 5. */
function southRoof(tilt: number): SurfacePolygon {
  const rad = (tilt * Math.PI) / 180;
  const dy = 6 * Math.cos(rad);
  const dz = 6 * Math.sin(rad);
  return {
    id: 'r', type: 'roof',
    coordinates: [[[0, 0, 5], [10, 0, 5], [10, dy, 5 + dz], [0, dy, 5 + dz], [0, 0, 5]]],
  };
}

/** Is a point inside the roof's footprint, at least `clearance` from every edge (plan view, flat roofs only)? */
function insideFlat(point: number[], ring: number[][], clearance: number): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  if (!inside) return false;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    if (Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) < clearance - 1e-6) return false;
  }
  return true;
}

describe('pvLayout flush', () => {
  it('fits whole modules in rows inside the edge clearance', () => {
    const layout = pvLayout(southRoof(30), module, { usableShare: 1, mounting: { kind: 'flush' }, orientation: 'portrait' });
    expect(layout.count).toBe(27);
    expect(layout.kwp).toBeCloseTo(27 * 0.4);
  });

  it('takes the roof\'s own tilt and facing', () => {
    const layout = pvLayout(southRoof(30), module, { usableShare: 1, mounting: { kind: 'flush' } });
    expect(layout.tilt).toBeCloseTo(30);
    expect(layout.azimuth).toBeCloseTo(180);
  });

  it('picks the orientation that fits more modules when none is given', () => {
    const best = pvLayout(southRoof(30), module, { usableShare: 1, mounting: { kind: 'flush' } });
    const landscape = pvLayout(southRoof(30), module, { usableShare: 1, mounting: { kind: 'flush' }, orientation: 'landscape' });
    expect(landscape.count).toBe(25);
    expect(best.count).toBe(27);
    expect(best.orientation).toBe('portrait');
  });

  it('fills the strip one orientation leaves with modules turned the other way', () => {
    // 10 m by 3.34 m: one portrait row (9) leaves room for one landscape row (5).
    const strip: SurfacePolygon = { id: 's', type: 'roof', coordinates: [[[0, 0, 3], [10, 0, 3], [10, 3.34, 3], [0, 3.34, 3], [0, 0, 3]]] };
    const flush = { usableShare: 1, mounting: { kind: 'flush' } } as const;
    const mixed = pvLayout(strip, module, flush);
    expect(pvLayout(strip, module, { ...flush, orientation: 'portrait' }).count).toBe(9);
    expect(pvLayout(strip, module, { ...flush, orientation: 'landscape' }).count).toBe(10);
    expect(mixed.count).toBe(14);
    expect(mixed.orientation).toBe('mixed');

    const boxes = mixed.modules.map((corners) => {
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    });
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart = a[1] <= b[0] + 1e-6 || b[1] <= a[0] + 1e-6 || a[3] <= b[2] + 1e-6 || b[3] <= a[2] + 1e-6;
        expect(apart).toBe(true);
      }
      for (const corner of mixed.modules[i]) expect(insideFlat(corner, strip.coordinates[0], 0.3)).toBe(true);
    }
  });

  it('caps the modules at the usable share of the area', () => {
    const layout = pvLayout(southRoof(30), module, { usableShare: 0.5, mounting: { kind: 'flush' } });
    expect(layout.count).toBe(Math.floor((0.5 * 60) / 1.7));
  });

  it('places no module, or part of one, outside a triangular roof', () => {
    const triangle: SurfacePolygon = { id: 't', type: 'roof', coordinates: [[[0, 0, 3], [10, 0, 3], [5, 6, 3], [0, 0, 3]]] };
    const layout = pvLayout(triangle, module, { usableShare: 1, mounting: { kind: 'racked', tilt: 0, azimuth: 180 } });
    expect(layout.count).toBeGreaterThan(0);
    for (const corners of layout.modules) {
      for (const corner of corners) expect(insideFlat(corner, triangle.coordinates[0], 0.3)).toBe(true);
    }
  });
});

describe('pvLayout racked', () => {
  const flat: SurfacePolygon = { id: 'f', type: 'roof', coordinates: [[[0, 0, 3], [10, 0, 3], [10, 6, 3], [0, 6, 3], [0, 0, 3]]] };

  it('sets the modules at their own tilt and facing, rows spaced against self-shading', () => {
    const layout = pvLayout(flat, module, { usableShare: 1, mounting: { kind: 'racked', tilt: 15, azimuth: 180 }, orientation: 'portrait' });
    expect(layout.count).toBe(18);
    expect(layout.tilt).toBe(15);
    expect(layout.azimuth).toBe(180);
  });

  it('raises each module\'s upper edge by its tilt', () => {
    const layout = pvLayout(flat, module, { usableShare: 1, mounting: { kind: 'racked', tilt: 15, azimuth: 180 }, orientation: 'portrait' });
    const heights = layout.modules[0].map((corner) => corner[2]);
    expect(Math.max(...heights) - Math.min(...heights)).toBeCloseTo(1.7 * Math.sin((15 * Math.PI) / 180), 3);
  });
});

describe('pvLayout default mounting', () => {
  it('racks a flat roof at 15° south and lays a pitched roof flush', () => {
    const flat: SurfacePolygon = { id: 'f', type: 'roof', coordinates: [[[0, 0, 3], [10, 0, 3], [10, 6, 3], [0, 6, 3], [0, 0, 3]]] };
    expect(pvLayout(flat, module, { usableShare: 1 })).toMatchObject({ tilt: 15, azimuth: 180 });
    expect(pvLayout(southRoof(30), module, { usableShare: 1 }).tilt).toBeCloseTo(30);
  });
});
