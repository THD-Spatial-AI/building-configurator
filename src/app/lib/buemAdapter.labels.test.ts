import { describe, expect, it } from 'vitest';
import { readableSurfaceLabels } from './buemAdapter';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';

function surface(id: string, type: BuildingElement['type'], azimuth: number, tilt: number): BuildingElement {
  return { id, label: id, type, area: 10, uValue: 0.3, gValue: null, tilt, azimuth, source: 'city', customMode: false };
}

describe('readableSurfaceLabels', () => {
  it('names UUID surfaces by type and orientation, numbering repeats', () => {
    const labels = readableSurfaceLabels([
      surface('75a9cf23-b896-4370-b719-90359029ba79', 'wall', 180, 90),
      surface('db891921-0a09-4eb6-98a7-1140e6637864', 'wall', 182, 90),
      surface('0a460bf9-1cbf-45c3-a6c5-06f684c6c316', 'wall', 90, 90),
      surface('80c11065-264f-4db9-8eef-112be9fd57dc', 'roof', 0, 3),
      surface('85a1eb60-b065-422f-9810-ba8b64019fae', 'roof', 225, 40),
      surface('1d893c8d-156c-425b-a560-96252b8354db', 'floor', 0, 180),
    ]);
    expect(labels).toEqual([
      'South wall 1',
      'South wall 2',
      'East wall',
      'Flat roof',
      'Southwest roof',
      'Floor',
    ]);
  });

  it('keeps labels derived from readable ids', () => {
    expect(readableSurfaceLabels([surface('Wall_1', 'wall', 180, 90)])).toEqual(['Wall 1']);
  });
});
