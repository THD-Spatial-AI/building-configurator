import { describe, expect, it } from 'vitest';
import { adaptBuemFeature, parseBuemFeatureForImport, serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
import { DEFAULT_GENERAL, generalFrom } from '../components/BuildingConfigurator/shared/buildingDefaults';
import { toBuem } from './buemRun';

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

describe('a building with storeys left out', () => {
  const three = { ...identity, floorArea: 300, storeys: 3 };
  const elements = {
    w1: { id: 'w1', label: 'Wall', type: 'wall', area: 30, uValue: 0.3, gValue: null, tilt: 90, azimuth: 180, modelledShare: 2 / 3 },
    win: { id: 'win', label: 'Window', type: 'window', area: 6, uValue: 1.1, gValue: 0.5, tilt: 90, azimuth: 180, parentId: 'w1', modelledShare: 2 / 3 },
    r1: { id: 'r1', label: 'Roof', type: 'roof', area: 100, uValue: 0.2, gValue: null, tilt: 30, azimuth: 180, modelledShare: 0 },
  };
  const general = { ...DEFAULT_GENERAL, floorArea: 100, storeys: 3, storeysModelled: [1, 2] };
  const stored = serializeToBuemFeature(three, elements, general);
  const { buem } = stored.properties;
  const sent = Object.fromEntries(buem.building.envelope.elements.map((el: { id: string }) => [el.id, el]));

  it('sends BuEM the floor area and envelope of the modelled storeys only', () => {
    expect(buem.building.A_ref).toEqual({ value: 200, unit: 'm2' });
    expect(sent.w1.area.value).toBeCloseTo(20);
    expect(sent.win.area.value).toBeCloseTo(4);
    expect(sent.r1).toBeUndefined();
  });

  it('sends a ceiling with no heat loss in place of a roof left out, since BuEM needs one', () => {
    const ceilings = buem.building.envelope.elements.filter((el: { type: string }) => el.type === 'roof');
    expect(ceilings).toHaveLength(1);
    expect(ceilings[0]).toMatchObject({ area: { value: 100 }, tilt: { value: 0 }, b_transmission: { value: 0 } });
    expect(buem.envelope_full.elements.some((el: { id: string }) => el.id === ceilings[0].id)).toBe(false);
    // The building had no floor to begin with, so none stands in for one.
    expect(buem.building.envelope.elements.some((el: { type: string }) => el.type === 'floor')).toBe(false);
  });

  it('keeps the whole envelope and the storeys modelled beside the block', () => {
    expect(buem.storey_list).toEqual([{ storey: 1, modelled: true }, { storey: 2, modelled: true }, { storey: 3, modelled: false }]);
    expect(buem.envelope_full.elements.map((el: { id: string; area: { value: number } }) => [el.id, el.area.value]))
      .toEqual([['w1', 30], ['win', 6], ['r1', 100]]);
  });

  it('reopens whole, with each surface\'s share and the storeys modelled', () => {
    const reopened = adaptBuemFeature(stored);
    const reopenedGeneral = generalFrom(reopened);
    expect(reopenedGeneral.floorArea).toBe(100);
    expect(reopenedGeneral.storeysModelled).toEqual([1, 2]);
    expect(reopened.envelope.w1).toMatchObject({ area: 30 });
    expect(reopened.envelope.w1.modelledShare).toBeCloseTo(2 / 3);
    expect(reopened.envelope.r1).toMatchObject({ area: 100, modelledShare: 0 });
  });

  it('reopens whole from an imported file', () => {
    const imported = parseBuemFeatureForImport(stored);
    expect(imported.general.floorArea).toBe(100);
    expect(imported.general.storeysModelled).toEqual([1, 2]);
    expect(imported.elements.r1).toMatchObject({ area: 100, modelledShare: 0 });
  });

  it('stores the same blocks again after reopening', () => {
    const blocks = toBuem(adaptBuemFeature(stored));
    expect(blocks.storey_list?.filter((s) => s.modelled).map((s) => s.storey)).toEqual([1, 2]);
    expect(toBuem(adaptBuemFeature({ ...stored, properties: { ...stored.properties, buem: blocks } }))).toEqual(blocks);
    expect(blocks.building.A_ref.value).toBe(200);
  });

  it('writes neither key when every storey is modelled', () => {
    const all = serializeToBuemFeature(three, elements, { ...general, storeysModelled: [1, 2, 3] }).properties.buem;
    expect(all).not.toHaveProperty('storey_list');
    expect(all).not.toHaveProperty('envelope_full');
    expect(all.building.A_ref.value).toBe(300);
  });
});
