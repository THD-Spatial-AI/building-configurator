// A PV run for the open building, through the host's optional runPvBuilding.
// The host holds the PV arrays; the package sends the geometry of the host's
// PV surfaces as the user has edited it, since edits are not saved until the
// view is left.

import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { ConfiguratorServices, PvBuildingRunRequest } from './services';
import type { PvLayout } from './pvLayout';

/**
 * The request for the host's PV surfaces, or null when the building has none
 * among its elements. A surface with a module layout also carries its modules.
 */
export function pvRunRequest(
  osmId: string,
  elements: Record<string, BuildingElement>,
  pvSurfaceIds: readonly string[],
  layouts: Readonly<Record<string, PvLayout>> = {},
): PvBuildingRunRequest | null {
  const surfaces = pvSurfaceIds
    .filter((id) => elements[id])
    .map((id) => {
      const { area, tilt, azimuth } = elements[id];
      const layout = layouts[id];
      return layout
        ? { id, area, tilt, azimuth, modules: layout.count, kwp: layout.kwp, panel_tilt: layout.tilt, panel_azimuth: layout.azimuth }
        : { id, area, tilt, azimuth };
    });
  return surfaces.length > 0 ? { osm_id: osmId, surfaces } : null;
}

/** The building's annual PV generation in kWh, or null when the host has no PV run or it failed. */
export async function runPvBuilding(
  services: Pick<ConfiguratorServices, 'runPvBuilding'>,
  request: PvBuildingRunRequest,
): Promise<number | null> {
  if (!services.runPvBuilding) return null;
  try {
    return (await services.runPvBuilding(request)).annualKwh;
  } catch {
    return null;
  }
}
