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
  /** A box in the class colour: its border over a light tint of it. */
  frame: string;
}

export const HWB_CLASSES: EnergyClass[] = [
  { label: 'A++', maxKwhPerM2: 10, badge: 'bg-[#0E6B33] text-white', frame: 'border-[#0E6B33] bg-[#0E6B33]/10' },
  { label: 'A+', maxKwhPerM2: 15, badge: 'bg-[#1B7A3A] text-white', frame: 'border-[#1B7A3A] bg-[#1B7A3A]/10' },
  { label: 'A', maxKwhPerM2: 25, badge: 'bg-[#3FA34D] text-white', frame: 'border-[#3FA34D] bg-[#3FA34D]/10' },
  { label: 'B', maxKwhPerM2: 50, badge: 'bg-[#8CC63F] text-[#1B2430]', frame: 'border-[#8CC63F] bg-[#8CC63F]/15' },
  { label: 'C', maxKwhPerM2: 100, badge: 'bg-[#E3D021] text-[#1B2430]', frame: 'border-[#E3D021] bg-[#E3D021]/15' },
  { label: 'D', maxKwhPerM2: 150, badge: 'bg-[#F5B323] text-[#1B2430]', frame: 'border-[#F5B323] bg-[#F5B323]/15' },
  { label: 'E', maxKwhPerM2: 200, badge: 'bg-[#F08A24] text-[#1B2430]', frame: 'border-[#F08A24] bg-[#F08A24]/12' },
  { label: 'F', maxKwhPerM2: 250, badge: 'bg-[#E2552B] text-white', frame: 'border-[#E2552B] bg-[#E2552B]/10' },
  { label: 'G', maxKwhPerM2: Infinity, badge: 'bg-[#C4252B] text-white', frame: 'border-[#C4252B] bg-[#C4252B]/10' },
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
