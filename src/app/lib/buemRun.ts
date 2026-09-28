// One building through BuEM: build the request from the edited model, hand it
// to the host's transport, map the answer into the shapes the UI reads.

import { serializeToBuemFeature, type BuildingIdentity, type BuildingState } from './buemAdapter';
import {
  DEFAULT_ELEMENTS,
  DEFAULT_GENERAL,
  computeTotalFloorArea,
  generalFrom,
} from '../components/BuildingConfigurator/shared/buildingDefaults';
import { toSimulationResult, type BuemSimulationResult } from './buemApi';
import type { ConfiguratorServices } from './services';

/**
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
  modelId: string,
  batteryConfig?: Record<string, any>,
): Promise<BuemSimulationResult | null> {
  const feature = serializeToBuemFeature(
    identity, elements, general,
    undefined, undefined, undefined, undefined,
    batteryConfig,
  );

  try {
    const response = await services.runBuemBuilding({
      osm_id:     String(feature.id),
      geometry:   feature.geometry,
      building:   feature.properties.buem.building,
      solver:     feature.properties.buem.solver,
      start_date: feature.properties.start_time,
      end_date:   feature.properties.end_time,
      resolution: Number(feature.properties.resolution),
      model_id:   modelId,
    });
    return toSimulationResult(response.buem.thermal_load_profile);
  } catch (err) {
    console.error('[buem/building] request failed', err);
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
 * The BuEM `building` and `solver` blocks a run of this building sends, for a
 * host to store. Reopen them with adaptBuemFeature on a Feature whose
 * properties.buem is this object. PV arrays and the battery are not part of
 * either block; they travel in building.technologyState.
 */
export function toBuem(building: BuildingState): { building: Record<string, any>; solver: { use_milp: boolean } } {
  const general = generalFrom(building);
  const envelope = building.thematic?.envelope ?? building.envelope;
  const elements = Object.keys(envelope).length > 0 ? envelope : DEFAULT_ELEMENTS;
  const { buem } = serializeToBuemFeature(runIdentity(building, general), elements, general).properties;
  return { building: buem.building, solver: buem.solver };
}
