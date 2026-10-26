import { describe, expect, it } from 'vitest';
import { adaptBuemFeature, parseBuemFeatureForImport, serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
import { DEFAULT_GENERAL, generalFrom } from '../components/BuildingConfigurator/shared/buildingDefaults';

const identity: BuildingIdentity = {
  id: 'b1', label: 'B1', coordinates: [6, 52], buildingType: 'Single-family House',
  constructionYear: 1990, country: 'NL', floorArea: 200, roomHeight: 2.5, storeys: 2,
};

describe('storeys of a stored building', () => {
  const stored = serializeToBuemFeature(identity, {}, { ...DEFAULT_GENERAL, floorArea: 100, storeys: 2 });

  it('sends BuEM the whole floor area', () => {
    expect(stored.properties.buem.building.A_ref).toEqual({ value: 200, unit: 'm2' });
  });

  it('come back as they were when the host reopens the building', () => {
    const general = generalFrom(adaptBuemFeature(stored));
    expect(general.storeys).toBe(2);
    expect(general.floorArea).toBe(100);
  });

  it('come back as they were from an imported file', () => {
    const { general } = parseBuemFeatureForImport(stored);
    expect(general.storeys).toBe(2);
    expect(general.floorArea).toBe(100);
  });
});
