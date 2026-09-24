// A building's PV split the way it is actually bought and installed: one module
// choice for the whole building, and an array per surface that says where the
// panels sit and how many of them fit.
//
// PvConfig stays the flat shape everything downstream reads (the BuEM export,
// the editors, the cost and capacity summaries). It is resolved from the two
// halves rather than stored, so the module and its cost cannot drift apart
// between one roof face and the next.

import {
  DEFAULT_PV_CONFIG,
  type PvConfig,
} from './buildingDefaults';
import { suggestedCapacityKwp } from './pvSuitability';
import type { BuildingElement } from '../configure/model/buildingElements';

/** The module and the money: one choice per building, shared by every array. */
export interface PvTechnology {
  cont_energy_eff: number;
  inv_eff: number;
  dc_ac_ratio: number;
  losses: number;
  cont_degradation_rate: number;
  cont_lifetime: number;
  cost_energy_cap: number;
  cost_om_annual: number;
  cost_om_variable: number;
  cost_interest_rate: number;
  cost_basis: PvConfig['cost_basis'];
  co2_emission_factor: number;
}

/** One array on one surface: where it sits, and how much of the surface it covers. */
export interface PvArray {
  installed: boolean;
  geometryMode: PvConfig['geometryMode'];
  tilt: number;
  azimuth: number;
  optimize_orientation: boolean;
  /** Share of the host surface panels can cover, after obstructions (%). */
  usable_area_pct: number;
  /** Capacity set by hand (kWp). Null follows the surface area and usable share. */
  capacityOverrideKwp: number | null;
  cont_energy_cap_min: number;
}

/** Which half of the model each PvConfig field belongs to. */
export const TECHNOLOGY_FIELDS = [
  'cont_energy_eff', 'inv_eff', 'dc_ac_ratio', 'losses', 'cont_degradation_rate',
  'cont_lifetime', 'cost_energy_cap', 'cost_om_annual', 'cost_om_variable',
  'cost_interest_rate', 'cost_basis', 'co2_emission_factor',
] as const satisfies readonly (keyof PvTechnology)[];

export const DEFAULT_PV_TECHNOLOGY: PvTechnology = Object.fromEntries(
  TECHNOLOGY_FIELDS.map((field) => [field, DEFAULT_PV_CONFIG[field]]),
) as unknown as PvTechnology;

/** An array on a surface, taking its angles from that surface. */
export function createPvArray(element?: Pick<BuildingElement, 'tilt' | 'azimuth'> | null): PvArray {
  return {
    installed: false,
    geometryMode: DEFAULT_PV_CONFIG.geometryMode,
    tilt: element?.tilt ?? DEFAULT_PV_CONFIG.tilt,
    azimuth: element?.azimuth ?? DEFAULT_PV_CONFIG.azimuth,
    optimize_orientation: DEFAULT_PV_CONFIG.optimize_orientation,
    usable_area_pct: DEFAULT_PV_CONFIG.usable_area_pct,
    capacityOverrideKwp: null,
    cont_energy_cap_min: DEFAULT_PV_CONFIG.cont_energy_cap_min,
  };
}

/** What fits on a surface, before any hand-set capacity. */
export function fittedCapacityKwp(array: PvArray, element?: BuildingElement): number {
  return element ? suggestedCapacityKwp(element.area, array.usable_area_pct) : 0;
}

/** The flat config for one array: the building's module, that surface's geometry. */
export function resolvePvArray(
  array: PvArray,
  technology: PvTechnology,
  element?: BuildingElement,
): PvConfig {
  const capacity = array.capacityOverrideKwp ?? fittedCapacityKwp(array, element);
  return {
    ...DEFAULT_PV_CONFIG,
    ...technology,
    installed: array.installed,
    geometryMode: array.geometryMode,
    tilt: array.tilt,
    azimuth: array.azimuth,
    optimize_orientation: array.optimize_orientation,
    usable_area_pct: array.usable_area_pct,
    system_capacity: capacity,
    // The array is sized to what it holds; a separate ceiling would only be a
    // second number saying the same thing.
    cont_energy_cap_max: capacity,
    cont_energy_cap_min: array.cont_energy_cap_min,
  };
}

/**
 * Routes an edit made against the flat shape back to the half it belongs to.
 * A cost or efficiency change reaches the building and therefore every array;
 * geometry and sizing stay on the one being edited.
 */
export function splitPvPatch(patch: Partial<PvConfig>): {
  technology: Partial<PvTechnology>;
  array: Partial<PvArray>;
} {
  const technology: Record<string, unknown> = {};
  const array: Partial<PvArray> = {};

  for (const [key, value] of Object.entries(patch)) {
    if ((TECHNOLOGY_FIELDS as readonly string[]).includes(key)) {
      technology[key] = value;
      continue;
    }
    switch (key) {
      case 'installed':
      case 'geometryMode':
      case 'tilt':
      case 'azimuth':
      case 'optimize_orientation':
      case 'cont_energy_cap_min':
        (array as Record<string, unknown>)[key] = value;
        break;
      // Sizing the array by how much of the surface it covers replaces any
      // capacity typed earlier: the last statement of intent wins.
      case 'usable_area_pct':
        array.usable_area_pct = value as number;
        array.capacityOverrideKwp = null;
        break;
      // Both say "this array is this big"; either one is a hand-set capacity.
      case 'system_capacity':
      case 'cont_energy_cap_max':
        array.capacityOverrideKwp = value as number;
        break;
      default:
        break;
    }
  }

  return { technology: technology as Partial<PvTechnology>, array };
}
