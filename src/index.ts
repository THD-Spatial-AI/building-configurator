/**
 * Published surface of @thd-spatial-ai/building-configurator.
 *
 * Everything below is reachable from a host application. Nothing else in src/
 * is: the demo shell, its map and its fixtures stay out of the bundle because
 * nothing here imports them.
 */

export { BuildingConfigurator } from './app/components/BuildingConfigurator';

export {
  BuildingConfiguratorProvider,
  useConfiguratorApi,
  type BuildingConfiguratorProviderProps,
  type ConfiguratorApi,
} from './app/lib/provider';

export {
  createFetchHttpClient,
  HttpError,
  type FetchHttpClientOptions,
  type HttpClient,
  type RequestOptions,
} from './app/lib/http';

// Building a BuildingState from what a host already holds: a BuEM feature, or
// a footprint collection joined with a City2TABULA enrich response.
export {
  adaptBuemFeature,
  exportToBuemGeojson,
  importBuildingData,
  serializeToBuemFeature,
  type BuildingIdentity,
  type BuildingState,
  type ImportedBuildingData,
  type ThermalSummary,
} from './app/lib/buemAdapter';

export { buildBuildingStates } from './app/lib/city2tabulaAdapter';

export type {
  EnergyTotals,
  EnergyType,
  LoadDataPoint,
  Resolution,
} from './app/lib/loadProfile';

export type {
  BuemBuildingRunRequest,
  BuemBuildingRunResponse,
  EnerplanetApi,
  EnrichBbox,
  EnrichEntry,
  EnrichResponse,
} from './app/lib/enerplanetApi';

export type { IgnisApi } from './app/lib/ignisApi';
