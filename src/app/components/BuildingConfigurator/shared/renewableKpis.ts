// Headline renewable figures for the overview. Capacities and coverage only:
// the BuEM run returns demand, not generation, so there is no yield or
// self-sufficiency figure to derive here.

import type { BuildingElement } from '../configure/model/buildingElements';
import type { BatteryConfig, PvConfig } from './buildingDefaults';

export interface RenewableKpis {
  /** Installed PV across every surface (kWp). */
  pvCapacityKwp: number;
  /** How many surfaces carry PV. */
  pvSurfaceCount: number;
  /** Of those, the roof area carrying PV (m²) and the building's total roof area. */
  roofAreaWithPv: number;
  roofArea: number;
  /** roofAreaWithPv as a percentage of roofArea, 0 when there is no roof. */
  roofSharePercent: number;
  /** PV on walls or other non-roof surfaces (kWp), which roof coverage cannot show. */
  nonRoofCapacityKwp: number;
  batteryStorageKwh: number;
  batteryPowerKw: number;
  installed: boolean;
}

export function renewableKpis(
  pvSurfaces: { element: BuildingElement; pv: PvConfig }[],
  elements: Record<string, BuildingElement>,
  battery: BatteryConfig,
): RenewableKpis {
  const roofArea = Object.values(elements)
    .filter((el) => el.type === 'roof')
    .reduce((sum, el) => sum + el.area, 0);

  // Roof coverage counts roof surfaces on both sides of the ratio: PV on a wall
  // is real capacity but not roof area, and would otherwise push this past 100%.
  const roofPv = pvSurfaces.filter(({ element }) => element.type === 'roof');
  const roofAreaWithPv = roofPv.reduce((sum, { element }) => sum + element.area, 0);

  return {
    pvCapacityKwp: pvSurfaces.reduce((sum, { pv }) => sum + pv.system_capacity, 0),
    pvSurfaceCount: pvSurfaces.length,
    roofAreaWithPv,
    roofArea,
    roofSharePercent: roofArea > 0 ? (roofAreaWithPv / roofArea) * 100 : 0,
    nonRoofCapacityKwp: pvSurfaces
      .filter(({ element }) => element.type !== 'roof')
      .reduce((sum, { pv }) => sum + pv.system_capacity, 0),
    batteryStorageKwh: battery.installed ? battery.cont_storage_cap_max : 0,
    batteryPowerKw: battery.installed ? battery.cont_energy_cap_max : 0,
    installed: pvSurfaces.length > 0 || battery.installed,
  };
}
