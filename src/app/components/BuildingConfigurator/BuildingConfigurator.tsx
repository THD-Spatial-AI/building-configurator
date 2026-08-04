// Main building configurator panel.
// Owns all application state and handlers; delegates rendering to sub-components.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Download, Upload, X, Building2, RotateCcw, Check, AlertTriangle,
} from 'lucide-react';

import type { BuildingElement } from './configure/model/buildingElements';
import {
  isElementEditable,
  normalizeElementRecord,
} from './configure/model/buildingElements';
import { type RoofConfig, DEFAULT_ROOF_CONFIG } from './configure/model/roof';
import { SegmentedControl, ConfiguratorStyles, ElementConfiguratorModal } from './shared/ui';
import { cn } from '../../../lib/utils';
import { type EnergyTotals, type LoadDataPoint } from '../../lib/loadProfile';

import { DEFAULT_ELEMENTS, DEFAULT_GENERAL, computeTotalFloorArea } from './shared/buildingDefaults';
import type { BuildingState, ThermalSummary } from '../../lib/buemAdapter';
import {
  formatCoordinates,
  exportToBuemGeojson,
  importBuildingData,
} from '../../lib/buemAdapter';
import { runBuildingSimulation } from '../../lib/buemApi';
import type { IgnisState } from '../../lib/ignisAdapter';
import {
  initIgnisState,
  selectVariantLevel,
  syncElementsWithVariantLevel,
  restoreDefaultUValues,
  resetElementsToVariantDefaults,
} from '../../lib/ignisAdapter';
import {
  loadVariantLevels,
  calculateHeatDemand,
} from '../../lib/ignisApi';
import {
  getThermalRating,
  buildSnapshotRows,
  type SnapshotBaseline,
} from './shared/snapshotUtils';
import { getThermalRatingFromDemand } from '@/app/config/thermalRatingStandards';
import { ELEMENT_GROUP_LABELS, type ElementGroupKey } from './shared/elementListUtils';
import { BuildingSnapshotAside } from './overview/BuildingSnapshotAside';
import { EnergyEnvelopeColumn } from './overview/EnergyEnvelopeColumn';
import { SurfaceGroupGrid } from './configure/surfaces/SurfaceGroupGrid';
import { SurfaceGroupEditor } from './configure/surfaces/SurfaceGroupEditor';
import { BuildingEditor } from './configure/building/BuildingEditor';
import { PvSurfaceManager } from './configure/pv/PvSurfaceManager';
import { BatteryEditor } from './configure/pv/BatteryEditor';
import { createSurfacePvConfig, DEFAULT_BATTERY_CONFIG } from './shared/buildingDefaults';
import type { PvConfig, BatteryConfig } from './shared/buildingDefaults';
import { TECH_REGISTRY } from '../../config/techRegistry';

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



// --- Energy totals helper -----------------------------------------------------

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
  if (timeseries && timeseries.length > 0) {
    return {
      heating:     formatKwh(timeseries.reduce((s, p) => s + p.heating,     0)),
      electricity: formatKwh(timeseries.reduce((s, p) => s + p.electricity, 0)),
      hotwater:    formatKwh(timeseries.reduce((s, p) => s + p.hotwater,    0)),
      unit: 'kWh/year',
    };
  }
  if (thermalSummary) {
    return {
      heating:     thermalSummary.heatingKwh.toFixed(0),
      electricity: thermalSummary.electricityKwh.toFixed(0),
      hotwater:    thermalSummary.coolingKwh.toFixed(0),
      unit: 'kWh/year',
    };
  }
  return { electricity: '—', heating: '—', hotwater: '—', unit: 'kWh/year' };
}

/**
 * Raw (unformatted) BuEM baseline annual heating figure, in kWh — the "last
 * full simulation" reference point that a live ignis recalculation is
 * compared against. Same source priority as computeEnergyTotals, but returns
 * a number for arithmetic rather than a display string.
 */
function baselineHeatingKwh(
  timeseries: LoadDataPoint[] | null,
  thermalSummary: ThermalSummary | null,
): number | null {
  if (timeseries && timeseries.length > 0) {
    return timeseries.reduce((s, p) => s + p.heating, 0);
  }
  if (thermalSummary) return thermalSummary.heatingKwh;
  return null;
}

/**
 * Resolves what the three energy cards should actually show, given every
 * source that might feed them: BuEM's last confirmed run, ignis's live
 * heating estimate (heating only — ignis has no electricity/cooling model),
 * and — if the user uploaded one — a real load profile. An uploaded profile
 * is real data, not a model guess, so it outranks both as the headline
 * number; the model outputs then become the thing being compared *against*
 * it instead of the other way around.
 */
function resolveDisplayEnergyTotals(
  energyTotals: EnergyTotals,
  groundTruthTimeseries: LoadDataPoint[] | null,
  ignisResult: { qHnd: number } | null | undefined,
  totalFloorArea: number,
  buemBaselineHeatingKwh: number | null,
  isHeatingConfirmed: boolean,
): EnergyTotals {
  const groundTruth = groundTruthTimeseries ? computeEnergyTotals(groundTruthTimeseries, null) : null;

  const ignisHeatingKwh = ignisResult && totalFloorArea > 0 ? ignisResult.qHnd * totalFloorArea : null;
  const currentHeatingKwh = ignisHeatingKwh === null || isHeatingConfirmed ? Number(energyTotals.heating) : ignisHeatingKwh;
  const currentHeatingSource: 'ignis' | 'buem' = ignisHeatingKwh === null || isHeatingConfirmed ? 'buem' : 'ignis';
  const currentHeatingPerM2 = ignisHeatingKwh !== null && !isHeatingConfirmed ? ignisResult!.qHnd.toFixed(1) : undefined;

  if (groundTruth) {
    // Ground truth always wins as the headline — compare whichever model
    // figure is "current" right now (ignis's live estimate, or BuEM's
    // confirmed result once Recalculate has run) against it.
    const heatingRefKwh = currentHeatingKwh > 0
      ? ((Number(groundTruth.heating) - currentHeatingKwh) / currentHeatingKwh) * 100
      : null;
    const electricityKwh = Number(energyTotals.electricity);
    const electricityDeltaPercent = electricityKwh > 0
      ? ((Number(groundTruth.electricity) - electricityKwh) / electricityKwh) * 100
      : null;
    const hotwaterKwh = Number(energyTotals.hotwater);
    const hotwaterDeltaPercent = hotwaterKwh > 0
      ? ((Number(groundTruth.hotwater) - hotwaterKwh) / hotwaterKwh) * 100
      : null;
    const heatingLabel = currentHeatingSource === 'ignis' ? "ignis's live estimate" : 'the last full simulation';

    return {
      ...groundTruth,
      heatingSource: 'user',
      electricitySource: 'user',
      hotwaterSource: 'user',
      heatingDeltaPercent: heatingRefKwh,
      heatingBaselineKwh: currentHeatingKwh > 0 ? formatKwh(currentHeatingKwh) : undefined,
      heatingComparisonLabel: currentHeatingKwh > 0 ? heatingLabel : undefined,
      electricityDeltaPercent,
      electricityBaselineKwh: electricityKwh > 0 ? formatKwh(electricityKwh) : undefined,
      electricityComparisonLabel: electricityKwh > 0 ? 'the last full simulation' : undefined,
      hotwaterDeltaPercent,
      hotwaterBaselineKwh: hotwaterKwh > 0 ? formatKwh(hotwaterKwh) : undefined,
      hotwaterComparisonLabel: hotwaterKwh > 0 ? 'the last full simulation' : undefined,
    };
  }

  if (ignisHeatingKwh === null) return energyTotals;

  if (isHeatingConfirmed) {
    // Right after Recalculate, with no edits since, energyTotals.heating is
    // already BuEM's confirmed result for the current inputs — show that
    // instead of ignis's fast estimate, since it's the number the user just
    // ran a real physics simulation to get.
    return { ...energyTotals, heatingSource: 'buem', heatingDeltaPercent: null, heatingPerM2: undefined };
  }

  const heatingDeltaPercent = buemBaselineHeatingKwh && buemBaselineHeatingKwh > 0
    ? ((ignisHeatingKwh - buemBaselineHeatingKwh) / buemBaselineHeatingKwh) * 100
    : null;

  return {
    ...energyTotals,
    heating: formatKwh(ignisHeatingKwh),
    heatingSource: 'ignis',
    heatingDeltaPercent,
    heatingPerM2: currentHeatingPerM2,
    heatingBaselineKwh: buemBaselineHeatingKwh && buemBaselineHeatingKwh > 0 ? formatKwh(buemBaselineHeatingKwh) : undefined,
    heatingComparisonLabel: 'the last full simulation',
  };
}

// --- Header icon button (local — only used in this file) ----------------------

function HeaderBtn({
  onClick, children, tooltip,
}: { onClick?: () => void; children: React.ReactNode; tooltip?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className="size-7 flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted transition-colors duration-100 shrink-0 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

// --- Component ----------------------------------------------------------------

interface BuildingConfiguratorProps {
  onClose?: () => void;
  /** Pre-parsed model data for a specific building. Falls back to hardcoded defaults when absent. */
  buildingData?: BuildingState;
}

/** Full-screen panel for inspecting and editing a building's energy model configuration. */
export function BuildingConfigurator({ onClose, buildingData }: BuildingConfiguratorProps) {
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
    constructionPeriod: identityData?.constructionPeriod ?? DEFAULT_GENERAL.constructionPeriod,
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

  const initialBaselineHeatingKwh = baselineHeatingKwh(
    thematicData?.timeseries ?? buildingData?.timeseries ?? null,
    thematicData?.thermalSummary ?? buildingData?.thermalSummary ?? null,
  );

  const [mode,          setMode]          = useState<'basic' | 'expert'>('basic');
  const [elements,      setElements]      = useState(initialElements);
  const [general,       setGeneralRaw]    = useState(initialGeneral);
  const [roofConfig,    setRoofConfig]    = useState<RoofConfig>(DEFAULT_ROOF_CONFIG);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [surfaceEditorTab, setSurfaceEditorTab] = useState<'properties' | 'pv'>('properties');
  // null = element configurator modal closed; a panel name opens it on that content.
  const [panelView,     setPanelView]     = useState<string | null>(null);
  /** The group type currently driving the surface-group grid in the center panel. */
  const [activeGroupType, setActiveGroupType] = useState<ElementGroupKey | null>(null);
  /** Whether the roof-type accordion is expanded while editing a roof surface. */
  // Per-surface PV configurations — keyed by element ID.
  const [surfacePvConfigs, setSurfacePvConfigs] = useState<Record<string, PvConfig>>({});
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

  // HDCP annual heat demand state — null until the building's country/type/period
  // resolve to at least one TABULA variant in the HDCP service.
  const [ignis, setHdcp] = useState<IgnisState | null>(null);

  const [savedState,      setSavedState]      = useState({ elements: initialElements, general: initialGeneral, roofConfig: DEFAULT_ROOF_CONFIG });
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [energyTotals,    setEnergyTotals]    = useState<EnergyTotals>(initialEnergyTotals);
  // The last full BuEM simulation's annual heating figure — a fixed reference point.
  // Set once per loaded building; does not change as the user edits ignis inputs.
  const [buemBaselineHeatingKwh, setBuemBaselineHeatingKwh] = useState<number | null>(initialBaselineHeatingKwh);
  // Hourly timeseries from the most recent live buem-gateway run this session — takes
  // priority over whatever timeseries the buildingData prop originally carried.
  const [modelTimeseries, setModelTimeseries] = useState<LoadDataPoint[] | null>(null);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  // True right after Recalculate, for as long as the ignis live estimate hasn't
  // moved since — meaning BuEM's just-fetched result still reflects the current
  // inputs and can be shown as the headline number instead of ignis's estimate.
  const [isHeatingConfirmed, setIsHeatingConfirmed] = useState(false);
  // A user-uploaded load profile, if any — outranks both ignis and BuEM as
  // the annual totals' source, since it's real data rather than a model output.
  const [groundTruthTimeseries, setGroundTruthTimeseries] = useState<LoadDataPoint[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      constructionPeriod: buildingData.thematic.identity.constructionPeriod,
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
    const nextBaselineHeatingKwh = baselineHeatingKwh(
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
    setBuemBaselineHeatingKwh(nextBaselineHeatingKwh);
    setSelectedId(null);
    setActiveGroupType(null);
    setSurfaceEditorTab('properties');
    setPanelView(null);
    setUploadError(null);
    setSurfacePvConfigs({});
    setPvInvalidated(false);
    setOtherTechIds(buildingData.technologies.installedTechIds.filter((id) => id !== 'solar_pv' && id !== 'battery'));
    setBatteryConfig(DEFAULT_BATTERY_CONFIG);
  }, [buildingData]);

  const hasUnsavedChanges = JSON.stringify({ elements, general, roofConfig }) !== JSON.stringify(savedState);

  // ── HDCP: reload variant levels when building classification changes ───────────
  // Triggered by country, building type, or construction period changes.
  // Resets HDCP state so stale results are not shown for a different building.
  useEffect(() => {
    const country = general.country as string | undefined;
    const type    = general.buildingType as string | undefined;
    const period  = general.constructionPeriod as string | undefined;

    if (!country || !type || !period) {
      setHdcp(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const variants = await loadVariantLevels(country, type, period);
      if (cancelled || variants.length === 0) {
        if (!cancelled) setHdcp(null);
        return;
      }

      // Only reload TABULA defaults (envelope U-values, floor area) when the user hand-edits
      // type/period/country for a building that's already loaded — not for the load itself,
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

      const building: BuildingState = {
        geometry: { buildingId: '', coordinates: [0, 0], buildingFootprint: null, buildingHeight: null },
        thematic: { identity: { id: '', label: '', coordinates: [0, 0], buildingType: type, constructionPeriod: period, country, floorArea: computeTotalFloorArea(general.floorArea ?? 0, general.storeys ?? 1), roomHeight: general.roomHeight ?? 2.5, storeys: general.storeys ?? 1 }, envelope: nextElements, thermalSummary: null, timeseries: null },
        technologies: { rawTechs: {}, installedTechIds: [] },
        identity: { id: '', label: '', coordinates: [0, 0], buildingType: type, constructionPeriod: period, country, floorArea: computeTotalFloorArea(general.floorArea ?? 0, general.storeys ?? 1), roomHeight: general.roomHeight ?? 2.5, storeys: general.storeys ?? 1 },
        envelope: nextElements,
        thermalSummary: null,
        timeseries: null,
        installedTechIds: [],
        ignis: null,
      };

      const state = initIgnisState(country, type, period, variants, building);
      if (!cancelled) setHdcp(state);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [general.country, general.buildingType, general.constructionPeriod]);

  // ── HDCP: auto-recalculate (debounced) when calcDemand changes ────────────────
  useEffect(() => {
    if (!ignis) return;

    const variant = ignis.variants[ignis.selectedVariantIndex];
    if (!variant) return;

    setHdcp((prev) => prev ? { ...prev, loading: true, error: null } : prev);

    const timer = setTimeout(async () => {
      const result = await calculateHeatDemand(variant.code, ignis.calcDemand);
      setHdcp((prev) => {
        if (!prev) return prev;
        if (result) return { ...prev, loading: false, result: { qHnd: result.q_h_nd, unit: 'kWh/(m2.a)' } };
        return { ...prev, loading: false, error: 'HDCP service unavailable' };
      });
    }, 500);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignis?.calcDemand, ignis?.selectedVariantIndex]);

  // A fresh ignis result means the building's inputs moved since the last
  // Recalculate — the BuEM figure on screen is no longer guaranteed current,
  // so fall back to showing ignis's live estimate until the user confirms
  // it again with another Recalculate.
  useEffect(() => {
    setIsHeatingConfirmed(false);
  }, [ignis?.result]);

  // ── HDCP handlers ─────────────────────────────────────────────────────────────

  const handleIgnisVariantSelect = (index: number) => {
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
    if (nextElements !== elements) setElements(nextElements);

    const building: BuildingState = {
      geometry: { buildingId: '', coordinates: [0, 0], buildingFootprint: null, buildingHeight: null },
      thematic: { identity: { id: '', label: '', coordinates: [0, 0], buildingType: general.buildingType, constructionPeriod: general.constructionPeriod, country: general.country, floorArea: computeTotalFloorArea(general.floorArea ?? 0, general.storeys ?? 1), roomHeight: general.roomHeight ?? 2.5, storeys: general.storeys ?? 1 }, envelope: nextElements, thermalSummary: null, timeseries: null },
      technologies: { rawTechs: {}, installedTechIds: [] },
      identity: { id: '', label: '', coordinates: [0, 0], buildingType: general.buildingType, constructionPeriod: general.constructionPeriod, country: general.country, floorArea: computeTotalFloorArea(general.floorArea ?? 0, general.storeys ?? 1), roomHeight: general.roomHeight ?? 2.5, storeys: general.storeys ?? 1 },
      envelope: nextElements,
      thermalSummary: null,
      timeseries: null,
      installedTechIds: [],
      ignis: null,
    };
    setHdcp(selectVariantLevel(ignis, index, building));
  };

  const handleIgnisPeriodOverride = (period: string) => {
    const country = general.country as string | undefined;
    const type    = general.buildingType as string | undefined;
    if (!country || !type) return;

    setHdcp(null);

    (async () => {
      const variants = await loadVariantLevels(country, type, general.constructionPeriod, period);
      if (variants.length === 0) return;

      // A period override is always a deliberate reclassification — reload this variant's
      // own "existing state" TABULA envelope and floor area, same as a type/country change.
      const existingStateData = variants[0]?.data ?? {};
      const nextElements = resetElementsToVariantDefaults(elements, existingStateData);
      if (nextElements !== elements) setElements(nextElements);
      if (existingStateData.A_C_Ref_Input) {
        const nextFloorArea = existingStateData.A_C_Ref_Input / Math.max(1, general.storeys ?? 1);
        setGeneralRaw((prev) => ({ ...prev, floorArea: nextFloorArea }));
      }

      const building: BuildingState = {
        geometry: { buildingId: '', coordinates: [0, 0], buildingFootprint: null, buildingHeight: null },
        thematic: { identity: { id: '', label: '', coordinates: [0, 0], buildingType: type, constructionPeriod: period, country, floorArea: computeTotalFloorArea(general.floorArea ?? 0, general.storeys ?? 1), roomHeight: general.roomHeight ?? 2.5, storeys: general.storeys ?? 1 }, envelope: nextElements, thermalSummary: null, timeseries: null },
        technologies: { rawTechs: {}, installedTechIds: [] },
        identity: { id: '', label: '', coordinates: [0, 0], buildingType: type, constructionPeriod: period, country, floorArea: computeTotalFloorArea(general.floorArea ?? 0, general.storeys ?? 1), roomHeight: general.roomHeight ?? 2.5, storeys: general.storeys ?? 1 },
        envelope: nextElements,
        thermalSummary: null,
        timeseries: null,
        installedTechIds: [],
        ignis: null,
      };

      setHdcp(initIgnisState(country, type, period, variants, building));
    })();
  };

  // --- Handlers ---------------------------------------------------------------

  const updateElement = (id: string, patch: Partial<BuildingElement>) =>
    setElements((prev) => {
      const current = prev[id];
      if (!current) return prev;
      // Auto-activate custom mode on first edit so the data model tracks the change.
      return { ...prev, [id]: { ...current, ...patch, customMode: true } };
    });

  // Label is display-only — rename is always allowed regardless of custom mode.
  const renameElement = (id: string, label: string) =>
    setElements((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, label } };
    });

  const deleteSurface = (id: string) => {
    const deletedType = elements[id]?.type as ElementGroupKey | undefined;
    setElements((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    if (selectedId === id) {
      setSelectedId(null);
      if (deletedType) {
        setActiveGroupType(deletedType);
        setPanelView('surface-group');
      } else {
        setActiveGroupType(null);
        setPanelView(null);
      }
    }
  };

  const createSurface = (type: BuildingElement['type']) => {
    const next = buildNewSurface(type, elements);
    setElements((prev) => ({ ...prev, [next.id]: next }));
    setSelectedId(next.id);
    setSurfaceEditorTab('properties');
    setPanelView('surface-group');
    setActiveGroupType(type as ElementGroupKey);
  };

  const handleBuildingSelect = () => {
    setSelectedId(null);
    setActiveGroupType(null);
    setSurfaceEditorTab('properties');
    setPanelView('building');
  };

  /** Closes the element configurator modal. */
  const closeElementModal = () => {
    setPanelView(null);
    setSelectedId(null);
    setActiveGroupType(null);
  };

  /** Opens the surface grid for a group type in the center panel. */
  const handleGroupTypeSelect = (type: ElementGroupKey) => {
    setActiveGroupType(type);
    setSelectedId(null);
    setPanelView('surface-group');
  };

  const handleTechnologyPvSelect = () => {
    setSelectedId(null);
    setActiveGroupType(null);
    setSurfaceEditorTab('pv');
    setPanelView('technology-pv');
  };

  /** Updates the PV config for a single surface. Creates a new entry if none exists. */
  const updateSurfacePv = (surfaceId: string, patch: Partial<PvConfig>) => {
    setSurfacePvConfigs((prev) => {
      const el = elements[surfaceId];
      const existing = prev[surfaceId] ?? createSurfacePvConfig(el);
      return { ...prev, [surfaceId]: { ...existing, ...patch } };
    });
  };

  /** Handles technology toggle from the overview panel for non-PV techs. */
  const handleTechToggle = (id: string, installed: boolean) => {
    if (id === 'battery') {
      setBatteryConfig((prev) => ({ ...prev, installed }));
      return;
    }
    setOtherTechIds((prev) =>
      installed ? [...prev.filter((i) => i !== id), id] : prev.filter((i) => i !== id),
    );
  };

  /** Navigates to the battery editor panel. */
  const handleTechnologyBatterySelect = () => {
    setPanelView('technology-battery');
    setSelectedId(null);
    setActiveGroupType(null);
  };

  /** Updates a subset of the battery configuration. */
  const updateBattery = (patch: Partial<BatteryConfig>) =>
    setBatteryConfig((prev) => ({ ...prev, ...patch }));

  /** Opens the element configurator modal for a technology card, using the registry to resolve the panel. */
  const handleTechnologyOpen = (id: string) => {
    if (id === 'solar_pv') { handleTechnologyPvSelect(); return; }
    if (id === 'battery')  { handleTechnologyBatterySelect(); return; }
    const tech = TECH_REGISTRY.find((t) => t.id === id);
    if (tech?.panelView) {
      setPanelView(tech.panelView);
      setSelectedId(null);
      setActiveGroupType(null);
      return;
    }
    handleBuildingSelect();
  };

  /** Opens a specific surface directly on its PV configuration tab. */
  const handleEditPvSurface = (surfaceId: string) => {
    setSelectedId(surfaceId);
    setSurfaceEditorTab('pv');
    setPanelView('surface-group');

    const el = elements[surfaceId];
    if (el) setActiveGroupType(el.type as ElementGroupKey);
  };

  /** Replaces roof elements from a new type template.
   *  If any replaced surface had PV installed, sets the invalidation warning. */
  const handleApplyRoofType = (newRoofElements: Record<string, BuildingElement>) => {
    setElements((prev) => {
      const oldRoofIds = Object.keys(prev).filter((id) => prev[id].type === 'roof');
      const hadPv = oldRoofIds.some((id) => surfacePvConfigs[id]?.installed);
      if (hadPv) {
        setPvInvalidated(true);
        setSurfacePvConfigs((pv) => {
          const next = { ...pv };
          oldRoofIds.forEach((id) => { delete next[id]; });
          return next;
        });
      }
      const withoutRoofs = Object.fromEntries(
        Object.entries(prev).filter(([, el]) => el.type !== 'roof'),
      );
      return { ...withoutRoofs, ...newRoofElements };
    });
    // After regenerating, show the roof surface grid so the new cards are visible.
    setSelectedId(null);
    setActiveGroupType('roof');
    setPanelView('surface-group');
  };

  const setGen = (key: string, value: any) =>
    setGeneralRaw((prev) => ({ ...prev, [key]: value }));

  /** Called when the user clicks an element row in the surface selector.
   *  Selects the element and switches to its surface panel. */
  const handleElementSelect = (elementId: string) => {
    setSelectedId(elementId);
    setSurfaceEditorTab('properties');
    setPanelView('surface-group');
    const el = elements[elementId];
    if (el) setActiveGroupType(el.type as ElementGroupKey);
  };

  const handleReset = () => {
    setElements(initialElements);
    setGeneralRaw(initialGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setSelectedId(null);
    setActiveGroupType(null);
    setPanelView(null);
    setUploadError(null);
  };

  /**
   * Commits the working draft, then runs a full BuEM simulation via
   * buem-gateway and feeds the resulting load profile into the overview
   * chart. Demo-only wiring — see buemApi.ts's module doc for why this is
   * a direct call rather than going through a backend/orchestration layer.
   */
  const handleRecalculate = async () => {
    setSavedState({ elements, general, roofConfig });

    const coordinates: [number, number] = geometryData?.coordinates ?? identityData?.coordinates ?? [11.5820, 48.1351];
    const identity = {
      id: identityData?.id ?? 'building-1',
      label: identityData?.label ?? buildingLabel,
      coordinates,
      buildingType: general.buildingType,
      constructionPeriod: general.constructionPeriod,
      country: general.country,
      floorArea: computeTotalFloorArea(general.floorArea, general.storeys),
      roomHeight: general.roomHeight,
      storeys: general.storeys,
    };

    setIsRunningSimulation(true);
    setUploadError(null);
    try {
      const result = await runBuildingSimulation(identity, elements, general, identity.id, batteryConfig);
      if (!result) {
        setUploadError('Simulation failed — buem-gateway is unreachable or rejected the request.');
        return;
      }
      setModelTimeseries(result.timeseries);
      setEnergyTotals(computeEnergyTotals(result.timeseries, result.thermalSummary));
      setBuemBaselineHeatingKwh(baselineHeatingKwh(result.timeseries, result.thermalSummary));
      setIsHeatingConfirmed(true);
    } finally {
      setIsRunningSimulation(false);
    }
  };

  // --- JSON export to BUEM API format ----------------------------------------

  const handleDownload = () => {
    try {
      // Prepare building identity from current state
      const coordinates: [number, number] = geometryData?.coordinates ?? identityData?.coordinates ?? [11.5820, 48.1351];
      const identity = {
        id: identityData?.id ?? 'building-1',
        label: identityData?.label ?? buildingLabel,
        coordinates,
        buildingType: general.buildingType,
        constructionPeriod: general.constructionPeriod,
        country: general.country,
        floorArea: computeTotalFloorArea(general.floorArea, general.storeys),
        roomHeight: general.roomHeight,
        storeys: general.storeys,
      };

      // Generate BUEM API GeoJSON FeatureCollection
      const buemJson = exportToBuemGeojson(identity, elements, general, undefined, undefined, batteryConfig);
      const blob = new Blob([buemJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `building-${identity.id}-buem.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setUploadError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // --- JSON import (both BUEM API and legacy formats) -------------------------

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const imported = importBuildingData(parsed);

        // Normalize and apply imported elements
        const normalizedElements = normalizeElementRecord(
          { ...DEFAULT_ELEMENTS, ...imported.elements },
          imported.isBuemFormat ? 'city' : 'default',
        );
        setElements(normalizedElements);

        // Apply imported general config
        const mergedGeneral = { ...DEFAULT_GENERAL, ...imported.general };
        setGeneralRaw(mergedGeneral);

        // Apply roof config if available (legacy format)
        if (isRoofConfig(imported.roofConfig)) {
          setRoofConfig(imported.roofConfig);
        }
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

  // --- Derived ---------------------------------------------------------------

  const identity = identityData;
  const buildingLabel = general.buildingName || identity?.label || 'Building';
  const buildingType  = general.buildingType || identity?.buildingType || '';
  const coordinates: [number, number] = geometryData?.coordinates ?? identity?.coordinates ?? [11.5820, 48.1351];

  const totalArea   = Object.values(elements).reduce((sum, e) => sum + (e.area || 0), 0);
  const avgUValue   = totalArea > 0
    ? Object.values(elements).reduce((sum, e) => sum + e.uValue * e.area, 0) / totalArea
    : 0;
  // Prefer a demand-based rating (kWh/(m²·a), matching real EPC-style classification —
  // see thermalRatingStandards.ts for the country-configurable band source) once ignis
  // has a result; fall back to the simpler U-value-based rating otherwise.
  const thermalRating = ignis?.result
    ? getThermalRatingFromDemand(ignis.result.qHnd, general.country as string | undefined)
    : getThermalRating(avgUValue);
  const snapshotRows  = buildSnapshotRows(general, elements, totalArea, baselineRef.current);

  // Live ignis heating figure (kWh/(m²·a) × floor area), compared against the
  // last full BuEM simulation. Lets the user see how their edits (refurbishment
  // level, field changes) move heating demand before deciding to save or revert.
  const displayEnergyTotals: EnergyTotals = useMemo(() => {
    const totalFloorArea = computeTotalFloorArea(Number(general.floorArea) || 0, Number(general.storeys) || 1);
    return resolveDisplayEnergyTotals(
      energyTotals,
      groundTruthTimeseries,
      ignis?.result,
      totalFloorArea,
      buemBaselineHeatingKwh,
      isHeatingConfirmed,
    );
  }, [energyTotals, groundTruthTimeseries, ignis?.result, general.floorArea, general.storeys, buemBaselineHeatingKwh, isHeatingConfirmed]);
  const pvInstalledSurfaces = useMemo(() => (
    Object.values(elements)
      .filter((element) => surfacePvConfigs[element.id]?.installed)
      .map((element) => ({
        element,
        pv: surfacePvConfigs[element.id] ?? createSurfacePvConfig(element),
      }))
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

  const modalTitle =
    panelView === 'building'             ? 'Building settings'
    : panelView === 'surface-group'      ? (activeGroupType ? ELEMENT_GROUP_LABELS[activeGroupType] : 'Surface')
    : panelView === 'technology-pv'      ? 'Solar PV'
    : panelView === 'technology-battery' ? 'Battery storage'
    : 'Configure';

  return (
    <div className="cfg-panel w-[95vw] max-w-[1440px] h-[92vh] rounded-lg shadow-2xl flex flex-col bg-card overflow-hidden">
      <ConfiguratorStyles />

      {/* ── Header ── */}
      <div className="h-[52px] shrink-0 px-4 flex items-center gap-3 bg-card border-b border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-7 bg-foreground rounded-md flex items-center justify-center shrink-0">
            <Building2 className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight">{buildingLabel} · {buildingType}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{formatCoordinates(coordinates[0], coordinates[1])}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SegmentedControl
            options={[{ value: 'basic', label: 'Basic' }, { value: 'expert', label: 'Expert' }]}
            value={mode}
            onChange={(v) => setMode(v as 'basic' | 'expert')}
          />
          <div className="w-px h-5 bg-border shrink-0 mx-1" />
          <HeaderBtn onClick={handleDownload} tooltip="Export as BUEM GeoJSON"><Download /></HeaderBtn>
          <HeaderBtn onClick={() => fileInputRef.current?.click()} tooltip="Import BUEM or legacy JSON"><Upload /></HeaderBtn>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
          <div className="w-px h-5 bg-border shrink-0 mx-1" />
          {onClose && (
            <HeaderBtn onClick={() => setShowCloseDialog(true)} tooltip="Close"><X /></HeaderBtn>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {/* Two-column main view: parameters + energy (editable inline) | envelope + technologies.
          The element configurator (building advanced settings / surface / PV / battery) lives
          in a modal, opened on demand from a card's Edit action — it no longer occupies a
          permanent column (decision: pull-common-editor-into-modal). */}
      <div className="min-h-0 flex-1 overflow-hidden bg-slate-50 flex flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-[minmax(420px,36%)_minmax(0,1fr)] overflow-hidden">

            <BuildingSnapshotAside
              energyTotals={displayEnergyTotals}
              thermalRating={thermalRating}
              avgUValue={avgUValue}
              installedTechIds={installedTechIds}
              pvSummary={pvSummary}
              onToggleTech={handleTechToggle}
              onOpenTech={handleTechnologyOpen}
              mode={mode}
            />
            <EnergyEnvelopeColumn
              uploadError={uploadError}
              onClearError={() => setUploadError(null)}
              elements={elements}
              baselineElements={baselineRef.current.elements}
              roofConfig={roofConfig}
              isActive
              buildingId={buildingLabel}
              initialTimeseries={modelTimeseries ?? thematicData?.timeseries ?? buildingData?.timeseries ?? null}
              onGroundTruthChange={(rows) => setGroundTruthTimeseries(rows)}
              mode={mode}
              snapshotRows={snapshotRows}
              onEditField={setGen}
              onOpenAdvanced={handleBuildingSelect}
              onEditGroup={handleGroupTypeSelect}
            />

          </div>
        </div>

        {/* ── Footer: reset / apply ── */}
        <div className="border-t border-border/80 bg-slate-50 px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-slate-50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-100 hover:bg-muted"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleRecalculate}
              disabled={isRunningSimulation}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90 shadow-[0_10px_20px_rgba(47,93,138,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="size-3.5" />
              {isRunningSimulation ? 'Running simulation…' : 'Recalculate'}
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Element configurator modal: building advanced settings / surface / PV / battery ── */}
      <ElementConfiguratorModal
        open={panelView !== null}
        onClose={closeElementModal}
        title={modalTitle}
        size={
          panelView === 'technology-battery' ? 'compact'
          : panelView === 'surface-group'    ? 'medium'
          : 'default'
        }
      >
        {pvInvalidated && (
          <div className="m-3 mb-0 flex shrink-0 items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="flex-1 text-[11px] leading-snug text-amber-700">
              One or more roof surfaces with PV installed were replaced by the new roof type.
              Please reassign PV to the updated roof surfaces.
            </p>
            <button
              type="button"
              onClick={() => setPvInvalidated(false)}
              className="shrink-0 cursor-pointer text-sm leading-none text-amber-600"
            >×</button>
          </div>
        )}

        <div key={`${panelView}-${selectedId ?? ''}`} className="flex min-h-0 flex-1 flex-col">
          {panelView === 'building' ? (
            <BuildingEditor
              general={general}
              setGen={setGen}
              mode={mode}
              ignis={ignis}
              onIgnisVariantSelect={handleIgnisVariantSelect}
              onIgnisPeriodOverride={handleIgnisPeriodOverride}
              avgUValue={avgUValue}
              onOpenEnvelope={() => handleGroupTypeSelect('wall')}
              hideIdentity
            />
          ) : panelView === 'surface-group' && activeGroupType ? (
            // Card grid of every surface in the group + the selected one's editor below —
            // this is how the user switches between siblings (e.g. Wall 1 -> Wall 2) now
            // that there's no permanent side nav.
            <SurfaceGroupGrid
              groupType={activeGroupType}
              elements={elements}
              selectedElementId={selectedId}
              onSelect={handleElementSelect}
              onDeleteSurface={deleteSurface}
              onApplyRoofType={handleApplyRoofType}
              onCreateSurface={createSurface}
              surfacePvConfigs={surfacePvConfigs}
              editorSlot={selectedId ? (
                <SurfaceGroupEditor
                  selectedElementId={selectedId}
                  elements={elements}
                  onUpdateElement={updateElement}
                  onRenameElement={renameElement}
                  preferredTab={surfaceEditorTab}
                  surfacePvConfig={surfacePvConfigs[selectedId] ?? null}
                  onUpdatePv={(patch) => updateSurfacePv(selectedId, patch)}
                  onDeleteSurface={deleteSurface}
                  mode={mode}
                  embedded
                />
              ) : undefined}
            />
          ) : panelView === 'technology-pv' ? (
            <PvSurfaceManager
              surfaces={pvInstalledSurfaces}
              totalCapacityKw={totalPvCapacityKw}
              mode={mode}
              onEditSurface={handleEditPvSurface}
              allElements={elements}
              onEnableSurface={handleEditPvSurface}
            />
          ) : panelView === 'technology-battery' ? (
            <BatteryEditor
              battery={batteryConfig}
              onUpdate={updateBattery}
              mode={mode}
            />
          ) : null}
        </div>
      </ElementConfiguratorModal>

      {/* ── Close confirmation dialog ── */}
      <DialogPrimitive.Root open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-md p-6 shadow-xl w-full max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-center gap-2 mb-3">
              {hasUnsavedChanges && <AlertTriangle className="size-4 text-amber-500 shrink-0" />}
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                {hasUnsavedChanges ? 'Unsaved Changes' : 'Close Configurator'}
              </DialogPrimitive.Title>
            </div>

            <div className="mb-4">
              {hasUnsavedChanges ? (
                <>
                  <p className="text-sm text-foreground mb-2">
                    You have unsaved changes to this building configuration. What would you like to do?
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-[6px] px-3 py-2">
                    <p className="text-xs text-amber-800">
                      Closing without saving will discard all modifications made since the last Apply.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-foreground">
                  Close the building configurator and return to the map?
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloseDialog(false)}
                className="px-3 py-1.5 text-sm font-medium text-foreground border border-border rounded-[6px] hover:bg-muted transition-colors cursor-pointer"
              >
                Continue Editing
              </button>
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={() => { handleRecalculate(); onClose?.(); setShowCloseDialog(false); }}
                  className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-[6px] hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Save &amp; Close
                </button>
              )}
              <button
                type="button"
                onClick={() => { onClose?.(); setShowCloseDialog(false); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-[6px] transition-colors cursor-pointer',
                  hasUnsavedChanges
                    ? 'text-destructive border border-destructive/30 hover:bg-destructive/5'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {hasUnsavedChanges ? 'Discard Changes' : 'Close'}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
