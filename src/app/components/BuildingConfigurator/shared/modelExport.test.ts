import { describe, it, expect } from 'vitest';
import { buildingCsv, surfacesCsv, toCsv } from './modelExport';
import { DEFAULT_PV_CONFIG } from './buildingDefaults';
import type { BuildingElement } from '../configure/model/buildingElements';

function surface(over: Partial<BuildingElement>): BuildingElement {
  return {
    id: 'a', label: 'Wall', type: 'wall', area: 12.5, uValue: 0.24,
    gValue: null, tilt: 90, azimuth: 180, source: 'city', ...over,
  };
}

describe('toCsv', () => {
  it('quotes a field carrying a comma, a quote or a newline', () => {
    expect(toCsv([['plain', 'with,comma', 'say "hi"', 'two\nlines']]))
      .toBe('plain,"with,comma","say ""hi""","two\nlines"');
  });

  it('writes an empty cell for a missing value', () => {
    expect(toCsv([['a', null, undefined, 0]])).toBe('a,,,0');
  });
});

describe('surfacesCsv', () => {
  it('carries a surface and its PV array', () => {
    const roof = surface({ id: 'r1', label: 'Roof', type: 'roof', area: 40, tilt: 35, azimuth: 180 });
    const csv = surfacesCsv(
      { r1: roof },
      { r1: { ...DEFAULT_PV_CONFIG, installed: true, system_capacity: 6.4 } },
    );
    const [header, row] = csv.split('\n');
    expect(header.startsWith('surface_id,label,type,face')).toBe(true);
    expect(row).toBe('r1,Roof,roof,S,40.00,0.240,,35.0,180.0,city,yes,6.40');
  });

  it('marks a surface with no array, and a horizontal one as flat', () => {
    const csv = surfacesCsv({ f1: surface({ id: 'f1', type: 'roof', azimuth: -1, tilt: 0 }) }, {});
    expect(csv.split('\n')[1]).toContain(',flat,');
    expect(csv.split('\n')[1].endsWith(',no,')).toBe(true);
  });

  it('escapes a renamed surface that carries a comma', () => {
    const csv = surfacesCsv({ a: surface({ label: 'Wall, north side' }) }, {});
    expect(csv.split('\n')[1]).toContain('"Wall, north side"');
  });
});

describe('buildingCsv', () => {
  it('derives the totals a reader would otherwise have to work out', () => {
    const csv = buildingCsv(
      { buildingName: 'Test', floorArea: 50, storeys: 3, roomHeight: 2.5, use_milp: true },
      { totalEnvelopeArea: 320, avgUValue: 0.41 },
    );
    expect(csv).toContain('floor_area_total,150.00,m2');
    expect(csv).toContain('volume,375.0,m3');
    expect(csv).toContain('calculation_method,MILP,');
  });

  it('leaves out a heat demand that has not been calculated', () => {
    const csv = buildingCsv({}, { totalEnvelopeArea: 1, avgUValue: 1 });
    expect(csv).not.toContain('annual_heat_demand');
  });
});
