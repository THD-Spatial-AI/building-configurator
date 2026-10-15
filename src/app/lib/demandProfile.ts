/**
 * A building's stored BuEM demand, as the host's backend summarises it. The
 * hourly series stay on the backend; the host's CSV route serves them.
 */

import type { ThermalSummary } from './buemAdapter';

/** One stored series. Energy fields are in `energy_unit` (kWh, kWh_gas for kitchen); cooling is positive. */
export interface DemandSeries {
  /** heating, cooling, electricity, hot_water or kitchen. */
  name: string;
  /** The building part a series belongs to, such as a roof face; absent or null for the whole building. */
  part?: string | null;
  source: 'default' | 'user' | 'uploaded';
  /** BuEM release and commit that produced the series. */
  producer_version: string;
  /** First value's timestamp; BuEM stamps hourly values at the half hour. */
  start: string;
  resolution_minutes: number;
  energy_unit: string;
  total: number;
  peak_unit: string;
  peak: number;
  peak_time: string;
  /** One value per calendar day. */
  daily: number[];
  /** One value per seven days from `start`; the 53rd covers the year's last day. */
  weekly: number[];
  /** One value per calendar month. */
  monthly: number[];
}

/** The body of the host's per-building demand-profile route. */
export interface BuildingDemandProfile {
  building_ref: string;
  series: DemandSeries[];
}

/** The annual totals and peaks the energy card reads, from the whole-building series. */
export function toThermalSummary(profile: BuildingDemandProfile): ThermalSummary {
  const find = (name: string) => profile.series.find((s) => s.name === name && !s.part);
  const total = (name: string) => find(name)?.total ?? 0;
  const heatingKwh = total('heating');
  const coolingKwh = total('cooling');
  const electricityKwh = total('electricity');
  const dhwKwh = total('hot_water');
  return {
    heatingKwh,
    coolingKwh,
    electricityKwh,
    dhwKwh,
    kitchenGasKwh: find('kitchen')?.total,
    peakHeatingKw: find('heating')?.peak ?? 0,
    peakCoolingKw: find('cooling')?.peak ?? 0,
    // Matches BuEM's total_energy_demand: kitchen is a gas channel and stays out.
    totalEnergyKwh: heatingKwh + coolingKwh + electricityKwh + dhwKwh,
  };
}
