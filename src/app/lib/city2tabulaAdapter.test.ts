import { describe, it, expect, vi } from 'vitest';
import { buildBuildingStates } from './city2tabulaAdapter';
import type { VariantLookupServices } from './services';
import type { EnrichEntry } from './enerplanet';

function footprint(osmId: string) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon', coordinates: [[[6.02, 52.1], [6.03, 52.1], [6.03, 52.11], [6.02, 52.1]]] },
    properties: { osm_id: osmId },
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

  it('skips a footprint with no envelope rather than fetching for it', async () => {
    const { api, fetchVariantData } = deferredIgnis();
    const features = [footprint('has-envelope'), footprint('missing')];
    const enrich = { 'has-envelope': enrichEntry('NL.N.SFH.02.Deta.ReEx.001.001') };

    const states = await buildBuildingStates(api, { features }, enrich);

    expect(Object.keys(states)).toEqual(['has-envelope']);
    expect(fetchVariantData).toHaveBeenCalledTimes(1);
  });
});
