import { describe, it, expect, vi } from 'vitest';
import { buildBuildingStates } from './city2tabulaAdapter';
import type { VariantLookupServices } from './services';
import type { EnrichEntry } from './enerplanet';

function footprint(osmId: string, fClass?: string) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon', coordinates: [[[6.02, 52.1], [6.03, 52.1], [6.03, 52.11], [6.02, 52.1]]] },
    properties: { osm_id: osmId, ...(fClass === undefined ? {} : { f_class: fClass }) },
  };
}

function enrichEntry(variantCode: string): EnrichEntry {
  return {
    object_id: `obj-${variantCode}`,
    tabula_variant_code: variantCode,
    default_construction_year: 1969,
    buem: {
      building: {
        n_storeys: 2,
        h_room: { value: 2.5, unit: 'm' },
        footprint_area: { value: 80, unit: 'm2' },
        envelope: { elements: [{ id: 's1', type: 'wall', area: { value: 20, unit: 'm2' }, azimuth: { value: 180, unit: 'deg' }, tilt: { value: 90, unit: 'deg' } }] },
      },
    },
  } as unknown as EnrichEntry;
}

/** Resolves only once every caller has had its turn, which is what a real
 *  network round trip does and what an unbuffered cache cannot survive. */
function deferredIgnis() {
  const fetchVariantData = vi.fn(async (code: string) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { tabula_data: { AdvancedParameters: { Uvalues: { U_Wall_1: 0.5 } } }, code } as never;
  });
  return {
    api: {
      fetchVariantData,
      fetchMatchingVariants: vi.fn(async () => ({ country: 'NL', prefix: 'NL.N', data: [] })),
    } as unknown as VariantLookupServices,
    fetchVariantData,
  };
}

describe('buildBuildingStates', () => {
  it('fetches each archetype once however many buildings share it', async () => {
    const { api, fetchVariantData } = deferredIgnis();
    // 20 buildings, 2 archetypes between them.
    const codes = ['NL.N.SFH.02.Deta.ReEx.001.001', 'NL.N.AB.03.Mai.ReEx.001.001'];
    const features = Array.from({ length: 20 }, (_, i) => footprint(`osm-${i}`));
    const enrich = Object.fromEntries(features.map((f, i) => [f.properties.osm_id, enrichEntry(codes[i % 2])]));

    const states = await buildBuildingStates(api, { features }, enrich);

    expect(Object.keys(states)).toHaveLength(20);
    // Every building resolves at once, so a cache holding results rather than
    // requests would miss on all 20 and fetch 20 times.
    expect(fetchVariantData).toHaveBeenCalledTimes(2);
  });

  it('keeps the building\'s TABULA variant code', async () => {
    const { api } = deferredIgnis();
    const code = 'NL.N.SFH.02.Deta.ReEx.001.002';
    const states = await buildBuildingStates(api, { features: [footprint('b')] }, { b: enrichEntry(code) });
    expect(states.b.refurbishment).toEqual({ variantCode: code });
  });

  it('types a building as the service type its OSM class maps to', async () => {
    const { api } = deferredIgnis();
    const features = [footprint('h', 'hospital'), footprint('c', 'Cafe '), footprint('d', 'doctors'), footprint('i', 'industrial')];
    const enrich = Object.fromEntries(features.map((f) => [f.properties.osm_id, enrichEntry('NL.N.AB.03.Mai.ReEx.001.001')]));

    const states = await buildBuildingStates(api, { features }, enrich);

    expect(states.h.identity.buildingType).toBe('Clinic');
    expect(states.c.identity.buildingType).toBe('Restaurant');
    expect(states.d.identity.buildingType).toBe('Clinic');
    expect(states.i.identity.buildingType).toBe('Warehouse');
    // The residential archetype still supplies the envelope.
    expect(states.h.refurbishment).toEqual({ variantCode: 'NL.N.AB.03.Mai.ReEx.001.001' });
  });

  it('falls back to the residential type of a service building\'s variant code', async () => {
    const fetchMatchingVariants = vi.fn(async () => ({ country: 'NL', prefix: 'NL.N', data: [] }));
    const api = {
      fetchVariantData: vi.fn(async () => { throw new Error('ignis down'); }),
      fetchMatchingVariants,
    } as unknown as VariantLookupServices;

    await buildBuildingStates(api, { features: [footprint('h', 'hospital')] }, { h: enrichEntry('NL.N.AB.03.Mai.ReEx.001.001') });

    expect(fetchMatchingVariants).toHaveBeenCalledWith('NL', 'AB', 1969, undefined);
  });

  it('keeps the City2TABULA type for a class BuEM has no service type for', async () => {
    const { api } = deferredIgnis();
    const features = [footprint('y', 'yes'), footprint('p', 'prison'), footprint('n')];
    const enrich = Object.fromEntries(features.map((f) => [f.properties.osm_id, enrichEntry('NL.N.MFH.02.Gen.ReEx.001.001')]));

    const states = await buildBuildingStates(api, { features }, enrich);

    for (const id of ['y', 'p', 'n']) expect(states[id].identity.buildingType).toBe('Multi-family House');
  });

  it('skips a footprint with no envelope rather than fetching for it', async () => {
    const { api, fetchVariantData } = deferredIgnis();
    const features = [footprint('has-envelope'), footprint('missing')];
    const enrich = { 'has-envelope': enrichEntry('NL.N.SFH.02.Deta.ReEx.001.001') };

    const states = await buildBuildingStates(api, { features }, enrich);

    expect(Object.keys(states)).toEqual(['has-envelope']);
    expect(fetchVariantData).toHaveBeenCalledTimes(1);
  });
});
