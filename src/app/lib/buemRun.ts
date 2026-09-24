// One building through BuEM: build the request from the edited model, hand it
// to the host's transport, map the answer into the shapes the UI reads.

import { serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
import { toSimulationResult, type BuemSimulationResult } from './buemApi';
import type { ConfiguratorServices } from './services';

/**
 * Returns null on any failure, so a service that is unreachable or a BuEM that
 * rejected an incomplete envelope surfaces as a message rather than a crash.
 * The run can legitimately take several seconds: BuEM solves, it does not look
 * a value up.
 *
 * Known gap: the request has no field for the MILP-solver toggle
 * (general.use_milp), so it is dropped here until the contract grows one.
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
