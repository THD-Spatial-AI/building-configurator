// The indicative energy class of a building: BuEM's space heating per A_ref
// on the OIB-RL 6 HWB scale, for every country. Simulated, not a certificate.
// The colours are the certificate colours, kept apart from the topic colours.

export interface EnergyClass {
  label: string;
  /** Upper limit, inclusive, in kWh/(m²·a); Infinity for the last class. */
  maxKwhPerM2: number;
  /** Badge fill and text, written out in full so Tailwind finds them. */
  badge: string;
}

export const HWB_CLASSES: EnergyClass[] = [
  { label: 'A++', maxKwhPerM2: 10, badge: 'bg-[#0E6B33] text-white' },
  { label: 'A+', maxKwhPerM2: 15, badge: 'bg-[#1B7A3A] text-white' },
  { label: 'A', maxKwhPerM2: 25, badge: 'bg-[#3FA34D] text-white' },
  { label: 'B', maxKwhPerM2: 50, badge: 'bg-[#8CC63F] text-[#1B2430]' },
  { label: 'C', maxKwhPerM2: 100, badge: 'bg-[#E3D021] text-[#1B2430]' },
  { label: 'D', maxKwhPerM2: 150, badge: 'bg-[#F5B323] text-[#1B2430]' },
  { label: 'E', maxKwhPerM2: 200, badge: 'bg-[#F08A24] text-[#1B2430]' },
  { label: 'F', maxKwhPerM2: 250, badge: 'bg-[#E2552B] text-white' },
  { label: 'G', maxKwhPerM2: Infinity, badge: 'bg-[#C4252B] text-white' },
];

/** The class of a space heating demand in kWh/(m²·a). */
export function hwbClass(kwhPerM2: number): EnergyClass {
  return HWB_CLASSES.find((c) => kwhPerM2 <= c.maxKwhPerM2) ?? HWB_CLASSES[HWB_CLASSES.length - 1];
}
