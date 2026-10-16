import { describe, expect, it } from 'vitest';
import { fixtureServices } from './services';
import { buildBuildingStates } from '../app/lib/city2tabulaAdapter';
import { loadVariantLevels } from '../app/lib/heatDemand';
import loenenFixture from '../assets/data/loenen_live_fixture.json';

type Args = Parameters<typeof buildBuildingStates>;

describe('fixtureServices', () => {
  it('resolves every bundled Loenen building from the captures alone', async () => {
    const misses: string[] = [];
    const services = {
      fetchMatchingVariants: (...args: Parameters<typeof fixtureServices.fetchMatchingVariants>) =>
        fixtureServices.fetchMatchingVariants(...args).catch((err: Error) => { misses.push(err.message); throw err; }),
      fetchVariantData: (code: string) =>
        fixtureServices.fetchVariantData(code).catch((err: Error) => { misses.push(err.message); throw err; }),
    };

    const states = await buildBuildingStates(
      services,
      loenenFixture.buildings as unknown as Args[1],
      loenenFixture.enrich.data as unknown as Args[2],
    );
    // The 3D view loads the variant levels again for the building it opens.
    for (const state of Object.values(states)) {
      const { country, buildingType, constructionYear } = state.identity;
      expect(await loadVariantLevels(services, country, buildingType, constructionYear)).not.toEqual([]);
    }

    expect(misses).toEqual([]);
    expect(Object.keys(states)).toHaveLength(18);
  });
});
