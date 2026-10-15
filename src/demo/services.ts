// The dev shell playing host with bundled captures in place of EnerPlanET, so
// the configurator runs with no backend. A real host implements
// ConfiguratorServices against its own client.
//
// src/assets/data/loenen_ignis_fixture.json holds real ignis responses for the
// Loenen buildings, keyed by request: match by "<country>/<type>/<year>", data
// by variant code. loenen_demand_fixture.json holds each building's stored
// BuEM demand profile by osm_id. A request outside the captures rejects with
// its key.

import type { ConfiguratorServices } from '../app/lib/services';
import type { BuildingDemandProfile } from '../app/lib/demandProfile';
import type { IgnisDataResponse, IgnisMatchResponse } from '../app/lib/ignisAdapter';
import ignisFixture from '../assets/data/loenen_ignis_fixture.json';
import demandFixture from '../assets/data/loenen_demand_fixture.json';
import seriesCsv268428620 from '../assets/data/loenen_series_268428620.csv?url';

const MATCH = ignisFixture.match as unknown as Record<string, IgnisMatchResponse>;
const DATA = ignisFixture.data as unknown as Record<string, IgnisDataResponse>;
const DEMAND = demandFixture as unknown as Record<string, BuildingDemandProfile>;
/** One building's series CSV is bundled; the others have no download. */
const SERIES_CSV: Record<string, string> = { '268428620': seriesCsv268428620 };

/** How long a fixture BuEM run takes, so the running state can be seen. */
const RUN_DELAY_MS = 2500;

/** Module constant: one identity for the life of the page, as the props ask for. */
export const fixtureServices: ConfiguratorServices = {
  async fetchMatchingVariants(countryIso2, typeCode, constructionYear) {
    const key = `${countryIso2}/${typeCode}/${constructionYear}`;
    const match = MATCH[key];
    if (!match) throw new Error(`No bundled ignis match for ${key}`);
    return match;
  },

  async fetchVariantData(variantCode) {
    const data = DATA[variantCode];
    if (!data) throw new Error(`No bundled ignis data for ${variantCode}`);
    return data;
  },

  async calculateHeatDemand(variantCode) {
    throw new Error(`Heat demand is not calculated in the dev shell (variant ${variantCode})`);
  },

  // Answers with the stored default run whatever was edited; a real host re-runs BuEM.
  async runBuemBuilding(request) {
    await new Promise((resolve) => setTimeout(resolve, RUN_DELAY_MS));
    const profile = DEMAND[request.osm_id];
    if (!profile) throw new Error(`No bundled BuEM result for building ${request.osm_id}`);
    return profile;
  },
};

/** A building's bundled stored demand, or null when BuEM produced none for it. */
export function fixtureDemandProfile(osmId: string): BuildingDemandProfile | null {
  return DEMAND[osmId] ?? null;
}

/** A building's bundled series CSV, or undefined when none is bundled. */
export function fixtureSeriesCsvUrl(osmId: string): string | undefined {
  return SERIES_CSV[osmId];
}
