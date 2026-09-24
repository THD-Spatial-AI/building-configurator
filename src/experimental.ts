/**
 * Unstable surface of @thd-spatial-ai/building-configurator, published as
 * `@thd-spatial-ai/building-configurator/experimental`.
 *
 * The 3D building view: a full-screen replacement for the configurator dialog,
 * where a building's envelope is the thing being clicked. It is here rather
 * than in the main entry because its props and its layout are still moving.
 * Pin an exact version when consuming it.
 *
 * The host supplies the building and its geometry; nothing in this entry knows
 * about a particular area or dataset.
 */

import type { Building3DViewProps as CurrentProps } from './app/components/workspace/Building3DView';
import type { BuildingState, ThermalSummary } from './app/lib/buemAdapter';
import type { IgnisInputs, IgnisVariantLevel } from './app/lib/ignisAdapter';
import type { LoadDataPoint } from './app/lib/loadProfile';

export { Building3DView } from './app/components/workspace/Building3DView';

export {
  polygonArea,
  surfacesFromGeometryResponse,
  type SurfaceGeometry,
  type SurfacePolygon,
} from './app/lib/surfaceMesh';

// ─── Proposed props surface ───────────────────────────────────────────────────
//
// Not yet implemented: the view still reaches the heat services itself through
// BuildingConfiguratorProvider, which makes this package a second place that
// has to know their URLs. These types are the replacement: the host performs
// the I/O and passes the results in.
//
// TODO: implement Building3DViewServices in Building3DView and drop the
// provider from this entry. Held until the host side is ready to supply them.

/** Which TABULA archetypes apply to a building. Variant selection is similar to what https://webtool.building-typology.eu/ provides. */
export interface VariantQuery {
  /** ISO-3166 alpha-2, e.g. "NL". */
  country: string;
  /** TABULA building type code: MFH, SFH, AB or TH. */
  buildingType: string;
  /** Instead of construction period as used in TABULA, use single construction year which gets mapped to the appropriate TABULA period. */
  constructionYear: number;
}

/** One annual heat demand figure, as ignis returns it. */
export interface HeatDemandResult {
  variantCode: string;
  /** Annual heat demand for the variant. */
  value: number;
  /** Unit as given by the service, e.g. "kWh/(m2.a)". */
  unit: string;
}

/** A simulation of the building as currently configured. */
export interface SimulationRequest {
  /** Envelope, building parameters and technologies as edited in the view. */
  building: BuildingState;
  /** ISO dates bounding the profile. */
  startDate: string;
  endDate: string;
  /** Hourly is the only resolution this stack runs at, front end to back end. */
  resolutionHours: 1;
}

export interface SimulationResult {
  /** One row per hour. */
  timeseries: LoadDataPoint[];
  thermalSummary: ThermalSummary | null;
}

/**
 * The calls the 3D view makes. The host maps its own endpoints onto these;
 *
 * Every member is optional. An absent call hides the feature that needs it
 * rather than failing: without `runSimulation` there is no simulation to run,
 * and without the two heat demand calls the refurbishment-level selector and
 * its estimate do not appear. With none of them the view is an editor over
 * whatever the host passed in, which is also how it runs against fixtures.
 */
export interface Building3DViewServices {
  /** TABULA refurbishment levels for a building's classification. For example, MFH buildings may have (existing, Usual & Advanced refurbishment) levels. */
  listVariants?: (query: VariantQuery) => Promise<IgnisVariantLevel[]>;
  /** Annual heat demand for one variant and the current envelope. */
  calculateHeatDemand?: (
    variantCode: string,
    inputs: IgnisInputs,
  ) => Promise<HeatDemandResult | null>;
  /** Hourly load profile for the building as configured. Null when the run failed. */
  runSimulation?: (request: SimulationRequest) => Promise<SimulationResult | null>;
}

/**
 * The view's props once it performs no I/O: what it already takes, plus the
 * calls the host supplies.
 *
 * `building` is initial state, not a controlled value: the view copies it and
 * edits its own copy, so passing a new object resets the view and discards
 * unsaved edits without asking. Keep the identity stable while the view is
 * open, and take changes back through `onExit`.
 */
export interface Building3DViewProps extends CurrentProps {
  services?: Building3DViewServices;
}
