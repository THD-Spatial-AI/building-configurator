import { describe, expect, it } from 'vitest';
import { adaptBuemFeature, serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
import { DEFAULT_GENERAL } from '../components/BuildingConfigurator/shared/buildingDefaults';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

const identity: BuildingIdentity = {
  id: 'b1', label: 'B1', coordinates: [6, 52], buildingType: 'Single-family House',
  constructionYear: 1990, country: 'NL', floorArea: 100, roomHeight: 2.5, storeys: 1,
};

function surface(id: string, type: BuildingElement['type'], azimuth: number, tilt: number, area = 10, extra: Partial<BuildingElement> = {}): BuildingElement {
  return { id, label: id, type, area, uValue: 1, gValue: type === 'window' ? 0.6 : null, tilt, azimuth, ...extra };
}

function sentParents(elements: Record<string, BuildingElement>): Record<string, string | undefined> {
  const sent = serializeToBuemFeature(identity, elements, DEFAULT_GENERAL).properties.buem.building.envelope.elements;
  return Object.fromEntries(sent.map((el: Record<string, unknown>) => [el.id, el.parent_id as string | undefined]));
}

describe('parent_id', () => {
  const walls = {
    south: surface('south', 'wall', 180, 90, 40),
    south_small: surface('south_small', 'wall', 175, 90, 5),
    east: surface('east', 'wall', 90, 90, 30),
    roof: surface('roof', 'roof', 180, 35, 50),
  };

  it('keeps the parent an element names', () => {
    const parents = sentParents({ ...walls, win: surface('win', 'window', 180, 90, 2, { parentId: 'east' }) });
    expect(parents.win).toBe('east');
  });

  it('puts a window or door without one in the largest wall facing its way', () => {
    const parents = sentParents({
      ...walls,
      win: surface('win', 'window', 185, 90, 2),
      door: surface('door', 'door', 95, 90, 2),
    });
    expect(parents).toMatchObject({ win: 'south', door: 'east' });
  });

  it('puts a skylight in a roof', () => {
    expect(sentParents({ ...walls, sky: surface('sky', 'window', 180, 30, 1) }).sky).toBe('roof');
  });

  it('sends none for walls, roofs and floors', () => {
    expect(sentParents(walls)).toEqual({ south: undefined, south_small: undefined, east: undefined, roof: undefined });
  });

  it('refuses a window with no surface to sit in, naming it', () => {
    expect(() => sentParents({ win: surface('win', 'window', 180, 90, 2) })).toThrow('win');
  });

  it('reads parent_id back from a feature', () => {
    const feature = {
      type: 'Feature', id: 'b1', geometry: { type: 'Point', coordinates: [6, 52] },
      properties: { buem: { building: { building_type: 'SFH', country: 'NL', envelope: { elements: [
        { id: 'w', type: 'wall', area: { value: 10 }, azimuth: { value: 180 }, tilt: { value: 90 } },
        { id: 'win', type: 'window', parent_id: 'w', area: { value: 2 }, azimuth: { value: 180 }, tilt: { value: 90 } },
      ] } } } },
    };
    expect(adaptBuemFeature(feature).envelope.win.parentId).toBe('w');
  });
});
