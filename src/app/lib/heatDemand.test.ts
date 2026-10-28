import { describe, expect, it } from 'vitest';
import { loadVariantLevels } from './heatDemand';
import type { IgnisMatchResponse } from './ignisAdapter';
import type { VariantLookupServices } from './services';

function lookup(data: IgnisMatchResponse['data'], calls: unknown[][] = []): VariantLookupServices {
  return {
    fetchMatchingVariants: async (...args) => {
      calls.push(args);
      return { country: 'NL', prefix: 'NL.N.SFH.02.Deta', data };
    },
    fetchVariantData: async (code) => ({
      country: 'NL', variant_code: code, expected_q_h_nd: 0, tabula_data: {},
    }),
  };
}

describe('loadVariantLevels', () => {
  it('looks a school up by the residential type of its own variant code, and nothing without one', async () => {
    const calls: unknown[][] = [];
    await loadVariantLevels(lookup([], calls), 'NL', 'School', 1975, 'Deta', 'NL.N.MFH.02.Gen.ReEx.001.001');
    expect(calls).toEqual([['NL', 'MFH', 1975, 'Deta']]);
    const none: unknown[][] = [];
    expect(await loadVariantLevels(lookup([], none), 'NL', 'School', 1975)).toEqual([]);
    expect(none).toEqual([]);
  });

  it('asks for the subtype it is given', async () => {
    const calls: unknown[][] = [];
    await loadVariantLevels(lookup([], calls), 'NL', 'Single-family House', 1975, 'Deta');
    expect(calls).toEqual([['NL', 'SFH', 1975, 'Deta']]);
  });

  it('keeps only the subtype asked for, else the first one listed', async () => {
    const data = [
      { code: 'NL.N.TH.04.End.ReEx.001.001', label: 'Existing state' },
      { code: 'NL.N.TH.04.Gen.ReEx.001.001', label: 'Refurbishment level 4' },
      { code: 'NL.N.TH.04.Gen.ReEx.001.002', label: 'Refurbishment level 5' },
    ];
    const codes = async (subtype?: string) =>
      (await loadVariantLevels(lookup(data), 'NL', 'Terraced House', 1998, subtype)).map((level) => level.code);
    expect(await codes('Gen')).toEqual(['NL.N.TH.04.Gen.ReEx.001.001', 'NL.N.TH.04.Gen.ReEx.001.002']);
    expect(await codes()).toEqual(['NL.N.TH.04.End.ReEx.001.001']);
  });

  it('keeps variants 1 to 3 with their number and label, in order', async () => {
    const levels = await loadVariantLevels(lookup([
      { code: 'NL.N.SFH.02.Deta.ReEx.001.003', label: 'Advanced refurbishment' },
      { code: 'NL.N.SFH.02.Deta.ReEx.001.001', number: 1, label: 'Minimum requirements' },
      { code: 'NL.N.SFH.02.Deta.ReEx.001.004', label: 'Refurbishment level 4' },
    ]), 'NL', 'Single-family House', 1975);
    expect(levels.map(({ number, label }) => ({ number, label }))).toEqual([
      { number: 1, label: 'Minimum requirements' },
      { number: 3, label: 'Advanced refurbishment' },
    ]);
  });

  it('names the generic labels of older ignis releases as TABULA does', async () => {
    const levels = await loadVariantLevels(lookup([
      { code: 'NL.N.TH.04.Gen.ReEx.001.001', label: 'Refurbishment level 4' },
      { code: 'NL.N.TH.04.Gen.ReEx.001.002', label: 'Medium refurbishment' },
      { code: 'NL.N.TH.04.Gen.ReEx.001.003', label: 'KfW Effizienzhaus 70' },
    ]), 'NL', 'Terraced House', 1998, 'Gen');
    expect(levels.map((level) => level.label)).toEqual(['Existing state', 'Usual refurbishment', 'KfW Effizienzhaus 70']);
  });
});
