import { describe, it, expect } from 'vitest';
import {
  compassDir, isFlatRoof, pvCandidates, scorePvSurface, suggestedCapacityKwp,
} from './pvSuitability';
import type { BuildingElement } from '../configure/model/buildingElements';

function surface(over: Partial<BuildingElement>): BuildingElement {
  return {
    id: 'x', label: 'x', type: 'roof', area: 40, uValue: 1, gValue: null,
    tilt: 35, azimuth: 180, ...over,
  };
}

describe('scorePvSurface', () => {
  it('rejects surfaces panels do not go on', () => {
    for (const type of ['floor', 'window', 'door'] as const) {
      expect(scorePvSurface(surface({ type }))).toBeNull();
    }
  });

  it('rates a south-facing pitched roof above an east-facing one', () => {
    const south = scorePvSurface(surface({ azimuth: 180 }))!;
    const east = scorePvSurface(surface({ azimuth: 90 }))!;
    expect(south).toBeGreaterThan(east);
  });

  it('rejects anything facing more than 90 degrees from south', () => {
    expect(scorePvSurface(surface({ azimuth: 0 }))).toBeNull();
    expect(scorePvSurface(surface({ azimuth: 300 }))).toBeNull();
  });

  it('treats a flat roof as unaffected by azimuth', () => {
    const flat = surface({ azimuth: -1, tilt: 0 });
    expect(isFlatRoof(flat)).toBe(true);
    expect(scorePvSurface(flat)).not.toBeNull();
    expect(compassDir(flat.azimuth)).toBe('flat');
  });

  it('prefers a roof to a wall of the same orientation', () => {
    // Away from the optimum, where the roof bonus is not lost to the 1.0 cap.
    const modest = { area: 10, tilt: 20 };
    expect(scorePvSurface(surface({ ...modest, type: 'roof' }))!)
      .toBeGreaterThan(scorePvSurface(surface({ ...modest, type: 'wall' }))!);
  });
});

describe('suggestedCapacityKwp', () => {
  it('derives capacity from the coverable area', () => {
    // 50 m² at 80% coverage, 0.2 kWp/m² -> 8 kWp
    expect(suggestedCapacityKwp(50, 80)).toBe(8);
  });
});

describe('pvCandidates', () => {
  it('lists suitable surfaces best first and skips the rest', () => {
    const elements = {
      good: surface({ id: 'good', azimuth: 180, area: 40 }),
      side: surface({ id: 'side', azimuth: 120, area: 20 }),
      north: surface({ id: 'north', azimuth: 10 }),
      floor: surface({ id: 'floor', type: 'floor' }),
      // A real envelope is full of these; no array fits on one.
      sliver: surface({ id: 'sliver', azimuth: 180, area: 0.4 }),
    };
    const candidates = pvCandidates(elements, 80);
    expect(candidates.map((c) => c.element.id)).toEqual(['good', 'side']);
    expect(candidates[0].capacityKwp).toBe(6.4);
  });
});
