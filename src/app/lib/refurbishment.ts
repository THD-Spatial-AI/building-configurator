// Refurbishment state per element type: which TABULA variant (1 existing
// state, 2 usual, 3 advanced refurbishment) each of walls, roof, floor,
// windows and doors follows, and what that means for each surface's U-value.
//
// A surface is Custom when its U-value is not the one its type's state gives
// it, or when it was added by hand. A state change moves only the surfaces that are not Custom, so values
// set surface by surface survive a preset.

import { tabulaUValue, type IgnisVariantLevel } from './ignisAdapter';
import type { Translate } from '../i18n';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';

export type RefurbElementType = BuildingElement['type'];

export const REFURB_TYPES: RefurbElementType[] = ['wall', 'roof', 'floor', 'window', 'door'];

/** Variant number per element type. */
export type RefurbStates = Record<RefurbElementType, number>;

/** What is saved with the building: the City2TABULA variant and the states chosen since. */
export interface Refurbishment {
  /** City2TABULA's tabula_variant_code for the building, e.g. "NL.N.SFH.02.Deta.ReEx.001.002". */
  variantCode?: string;
  states?: Partial<RefurbStates>;
}

/** TABULA's names for variants 1 to 3, used where ignis gives a generic label. */
export const TABULA_VARIANT_NAMES = ['Existing state', 'Usual refurbishment', 'Advanced refurbishment'];

const VARIANT_KEYS = ['existing', 'usual', 'advanced'];

/**
 * A variant's name in the view's language: TABULA's own name translated, or
 * the specific description ignis gives (for example a construction standard)
 * as it is. `short` is the form for a preset chip.
 */
export function variantName(t: Translate, label: string, number: number, short = false): string {
  if (TABULA_VARIANT_NAMES[number - 1] !== label) return label;
  return t(`insulation.variant.${short ? 'short' : 'full'}.${VARIANT_KEYS[number - 1]}`);
}

/** U-values closer than this count as equal; TABULA gives two decimals. */
const U_TOLERANCE = 1e-6;

/** The variant number a TABULA code ends in (001.002 is 2), or null. */
export function variantNumber(code: string | undefined): number | null {
  const n = Number(code?.split('.').pop());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The building subtype a TABULA code names (NL.N.SFH.02.Deta... is Deta), or undefined. */
export function variantSubtype(code: string | undefined): string | undefined {
  return code?.split('.')[4] || undefined;
}

/** Each type's state as the building opens: saved, else the City2TABULA variant, else existing state. */
export function startingStates(saved: Refurbishment | undefined): RefurbStates {
  const fallback = variantNumber(saved?.variantCode) ?? 1;
  return Object.fromEntries(
    REFURB_TYPES.map((type) => [type, saved?.states?.[type] ?? fallback]),
  ) as RefurbStates;
}

/** The U-value a state gives a surface: as loaded for its starting state, else the variant's TABULA value. */
export function expectedUValue(
  el: BuildingElement,
  state: number,
  initial: RefurbStates,
  levels: IgnisVariantLevel[],
): number | undefined {
  if (state === initial[el.type]) return el.defaultUValue ?? el.uValue;
  const level = levels.find((l) => l.number === state);
  return level ? tabulaUValue(level.data, el.type) : undefined;
}

function isCustom(el: BuildingElement, state: number, initial: RefurbStates, levels: IgnisVariantLevel[]): boolean {
  // A surface added by hand has no TABULA counterpart; it keeps what was typed.
  if (el.source === 'custom') return true;
  const expected = expectedUValue(el, state, initial, levels);
  return expected === undefined || Math.abs(el.uValue - expected) > U_TOLERANCE;
}

/** How many surfaces of the type are set by hand away from its state. */
export function customCount(
  elements: Record<string, BuildingElement>,
  type: RefurbElementType,
  state: number,
  initial: RefurbStates,
  levels: IgnisVariantLevel[],
): number {
  return Object.values(elements).filter((el) => el.type === type && isCustom(el, state, initial, levels)).length;
}

/**
 * Moves the type's surfaces from one state to another, leaving Custom ones as
 * they are. Returns the same object when nothing changes.
 */
export function applyState(
  elements: Record<string, BuildingElement>,
  type: RefurbElementType,
  from: number,
  to: number,
  initial: RefurbStates,
  levels: IgnisVariantLevel[],
): Record<string, BuildingElement> {
  let changed = false;
  const next: Record<string, BuildingElement> = {};
  for (const [id, el] of Object.entries(elements)) {
    const target = el.type === type && !isCustom(el, from, initial, levels)
      ? expectedUValue(el, to, initial, levels)
      : undefined;
    if (target !== undefined && Math.abs(target - el.uValue) > U_TOLERANCE) {
      next[id] = { ...el, uValue: target };
      changed = true;
    } else {
      next[id] = el;
    }
  }
  return changed ? next : elements;
}
