import { describe, expect, it } from 'vitest';
import {
  applyState, customCount, startingStates, variantNumber, variantSubtype,
} from './refurbishment';
import type { IgnisVariantLevel } from './ignisAdapter';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

const levels: IgnisVariantLevel[] = [
  { code: 'NL.N.SFH.02.Deta.ReEx.001.001', number: 1, label: 'Existing state', data: { U_Wall_1: 1.5, U_Actual_Wall_1: 1.5 } },
  { code: 'NL.N.SFH.02.Deta.ReEx.001.002', number: 2, label: 'Usual refurbishment', data: { U_Wall_1: 1.5, U_Actual_Wall_1: 0.4 } },
  { code: 'NL.N.SFH.02.Deta.ReEx.001.003', number: 3, label: 'Advanced refurbishment', data: { U_Wall_1: 1.5, U_Actual_Wall_1: 0.2 } },
];

function wall(id: string, uValue: number, defaultUValue = 1.3): BuildingElement {
  return { id, label: id, type: 'wall', area: 10, uValue, defaultUValue, gValue: null, tilt: 90, azimuth: 0 };
}

describe('variant codes', () => {
  it('read the variant number and subtype', () => {
    expect(variantNumber('NL.N.SFH.02.Deta.ReEx.001.002')).toBe(2);
    expect(variantSubtype('NL.N.SFH.02.Deta.ReEx.001.002')).toBe('Deta');
  });

  it('give nothing for a missing or short code', () => {
    expect(variantNumber(undefined)).toBeNull();
    expect(variantSubtype('NL.N.SFH')).toBeUndefined();
  });
});

describe('startingStates', () => {
  it('keeps the saved states', () => {
    expect(startingStates({ variantCode: 'NL.N.SFH.02.Deta.ReEx.001.002', states: { roof: 3 } }))
      .toEqual({ wall: 2, roof: 3, floor: 2, window: 2, door: 2 });
  });

  it('starts every element type at existing state without a saved state or code', () => {
    expect(startingStates(undefined)).toEqual({ wall: 1, roof: 1, floor: 1, window: 1, door: 1 });
  });
});

describe('applyState', () => {
  const initial = startingStates(undefined);

  it('sets the surfaces of the type to the state', () => {
    const next = applyState({ a: wall('a', 1.3), b: wall('b', 1.3) }, 'wall', 1, 3, initial, levels);
    expect([next.a.uValue, next.b.uValue]).toEqual([0.2, 0.2]);
  });

  it('returns to the surface as loaded for the starting state', () => {
    const next = applyState({ a: wall('a', 0.2) }, 'wall', 3, 1, initial, levels);
    expect(next.a.uValue).toBe(1.3);
  });

  it('keeps a surface set by hand and counts it as custom', () => {
    const elements = { a: wall('a', 1.3), b: wall('b', 0.9) };
    const next = applyState(elements, 'wall', 1, 2, initial, levels);
    expect([next.a.uValue, next.b.uValue]).toEqual([0.4, 0.9]);
    expect(customCount(next, 'wall', 2, initial, levels)).toBe(1);
  });

  it('keeps a surface added by hand', () => {
    const added = { ...wall('added', 0.5), defaultUValue: undefined, source: 'custom' as const };
    const next = applyState({ added }, 'wall', 1, 3, initial, levels);
    expect(next.added.uValue).toBe(0.5);
    expect(customCount(next, 'wall', 3, initial, levels)).toBe(1);
  });

  it('leaves a state the building has no variant for alone', () => {
    const elements = { a: wall('a', 1.3) };
    expect(applyState(elements, 'wall', 1, 4, initial, levels)).toBe(elements);
  });
});
