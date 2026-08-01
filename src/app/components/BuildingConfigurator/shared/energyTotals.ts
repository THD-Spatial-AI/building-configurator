// Derives the fixed annual energy totals (heating/electricity/hot water) shown
// in the overview hero and the configure workspace's preliminary demand card.

import { Flame, Zap, Droplets } from 'lucide-react';
import type { EnergyTotals, LoadDataPoint } from '../../lib/loadProfile';
import type { ThermalSummary } from '../../lib/buemAdapter';

/** Formats a kWh figure with precision scaled to its magnitude. */
export function formatKwh(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100) return abs.toFixed(0);
  if (abs >= 1)   return abs.toFixed(1);
  return abs.toFixed(2);
}

/**
 * Computes fixed annual energy totals from the full hourly timeseries.
 * Falls back to the model thermal summary, then to placeholder dashes.
 * Unit is always kWh — independent of chart resolution.
 */
export function computeEnergyTotals(
  timeseries: LoadDataPoint[] | null,
  thermalSummary: ThermalSummary | null,
): EnergyTotals {
  if (timeseries && timeseries.length > 0) {
    return {
      heating:     formatKwh(timeseries.reduce((s, p) => s + p.heating,     0)),
      electricity: formatKwh(timeseries.reduce((s, p) => s + p.electricity, 0)),
      hotwater:    formatKwh(timeseries.reduce((s, p) => s + p.hotwater,    0)),
      unit: 'kWh',
    };
  }
  if (thermalSummary) {
    return {
      heating:     thermalSummary.heatingKwh.toFixed(0),
      electricity: thermalSummary.electricityKwh.toFixed(0),
      hotwater:    thermalSummary.coolingKwh.toFixed(0),
      unit: 'kWh',
    };
  }
  return { electricity: '—', heating: '—', hotwater: '—', unit: 'kWh' };
}

/**
 * Raw (unformatted) BuEM baseline annual heating figure, in kWh — the "last
 * full simulation" reference point that a live ignis recalculation is
 * compared against. Same source priority as computeEnergyTotals, but returns
 * a number for arithmetic rather than a display string.
 */
export function baselineHeatingKwh(
  timeseries: LoadDataPoint[] | null,
  thermalSummary: ThermalSummary | null,
): number | null {
  if (timeseries && timeseries.length > 0) {
    return timeseries.reduce((s, p) => s + p.heating, 0);
  }
  if (thermalSummary) return thermalSummary.heatingKwh;
  return null;
}

/** Row config for the configure workspace's preliminary energy demand card. */
export const ENERGY_ITEMS = [
  { key: 'heating',     label: 'Heating',     Icon: Flame,    iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', valueColor: 'text-orange-300' },
  { key: 'electricity', label: 'Electricity', Icon: Zap,      iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', valueColor: 'text-yellow-300' },
  { key: 'hotwater',    label: 'Hot Water',   Icon: Droplets, iconBg: 'bg-blue-500/20',   iconColor: 'text-blue-400',   valueColor: 'text-blue-300'   },
] as const;
