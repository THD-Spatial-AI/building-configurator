// The building's editable model: envelope, general parameters, technologies,
// ignis heat demand and the BuEM simulation result, with every handler that
// changes them.
//
// Owned here rather than in a component so the dialog and the 3D workspace
// present the same state instead of each keeping their own copy. Anything
// about which panel is open or which surface is selected belongs to the
// component, not here.

import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { BuildingElement } from './configure/model/buildingElements';
import {
  isElementEditable,
  normalizeElementRecord,
  hasInvalidArea,
} from './configure/model/buildingElements';
import { type RoofConfig, DEFAULT_ROOF_CONFIG } from './configure/model/roof';
import { type EnergyTotals, type LoadDataPoint } from '../../lib/loadProfile';
import { DEFAULT_ELEMENTS, DEFAULT_GENERAL, computeTotalFloorArea } from './shared/buildingDefaults';
import { yearToConstructionPeriod } from './shared/buildingOptions';
import type { BuildingState, ThermalSummary } from '../../lib/buemAdapter';
import { exportToBuemGeojson, importBuildingData } from '../../lib/buemAdapter';
import type { IgnisState } from '../../lib/ignisAdapter';
import {
  initIgnisState,
  selectVariantLevel,
  syncElementsWithVariantLevel,
  restoreDefaultUValues,
  resetElementsToVariantDefaults,
} from '../../lib/ignisAdapter';
import { useConfiguratorApi } from '../../lib/provider';
import { getThermalRating, buildSnapshotRows, type SnapshotBaseline } from './shared/snapshotUtils';
import { modelTablesZip } from './shared/modelExport';
import { getThermalRatingFromDemand } from '@/app/config/thermalRatingStandards';
import { DEFAULT_BATTERY_CONFIG } from './shared/buildingDefaults';
import type { PvConfig, BatteryConfig } from './shared/buildingDefaults';
import {
  createPvArray,
  DEFAULT_PV_TECHNOLOGY,
  resolvePvArray,
  splitPvPatch,
  type PvArray,
  type PvTechnology,
} from './shared/pvModel';

const SURFACE_DEFAULTS: Record<BuildingElement['type'], Omit<BuildingElement, 'id' | 'label'>> = {
  wall:   { type: 'wall',   area: 12, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180, source: 'custom', customMode: true },
  window: { type: 'window', area: 2.4, uValue: 1.3,  gValue: 0.6,  tilt: 90, azimuth: 180, source: 'custom', customMode: true },
  door:   { type: 'door',   area: 2.1, uValue: 1.8,  gValue: null, tilt: 90, azimuth: 180, source: 'custom', customMode: true },
  roof:   { type: 'roof',   area: 18, uValue: 0.18, gValue: null, tilt: 35, azimuth: 180, source: 'custom', customMode: true },
  floor:  { type: 'floor',  area: 18, uValue: 0.30, gValue: null, tilt: 0,  azimuth: 0,   source: 'custom', customMode: true },
};

function surfaceTypeLabel(type: BuildingElement['type']): string {
  if (type === 'roof') return 'Roof';
  if (type === 'floor') return 'Floor';
  if (type === 'door') return 'Door';
  if (type === 'window') return 'Window';
  return 'Wall';
}

function buildSurfaceLabel(type: BuildingElement['type'], elements: Record<string, BuildingElement>): string {
  const next = Object.values(elements).filter((el) => el.type === type).length + 1;
  return `Custom ${surfaceTypeLabel(type)} ${next}`;
}

function buildSurfaceId(type: BuildingElement['type'], elements: Record<string, BuildingElement>): string {
  const base = `custom_${type}`;
  let idx = 1;
  while (elements[`${base}_${idx}`]) idx += 1;
  return `${base}_${idx}`;
}

function buildNewSurface(type: BuildingElement['type'], elements: Record<string, BuildingElement>): BuildingElement {
  const seed = Object.values(elements).find((el) => el.type === type && isElementEditable(el))
    ?? Object.values(elements).find((el) => el.type === type)
    ?? null;

  return {
    id: buildSurfaceId(type, elements),
    label: buildSurfaceLabel(type, elements),
    ...(seed
      ? {
          type,
          area: seed.area,
          uValue: seed.uValue,
          gValue: seed.gValue,
          tilt: seed.tilt,
          azimuth: seed.azimuth,
          source: 'custom' as const,
          customMode: true,
        }
      : SURFACE_DEFAULTS[type]),
  };
}

function isRoofConfig(value: unknown): value is RoofConfig {
  return !!value
    && typeof value === 'object'
    && 'type' in value
    && 'surfaces' in value
    && Array.isArray((value as RoofConfig).surfaces)
    && 'from3DData' in value;
}

/** Formats a kWh figure with precision scaled to its magnitude. */
function formatKwh(v: number): string {
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
function computeEnergyTotals(
  timeseries: LoadDataPoint[] | null,
  thermalSummary: ThermalSummary | null,
): EnergyTotals {
  // A live BuEM run always populates timeseries and thermalSummary together
  // (see toSimulationResult), so whenever real per-hour dhw/kitchen data
  // exists, thermalSummary — the authoritative source for these two and for
  // the combined total below — exists alongside it. An uploaded ground-truth
  // CSV has no dhw/kitchen column and no thermalSummary either, so both
  // correctly fall back to '—' rather than a misleading 0.
  const dhw     = thermalSummary ? formatKwh(thermalSummary.dhwKwh) : '—';
  const kitchen = thermalSummary ? formatKwh(thermalSummary.kitchenGasKwh) : '—';
  const total   = thermalSummary ? formatKwh(thermalSummary.totalEnergyKwh) : '—';

  if (timeseries && timeseries.length > 0) {
    return {
      heating:     formatKwh(timeseries.reduce((s, p) => s + p.heating,     0)),
      electricity: formatKwh(timeseries.reduce((s, p) => s + p.electricity, 0)),
      hotwater:    formatKwh(timeseries.reduce((s, p) => s + p.hotwater,    0)),
      dhw, kitchen, total,
      unit: 'kWh/year',
      kitchenUnit: 'kWh_gas/year',
    };
  }
  if (thermalSummary) {
    return {
      heating:     thermalSummary.heatingKwh.toFixed(0),
      electricity: thermalSummary.electricityKwh.toFixed(0),
      hotwater:    thermalSummary.coolingKwh.toFixed(0),
      dhw, kitchen, total,
      unit: 'kWh/year',
      kitchenUnit: 'kWh_gas/year',
    };
  }
  return { electricity: '—', heating: '—', hotwater: '—', dhw: '—', kitchen: '—', total: '—', unit: 'kWh/year' };
}

/**
 * Resolves what the energy cards should show: BuEM's last confirmed run, or
 * — if the user uploaded one — a real load profile compared against it.
 * BuEM is the single source of truth for energy demand; ignis is used only
 * for building thermal properties (TABULA U-values), never shown here as a
 * competing demand estimate — the two models' figures for the same building
 * can differ enough to read as a discrepancy rather than the different
 * things they actually are (a fast per-m² estimate vs. an hourly physics
 * simulation).
 */
function resolveDisplayEnergyTotals(
  energyTotals: EnergyTotals,
  groundTruthTimeseries: LoadDataPoint[] | null,
): EnergyTotals {
  const groundTruth = groundTruthTimeseries ? computeEnergyTotals(groundTruthTimeseries, null) : null;
  if (!groundTruth) return energyTotals;

  const heatingKwh = Number(energyTotals.heating);
  const heatingDeltaPercent = heatingKwh > 0
    ? ((Number(groundTruth.heating) - heatingKwh) / heatingKwh) * 100
    : null;
  const electricityKwh = Number(energyTotals.electricity);
  const electricityDeltaPercent = electricityKwh > 0
    ? ((Number(groundTruth.electricity) - electricityKwh) / electricityKwh) * 100
    : null;
  const hotwaterKwh = Number(energyTotals.hotwater);
  const hotwaterDeltaPercent = hotwaterKwh > 0
    ? ((Number(groundTruth.hotwater) - hotwaterKwh) / hotwaterKwh) * 100
    : null;

  return {
    ...groundTruth,
    heatingSource: 'user',
    electricitySource: 'user',
    hotwaterSource: 'user',
    heatingDeltaPercent,
    heatingBaselineKwh: heatingKwh > 0 ? formatKwh(heatingKwh) : undefined,
    heatingComparisonLabel: heatingKwh > 0 ? 'the last full simulation' : undefined,
    electricityDeltaPercent,
    electricityBaselineKwh: electricityKwh > 0 ? formatKwh(electricityKwh) : undefined,
    electricityComparisonLabel: electricityKwh > 0 ? 'the last full simulation' : undefined,
    hotwaterDeltaPercent,
    hotwaterBaselineKwh: hotwaterKwh > 0 ? formatKwh(hotwaterKwh) : undefined,
    hotwaterComparisonLabel: hotwaterKwh > 0 ? 'the last full simulation' : undefined,
  };
}

/** How long consecutive edits of the same field fold into one undo step, so a
 *  dragged slider is one change rather than one per pixel. */
const UNDO_COALESCE_MS = 900;
const UNDO_DEPTH = 30;

interface EnvelopeHistoryEntry {
  elements: Record<string, BuildingElement>;
  /** What the step did, for the undo button, e.g. "Deleted wall". */
  label: string;
  /** Identifies the edit for coalescing: same key in quick succession is one step. */
  key: string;
  at: number;
}

const FIELD_LABELS: Record<string, string> = {
  area: 'Area',
  uValue: 'U-value',
  tilt: 'Tilt',
  azimuth: 'Orientation',
  gValue: 'Solar transmittance',
  label: 'Name',
};

export type BuildingModel = ReturnType<typeof useBuildingModel>;

export function useBuildingModel(buildingData?: BuildingState) {
  const api = useConfiguratorApi();
  const thematicData = buildingData?.thematic;
  const geometryData = buildingData?.geometry;
  const technologyData = buildingData?.technologies;
  const identityData = thematicData?.identity ?? buildingData?.identity;

  // Merge model identity fields into general config, keeping defaults for any missing fields.
  // identity.floorArea is the source data's total conditioned floor area (BuEM A_ref); general.floorArea
  // is per-storey, so divide by storeys when seeding it.
  const initialGeneral = buildingData ? {
    ...DEFAULT_GENERAL,
    buildingName:       identityData?.label ?? DEFAULT_GENERAL.buildingName,
    buildingType:       identityData?.buildingType ?? DEFAULT_GENERAL.buildingType,
    constructionYear:   identityData?.constructionYear || DEFAULT_GENERAL.constructionYear,
    country:            identityData?.country ?? DEFAULT_GENERAL.country,
    floorArea:          identityData?.floorArea
      ? identityData.floorArea / Math.max(1, identityData?.storeys || DEFAULT_GENERAL.storeys)
      : DEFAULT_GENERAL.floorArea,
    roomHeight:         identityData?.roomHeight || DEFAULT_GENERAL.roomHeight,
    storeys:            identityData?.storeys || DEFAULT_GENERAL.storeys,
  } : DEFAULT_GENERAL;

  const initialElements = normalizeElementRecord(
    thematicData && Object.keys(thematicData.envelope).length > 0
      ? thematicData.envelope
      : DEFAULT_ELEMENTS,
    thematicData && Object.keys(thematicData.envelope).length > 0 ? 'city' : 'default',
  );

  const initialEnergyTotals = computeEnergyTotals(
    thematicData?.timeseries ?? buildingData?.timeseries ?? null,
    thematicData?.thermalSummary ?? buildingData?.thermalSummary ?? null,
  );

  const [elements,      setElements]      = useState(initialElements);
  const [general,       setGeneralRaw]    = useState(initialGeneral);
  const [roofConfig,    setRoofConfig]    = useState<RoofConfig>(DEFAULT_ROOF_CONFIG);
  // One module choice for the building, and an array per surface saying where
  // the panels sit. The flat per-surface config everything else reads is
  // resolved from the two, so cost and efficiency cannot drift between arrays.
  const [pvTechnology, setPvTechnology] = useState<PvTechnology>(DEFAULT_PV_TECHNOLOGY);
  const [pvArrays, setPvArrays] = useState<Record<string, PvArray>>({});
  // True when a roof-type change removed surfaces that had PV installed.
  const [pvInvalidated,  setPvInvalidated]  = useState(false);
  // Non-PV technology IDs (heat_pump) toggled by the overview panel.
  const [otherTechIds,   setOtherTechIds]   = useState<string[]>(() =>
    (technologyData?.installedTechIds ?? buildingData?.installedTechIds ?? []).filter((id) => id !== 'solar_pv' && id !== 'battery'),
  );
  // Battery configuration — owned as dedicated state so BatteryEditor has full control.
  const [batteryConfig,  setBatteryConfig]  = useState<BatteryConfig>(() => {
    const raw = technologyData?.rawTechs?.battery_storage ?? buildingData?.technologies?.rawTechs?.battery_storage;
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, any>;
      return {
        ...DEFAULT_BATTERY_CONFIG,
        installed:                    (buildingData?.installedTechIds ?? []).includes('battery'),
        cont_energy_cap_max:          r.cont_energy_cap_max          ?? DEFAULT_BATTERY_CONFIG.cont_energy_cap_max,
        cont_energy_cap_min:          r.cont_energy_cap_min          ?? DEFAULT_BATTERY_CONFIG.cont_energy_cap_min,
        cont_storage_cap_max:         r.cont_storage_cap_max         ?? DEFAULT_BATTERY_CONFIG.cont_storage_cap_max,
        cont_storage_cap_min:         r.cont_storage_cap_min         ?? DEFAULT_BATTERY_CONFIG.cont_storage_cap_min,
        cont_energy_eff:              r.cont_energy_eff              ?? DEFAULT_BATTERY_CONFIG.cont_energy_eff,
        cont_storage_loss:            r.cont_storage_loss            ?? DEFAULT_BATTERY_CONFIG.cont_storage_loss,
        cont_storage_discharge_depth: r.cont_storage_discharge_depth ?? DEFAULT_BATTERY_CONFIG.cont_storage_discharge_depth,
        cont_storage_initial:         r.cont_storage_initial         ?? DEFAULT_BATTERY_CONFIG.cont_storage_initial,
        cont_lifetime:                r.cont_lifetime                ?? DEFAULT_BATTERY_CONFIG.cont_lifetime,
        cost_energy_cap:              r.cost_energy_cap              ?? DEFAULT_BATTERY_CONFIG.cost_energy_cap,
        cost_storage_cap:             r.cost_storage_cap             ?? DEFAULT_BATTERY_CONFIG.cost_storage_cap,
        cost_om_annual:               r.cost_om_annual               ?? DEFAULT_BATTERY_CONFIG.cost_om_annual,
        cost_interest_rate:           r.cost_interest_rate           ?? DEFAULT_BATTERY_CONFIG.cost_interest_rate,
      };
    }
    return DEFAULT_BATTERY_CONFIG;
  });
  const [uploadError,   setUploadError]   = useState<string | null>(null);
  // Envelope edits only: what a user changes by hand and may want back. Building
  // parameters and technology settings are not in it.
  const [history, setHistory] = useState<EnvelopeHistoryEntry[]>([]);

  // HDCP annual heat demand state — null until the building's country/type/period
  // resolve to at least one TABULA variant in the HDCP service.
  const [ignis, setHdcp] = useState<IgnisState | null>(null);

  const [savedState,      setSavedState]      = useState({ elements: initialElements, general: initialGeneral, roofConfig: DEFAULT_ROOF_CONFIG });
  const [energyTotals,    setEnergyTotals]    = useState<EnergyTotals>(initialEnergyTotals);
  // Hourly timeseries from the most recent live buem-gateway run this session — takes
  // priority over whatever timeseries the buildingData prop originally carried.
  const [modelTimeseries, setModelTimeseries] = useState<LoadDataPoint[] | null>(null);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  // A user-uploaded load profile, if any — outranks BuEM as the annual
  // totals' source, since it's real data rather than a model output.
  const [groundTruthTimeseries, setGroundTruthTimeseries] = useState<LoadDataPoint[] | null>(null);

  // Guards the classification-change effect below from re-deriving floor area/envelope
  // defaults on the load of a new building (whose own data should win), while still
  // applying that reload when the *same* building's type/period/country is edited by hand.
  const isFirstClassificationLoad = useRef(true);

  // Baseline for "Modified" comparisons — updated whenever a new building is loaded.
  // This records the state as it was when first loaded so the badges reflect user
  // edits only, not differences from the static DEFAULT_* constants.
  const baselineRef = useRef<SnapshotBaseline>({
    general:      initialGeneral,
    elements:     initialElements,
    totalArea:    Object.values(initialElements).reduce((s, e) => s + e.area, 0),
    elementCount: Object.keys(initialElements).length,
  });

  // Sync all model-derived state whenever buildingData prop changes (e.g. different building
  // selected, or the source JSON is updated during development).
  useEffect(() => {
    if (!buildingData) return;

    // A new building just loaded with its own data — the next classification-change
    // effect run is that load settling in, not a hand-edit, so it must not reload
    // TABULA defaults on top of what this building just brought with it.
    isFirstClassificationLoad.current = true;

    const nextElements = normalizeElementRecord(
      Object.keys(buildingData.thematic.envelope).length > 0
        ? buildingData.thematic.envelope
        : DEFAULT_ELEMENTS,
      Object.keys(buildingData.thematic.envelope).length > 0 ? 'city' : 'default',
    );

    const nextStoreys = buildingData.thematic.identity.storeys || DEFAULT_GENERAL.storeys;
    const nextGeneral = {
      ...DEFAULT_GENERAL,
      buildingType:       buildingData.thematic.identity.buildingType,
      constructionYear:   buildingData.thematic.identity.constructionYear || DEFAULT_GENERAL.constructionYear,
      country:            buildingData.thematic.identity.country,
      // identity.floorArea is the total conditioned floor area (BuEM A_ref); general.floorArea is per-storey.
      floorArea:          buildingData.thematic.identity.floorArea
        ? buildingData.thematic.identity.floorArea / Math.max(1, nextStoreys)
        : DEFAULT_GENERAL.floorArea,
      roomHeight:         buildingData.thematic.identity.roomHeight || DEFAULT_GENERAL.roomHeight,
      storeys:            nextStoreys,
    };

    const nextTotals = computeEnergyTotals(
      buildingData.thematic.timeseries ?? buildingData.timeseries ?? null,
      buildingData.thematic.thermalSummary ?? buildingData.thermalSummary ?? null,
    );

    baselineRef.current = {
      general:      nextGeneral,
      elements:     nextElements,
      totalArea:    Object.values(nextElements).reduce((s, e) => s + e.area, 0),
      elementCount: Object.keys(nextElements).length,
    };
    setElements(nextElements);
    setGeneralRaw(nextGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setSavedState({ elements: nextElements, general: nextGeneral, roofConfig: DEFAULT_ROOF_CONFIG });
    setEnergyTotals(nextTotals);
    setModelTimeseries(null);
    setUploadError(null);
    setPvArrays({});
    setPvTechnology(DEFAULT_PV_TECHNOLOGY);
    setPvInvalidated(false);
    setHistory([]);
    setOtherTechIds(buildingData.technologies.installedTechIds.filter((id) => id !== 'solar_pv' && id !== 'battery'));
    setBatteryConfig(DEFAULT_BATTERY_CONFIG);
  }, [buildingData]);

  const hasUnsavedChanges = JSON.stringify({ elements, general, roofConfig }) !== JSON.stringify(savedState);

  // ── HDCP: reload variant levels when building classification changes ───────────
  // Triggered by country, building type, or construction year changes.
  // Resets HDCP state so stale results are not shown for a different building.
  useEffect(() => {
    const country = general.country as string | undefined;
    const type    = general.buildingType as string | undefined;
    const year    = general.constructionYear as number | undefined;

    if (!country || !type || !year) {
      setHdcp(null);
      return;
    }

    const period = yearToConstructionPeriod(year);
    let cancelled = false;

    (async () => {
      const variants = await api.ignis.loadVariantLevels(country, type, year);
      if (cancelled || variants.length === 0) {
        if (!cancelled) setHdcp(null);
        return;
      }

      // Only reload TABULA defaults (envelope U-values, floor area) when the user hand-edits
      // type/year/country for a building that's already loaded — not for the load itself,
      // which should keep whatever envelope/floor-area that building's own data brought.
      const isReload = !isFirstClassificationLoad.current;
      isFirstClassificationLoad.current = false;

      const existingStateData = variants[0]?.data ?? {};
      const nextElements = isReload
        ? resetElementsToVariantDefaults(elements, existingStateData)
        : restoreDefaultUValues(elements);
      if (!cancelled && nextElements !== elements) setElements(nextElements);

      if (isReload && existingStateData.A_C_Ref_Input) {
        const nextFloorArea = existingStateData.A_C_Ref_Input / Math.max(1, general.storeys ?? 1);
        if (!cancelled) setGeneralRaw((prev) => ({ ...prev, floorArea: nextFloorArea }));
      }

      const state = initIgnisState(country, type, period, variants, ignisSeedBuilding(general, nextElements, type, year, country));
      if (!cancelled) setHdcp(state);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [general.country, general.buildingType, general.constructionYear]);

  // ── HDCP: auto-recalculate (debounced) when calcDemand changes ────────────────
  useEffect(() => {
    if (!ignis) return;

    const variant = ignis.variants[ignis.selectedVariantIndex];
    if (!variant) return;

    setHdcp((prev) => prev ? { ...prev, loading: true, error: null } : prev);

    const timer = setTimeout(async () => {
      const result = await api.ignis.calculateHeatDemand(variant.code, ignis.calcDemand);
      setHdcp((prev) => {
        if (!prev) return prev;
        if (result) return { ...prev, loading: false, result: { qHnd: result.q_h_nd, unit: 'kWh/(m2.a)' } };
        return { ...prev, loading: false, error: 'ignis service unavailable' };
      });
    }, 500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignis?.calcDemand, ignis?.selectedVariantIndex]);

  const selectIgnisVariant = (index: number) => {
    if (!ignis) return;
    const targetVariant = ignis.variants[index];
    // Refurbished levels apply the TABULA archetype's own U-values per surface
    // category (roof/wall/floor/window/door); "existing state" restores each
    // surface's real, as-measured U-value. Without this, refurbishment-level
    // selection cannot change thermal efficiency or heat demand at all — BuEM's
    // real per-surface U-values would otherwise always win.
    const nextElements = targetVariant
      ? syncElementsWithVariantLevel(elements, index, targetVariant.data)
      : elements;
    if (nextElements !== elements) {
      remember(`variant:${Date.now()}`, 'Refurbishment level');
      setElements(nextElements);
    }

    setHdcp(selectVariantLevel(ignis, index, ignisSeedBuilding(
      general, nextElements, general.buildingType, general.constructionYear, general.country,
    )));
  };

  // --- Envelope history -------------------------------------------------------

  /** Records the envelope as it is now, so the next change can be undone. */
  const remember = (key: string, label: string) => {
    const at = Date.now();
    setHistory((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.key === key && at - top.at < UNDO_COALESCE_MS) {
        // Same field still being dragged: keep the older snapshot, extend the window.
        return [...prev.slice(0, -1), { ...top, at }];
      }
      return [...prev, { elements, label, key, at }].slice(-UNDO_DEPTH);
    });
  };

  /** Restores the envelope to before the last change, deleted surfaces included. */
  const undo = () => {
    const top = history[history.length - 1];
    if (!top) return;
    setElements(top.elements);
    setHistory((prev) => prev.slice(0, -1));
  };

  // --- Envelope handlers ------------------------------------------------------

  const updateElement = (id: string, patch: Partial<BuildingElement>) => {
    const field = Object.keys(patch)[0] ?? '';
    remember(`update:${id}:${field}`, `${FIELD_LABELS[field] ?? 'Surface'} change`);
    setElements((prev) => {
      const current = prev[id];
      if (!current) return prev;
      // Auto-activate custom mode on first edit so the data model tracks the change.
      return { ...prev, [id]: { ...current, ...patch, customMode: true } };
    });
  };

  // Label is display-only — rename is always allowed regardless of custom mode.
  const renameElement = (id: string, label: string) => {
    remember(`rename:${id}`, 'Rename');
    setElements((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, label } };
    });
  };

  /** Removes a surface, returning its type so the caller can keep its own
   *  selection and navigation in step. Undo brings it back. */
  const deleteSurface = (id: string): BuildingElement['type'] | null => {
    const deletedType = elements[id]?.type ?? null;
    remember(`delete:${id}:${Date.now()}`, `Deleted ${deletedType ?? 'surface'}`);
    setElements((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    return deletedType;
  };

  /** Adds a surface of the given type, returning it so the caller can select it. */
  const createSurface = (type: BuildingElement['type']): BuildingElement => {
    const next = buildNewSurface(type, elements);
    remember(`create:${next.id}`, `Added ${type}`);
    setElements((prev) => ({ ...prev, [next.id]: next }));
    return next;
  };

  /** Replaces roof elements from a new type template.
   *  If any replaced surface had PV installed, sets the invalidation warning. */
  const applyRoofType = (newRoofElements: Record<string, BuildingElement>) => {
    remember(`roof-type:${Date.now()}`, 'Roof type change');
    setElements((prev) => {
      const oldRoofIds = Object.keys(prev).filter((id) => prev[id].type === 'roof');
      const hadPv = oldRoofIds.some((id) => pvArrays[id]?.installed);
      if (hadPv) {
        setPvInvalidated(true);
        setPvArrays((arrays) => {
          const next = { ...arrays };
          oldRoofIds.forEach((id) => { delete next[id]; });
          return next;
        });
      }
      const withoutRoofs = Object.fromEntries(
        Object.entries(prev).filter(([, el]) => el.type !== 'roof'),
      );
      return { ...withoutRoofs, ...newRoofElements };
    });
  };

  const setGen = (key: string, value: any) =>
    setGeneralRaw((prev) => ({ ...prev, [key]: value }));

  // --- Technology handlers ----------------------------------------------------

  /**
   * Applies an edit made against the flat per-surface shape. Module and cost
   * fields reach the building, so every array moves with them; geometry and
   * sizing stay on the array being edited.
   */
  const updateSurfacePv = (elementId: string, patch: Partial<PvConfig>) => {
    const { technology, array } = splitPvPatch(patch);

    if (Object.keys(technology).length > 0) {
      setPvTechnology((prev) => ({ ...prev, ...technology }));
    }
    if (Object.keys(array).length === 0) return;

    setPvArrays((prev) => ({
      ...prev,
      [elementId]: { ...(prev[elementId] ?? createPvArray(elements[elementId])), ...array },
    }));
  };

  /** Edits the building's module and its cost, for every array at once. */
  const updatePvTechnology = (patch: Partial<PvTechnology>) =>
    setPvTechnology((prev) => ({ ...prev, ...patch }));

  const updateBattery = (patch: Partial<BatteryConfig>) =>
    setBatteryConfig((prev) => ({ ...prev, ...patch }));

  const setTechInstalled = (id: string, installed: boolean) => {
    if (id === 'battery') {
      setBatteryConfig((prev) => ({ ...prev, installed }));
      return;
    }
    setOtherTechIds((prev) =>
      installed ? [...prev.filter((i) => i !== id), id] : prev.filter((i) => i !== id),
    );
  };

  // --- Model-wide actions -----------------------------------------------------

  const reset = () => {
    setElements(initialElements);
    setGeneralRaw(initialGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setUploadError(null);
  };

  const buildIdentity = () => {
    const coordinates: [number, number] = geometryData?.coordinates ?? identityData?.coordinates ?? [11.5820, 48.1351];
    return {
      id: identityData?.id ?? 'building-1',
      label: identityData?.label ?? (general.buildingName || identityData?.label || 'Building'),
      coordinates,
      buildingType: general.buildingType,
      constructionYear: general.constructionYear,
      country: general.country,
      floorArea: computeTotalFloorArea(general.floorArea, general.storeys),
      roomHeight: general.roomHeight,
      storeys: general.storeys,
    };
  };

  /**
   * Commits the working draft, then runs a full BuEM simulation through the
   * EnerPlanET backend's per-building BuEM endpoint and feeds the resulting
   * load profile into the overview chart. See enerplanetApi.ts's
   * runBuildingSimulation doc for the request shape and known gaps.
   */
  const runSimulation = async () => {
    const invalid = Object.values(elements).filter(hasInvalidArea);
    if (invalid.length > 0) {
      setUploadError(
        `${invalid.length} surface${invalid.length > 1 ? 's have' : ' has'} no area (${invalid.map((el) => el.label).join(', ')}) — `
        + 'fix or delete them in the Envelope view before running a simulation.',
      );
      return;
    }

    setSavedState({ elements, general, roofConfig });
    const identity = buildIdentity();

    setIsRunningSimulation(true);
    setUploadError(null);
    try {
      const result = await api.enerplanet.runBuildingSimulation(identity, elements, general, identity.id, batteryConfig);
      if (!result) {
        setUploadError('Simulation failed — the EnerPlanET backend is unreachable or rejected the request. See the browser console for details.');
        return;
      }
      setModelTimeseries(result.timeseries);
      setEnergyTotals(computeEnergyTotals(result.timeseries, result.thermalSummary));
    } finally {
      setIsRunningSimulation(false);
    }
  };

  /** Saves a file the browser has just built. */
  const saveFile = (data: BlobPart, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Downloads the current model as a BUEM GeoJSON FeatureCollection. */
  const download = () => {
    try {
      const identity = buildIdentity();
      const buemJson = exportToBuemGeojson(
        identity, elements, general, undefined, undefined, batteryConfig, surfacePvConfigs,
      );
      saveFile(buemJson, `building-${identity.id}-buem.json`, 'application/json');
    } catch (err) {
      setUploadError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /** Downloads the building and its surfaces as CSV tables, zipped together. */
  const downloadTables = () => {
    try {
      const identity = buildIdentity();
      const zip = modelTablesZip(elements, surfacePvConfigs, general, {
        totalEnvelopeArea: totalArea,
        avgUValue,
        heatDemandKwhM2a: ignis?.result?.qHnd ?? null,
      });
      // Same cast the profile download needs: fflate's Uint8Array is not
      // narrowed to an ArrayBuffer-backed view, which BlobPart requires.
      saveFile(zip as BlobPart, `building-${identity.id}-tables.zip`, 'application/zip');
    } catch (err) {
      setUploadError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /** Loads a BUEM GeoJSON, legacy configurator export or EnerPlanET config.json. */
  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const imported = importBuildingData(parsed);

        const normalizedElements = normalizeElementRecord(
          { ...DEFAULT_ELEMENTS, ...imported.elements },
          imported.isBuemFormat ? 'city' : 'default',
        );
        remember(`import:${Date.now()}`, 'Import');
        setElements(normalizedElements);
        setGeneralRaw({ ...DEFAULT_GENERAL, ...imported.general });
        if (isRoofConfig(imported.roofConfig)) setRoofConfig(imported.roofConfig);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setUploadError(
          `Could not parse file: ${msg}. `
          + 'Ensure it is a valid BUEM GeoJSON, legacy configurator export, or EnerPlanET config.json.',
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Derived ----------------------------------------------------------------

  const buildingLabel = general.buildingName || identityData?.label || 'Building';
  const buildingType  = general.buildingType || identityData?.buildingType || '';
  const coordinates: [number, number] = geometryData?.coordinates ?? identityData?.coordinates ?? [11.5820, 48.1351];

  const totalArea = Object.values(elements).reduce((sum, e) => sum + (e.area || 0), 0);
  const avgUValue = totalArea > 0
    ? Object.values(elements).reduce((sum, e) => sum + e.uValue * e.area, 0) / totalArea
    : 0;
  // Prefer a demand-based rating (kWh/(m²·a), matching real EPC-style classification —
  // see thermalRatingStandards.ts for the country-configurable band source) once ignis
  // has a result; fall back to the simpler U-value-based rating otherwise.
  const thermalRating = ignis?.result
    ? getThermalRatingFromDemand(ignis.result.qHnd, general.country as string | undefined)
    : getThermalRating(avgUValue);
  const snapshotRows = buildSnapshotRows(general, elements, totalArea, baselineRef.current);

  // BuEM's confirmed result, or a user-uploaded ground-truth profile compared
  // against it — ignis never substitutes as a competing demand estimate here.
  const displayEnergyTotals: EnergyTotals = useMemo(
    () => resolveDisplayEnergyTotals(energyTotals, groundTruthTimeseries),
    [energyTotals, groundTruthTimeseries],
  );
  /** The flat per-surface configs, resolved from the building's module and
   *  each array's own geometry. */
  const surfacePvConfigs = useMemo(() => Object.fromEntries(
    Object.entries(pvArrays).map(([id, array]) => [id, resolvePvArray(array, pvTechnology, elements[id])]),
  ), [pvArrays, pvTechnology, elements]);

  const pvInstalledSurfaces = useMemo(() => (
    Object.values(elements)
      .filter((element) => surfacePvConfigs[element.id]?.installed)
      .map((element) => ({ element, pv: surfacePvConfigs[element.id] }))
  ), [elements, surfacePvConfigs]);
  const totalPvCapacityKw = pvInstalledSurfaces.reduce((sum, entry) => sum + entry.pv.system_capacity, 0);
  const pvSummary = {
    installed: pvInstalledSurfaces.length > 0,
    surfaceCount: pvInstalledSurfaces.length,
    totalCapacityKw: totalPvCapacityKw,
  };

  // Installed tech IDs — solar_pv is per-surface; battery has its own config state.
  const installedTechIds = batteryConfig.installed
    ? [...otherTechIds.filter((id) => id !== 'battery'), 'battery']
    : otherTechIds.filter((id) => id !== 'battery');

  const chartTimeseries = modelTimeseries ?? thematicData?.timeseries ?? buildingData?.timeseries ?? null;

  /** The building as opened, with the current or last saved edits written into it. */
  const toBuildingState = (source: 'current' | 'saved'): BuildingState | undefined => {
    const edits = source === 'current' ? { elements, general } : { elements: savedState.elements, general: savedState.general };
    const untouched = JSON.stringify(edits) === JSON.stringify({ elements: initialElements, general: initialGeneral });
    if (!buildingData || untouched) return buildingData;
    return withEdits(buildingData, edits.elements, edits.general);
  };

  return {
    // state
    elements, general, roofConfig, surfacePvConfigs, pvTechnology, pvArrays, batteryConfig, ignis,
    uploadError, isRunningSimulation, pvInvalidated, hasUnsavedChanges,
    chartTimeseries,
    /** What undo would take back, or null when there is nothing to undo. */
    undoLabel: history[history.length - 1]?.label ?? null,
    baselineElements: baselineRef.current.elements,
    // derived
    buildingLabel, buildingType, coordinates, totalArea, avgUValue, thermalRating,
    snapshotRows, displayEnergyTotals, pvInstalledSurfaces, totalPvCapacityKw,
    pvSummary, installedTechIds,
    // handlers
    setGen, updateElement, renameElement, deleteSurface, createSurface, applyRoofType,
    updateSurfacePv, updatePvTechnology, updateBattery, setTechInstalled,
    selectIgnisVariant, undo,
    runSimulation, download, downloadTables, upload, reset, toBuildingState,
    setUploadError, setGroundTruthTimeseries, setPvInvalidated,
  };
}

/** The shape initIgnisState/selectVariantLevel read: identity + envelope only. */
function ignisSeedBuilding(
  general: Record<string, any>,
  elements: Record<string, BuildingElement>,
  type: string,
  year: number,
  country: string,
): BuildingState {
  const identity = {
    id: '', label: '', coordinates: [0, 0] as [number, number],
    buildingType: type, constructionYear: year, country,
    floorArea: computeTotalFloorArea(general.floorArea ?? 0, general.storeys ?? 1),
    roomHeight: general.roomHeight ?? 2.5,
    storeys: general.storeys ?? 1,
  };
  return {
    geometry: { buildingId: '', coordinates: [0, 0], buildingFootprint: null, buildingHeight: null },
    thematic: { identity, envelope: elements, thermalSummary: null, timeseries: null },
    technologies: { rawTechs: {}, installedTechIds: [] },
    identity,
    envelope: elements,
    thermalSummary: null,
    timeseries: null,
    installedTechIds: [],
    ignis: null,
  };
}

/**
 * The building with an edited envelope and building parameters written back
 * into it, so reopening it shows the edits. Technologies and results are kept
 * as they were.
 */
export function withEdits(
  building: BuildingState,
  elements: Record<string, BuildingElement>,
  general: typeof DEFAULT_GENERAL,
): BuildingState {
  const base = building.thematic?.identity ?? building.identity;
  const identity = {
    ...base,
    label: general.buildingName || base.label,
    buildingType: general.buildingType,
    constructionYear: general.constructionYear,
    country: general.country,
    floorArea: computeTotalFloorArea(general.floorArea, general.storeys),
    roomHeight: general.roomHeight,
    storeys: general.storeys,
  };
  return {
    ...building,
    thematic: { ...building.thematic, identity, envelope: elements },
    identity,
    envelope: elements,
  };
}
