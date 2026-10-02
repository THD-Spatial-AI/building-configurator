import { describe, expect, it } from 'vitest';
import { serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
import { DEFAULT_GENERAL } from '../components/BuildingConfigurator/shared/buildingDefaults';

const identity: BuildingIdentity = {
  id: 'b1', label: 'B1', coordinates: [6, 52], buildingType: 'Single-family House',
  constructionYear: 1990, country: 'NL', floorArea: 100, roomHeight: 2.5, storeys: 1,
};

function thermalClass(massClass: string): string {
  return serializeToBuemFeature(identity, {}, { ...DEFAULT_GENERAL, massClass })
    .properties.buem.building.thermal.thermal_class;
}

describe('thermal_class', () => {
  it.each([
    ['VeryLight', 'light'],
    ['Light', 'light'],
    ['Medium', 'medium'],
    ['Heavy', 'heavy'],
    ['VeryHeavy', 'heavy'],
  ])('sends mass class %s as %s', (massClass, expected) => {
    expect(thermalClass(massClass)).toBe(expected);
  });

  it('refuses a mass class it has no BuEM class for', () => {
    expect(() => thermalClass('Massive')).toThrow('Massive');
  });
});
