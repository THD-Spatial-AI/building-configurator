/**
 * BuEM response shapes, shared between callers of the per-building BuEM run.
 *
 * enerplanetApi.ts's runBuildingSimulation is the only caller: it posts to
 * the EnerPlanET backend's POST /api/v1/buem/building, which forwards the
 * request to buem-gateway and returns buem-gateway's own per-building result
 * unchanged — so the shapes below describe buem-gateway's output either way.
 */

import type { LoadDataPoint } from './loadProfile';

/** A {value, unit} measurement, as buem-gateway's response shapes them. */
interface BuemQuantity {
  value: number;
  unit: string;
}

export interface BuemThermalLoadProfile {
  summary: {
    heating: { total: BuemQuantity };
    cooling?: { total: BuemQuantity };
    electricity: { total: BuemQuantity };
    // v6-draft; absent on results predating hot_water/kitchen. Kitchen's
    // total is in kWh_gas — a fuel channel, not electric kWh.
    hot_water?: { total: BuemQuantity };
    kitchen?: { total: BuemQuantity };
    // heating + cooling + electricity + hot_water, deliberately excluding
    // kitchen (a gas channel, not electric/thermal kWh — see geojson_processor.py).
    total_energy_demand?: BuemQuantity;
    peak_heating_load?: BuemQuantity;
    peak_cooling_load?: BuemQuantity;
    energy_intensity?: BuemQuantity;
  };
  timeseries?: {
    unit: string;
    kitchen_unit?: string;
    timestamps: string[];
    heating: number[];
    cooling?: number[];
    electricity: number[];
    hot_water?: number[];
    kitchen?: number[];
  };
}

export interface BuemThermalSummary {
  heatingKwh: number;
  coolingKwh: number;
  electricityKwh: number;
  peakHeatingKw: number;
  peakCoolingKw: number;
  energyIntensityKwhM2: number;
  dhwKwh: number;
  kitchenGasKwh: number;
  /** BuEM's own heating+cooling+electricity+hot_water total — gas deliberately excluded, see BuemThermalLoadProfile. */
  totalEnergyKwh: number;
}

export interface BuemSimulationResult {
  timeseries: LoadDataPoint[];
  thermalSummary: BuemThermalSummary;
}

export function toSimulationResult(profile: BuemThermalLoadProfile): BuemSimulationResult {
  const ts = profile.timeseries;
  const timeseries: LoadDataPoint[] = ts
    ? ts.timestamps.map((timestamp, i) => ({
        timestamp,
        heating:     ts.heating[i] ?? 0,
        electricity: ts.electricity[i] ?? 0,
        // LoadDataPoint has no cooling field. Reusing "hotwater" for BuEM's
        // cooling output matches the existing thermalSummary-based fallback
        // in BuildingConfigurator.tsx's computeEnergyTotals — not a
        // physically accurate label, but the established convention.
        // BuEM reports cooling as negative (its solver shares one signed
        // Q_HC axis: positive = heat added, negative = heat removed) — flip
        // it here so every downstream reader (chart, CSV export, totals)
        // sees a plain positive "energy needed for cooling" figure.
        hotwater: -(ts.cooling?.[i] ?? 0),
        dhw:      ts.hot_water?.[i] ?? 0,
        kitchen:  ts.kitchen?.[i] ?? 0,
      }))
    : [];

  return {
    timeseries,
    thermalSummary: {
      heatingKwh:           profile.summary.heating.total.value,
      coolingKwh:           profile.summary.cooling?.total.value ?? 0,
      electricityKwh:       profile.summary.electricity.total.value,
      peakHeatingKw:        profile.summary.peak_heating_load?.value ?? 0,
      peakCoolingKw:        profile.summary.peak_cooling_load?.value ?? 0,
      energyIntensityKwhM2: profile.summary.energy_intensity?.value ?? 0,
      dhwKwh:               profile.summary.hot_water?.total.value ?? 0,
      kitchenGasKwh:        profile.summary.kitchen?.total.value ?? 0,
      totalEnergyKwh:       profile.summary.total_energy_demand?.value
        ?? profile.summary.heating.total.value + (profile.summary.cooling?.total.value ?? 0)
           + profile.summary.electricity.total.value + (profile.summary.hot_water?.total.value ?? 0),
    },
  };
}
