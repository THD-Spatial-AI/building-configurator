// Capital and running cost of the installed technologies, from the cost fields
// each one already carries (see buildingDefaults.ts).
//
// Only what the parameters state: no discounting, no annuity, no energy tariff.
// A PV system whose cost_basis is 'annualized' reports its capital figure as a
// yearly cost, which is what that flag means.

import type { BatteryConfig, PvConfig } from './buildingDefaults';
import type { BuildingElement } from '../configure/model/buildingElements';

export interface TechnologyCost {
  id: string;
  label: string;
  /** Up-front capital cost (€). */
  capex: number;
  /** Fixed operation and maintenance cost (€/year). */
  omAnnual: number;
  /** The quantities the figures came from, for the row's subtitle. */
  basis: string;
}

export interface TechnologyCostSummary {
  items: TechnologyCost[];
  capexTotal: number;
  omAnnualTotal: number;
}

/** Aggregates the installed PV surfaces and the battery into one cost summary. */
export function technologyCosts(
  pvSurfaces: { element: BuildingElement; pv: PvConfig }[],
  battery: BatteryConfig,
): TechnologyCostSummary {
  const items: TechnologyCost[] = [];

  const pvCapacity = pvSurfaces.reduce((sum, { pv }) => sum + pv.system_capacity, 0);
  if (pvCapacity > 0) {
    const annualized = pvSurfaces.reduce(
      (sum, { pv }) => sum + (pv.cost_basis === 'annualized' ? pv.system_capacity * pv.cost_energy_cap : 0), 0,
    );
    const upFront = pvSurfaces.reduce(
      (sum, { pv }) => sum + (pv.cost_basis === 'annualized' ? 0 : pv.system_capacity * pv.cost_energy_cap), 0,
    );
    const om = pvSurfaces.reduce((sum, { pv }) => sum + pv.system_capacity * pv.cost_om_annual, 0);
    items.push({
      id: 'solar_pv',
      label: 'Solar PV',
      capex: upFront,
      omAnnual: om + annualized,
      basis: `${pvCapacity.toFixed(1)} kWp over ${pvSurfaces.length} surface${pvSurfaces.length > 1 ? 's' : ''}`,
    });
  }

  if (battery.installed) {
    items.push({
      id: 'battery',
      label: 'Battery storage',
      capex: battery.cont_energy_cap_max * battery.cost_energy_cap
        + battery.cont_storage_cap_max * battery.cost_storage_cap,
      omAnnual: battery.cont_energy_cap_max * battery.cost_om_annual,
      basis: `${battery.cont_energy_cap_max} kW · ${battery.cont_storage_cap_max} kWh`,
    });
  }

  return {
    items,
    capexTotal: items.reduce((sum, item) => sum + item.capex, 0),
    omAnnualTotal: items.reduce((sum, item) => sum + item.omAnnual, 0),
  };
}

/** Euro figure with no decimals and thousands separators, e.g. "€9,200". */
export function formatEuro(value: number): string {
  return `€${Math.round(value).toLocaleString('en-GB')}`;
}
