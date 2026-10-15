// The dev shell playing host with bundled captures in place of EnerPlanET, so
// the configurator runs with no backend. A real host implements
// ConfiguratorServices against its own client.
//
// src/assets/data/loenen_ignis_fixture.json holds real ignis responses for the
// Loenen buildings, keyed by request: match by "<country>/<type>/<year>", data
// by variant code. A request outside the capture rejects with its key.

import type { ConfiguratorServices } from '../app/lib/services';
import type { IgnisDataResponse, IgnisMatchResponse } from '../app/lib/ignisAdapter';
import ignisFixture from '../assets/data/loenen_ignis_fixture.json';

const MATCH = ignisFixture.match as unknown as Record<string, IgnisMatchResponse>;
const DATA = ignisFixture.data as unknown as Record<string, IgnisDataResponse>;

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

  // TODO: answer from bundled demand profiles once a stored BuEM run is captured.
  async runBuemBuilding(request) {
    throw new Error(`No bundled BuEM result for building ${request.osm_id}`);
  },
};
