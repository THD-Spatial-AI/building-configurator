import { describe, expect, it } from 'vitest';
import { adaptBuemFeature } from './buemAdapter';

const feature = (geometry: unknown) => ({
  type: 'Feature', id: 'b1', ...(geometry ? { geometry } : {}),
  properties: { buem: { building: { building_type: 'SFH', A_ref: { value: 100, unit: 'm2' } } } },
});
const ring = [[6.1, 52.2], [6.2, 52.2], [6.2, 52.3], [6.1, 52.2]];

describe("a building's location", () => {
  it('is a Point as given', () => {
    expect(adaptBuemFeature(feature({ type: 'Point', coordinates: [6.1, 52.2] })).identity.coordinates).toEqual([6.1, 52.2]);
  });

  it('is the first vertex of a footprint, as a Polygon or MultiPolygon', () => {
    expect(adaptBuemFeature(feature({ type: 'Polygon', coordinates: [ring] })).identity.coordinates).toEqual([6.1, 52.2]);
    expect(adaptBuemFeature(feature({ type: 'MultiPolygon', coordinates: [[ring]] })).identity.coordinates).toEqual([6.1, 52.2]);
  });

  it('is 0, 0 without a geometry, and refused for any other geometry', () => {
    expect(adaptBuemFeature(feature(undefined)).identity.coordinates).toEqual([0, 0]);
    expect(() => adaptBuemFeature(feature({ type: 'LineString', coordinates: ring }))).toThrow('got LineString');
  });
});
