import { describe, expect, it } from 'vitest';
import { parseBuemFeatureForImport, serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
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

describe('thermal defaults', () => {
  const feature = (thermal?: Record<string, unknown>) => ({
    type: 'Feature',
    properties: { buem: { building: { building_type: 'SFH', country: 'NL', ...(thermal ? { thermal } : {}) } } },
  });

  it('match the v6-draft schema defaults', () => {
    expect(DEFAULT_GENERAL).toMatchObject({
      n_air_infiltration: 0.5, n_air_use: 0.5, c_m: 165, massClass: 'Medium', comfortT_lb: 18, comfortT_ub: 21,
    });
  });

  it('leave a thermal value the import does not set to the shared defaults', () => {
    const { general } = parseBuemFeatureForImport(feature());
    for (const key of ['n_air_infiltration', 'n_air_use', 'c_m', 'massClass']) expect(general).not.toHaveProperty(key);
  });

  it('send the heating and cooling setpoints and read them back', () => {
    const sent = serializeToBuemFeature(identity, {}, { ...DEFAULT_GENERAL, comfortT_lb: 20, comfortT_ub: 24 });
    expect(sent.properties.buem.building.thermal).toMatchObject({
      comfortT_lb: { value: 20, unit: 'degC' }, comfortT_ub: { value: 24, unit: 'degC' },
    });
    expect(parseBuemFeatureForImport(sent).general).toMatchObject({ comfortT_lb: 20, comfortT_ub: 24 });
  });

  it('import the thermal values a feature sets', () => {
    const { general } = parseBuemFeatureForImport(feature({
      n_air_infiltration: { value: 0.3 }, n_air_use: { value: 0.6 }, c_m: { value: 260 }, thermal_class: 'heavy',
    }));
    expect(general).toMatchObject({ n_air_infiltration: 0.3, n_air_use: 0.6, c_m: 260, massClass: 'Heavy' });
  });
});
