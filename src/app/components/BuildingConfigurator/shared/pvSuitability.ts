// How suitable a surface is for PV, and how much would fit on it.
//
// One scoring model for the whole app: the configurator's recommendation list
// and the 3D workspace's PV planner both read it, so a surface cannot be
// "Excellent" in one view and unlisted in the other.

import type { BuildingElement } from '../configure/model/buildingElements';

/**
 * city2tabula's own signal for "this surface is horizontal, no meaningful
 * azimuth" (tilt > ~80°, where atan2 stops being numerically stable) — not a
 * heuristic guess, and stable across the whole dataset. On a flat roof,
 * azimuth and tilt for PV are the installer's choice, not a geometry fact.
 */
export function isFlatRoof(el: Pick<BuildingElement, 'azimuth'>): boolean {
  return el.azimuth === -1;
}

/** Compass label for an azimuth, or "flat" where the surface has no bearing. */
export function compassDir(azimuth: number): string {
  if (azimuth === -1) return 'flat';
  const dirs: Array<[number, string]> = [
    [22.5, 'N'], [67.5, 'NE'], [112.5, 'E'], [157.5, 'SE'],
    [202.5, 'S'], [247.5, 'SW'], [292.5, 'W'], [337.5, 'NW'],
  ];
  return dirs.find(([limit]) => azimuth < limit)?.[1] ?? 'N';
}

/**
 * Scores a surface for PV suitability (0–1).
 * Returns null for surfaces that are impractical for PV (floor, window, door).
 *
 * Scoring factors:
 *   - Azimuth (40%): south-facing (180°) = 1.0, north-facing = 0.3
 *   - Tilt     (35%): 35° = 1.0 (central-European optimum); degrades toward 0° and 90°
 *   - Area     (25%): scales up to 40 m²; larger surfaces offer more panel options
 *   - Type bonus:     roof surfaces get a 10% boost over walls (better exposure)
 */
export function scorePvSurface(el: BuildingElement): number | null {
  if (['floor', 'window', 'door'].includes(el.type)) return null;

  const flat = isFlatRoof(el);
  // Angle from south (0 = south, 180 = north) — meaningless for a flat roof,
  // so never computed from el.azimuth (-1) in that case.
  const azDiff = flat ? 0 : Math.min(Math.abs(el.azimuth - 180), 360 - Math.abs(el.azimuth - 180));

  // Steeply-tilted surfaces facing more than 90° from south get no solar gain in the
  // northern hemisphere — exclude them entirely from recommendations. Flat
  // roofs have no bearing to measure this against, so they're never excluded here.
  if (!flat && azDiff > 90) return null;

  // Cosine-based azimuth score: 1.0 south, 0 east/west.
  // Flat surfaces are unaffected by azimuth so receive full score.
  const azScore = flat ? 1.0 : Math.max(0, Math.cos((azDiff * Math.PI) / 180));

  const tiltScore = Math.max(0, 1 - Math.abs(el.tilt - 35) / 70);
  const areaScore = Math.min(1, el.area / 40);
  const typeBonus = el.type === 'roof' ? 1.1 : 1.0;

  return Math.min(1, (0.4 * azScore + 0.35 * tiltScore + 0.25 * areaScore) * typeBonus);
}

export function suitabilityLabel(score: number): { text: string; color: string; bg: string } {
  if (score >= 0.75) return { text: 'Excellent', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 0.55) return { text: 'Good',      color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' };
  return               { text: 'Fair',      color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' };
}

/** Below this a surface is not offered for PV at all. */
export const MIN_SCORE = 0.3;

/**
 * Smallest surface worth offering, m². A crystalline module is about 1.7 m²,
 * so anything under a few square metres cannot hold an array worth wiring —
 * and a real envelope carries plenty of slivers that would otherwise fill the
 * list ahead of the surfaces that matter.
 */
export const MIN_PV_AREA_M2 = 4;

export interface PvCandidate {
  element: BuildingElement;
  score: number;
  /** What would fit on it, kWp. */
  capacityKwp: number;
}

/**
 * Typical power density of a modern crystalline module, kWp per m² of module.
 * Used with usable_area_pct to turn a surface's area into a capacity, which is
 * what `usable_area_pct` exists for (see buildingDefaults.ts).
 */
export const MODULE_KWP_PER_M2 = 0.2;

/** What would fit on a surface, given the share of it panels can cover. */
export function suggestedCapacityKwp(area: number, usableAreaPct: number): number {
  return Math.round(area * (usableAreaPct / 100) * MODULE_KWP_PER_M2 * 10) / 10;
}

/** Every surface worth offering for PV, best first. */
export function pvCandidates(
  elements: Record<string, BuildingElement>,
  usableAreaPct: number,
): PvCandidate[] {
  return Object.values(elements)
    .flatMap((element) => {
      if (element.area < MIN_PV_AREA_M2) return [];
      const score = scorePvSurface(element);
      if (score === null || score < MIN_SCORE) return [];
      return [{ element, score, capacityKwp: suggestedCapacityKwp(element.area, usableAreaPct) }];
    })
    .sort((a, b) => b.score - a.score);
}
