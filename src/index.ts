/**
 * Published surface of @thd-spatial-ai/building-configurator.
 *
 * Everything below is reachable from a host application. Nothing else in src/
 * is: the demo shell, its map and its fixtures stay out of the bundle because
 * nothing here imports them.
 *
 * The configurator is the 3D view: a building's envelope is the thing being
 * clicked, and the panel beside it holds the parameters. The host supplies the
 * building, its geometry and the calls that reach its services.
 */

export { Building3DView } from './app/components/workspace/Building3DView';
export type { Building3DViewProps } from './app/components/workspace/Building3DView';

export {
  polygonArea,
  surfacesFromGeometryResponse,
  type SurfaceGeometry,
  type SurfacePolygon,
} from './app/lib/surfaceMesh';

// The four calls a host supplies, and the shapes they carry.
export type {
  BuemBuildingRunRequest,
  BuemBuildingRunResponse,
  ConfiguratorServices,
  VariantLookupServices,
} from './app/lib/services';

export type {
  IgnisCalculateResponse,
  IgnisDataResponse,
  IgnisInputs,
  IgnisMatchResponse,
} from './app/lib/ignisAdapter';

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
  type TechnologyState,
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
  BuildingGeometry,
  EnrichBbox,
  EnrichEntry,
  EnrichResponse,
} from './app/lib/enerplanet';
