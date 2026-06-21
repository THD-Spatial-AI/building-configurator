/**
 * HDCP (Heat Demand Calculation Pipeline) data model and adapter functions.
 *
 * HDCP uses ISO 13790 / TABULA building-level scalar inputs — one value per
 * element type across the whole building — whereas BuEM uses per-surface arrays.
 * This module defines the HDCP state shape, derives aggregate HDCP inputs from
 * BuEM surface data, and produces the payload sent to the HDCP API.
 *
 * The HDCP state lives alongside BuEM state in BuildingState; neither overwrites
 * the other. Shared fields (floor area, infiltration rates, thermal mass, etc.)
 * are kept in sync by BuildingConfigurator.
 */

import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { BuildingState } from './buemAdapter';

// ─── HDCP scalar input types ──────────────────────────────────────────────────

/**
 * TABULA building-level scalar inputs sent to the HDCP pipeline.
 * All fields are optional so partial objects can be merged progressively
 * (TABULA DB defaults → BuEM-derived values → user overrides).
 */
export interface HdcpInputs {
  // Reference floor area (m²) — synced with BuEM floorArea
  A_C_Ref_Input?: number;

  // Envelope areas (m²) — aggregated from BuEM surface elements
  A_Roof_1?: number;
  A_Roof_2?: number;
  A_Wall_1?: number;
  A_Wall_2?: number;
  A_Wall_3?: number;
  A_Floor_1?: number;
  A_Floor_2?: number;
  A_Window_1?: number;
  A_Window_2?: number;
  A_Window_South?: number;
  A_Window_East?: number;
  A_Window_West?: number;
  A_Window_North?: number;
  A_Door_1?: number;

  // Climate conditions
  HeatingDays?: number;
  Theta_e?: number;   // external design temperature (°C)
  Theta_i?: number;   // internal design temperature (°C)

  // U-values (W/m²K) — area-weighted average by element type from BuEM surfaces
  U_Roof_1?: number;
  U_Wall_1?: number;
  U_Floor_1?: number;
  U_Window_1?: number;
  U_Door_1?: number;

  // Shared with BuEM — kept in sync
  N_air_infiltration?: number;
  N_air_use?: number;
  F_sh_hor?: number;
  F_sh_vert?: number;
  F_f?: number;
  F_w?: number;
  C_m?: number;
  Phi_int?: number;

  // Solar irradiance (Wh/m²·a) — from climate dataset, not BuEM
  I_Sol_South?: number;
  I_Sol_East?: number;
  I_Sol_West?: number;
  I_Sol_North?: number;
  I_Sol_Horizontal?: number;

  // Thermal bridging (W/m²K) — added to U-values
  Delta_U_ThermalBridging_Original?: number;
  Delta_U_ThermalBridging_Refurbished?: number;
}

// ─── Refurbishment level ──────────────────────────────────────────────────────

/**
 * One pre-defined refurbishment level loaded from the TABULA DB.
 * The data object is read-only — user edits go into HdcpState.calcDemand.
 */
export interface HdcpVariantLevel {
  /** Full TABULA variant code, e.g. "DE.N.SFH.01.Gen". */
  code: string;
  /** Human-readable label: "Existing state" | "Medium refurbishment" | "Advanced refurbishment". */
  label: string;
  /** TABULA scalar values for this refurbishment level. Never mutated after load. */
  data: HdcpInputs;
}

// ─── HDCP state ───────────────────────────────────────────────────────────────

/**
 * All HDCP-related state for a single building.
 * Attached to BuildingState.hdcp; null until the user's building classification
 * resolves to at least one TABULA variant.
 */
export interface HdcpState {
  /** ISO 3166-1 alpha-2 country code, e.g. "DE". */
  countryIso2: string;
  /** TABULA building type code, e.g. "SFH", "MFH". */
  buildingTypeCode: string;
  /** TABULA construction period index, e.g. "01", "02". */
  constructionPeriod: string;

  /**
   * Pre-defined refurbishment levels from the TABULA DB, ordered from
   * existing state to most-refurbished. Never mutated after load.
   */
  variants: HdcpVariantLevel[];

  /** Index into variants[] for the currently selected refurbishment level. */
  selectedVariantIndex: number;

  /**
   * Working copy of the selected variant's data, augmented with values
   * derived from BuEM surfaces and any user edits.
   *
   * This is what gets sent to the HDCP API. Reset to the selected
   * variant's data (plus BuEM-derived geometry) at any time.
   */
  calcDemand: HdcpInputs;

  /**
   * True when calcDemand differs from the selected variant's data.
   * Used to show the "Reset to defaults" button.
   */
  isDirty: boolean;

  /** Latest heat demand result from the HDCP API, or null. */
  result: { qHnd: number; unit: 'kWh/(m2.a)' } | null;

  /** True while an HDCP API call is in flight. */
  loading: boolean;

  /** Error message from the last failed HDCP API call, or null. */
  error: string | null;
}

// ─── API response types ───────────────────────────────────────────────────────

/** Shape of one entry in the /variants/:country/match response. */
export interface HdcpVariantEntry {
  code: string;
  label: string;
}

/** Shape of /variants/:country/match response body. */
export interface HdcpMatchResponse {
  country: string;
  prefix: string;
  data: HdcpVariantEntry[];
}

/** Shape of /data/:code response body. */
export interface HdcpDataResponse {
  country: string;
  variant_code: string;
  tabula_data: Record<string, unknown>;
  expected_q_h_nd: number;
}

/** Shape of /calculate/:code response body. */
export interface HdcpCalculateResponse {
  variant_code: string;
  q_h_nd: number;
  unit: string;
}

// ─── Derivation from BuEM surfaces ───────────────────────────────────────────

/** Azimuth bucket boundaries for cardinal direction area aggregation. */
function cardinalFromAzimuth(azimuth: number): 'South' | 'East' | 'West' | 'North' {
  const a = ((azimuth % 360) + 360) % 360; // normalise to [0, 360)
  if (a >= 45 && a < 135) return 'East';
  if (a >= 135 && a < 225) return 'South';
  if (a >= 225 && a < 315) return 'West';
  return 'North';
}

/**
 * Derives HDCP aggregate inputs from BuEM surface-level data.
 * Called when a TABULA variant is first loaded to pre-fill geometry fields.
 *
 * Returns a partial HdcpInputs — only the fields that can be computed from
 * BuEM surfaces. Climate, solar, and thermal-bridging fields are left for
 * the TABULA DB record to supply.
 */
export function deriveHdcpInputsFromBuem(building: BuildingState): Partial<HdcpInputs> {
  const elements = Object.values(building.envelope) as BuildingElement[];

  const derived: Partial<HdcpInputs> = {};

  // ── Envelope areas and area-weighted U-values by element type ──────────────

  const byType = (type: BuildingElement['type']) => elements.filter(e => e.type === type);

  const sumArea = (els: BuildingElement[]) => els.reduce((s, e) => s + (e.area ?? 0), 0);

  const weightedUValue = (els: BuildingElement[]): number | undefined => {
    const totalArea = sumArea(els);
    if (totalArea === 0) return undefined;
    const weighted = els.reduce((s, e) => s + (e.uValue ?? 0) * (e.area ?? 0), 0);
    return weighted / totalArea;
  };

  const roofs   = byType('roof');
  const walls   = byType('wall');
  const floors  = byType('floor');
  const windows = byType('window');
  const doors   = byType('door');

  if (roofs.length   > 0) { derived.A_Roof_1   = sumArea(roofs);   derived.U_Roof_1   = weightedUValue(roofs); }
  if (walls.length   > 0) { derived.A_Wall_1   = sumArea(walls);   derived.U_Wall_1   = weightedUValue(walls); }
  if (floors.length  > 0) { derived.A_Floor_1  = sumArea(floors);  derived.U_Floor_1  = weightedUValue(floors); }
  if (windows.length > 0) { derived.A_Window_1 = sumArea(windows); derived.U_Window_1 = weightedUValue(windows); }
  if (doors.length   > 0) { derived.A_Door_1   = sumArea(doors);   derived.U_Door_1   = weightedUValue(doors); }

  // ── Window areas by cardinal direction ─────────────────────────────────────

  const windowsByDir: Record<string, number> = { South: 0, East: 0, West: 0, North: 0 };
  for (const w of windows) {
    const dir = cardinalFromAzimuth(w.azimuth ?? 180);
    windowsByDir[dir] += w.area ?? 0;
  }
  if (windowsByDir.South > 0) derived.A_Window_South = windowsByDir.South;
  if (windowsByDir.East  > 0) derived.A_Window_East  = windowsByDir.East;
  if (windowsByDir.West  > 0) derived.A_Window_West  = windowsByDir.West;
  if (windowsByDir.North > 0) derived.A_Window_North = windowsByDir.North;

  // ── Reference floor area — from building identity ─────────────────────────

  if (building.identity.floorArea > 0) {
    derived.A_C_Ref_Input = building.identity.floorArea;
  }

  return derived;
}

// ─── TABULA data → HdcpInputs ─────────────────────────────────────────────────

/**
 * Extracts HDCP scalar inputs from the raw TABULA API data record.
 * Only the fields relevant to the UI are extracted; internal TABULA fields
 * (measure codes, plausibility thresholds, etc.) are left in the DB.
 */
export function hdcpInputsFromTabulaData(tabula: Record<string, unknown>): HdcpInputs {
  const num = (key: string): number | undefined => {
    const v = tabula[key];
    return typeof v === 'number' ? v : undefined;
  };

  return {
    A_C_Ref_Input:    num('A_C_Ref_Input'),
    A_Roof_1:         num('A_Roof_1'),
    A_Roof_2:         num('A_Roof_2'),
    A_Wall_1:         num('A_Wall_1'),
    A_Wall_2:         num('A_Wall_2'),
    A_Wall_3:         num('A_Wall_3'),
    A_Floor_1:        num('A_Floor_1'),
    A_Floor_2:        num('A_Floor_2'),
    A_Window_1:       num('A_Window_1'),
    A_Window_2:       num('A_Window_2'),
    A_Window_South:   num('A_Window_South'),
    A_Window_East:    num('A_Window_East'),
    A_Window_West:    num('A_Window_West'),
    A_Window_North:   num('A_Window_North'),
    A_Door_1:         num('A_Door_1'),
    HeatingDays:      num('HeatingDays'),
    Theta_e:          num('Theta_e'),
    Theta_i:          num('theta_i'),      // lowercase in TABULA/DB
    U_Roof_1:         num('U_Roof_1'),
    U_Wall_1:         num('U_Wall_1'),
    U_Floor_1:        num('U_Floor_1'),
    U_Window_1:       num('U_Window_1'),
    U_Door_1:         num('U_Door_1'),
    N_air_infiltration: num('n_air_infiltration'),
    N_air_use:          num('n_air_use'),
    F_sh_hor:           num('F_sh_hor'),
    F_sh_vert:          num('F_sh_vert'),
    F_f:                num('F_f'),
    F_w:                num('F_w'),
    C_m:                num('c_m'),
    Phi_int:            num('phi_int'),
    I_Sol_South:        num('I_Sol_South'),
    I_Sol_East:         num('I_Sol_East'),
    I_Sol_West:         num('I_Sol_West'),
    I_Sol_North:        num('I_Sol_North'),
    I_Sol_Horizontal:   num('I_Sol_Hor'),
    Delta_U_ThermalBridging_Original:    num('delta_U_ThermalBridging_Original'),
    Delta_U_ThermalBridging_Refurbished: num('delta_U_ThermalBridging_Refurbished'),
  };
}

// ─── API payload ──────────────────────────────────────────────────────────────

/**
 * Produces the request body for POST /api/v1/calculate/:code.
 * Currently only A_ref can be passed as an override; the rest of calcDemand
 * is used for display and export but does not yet flow into the pipeline.
 */
export function toHdcpApiPayload(calcDemand: HdcpInputs): Record<string, unknown> | undefined {
  if (calcDemand.A_C_Ref_Input !== undefined) {
    return { A_ref: calcDemand.A_C_Ref_Input };
  }
  return undefined;
}

// ─── State initialiser ────────────────────────────────────────────────────────

/**
 * Builds the initial HdcpState after the variant match API call returns results.
 * Selects the first variant (existing state) and pre-fills geometry from BuEM data.
 */
export function initHdcpState(
  countryIso2: string,
  buildingTypeCode: string,
  constructionPeriod: string,
  variants: HdcpVariantLevel[],
  building: BuildingState,
): HdcpState {
  const buemDerived = deriveHdcpInputsFromBuem(building);
  const baseData = variants[0]?.data ?? {};

  // Merge: TABULA defaults first, BuEM geometry on top (geometry is more accurate)
  const calcDemand: HdcpInputs = { ...baseData, ...buemDerived };

  return {
    countryIso2,
    buildingTypeCode,
    constructionPeriod,
    variants,
    selectedVariantIndex: 0,
    calcDemand,
    isDirty: false,
    result: null,
    loading: false,
    error: null,
  };
}

/**
 * Returns updated HdcpState after the user switches refurbishment level.
 * Resets calcDemand to the new variant's data merged with the current BuEM geometry.
 */
export function selectVariantLevel(
  state: HdcpState,
  index: number,
  building: BuildingState,
): HdcpState {
  const variant = state.variants[index];
  if (!variant) return state;

  const buemDerived = deriveHdcpInputsFromBuem(building);
  const calcDemand: HdcpInputs = { ...variant.data, ...buemDerived };

  return { ...state, selectedVariantIndex: index, calcDemand, isDirty: false, result: null };
}

/**
 * Returns updated HdcpState after a field edit.
 * Merges the changed fields into calcDemand and marks the state as dirty.
 */
export function updateCalcDemand(state: HdcpState, changes: Partial<HdcpInputs>): HdcpState {
  return {
    ...state,
    calcDemand: { ...state.calcDemand, ...changes },
    isDirty: true,
  };
}

/**
 * Resets calcDemand to the selected variant's defaults merged with BuEM geometry.
 */
export function resetCalcDemand(state: HdcpState, building: BuildingState): HdcpState {
  const variant = state.variants[state.selectedVariantIndex];
  if (!variant) return state;

  const buemDerived = deriveHdcpInputsFromBuem(building);
  const calcDemand: HdcpInputs = { ...variant.data, ...buemDerived };

  return { ...state, calcDemand, isDirty: false, result: null };
}
