// Main building configurator panel.
// Owns all application state and handlers; delegates rendering to sub-components.

import React, { useState, useRef, useEffect, useMemo } from 'react';

import { VIEW_ORDER } from './configure/visualization/BuildingVisualization';
import type { BuildingElement, FaceGroup } from './configure/model/buildingElements';
import { elementToGroup, normalizeElementRecord } from './configure/model/buildingElements';
import { type RoofConfig, DEFAULT_ROOF_CONFIG } from './configure/model/roof';
import { type EnergyTotals, type LoadDataPoint } from '../../lib/loadProfile';

import { DEFAULT_ELEMENTS, DEFAULT_GENERAL, computeTotalFloorArea } from './shared/buildingDefaults';
import type { BuildingState } from '../../lib/buemAdapter';
import { exportToBuemGeojson, importBuildingData } from '../../lib/buemAdapter';
import { runBuildingSimulation } from '../../lib/buemApi';
import type { IgnisState, IgnisInputs, IgnisFieldMetadata } from '../../lib/ignisAdapter';
import {
  initIgnisState,
  selectVariantLevel,
  updateCalcDemand,
  resetCalcDemand,
  syncElementsWithVariantLevel,
  restoreDefaultUValues,
  resetElementsToVariantDefaults,
} from '../../lib/ignisAdapter';
import {
  loadVariantLevels,
  calculateHeatDemand,
  fetchFieldMetadata,
} from '../../lib/ignisApi';
import {
  getThermalRating,
  buildSnapshotRows,
  type SnapshotBaseline,
} from './shared/snapshotUtils';
import { getThermalRatingFromDemand } from '@/app/config/thermalRatingStandards';
import type { ElementGroupKey } from './shared/elementListUtils';
import { buildNewSurface, isRoofConfig } from './shared/surfaceFactory';
import { formatKwh, computeEnergyTotals, baselineHeatingKwh } from './shared/energyTotals';
import { createSurfacePvConfig, DEFAULT_BATTERY_CONFIG } from './shared/buildingDefaults';
import type { PvConfig, BatteryConfig } from './shared/buildingDefaults';
import { TECH_REGISTRY, VISIBLE_TECHS } from '../../config/techRegistry';
import type { TechNavItem } from '../../config/techRegistry';

import { ConfiguratorHeader } from './layout/ConfiguratorHeader';
import { ConfiguratorFooter } from './layout/ConfiguratorFooter';
import { CloseConfirmDialog } from './layout/CloseConfirmDialog';
import { OverviewLayout } from './layout/OverviewLayout';
import { ConfigureLayout } from './layout/ConfigureLayout';

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

  const [workspaceView, setWorkspaceView] = useState<'overview' | 'configure'>('overview');
  const [mode,          setMode]          = useState<'basic' | 'expert'>('basic');
  const [elements,      setElements]      = useState(initialElements);
  const [general,       setGeneralRaw]    = useState(initialGeneral);
  const [roofConfig,    setRoofConfig]    = useState<RoofConfig>(DEFAULT_ROOF_CONFIG);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [surfaceEditorTab, setSurfaceEditorTab] = useState<'properties' | 'pv'>('properties');
  const [panelView,     setPanelView]     = useState<string>('building');
  /** The group type currently driving the surface-group grid in the center panel. */
  const [activeGroupType, setActiveGroupType] = useState<ElementGroupKey | null>(null);
  // Per-surface PV configurations — keyed by element ID.
  const [surfacePvConfigs, setSurfacePvConfigs] = useState<Record<string, PvConfig>>({});
  // True when a roof-type change removed surfaces that had PV installed.
  const [pvInvalidated,  setPvInvalidated]  = useState(false);
  // Non-PV technology IDs (heat_pump, ev_charger) toggled by the overview panel.
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
  const [vizViewIndex,  setVizViewIndex]  = useState(0);
  const [uploadError,   setUploadError]   = useState<string | null>(null);

  // HDCP annual heat demand state — null until the building's country/type/period
  // resolve to at least one TABULA variant in the HDCP service.
  const [ignis, setHdcp] = useState<IgnisState | null>(null);

  // ignis field descriptions (labels/tooltips), fetched once. Empty until it
  // resolves; IgnisSection falls back to its own hardcoded tooltip text until then.
  const [ignisFieldMetadata, setIgnisFieldMetadata] = useState<IgnisFieldMetadata[]>([]);
  useEffect(() => {
    fetchFieldMetadata().then(setIgnisFieldMetadata);
  }, []);

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
    setPanelView('building');
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

  // ── HDCP handlers ─────────────────────────────────────────────────────────────

  const handleIgnisFieldChange = (changes: Partial<IgnisInputs>) =>
    setHdcp((prev) => prev ? updateCalcDemand(prev, changes) : prev);

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

  const handleIgnisReset = () => {
    if (!ignis) return;
    const selectedVariant = ignis.variants[ignis.selectedVariantIndex];
    const nextElements = selectedVariant
      ? syncElementsWithVariantLevel(elements, ignis.selectedVariantIndex, selectedVariant.data)
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
    setHdcp(resetCalcDemand(ignis, building));
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
        setPanelView('building');
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
    setWorkspaceView('configure');

    const group = elementToGroup(next);
    if (group.face !== 'roof' && group.face !== 'floor') {
      const idx = VIEW_ORDER.findIndex((v) => v.frontWallId === group.face);
      if (idx !== -1) setVizViewIndex(idx);
    }
  };

  const handleBuildingSelect = () => {
    setSelectedId(null);
    setActiveGroupType(null);
    setSurfaceEditorTab('properties');
    setPanelView('building');
    setWorkspaceView('configure');
  };

  /** Opens the surface grid for a group type in the center panel. */
  const handleGroupTypeSelect = (type: ElementGroupKey) => {
    setActiveGroupType(type);
    setSelectedId(null);
    setPanelView('surface-group');
    setWorkspaceView('configure');
  };

  const handleTechnologyPvSelect = () => {
    setSelectedId(null);
    setActiveGroupType(null);
    setSurfaceEditorTab('pv');
    setPanelView('technology-pv');
    setWorkspaceView('configure');
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
    setWorkspaceView('configure');
  };

  /** Updates a subset of the battery configuration. */
  const updateBattery = (patch: Partial<BatteryConfig>) =>
    setBatteryConfig((prev) => ({ ...prev, ...patch }));

  /** Opens the configure workspace for a technology card, using the registry to resolve the panel. */
  const handleTechnologyOpen = (id: string) => {
    if (id === 'solar_pv') { handleTechnologyPvSelect(); return; }
    if (id === 'battery')  { handleTechnologyBatterySelect(); return; }
    const tech = TECH_REGISTRY.find((t) => t.id === id);
    if (tech?.panelView) {
      setPanelView(tech.panelView);
      setSelectedId(null);
      setActiveGroupType(null);
      setWorkspaceView('configure');
      return;
    }
    handleBuildingSelect();
  };

  /** Opens a specific surface directly on its PV configuration tab. */
  const handleEditPvSurface = (surfaceId: string) => {
    setSelectedId(surfaceId);
    setSurfaceEditorTab('pv');
    setPanelView('surface-group');
    setWorkspaceView('configure');

    const el = elements[surfaceId];
    if (el) {
      setActiveGroupType(el.type as ElementGroupKey);
      const g = elementToGroup(el);
      if (g.face !== 'roof' && g.face !== 'floor') {
        const idx = VIEW_ORDER.findIndex((v) => v.frontWallId === g.face);
        if (idx !== -1) setVizViewIndex(idx);
      }
    }
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

  /** Called when the user clicks a face in the 3D preview.
   *  Selects the first element in that face group and rotates the preview to front-face it. */
  const handleGroupSelect = (group: FaceGroup) => {
    const firstEl = group.elementId
      ? elements[group.elementId]
      : Object.values(elements).find((e) => {
          const g = elementToGroup(e);
          return g.type === group.type && g.face === group.face;
        });
    if (firstEl) {
      setSelectedId(firstEl.id);
      setActiveGroupType(firstEl.type as ElementGroupKey);
      setSurfaceEditorTab('properties');
      setPanelView('surface-group');
      setWorkspaceView('configure');
    }
    if (group.face !== 'roof' && group.face !== 'floor') {
      const idx = VIEW_ORDER.findIndex((v) => v.frontWallId === group.face);
      if (idx !== -1) setVizViewIndex(idx);
    }
  };

  /** Called when the user clicks an element row in the surface selector.
   *  Sets the selected element, switches to surface panel, and rotates the 3D preview to its face direction. */
  const handleElementSelect = (elementId: string) => {
    setSelectedId(elementId);
    setSurfaceEditorTab('properties');
    setPanelView('surface-group');
    const el = elements[elementId];
    if (el) {
      setActiveGroupType(el.type as ElementGroupKey);
      const g = elementToGroup(el);
      if (g.face !== 'roof' && g.face !== 'floor') {
        const idx = VIEW_ORDER.findIndex((v) => v.frontWallId === g.face);
        if (idx !== -1) setVizViewIndex(idx);
      }
    }
  };

  const handleReset = () => {
    setElements(initialElements);
    setGeneralRaw(initialGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setSelectedId(null);
    setActiveGroupType(null);
    setPanelView('building');
    setVizViewIndex(0);
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

  // selectedGroup is derived from the selected element — no separate state needed.
  // This ensures the 3D highlight always follows the element's actual face, even
  // when azimuth changes move it to a different direction bucket.
  const selectedGroup = useMemo((): FaceGroup | null => {
    const el = selectedId ? elements[selectedId] : null;
    return el ? elementToGroup(el) : null;
  }, [selectedId, elements]);

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
    const ignisResult = ignis?.result;
    if (!ignisResult || totalFloorArea <= 0) return energyTotals;

    const ignisHeatingKwh = ignisResult.qHnd * totalFloorArea;
    const heatingDeltaPercent = buemBaselineHeatingKwh && buemBaselineHeatingKwh > 0
      ? ((ignisHeatingKwh - buemBaselineHeatingKwh) / buemBaselineHeatingKwh) * 100
      : null;

    return {
      ...energyTotals,
      heating: formatKwh(ignisHeatingKwh),
      heatingSource: 'ignis',
      heatingDeltaPercent,
      heatingPerM2: ignisResult.qHnd.toFixed(1),
    };
  }, [energyTotals, ignis?.result, general.floorArea, general.storeys, buemBaselineHeatingKwh]);
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

  /** Builds the tech nav item list for SurfaceGroupSelector from the registry + current state. */
  function buildTechNavItems(): TechNavItem[] {
    return VISIBLE_TECHS
      .filter((tech) => tech.panelView !== undefined)
      .map((tech): TechNavItem => {
        if (tech.id === 'solar_pv') {
          return {
            id:           tech.id,
            label:        tech.label,
            Icon:         tech.Icon,
            selected:     panelView === tech.panelView,
            badge:        pvSummary.surfaceCount > 0 ? String(pvSummary.surfaceCount) : undefined,
            subtitle:     pvSummary.surfaceCount > 0
              ? `${pvSummary.surfaceCount} ${pvSummary.surfaceCount === 1 ? 'surface' : 'surfaces'} · ${pvSummary.totalCapacityKw.toFixed(1)} kWp`
              : 'No surfaces configured',
            onSelect:     handleTechnologyPvSelect,
            navIconColor: tech.navIconColor,
          };
        }
        if (tech.id === 'battery') {
          return {
            id:           tech.id,
            label:        tech.label,
            Icon:         tech.Icon,
            selected:     panelView === tech.panelView,
            badge:        batteryConfig.installed ? '●' : undefined,
            subtitle:     batteryConfig.installed ? 'Installed' : 'Not configured',
            onSelect:     handleTechnologyBatterySelect,
            navIconColor: tech.navIconColor,
          };
        }
        // Generic building-scope tech with a panelView
        const installed = otherTechIds.includes(tech.id);
        return {
          id:           tech.id,
          label:        tech.label,
          Icon:         tech.Icon,
          selected:     panelView === tech.panelView,
          badge:        installed ? '●' : undefined,
          subtitle:     installed ? 'Installed' : 'Not configured',
          onSelect:     () => handleTechnologyOpen(tech.id),
          navIconColor: tech.navIconColor,
        };
      });
  }

  return (
    <div className="cfg-panel w-[80vw] h-[88vh] rounded-lg shadow-2xl flex flex-col bg-card overflow-hidden">

      <ConfiguratorHeader
        buildingLabel={buildingLabel}
        buildingType={buildingType}
        coordinates={coordinates}
        workspaceView={workspaceView}
        onWorkspaceViewChange={setWorkspaceView}
        mode={mode}
        onModeChange={setMode}
        onDownload={handleDownload}
        onUploadClick={() => fileInputRef.current?.click()}
        fileInputRef={fileInputRef}
        onUploadChange={handleUpload}
        onRequestClose={onClose ? () => setShowCloseDialog(true) : undefined}
      />

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-hidden bg-slate-50 flex flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          {workspaceView === 'overview' ? (
            <OverviewLayout
              snapshot={{
                energyTotals: displayEnergyTotals,
                snapshotRows,
                thermalRating,
                avgUValue,
                installedTechIds,
                pvSummary,
                onToggleTech: handleTechToggle,
                onOpenTech: handleTechnologyOpen,
                mode,
              }}
              envelope={{
                uploadError,
                onClearError: () => setUploadError(null),
                elements,
                baselineElements: baselineRef.current.elements,
                roofConfig,
                isActive: workspaceView === 'overview',
                buildingId: buildingLabel,
                initialTimeseries: modelTimeseries ?? thematicData?.timeseries ?? buildingData?.timeseries ?? null,
                mode,
                installedTechIds,
                pvSummary,
                onToggleTech: handleTechToggle,
                onOpenTech: handleTechnologyOpen,
              }}
            />
          ) : (
            <ConfigureLayout
              elements={elements}
              selectedGroup={selectedGroup}
              onSelectGroup={handleGroupSelect}
              vizViewIndex={vizViewIndex}
              onViewChange={setVizViewIndex}
              energyDemand={{ displayEnergyTotals, thermalRating, avgUValue }}
              uploadError={uploadError}
              onClearUploadError={() => setUploadError(null)}
              pvInvalidated={pvInvalidated}
              onClearPvInvalidated={() => setPvInvalidated(false)}
              panelView={panelView}
              selectedId={selectedId}
              panel={{
                panelView,
                activeGroupType,
                selectedId,
                elements,
                mode,
                surfaceEditorTab,
                surfacePvConfigs,
                general,
                setGen,
                ignis,
                ignisFieldMetadata,
                onIgnisFieldChange: handleIgnisFieldChange,
                onIgnisVariantSelect: handleIgnisVariantSelect,
                onIgnisReset: handleIgnisReset,
                onIgnisPeriodOverride: handleIgnisPeriodOverride,
                onUpdateElement: updateElement,
                onRenameElement: renameElement,
                onUpdateSurfacePv: updateSurfacePv,
                onDeleteSurface: deleteSurface,
                onSelectSurface: handleElementSelect,
                onCreateSurface: createSurface,
                onApplyRoofType: handleApplyRoofType,
                pvInstalledSurfaces,
                totalPvCapacityKw,
                onEditPvSurface: handleEditPvSurface,
                batteryConfig,
                onUpdateBattery: updateBattery,
              }}
              selector={{
                elements,
                activeGroupType,
                onSelectGroupType: handleGroupTypeSelect,
                onCreateSurface: createSurface,
                buildingSubtitle: `${general.buildingType || buildingType}${general.floorArea ? ` · ${computeTotalFloorArea(general.floorArea, general.storeys).toFixed(0)} m²` : ''}`,
                buildingSelected: panelView === 'building',
                onSelectBuilding: handleBuildingSelect,
                selectedSurfaceId: selectedId,
                onSelectSurface: handleElementSelect,
                onDeleteSurface: deleteSurface,
                surfacePvConfigs,
                techNavItems: buildTechNavItems(),
              }}
            />
          )}
        </div>

        <ConfiguratorFooter
          onReset={handleReset}
          onRecalculate={handleRecalculate}
          isRunningSimulation={isRunningSimulation}
        />
      </div>

      <CloseConfirmDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveAndClose={() => { handleRecalculate(); onClose?.(); setShowCloseDialog(false); }}
        onDiscardOrClose={() => { onClose?.(); setShowCloseDialog(false); }}
      />
    </div>
  );
}
