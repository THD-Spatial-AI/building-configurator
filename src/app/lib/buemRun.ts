// One building through BuEM: build the request from the edited model, hand it
// to the host's transport, map the answer into the shapes the UI reads.

import { serializeToBuemFeature, type BuildingIdentity, type BuildingState, type StoreyEntry } from './buemAdapter';
import {
  DEFAULT_ELEMENTS,
  DEFAULT_GENERAL,
  computeTotalFloorArea,
  generalFrom,
} from '../components/BuildingConfigurator/shared/buildingDefaults';
import type { BuildingDemandProfile } from './demandProfile';
import { MODEL_DATA_MAP } from '../config/modelDataMap';
import { getMappedNumber } from '../config/modelDataResolver';
import type { BuemBuildingRunRequest, ConfiguratorServices } from './services';

/** The weather the user picked; a field is absent where the host's default applies. */
export type WeatherChoice = Pick<BuemBuildingRunRequest, 'weather_provider' | 'weather_scenario'>;

/** The period a run covers, supplied by the host. Dates are RFC 3339. */
export interface RunContext {
  startDate: string;
  endDate: string;
}

/**
 * Without a run context the run covers the serialiser's default year.
 *
 * Returns null on any failure, so a service that is unreachable or a BuEM that
 * rejected an incomplete envelope surfaces as a message rather than a crash.
 * The run can legitimately take several seconds: BuEM solves, it does not look
 * a value up.
 */
export async function runBuildingSimulation(
  services: Pick<ConfiguratorServices, 'runBuemBuilding'>,
  identity: BuildingIdentity,
  elements: Record<string, any>,
  general: Record<string, any>,
  runContext?: RunContext,
  weather: WeatherChoice = {},
): Promise<BuildingDemandProfile | null> {
  const feature = serializeToBuemFeature(identity, elements, general, runContext?.startDate, runContext?.endDate);

  try {
    return await services.runBuemBuilding({
      osm_id:     String(feature.id),
      geometry:   feature.geometry,
      building:   feature.properties.buem.building,
      solver:     feature.properties.buem.solver,
      outputs:    feature.properties.buem.outputs,
      start_date: feature.properties.start_time,
      end_date:   feature.properties.end_time,
      resolution: Number(feature.properties.resolution),
      ...weather,
    });
  } catch (err) {
    console.error('[buem/building] request failed', err);
    return null;
  }
}

/** A preview asks for the heating total only, so BuEM returns no series. */
const PREVIEW_OUTPUTS: BuemBuildingRunRequest['outputs'] = {
  heating: 'summary', cooling: 'none', electricity: 'none', hot_water: 'none', kitchen: 'none',
};

/**
 * Annual space heating per A_ref, kWh/(m²·a), of the building as given, from
 * a BuEM run the host does not store. Null without a preview service or when
 * the run fails, so a missing class reads as unknown rather than an error.
 */
export async function previewHeatingPerM2(
  services: Pick<ConfiguratorServices, 'previewBuemBuilding'>,
  identity: BuildingIdentity,
  elements: Record<string, any>,
  general: Record<string, any>,
  runContext?: RunContext,
  weather: WeatherChoice = {},
): Promise<number | null> {
  if (!services.previewBuemBuilding) return null;
  const feature = serializeToBuemFeature(
    identity, elements, { ...general, outputs: PREVIEW_OUTPUTS }, runContext?.startDate, runContext?.endDate,
  );
  const aRef = Number(feature.properties.buem.building.A_ref?.value);
  try {
    const { buem } = await services.previewBuemBuilding({
      osm_id:     String(feature.id),
      geometry:   feature.geometry,
      building:   feature.properties.buem.building,
      solver:     feature.properties.buem.solver,
      outputs:    PREVIEW_OUTPUTS,
      start_date: feature.properties.start_time,
      end_date:   feature.properties.end_time,
      resolution: Number(feature.properties.resolution),
      ...weather,
    });
    const heating = getMappedNumber({ properties: { buem } }, MODEL_DATA_MAP.thematic.results.heatingTotal);
    return aRef > 0 && heating > 0 ? heating / aRef : null;
  } catch (err) {
    console.error('[buem/preview] request failed', err);
    return null;
  }
}

/** The identity a run sends: the building's own, with the edited parameters over it. */
export function runIdentity(
  building: BuildingState | undefined,
  general: typeof DEFAULT_GENERAL,
): BuildingIdentity {
  const base = building?.thematic?.identity ?? building?.identity;
  return {
    id: base?.id ?? 'building-1',
    label: general.buildingName || base?.label || 'Building',
    coordinates: building?.geometry?.coordinates ?? base?.coordinates ?? [11.5820, 48.1351],
    buildingType: general.buildingType,
    constructionYear: general.constructionYear,
    country: general.country,
    floorArea: computeTotalFloorArea(general.floorArea, general.storeys),
    roomHeight: general.roomHeight,
    storeys: general.storeys,
  };
}

/**
 * The BuEM `building`, `outputs` and `solver` blocks a run of this building
 * sends, for a host to store. Reopen them with adaptBuemFeature on a Feature
 * whose properties.buem is this object.
 */
export function toBuem(building: BuildingState): {
  building: Record<string, any>;
  /** Kept beside the block: BuEM's construction_period is a TABULA class code, not a year. */
  construction_year?: number;
  /** Kept beside the block: BuEM takes no storey count, and A_ref alone does not say how it splits. */
  storeys?: number;
  /** With storeys left out: every storey and whether it is modelled, the block being cut to those that are. */
  storey_list?: StoreyEntry[];
  /** With storeys left out: the whole envelope, for reopening; never sent to BuEM. */
  envelope_full?: { elements: Record<string, any>[] };
  /** With storeys left out and their dwellings given: the whole building's residential_units (null: BuEM's default). */
  residential_units_full?: number | null;
  /** Kept beside the block and never sent to BuEM: the TABULA variant and the state per element type. */
  refurbishment?: { variant_code?: string; states?: Record<string, number> };
  outputs: BuemBuildingRunRequest['outputs'];
  solver: { use_milp: boolean };
} {
  const general = generalFrom(building);
  const envelope = building.thematic?.envelope ?? building.envelope;
  const elements = Object.keys(envelope).length > 0 ? envelope : DEFAULT_ELEMENTS;
  const { buem } = serializeToBuemFeature(runIdentity(building, general), elements, general).properties;
  return {
    building: buem.building,
    construction_year: buem.construction_year,
    ...(buem.storeys ? { storeys: buem.storeys } : {}),
    ...(buem.storey_list ? { storey_list: buem.storey_list, envelope_full: buem.envelope_full } : {}),
    ...('residential_units_full' in buem ? { residential_units_full: buem.residential_units_full } : {}),
    ...(buem.refurbishment ? { refurbishment: buem.refurbishment } : {}),
    outputs: buem.outputs,
    solver: buem.solver,
  };
}
