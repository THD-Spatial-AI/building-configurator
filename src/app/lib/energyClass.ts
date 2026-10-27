// The indicative energy class of a building: BuEM's space heating per A_ref
// on the OIB-RL 6 HWB scale, for every country. Simulated, not a certificate.
// The colours are the certificate colours, kept apart from the topic colours.

import type { EnergyTotals } from './loadProfile';

export interface EnergyClass {
  label: string;
  /** Upper limit, inclusive, in kWh/(m²·a); Infinity for the last class. */
  maxKwhPerM2: number;
  /** Badge fill and text, written out in full so Tailwind finds them. */
  badge: string;
  /** The class colour, for a border and a light fill in it. */
  color: string;
}

export const HWB_CLASSES: EnergyClass[] = [
  { label: 'A++', maxKwhPerM2: 10, badge: 'bg-[#0E6B33] text-white', color: '#0E6B33' },
  { label: 'A+', maxKwhPerM2: 15, badge: 'bg-[#1B7A3A] text-white', color: '#1B7A3A' },
  { label: 'A', maxKwhPerM2: 25, badge: 'bg-[#3FA34D] text-white', color: '#3FA34D' },
  { label: 'B', maxKwhPerM2: 50, badge: 'bg-[#8CC63F] text-[#1B2430]', color: '#8CC63F' },
  { label: 'C', maxKwhPerM2: 100, badge: 'bg-[#E3D021] text-[#1B2430]', color: '#E3D021' },
  { label: 'D', maxKwhPerM2: 150, badge: 'bg-[#F5B323] text-[#1B2430]', color: '#F5B323' },
  { label: 'E', maxKwhPerM2: 200, badge: 'bg-[#F08A24] text-[#1B2430]', color: '#F08A24' },
  { label: 'F', maxKwhPerM2: 250, badge: 'bg-[#E2552B] text-white', color: '#E2552B' },
  { label: 'G', maxKwhPerM2: Infinity, badge: 'bg-[#C4252B] text-white', color: '#C4252B' },
];

/** The class of a space heating demand in kWh/(m²·a). */
export function hwbClass(kwhPerM2: number): EnergyClass {
  return HWB_CLASSES.find((c) => kwhPerM2 <= c.maxKwhPerM2) ?? HWB_CLASSES[HWB_CLASSES.length - 1];
}

/**
 * BuEM's space heating per m² of the storeys the result covers, or null
 * without a BuEM heating figure. A stored whole-building result is not divided
 * by the area of fewer storeys before the next run.
 */
export function heatingPerM2(
  totals: Pick<EnergyTotals, 'heating' | 'heatingSource'>,
  general: { floorArea: number; storeys: number },
  resultStoreys: readonly number[] | null,
): number | null {
  const heating = Number(totals.heating);
  const aRef = general.floorArea * (resultStoreys?.length ?? general.storeys);
  const fromBuem = totals.heatingSource === undefined || totals.heatingSource === 'buem';
  return fromBuem && Number.isFinite(heating) && heating > 0 && aRef > 0 ? heating / aRef : null;
}
