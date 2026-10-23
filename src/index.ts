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
export type { PvMode, PvSurface } from './app/components/workspace/PvMode';
export type { TechCard, TechField, Technologies } from './app/components/workspace/TechnologyCards';
export type { Language } from './app/i18n';

export {
  isEnvelopeDetached,
  polygonArea,
  surfacesFromGeometryResponse,
  type SurfaceGeometry,
  type SurfacePolygon,
} from './app/lib/surfaceMesh';

// The calls a host supplies (four, and an optional PV run), and the shapes they carry.
export type {
  BuemBuildingRunRequest,
  BuemBuildingRunResponse,
  ConfiguratorServices,
  IgnisCalculatePayload,
  PvBuildingRunRequest,
  PvBuildingRunResponse,
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
  type BuildingParameters,
  type BuildingState,
  type ImportedBuildingData,
  type ThermalSummary,
} from './app/lib/buemAdapter';

export { buildBuildingStates } from './app/lib/city2tabulaAdapter';

// Storing an edited building: the BuEM blocks a run would send for it.
export { toBuem, type RunContext } from './app/lib/buemRun';

// A building's stored demand, as the host's backend summarises it.
export type { BuildingDemandProfile, DemandSeries } from './app/lib/demandProfile';

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
