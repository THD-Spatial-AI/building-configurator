import { describe, expect, it } from 'vitest';
import { translate } from '@/app/i18n';
import { localSurfaceLabel, readableSurfaceLabels } from './buemAdapter';
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

describe('localSurfaceLabel', () => {
  const de = (key: string, values?: Record<string, string | number>) => translate('de', key, values);
  const en = (key: string, values?: Record<string, string | number>) => translate('en', key, values);
  const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const generated = readableSurfaceLabels([
    ...(['wall', 'roof', 'window', 'door'] as const).flatMap((type, t) => [0, 45, 90, 135, 180, 225, 270, 315, 0]
      .map((azimuth, i) => surface(uuid(t * 10 + i), type, azimuth, 90))),
    surface(uuid(90), 'roof', 0, 3),
    surface(uuid(91), 'floor', 0, 0),
  ]);

  it('names every generated surface in the language, keeping its number', () => {
    expect(localSurfaceLabel(de, 'Northwest wall 3')).toBe('Nordwestwand 3');
    expect(localSurfaceLabel(de, 'Southeast roof')).toBe('Südostdach');
    expect(localSurfaceLabel(de, 'Flat roof')).toBe('Flachdach');
    expect(localSurfaceLabel(de, 'Floor 2')).toBe('Boden 2');
    for (const label of generated) {
      const local = localSurfaceLabel(de, label);
      expect(local).not.toBe(label);
      expect(local).not.toContain('surface.named');
    }
  });

  it('reads every generated label back unchanged in English, and leaves any other label as it is', () => {
    expect(generated.map((label) => localSurfaceLabel(en, label))).toEqual(generated);
    expect(localSurfaceLabel(de, 'Wall 1')).toBe('Wall 1');
    expect(localSurfaceLabel(de, 'Garage roof')).toBe('Garage roof');
  });
});
