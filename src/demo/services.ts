// The demo shell playing host: it owns the URLs, the session and the envelope
// the backend wraps its answers in, and hands the configurator four functions
// that do nothing but carry a request.
//
// A real host implements this against its own client. The paths below are the
// EnerPlanET backend's.

import type { ConfiguratorServices } from '../app/lib/services';
import type { IgnisCalculateResponse, IgnisDataResponse, IgnisMatchResponse } from '../app/lib/ignisAdapter';
import { demoHttp } from '../demoClient';

/** The backend's envelope around a verbatim upstream body. */
interface Enveloped<T> {
  data: T;
}

/**
 * Ceilings on a lookup and on the calculation respectively. These bound the
 * wait, not the work: the heat demand service answers a lookup from its own
 * database and the calculation is a closed-form pipeline, so anything slower
 * than this is a service in trouble rather than a long job to wait out.
 */
const LOOKUP_TIMEOUT_MS = 8000;
const CALCULATE_TIMEOUT_MS = 15000;

/** Module constant: one identity for the life of the page, as the props ask for. */
export const demoServices: ConfiguratorServices = {
  async fetchMatchingVariants(countryIso2, typeCode, constructionYear) {
    const res = await demoHttp.get<Enveloped<IgnisMatchResponse>>(
      `/v2/ignis/variants/${encodeURIComponent(countryIso2)}/match`
      + `?type=${encodeURIComponent(typeCode)}&year=${encodeURIComponent(String(constructionYear))}`,
      { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
    );
    return res.data;
  },

  async fetchVariantData(variantCode) {
    const res = await demoHttp.get<Enveloped<IgnisDataResponse>>(
      `/v2/ignis/data/${encodeURIComponent(variantCode)}`,
      { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
    );
    return res.data;
  },

  async calculateHeatDemand(variantCode, inputs) {
    const res = await demoHttp.post<Enveloped<IgnisCalculateResponse>>(
      `/v2/ignis/calculate/${encodeURIComponent(variantCode)}`,
      inputs,
      { signal: AbortSignal.timeout(CALCULATE_TIMEOUT_MS) },
    );
    return res.data;
  },

  runBuemBuilding(request) {
    return demoHttp.post('/v1/buem/building', request);
  },
};
