// The building's editable model: envelope, general parameters,
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
} from './configure/model/buildingElements';
import { type RoofConfig, DEFAULT_ROOF_CONFIG } from './configure/model/roof';
import { type EnergyTotals, type LoadDataPoint } from '../../lib/loadProfile';
import { DEFAULT_ELEMENTS, DEFAULT_GENERAL, computeTotalFloorArea, generalFrom } from './shared/buildingDefaults';
import { requiresResidentialUnits, yearToConstructionPeriod } from './shared/buildingOptions';
import type { BuildingState, ThermalSummary } from '../../lib/buemAdapter';
import { exportToBuemGeojson, importBuildingData } from '../../lib/buemAdapter';
import type { IgnisState } from '../../lib/ignisAdapter';
import {
  initIgnisState,
  selectVariantLevel,
  restoreDefaultUValues,
  resetElementsToVariantDefaults,
} from '../../lib/ignisAdapter';
import { calculateHeatDemand, loadVariantLevels } from '../../lib/heatDemand';
import { applyState, startingStates, variantSubtype, type RefurbElementType } from '../../lib/refurbishment';
import { runBuildingSimulation, runIdentity, type RunContext } from '../../lib/buemRun';
import { toThermalSummary, type BuildingDemandProfile } from '../../lib/demandProfile';
import type { ConfiguratorServices } from '../../lib/services';
import type { Language, Message } from '../../i18n';
import { getThermalRating, buildSnapshotRows, type SnapshotBaseline } from './shared/snapshotUtils';
import { modelTablesZip } from './shared/modelExport';
import { getThermalRatingFromDemand } from '@/app/config/thermalRatingStandards';

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
  // dhw, kitchen and the combined total come only from a summary. An uploaded
  // ground-truth CSV has no such columns and no summary, so they read '—'.
  const dhw     = thermalSummary ? formatKwh(thermalSummary.dhwKwh) : '—';
  const kitchen = thermalSummary?.kitchenGasKwh !== undefined ? formatKwh(thermalSummary.kitchenGasKwh) : '—';
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
    heatingComparisonLabel: heatingKwh > 0 ? 'model.comparison.lastRun' : undefined,
    electricityDeltaPercent,
    electricityBaselineKwh: electricityKwh > 0 ? formatKwh(electricityKwh) : undefined,
    electricityComparisonLabel: electricityKwh > 0 ? 'model.comparison.lastRun' : undefined,
    hotwaterDeltaPercent,
    hotwaterBaselineKwh: hotwaterKwh > 0 ? formatKwh(hotwaterKwh) : undefined,
    hotwaterComparisonLabel: hotwaterKwh > 0 ? 'model.comparison.lastRun' : undefined,
  };
}

/** How long consecutive edits of the same field fold into one undo step, so a
 *  dragged slider is one change rather than one per pixel. */
const UNDO_COALESCE_MS = 900;
const UNDO_DEPTH = 30;

interface EnvelopeHistoryEntry {
  elements: Record<string, BuildingElement>;
  /** What the step did, for the undo button: a model.history message, e.g. "deleted wall". */
  label: Message;
  /** Identifies the edit for coalescing: same key in quick succession is one step. */
  key: string;
  at: number;
}

/** The model.history.field message for a surface field an edit changed. */
const HISTORY_FIELDS = new Set(['area', 'uValue', 'tilt', 'azimuth', 'gValue', 'label']);

export type BuildingModel = ReturnType<typeof useBuildingModel>;

/**
 * `estimateHeatDemand` runs the annual demand alongside the model. Off for a
 * caller that shows no such figure: the heat demand service then only serves
 * TABULA variants and their U-values, and no request is made per envelope
 * edit. `runContext` is the period a BuEM run covers. `demandProfile` is the
 * building's stored demand; when present its totals replace the building's own.
 */
export function useBuildingModel(
  services: ConfiguratorServices,
  buildingData?: BuildingState,
  { estimateHeatDemand = true, runContext, demandProfile, language = 'en' }: {
    estimateHeatDemand?: boolean;
    runContext?: RunContext;
    demandProfile?: BuildingDemandProfile | null;
    /** The language the snapshot rows' numbers are written in. */
    language?: Language;
  } = {},
) {
  const thematicData = buildingData?.thematic;
  const geometryData = buildingData?.geometry;
  const identityData = thematicData?.identity ?? buildingData?.identity;

  const initialGeneral = generalFrom(buildingData);

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
  const [uploadError,   setUploadError]   = useState<Message | null>(null);
  // Envelope edits only: what a user changes by hand and may want back. Building
  // parameters are not in it.
  const [history, setHistory] = useState<EnvelopeHistoryEntry[]>([]);

  // HDCP annual heat demand state — null until the building's country/type/period
  // resolve to at least one TABULA variant in the HDCP service.
  const [ignis, setHdcp] = useState<IgnisState | null>(null);
  // The state per element type the surfaces' loaded U-values stand for; a
  // type back at this state returns to them rather than to TABULA's values.
  const [refurbInitial, setRefurbInitial] = useState(() => startingStates(initialGeneral.refurbishment));

  const [savedState,      setSavedState]      = useState({ elements: initialElements, general: initialGeneral, roofConfig: DEFAULT_ROOF_CONFIG });
  // The building as opened, after the load-time TABULA pass below: what counts
  // as untouched, so opening and leaving hands the host its building back.
  const [loaded, setLoaded] = useState({ elements: initialElements, general: initialGeneral });
  const [energyTotals,    setEnergyTotals]    = useState<EnergyTotals>(initialEnergyTotals);
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

    const nextGeneral = generalFrom(buildingData);

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
    setLoaded({ elements: nextElements, general: nextGeneral });
    setRefurbInitial(startingStates(nextGeneral.refurbishment));
    setEnergyTotals(nextTotals);
    setUploadError(null);
    setHistory([]);
  }, [buildingData]);

  // After the effect above, so a stored profile wins over the building's own summary.
  useEffect(() => {
    if (demandProfile) setEnergyTotals(computeEnergyTotals(null, toThermalSummary(demandProfile)));
  }, [demandProfile]);

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
    // City2TABULA's subtype holds for the building as loaded, not for a
    // classification changed by hand.
    const subtype = isFirstClassificationLoad.current ? variantSubtype(general.refurbishment.variantCode) : undefined;

    (async () => {
      const variants = await loadVariantLevels(services, country, type, year, subtype);
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
      // Another classification is another building: existing state everywhere.
      if (!cancelled && isReload) {
        setRefurbInitial(startingStates(undefined));
        setGeneralRaw((prev) => ({ ...prev, refurbishment: {} }));
      }

      if (isReload && existingStateData.A_C_Ref_Input) {
        const nextFloorArea = existingStateData.A_C_Ref_Input / Math.max(1, general.storeys ?? 1);
        if (!cancelled) setGeneralRaw((prev) => ({ ...prev, floorArea: nextFloorArea }));
      }

      // TABULA's dwelling count prefills BuEM's residential_units: on load only
      // when the building brings none, on a hand-edited classification always.
      // 0 means TABULA gives no count.
      const dwellings = existingStateData.n_Apartment;
      if (!cancelled && dwellings) {
        setGeneralRaw((prev) => (
          prev.residential_units && !isReload ? prev : { ...prev, residential_units: dwellings }
        ));
      }

      // What the load pass changed is part of opening the building, not an edit.
      if (!cancelled && !isReload) {
        const settledGeneral = dwellings && !general.residential_units
          ? { ...general, residential_units: dwellings }
          : general;
        setLoaded({ elements: nextElements, general: settledGeneral });
        setSavedState((prev) => ({ ...prev, elements: nextElements, general: settledGeneral }));
      }

      const state = initIgnisState(country, type, period, variants, ignisSeedBuilding(general, nextElements, type, year, country));
      if (!cancelled) setHdcp(state);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [general.country, general.buildingType, general.constructionYear]);

  // ── HDCP: auto-recalculate (debounced) when calcDemand changes ────────────────
  useEffect(() => {
    if (!ignis || !estimateHeatDemand) return;

    const variant = ignis.variants[ignis.selectedVariantIndex];
    if (!variant) return;

    setHdcp((prev) => prev ? { ...prev, loading: true, error: null } : prev);

    const timer = setTimeout(async () => {
      const result = await calculateHeatDemand(services, variant.code, ignis.calcDemand);
      setHdcp((prev) => {
        if (!prev) return prev;
        if (result) return { ...prev, loading: false, result: { qHnd: result.q_h_nd, unit: 'kWh/(m2.a)' } };
        return { ...prev, loading: false, error: 'ignis service unavailable' };
      });
    }, 500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignis?.calcDemand, ignis?.selectedVariantIndex, estimateHeatDemand]);

  /** Each element type's refurbishment state now. */
  const refurbStates = startingStates(general.refurbishment);

  /**
   * Sets the element types to a TABULA variant. Surfaces set by hand keep
   * their U-value; the state is saved with the building.
   */
  const setRefurbishment = (types: RefurbElementType[], number: number) => {
    const levels = ignis?.variants ?? [];
    const nextElements = types.reduce(
      (acc, type) => applyState(acc, type, refurbStates[type], number, refurbInitial, levels),
      elements,
    );
    if (nextElements !== elements) {
      remember(`refurbishment:${Date.now()}`, { key: 'model.history.refurbishment' });
      setElements(nextElements);
    }
    const states = { ...refurbStates, ...Object.fromEntries(types.map((type) => [type, number])) };
    setGen('refurbishment', { ...general.refurbishment, states });
    // ignis's annual demand follows the building-wide preset.
    const index = levels.findIndex((level) => level.number === number);
    if (ignis && index >= 0 && types.length > 1) {
      setHdcp(selectVariantLevel(ignis, index, ignisSeedBuilding(
        general, nextElements, general.buildingType, general.constructionYear, general.country,
      )));
    }
  };

  /** Gives every surface of the type one U-value, e.g. from a per-type field in Expert. */
  const setTypeUValue = (type: RefurbElementType, uValue: number) => {
    remember(`type-u:${type}`, { key: 'model.history.field.uValue' });
    setElements((prev) => Object.fromEntries(Object.entries(prev).map(([id, el]) => [
      id, el.type === type ? { ...el, uValue, customMode: true } : el,
    ])));
  };

  /**
   * Gives every surface of the type one loss factor (BuEM b_transmission,
   * 0 to 1). Party walls, at 0, keep it: they are set surface by surface.
   */
  const setTypeLossFactor = (type: RefurbElementType, bTransmission: number) => {
    remember(`type-b:${type}`, { key: 'model.history.lossFactor' });
    setElements((prev) => Object.fromEntries(Object.entries(prev).map(([id, el]) => [
      id, el.type === type && el.bTransmission !== 0 ? { ...el, bTransmission, customMode: true } : el,
    ])));
  };

  // --- Envelope history -------------------------------------------------------

  /** Records the envelope as it is now, so the next change can be undone. */
  const remember = (key: string, label: Message) => {
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
    remember(`update:${id}:${field}`, { key: HISTORY_FIELDS.has(field) ? `model.history.field.${field}` : 'model.history.field.surface' });
    setElements((prev) => {
      const current = prev[id];
      if (!current) return prev;
      // Auto-activate custom mode on first edit so the data model tracks the change.
      return { ...prev, [id]: { ...current, ...patch, customMode: true } };
    });
  };

  /** Puts a surface back as it was, e.g. when its editor's changes are discarded. */
  const restoreElement = (element: BuildingElement) => {
    remember(`restore:${element.id}`, { key: 'model.history.discarded' });
    setElements((prev) => (prev[element.id] ? { ...prev, [element.id]: element } : prev));
  };

  // Label is display-only — rename is always allowed regardless of custom mode.
  const renameElement = (id: string, label: string) => {
    remember(`rename:${id}`, { key: 'model.history.field.label' });
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
    remember(`delete:${id}:${Date.now()}`, { key: `model.history.deleted.${deletedType ?? 'surface'}` });
    setElements((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    return deletedType;
  };

  /**
   * Adds a surface of the given type, with `values` over the defaults, and
   * returns it so the caller can select it.
   */
  const createSurface = (type: BuildingElement['type'], values: Partial<BuildingElement> = {}): BuildingElement => {
    const next = { ...buildNewSurface(type, elements), ...values };
    remember(`create:${next.id}`, { key: `model.history.added.${type}` });
    setElements((prev) => ({ ...prev, [next.id]: next }));
    return next;
  };

  /** Replaces roof elements from a new type template. */
  const applyRoofType = (newRoofElements: Record<string, BuildingElement>) => {
    remember(`roof-type:${Date.now()}`, { key: 'model.history.roofType' });
    setElements((prev) => {
      const withoutRoofs = Object.fromEntries(
        Object.entries(prev).filter(([, el]) => el.type !== 'roof'),
      );
      return { ...withoutRoofs, ...newRoofElements };
    });
  };

  const setGen = (key: string, value: any) =>
    setGeneralRaw((prev) => ({ ...prev, [key]: value }));

  // --- Model-wide actions -----------------------------------------------------

  const reset = () => {
    setElements(initialElements);
    setGeneralRaw(initialGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setUploadError(null);
  };

  const buildIdentity = () => runIdentity(buildingData, general);

  /**
   * Commits the working draft, then runs it through BuEM via the host and
   * shows the stored totals the host returns.
   */
  const runSimulation = async () => {
    if (requiresResidentialUnits(general.buildingType) && !general.residential_units) {
      setUploadError({ key: 'model.error.dwellingsRequired' });
      return;
    }

    setSavedState({ elements, general, roofConfig });
    const identity = buildIdentity();

    setIsRunningSimulation(true);
    setUploadError(null);
    try {
      const result = await runBuildingSimulation(services, identity, elements, general, runContext);
      if (!result) {
        setUploadError({ key: 'model.error.runFailed' });
        return;
      }
      setEnergyTotals(computeEnergyTotals(null, toThermalSummary(result)));
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
        identity, elements, general,
      );
      saveFile(buemJson, `building-${identity.id}-buem.json`, 'application/json');
    } catch (err) {
      setUploadError({ key: 'model.error.exportFailed', values: { reason: err instanceof Error ? err.message : String(err) } });
    }
  };

  /** Downloads the building and its surfaces as CSV tables, zipped together. */
  const downloadTables = () => {
    try {
      const identity = buildIdentity();
      const zip = modelTablesZip(elements, general, {
        totalEnvelopeArea: totalArea,
        avgUValue,
        heatDemandKwhM2a: ignis?.result?.qHnd ?? null,
      });
      // fflate's Uint8Array is not narrowed to an ArrayBuffer-backed view,
      // which BlobPart requires.
      saveFile(zip as BlobPart, `building-${identity.id}-tables.zip`, 'application/zip');
    } catch (err) {
      setUploadError({ key: 'model.error.exportFailed', values: { reason: err instanceof Error ? err.message : String(err) } });
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
        remember(`import:${Date.now()}`, { key: 'model.history.import' });
        setElements(normalizedElements);
        setGeneralRaw({ ...DEFAULT_GENERAL, ...imported.general });
        if (isRoofConfig(imported.roofConfig)) setRoofConfig(imported.roofConfig);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setUploadError({ key: 'model.error.importFailed', values: { reason: msg } });
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
  const snapshotRows = buildSnapshotRows(general, elements, totalArea, language, baselineRef.current);

  // BuEM's confirmed result, or a user-uploaded ground-truth profile compared
  // against it — ignis never substitutes as a competing demand estimate here.
  const displayEnergyTotals: EnergyTotals = useMemo(
    () => resolveDisplayEnergyTotals(energyTotals, groundTruthTimeseries),
    [energyTotals, groundTruthTimeseries],
  );
  const chartTimeseries = thematicData?.timeseries ?? buildingData?.timeseries ?? null;

  /** The building as opened, with the current or last saved edits written into it. */
  const toBuildingState = (source: 'current' | 'saved'): BuildingState | undefined => {
    const edits = source === 'current'
      ? { elements, general }
      : { elements: savedState.elements, general: savedState.general };
    const untouched = JSON.stringify(edits) === JSON.stringify(loaded);
    if (!buildingData || untouched) return buildingData;
    return withEdits(buildingData, edits.elements, edits.general);
  };

  return {
    // state
    elements, general, roofConfig, ignis,
    refurbStates, refurbInitial,
    uploadError, isRunningSimulation, hasUnsavedChanges,
    chartTimeseries,
    /** What undo would take back, or null when there is nothing to undo. */
    undoLabel: history[history.length - 1]?.label ?? null,
    baselineElements: baselineRef.current.elements,
    // derived
    buildingLabel, buildingType, coordinates, totalArea, avgUValue, thermalRating,
    snapshotRows, displayEnergyTotals,
    // handlers
    setGen, updateElement, restoreElement, renameElement, deleteSurface, createSurface, applyRoofType,
    setRefurbishment, setTypeUValue, setTypeLossFactor, undo,
    runSimulation, download, downloadTables, upload, reset, toBuildingState,
    setUploadError, setGroundTruthTimeseries,
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
    identity,
    envelope: elements,
    thermalSummary: null,
    timeseries: null,
    ignis: null,
  };
}

/**
 * The building with the edited envelope and building parameters written back
 * into it, so reopening it shows the edits. Results are kept as they were.
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
    refurbishment: general.refurbishment,
    parameters: {
      n_air_infiltration:      general.n_air_infiltration,
      n_air_use:               general.n_air_use,
      c_m:                     general.c_m,
      massClass:               general.massClass,
      comfortT_lb:             general.comfortT_lb,
      comfortT_ub:             general.comfortT_ub,
      window_to_wall_ratio:    general.window_to_wall_ratio,
      window_U:                general.window_U,
      window_g_gl:             general.window_g_gl,
      use_milp:                general.use_milp,
      residential_units:       general.residential_units,
      num_persons:             general.num_persons,
      archetype:               general.archetype,
      region_code:             general.region_code,
      cooking_carrier:         general.cooking_carrier,
      include_dhw:             general.include_dhw,
      setback_profile:         general.setback_profile,
      capacity:                general.capacity,
      equipment:               general.equipment,
      outputs:                 general.outputs,
    },
  };
}
