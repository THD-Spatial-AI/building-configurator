// Main building configurator panel.
// Owns all application state and handlers; delegates rendering to sub-components.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Download, Upload, X, Building2, RotateCcw, Check, AlertTriangle,
  Flame, Zap, Droplets, Gauge, LayoutDashboard, SlidersHorizontal,
} from 'lucide-react';

import { BuildingVisualization, VIEW_ORDER } from './configure/visualization/BuildingVisualization';
import type { BuildingElement, FaceGroup } from './configure/model/buildingElements';
import {
  elementToGroup,
  isElementEditable,
  normalizeElementRecord,
  faceFromAzimuth,
} from './configure/model/buildingElements';
import { type RoofConfig, DEFAULT_ROOF_CONFIG } from './configure/model/roof';
import { SegmentedControl, ConfiguratorStyles, ScrollHintContainer } from './shared/ui';
import { cn } from '../../../lib/utils';
import { type EnergyTotals, type LoadDataPoint } from '../../lib/loadProfile';

import { DEFAULT_ELEMENTS, DEFAULT_GENERAL } from './shared/buildingDefaults';
import type { BuildingState, ThermalSummary } from '../../lib/buemAdapter';
import {
  formatCoordinates,
  exportToBuemGeojson,
  importBuildingData,
} from '../../lib/buemAdapter';
import {
  getThermalRating,
  buildSnapshotRows,
} from './shared/snapshotUtils';
import type { ElementGroupKey } from './shared/elementListUtils';
import { BuildingSnapshotAside } from './overview/BuildingSnapshotAside';
import { EnergyEnvelopeColumn } from './overview/EnergyEnvelopeColumn';
import { SurfaceGroupSelector } from './configure/surfaces/SurfaceGroupSelector';
import { SurfaceGroupGrid } from './configure/surfaces/SurfaceGroupGrid';
import { SurfaceGroupEditor } from './configure/surfaces/SurfaceGroupEditor';
import { BuildingEditor } from './configure/building/BuildingEditor';
import { PvSurfaceManager } from './configure/pv/PvSurfaceManager';
import { BatteryEditor } from './configure/pv/BatteryEditor';
import { createSurfacePvConfig, DEFAULT_BATTERY_CONFIG } from './shared/buildingDefaults';
import type { PvConfig, BatteryConfig } from './shared/buildingDefaults';

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
    const fmt = (v: number) => {
      const abs = Math.abs(v);
      if (abs >= 100)  return abs.toFixed(0);
      if (abs >= 1)    return abs.toFixed(1);
      return abs.toFixed(2);
    };
    return {
      heating:     fmt(timeseries.reduce((s, p) => s + p.heating,     0)),
      electricity: fmt(timeseries.reduce((s, p) => s + p.electricity, 0)),
      hotwater:    fmt(timeseries.reduce((s, p) => s + p.hotwater,    0)),
      unit: 'kWh',
    };
  }
  if (thermalSummary) {
    return {
      heating:     thermalSummary.heatingKwh.toFixed(0),
      electricity: thermalSummary.electricityKwh.toFixed(0),
      hotwater:    thermalSummary.coolingKwh.toFixed(0),
      unit: 'kWh',
    };
  }
  return { electricity: '—', heating: '—', hotwater: '—', unit: 'kWh' };
}

// --- Energy items config (used in the configure view's demand mini panel) -----

const ENERGY_ITEMS = [
  { key: 'heating',     label: 'Heating',     Icon: Flame,    iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', valueColor: 'text-orange-300' },
  { key: 'electricity', label: 'Electricity', Icon: Zap,      iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', valueColor: 'text-yellow-300' },
  { key: 'hotwater',    label: 'Hot Water',   Icon: Droplets, iconBg: 'bg-blue-500/20',   iconColor: 'text-blue-400',   valueColor: 'text-blue-300'   },
] as const;

// --- Direction label helper ---------------------------------------------------


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
  const initialGeneral = buildingData ? {
    ...DEFAULT_GENERAL,
    buildingName:       identityData?.label ?? DEFAULT_GENERAL.buildingName,
    buildingType:       identityData?.buildingType ?? DEFAULT_GENERAL.buildingType,
    constructionPeriod: identityData?.constructionPeriod ?? DEFAULT_GENERAL.constructionPeriod,
    country:            identityData?.country ?? DEFAULT_GENERAL.country,
    floorArea:          identityData?.floorArea || DEFAULT_GENERAL.floorArea,
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

  const [workspaceView, setWorkspaceView] = useState<'overview' | 'configure'>('overview');
  const [mode,          setMode]          = useState<'basic' | 'expert'>('basic');
  const [elements,      setElements]      = useState(initialElements);
  const [general,       setGeneralRaw]    = useState(initialGeneral);
  const [roofConfig,    setRoofConfig]    = useState<RoofConfig>(DEFAULT_ROOF_CONFIG);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [surfaceEditorTab, setSurfaceEditorTab] = useState<'properties' | 'pv'>('properties');
  const [panelView,     setPanelView]     = useState<'building' | 'surface' | 'surface-group' | 'technology-pv' | 'technology-battery'>('building');
  /** The group type currently driving the surface-group grid in the center panel. */
  const [activeGroupType, setActiveGroupType] = useState<ElementGroupKey | null>(null);
  /** Whether the roof-type accordion is expanded while editing a roof surface. */
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

  const [savedState,      setSavedState]      = useState({ elements: initialElements, general: initialGeneral, roofConfig: DEFAULT_ROOF_CONFIG });
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [energyTotals,    setEnergyTotals]    = useState<EnergyTotals>(initialEnergyTotals);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync all model-derived state whenever buildingData prop changes (e.g. different building
  // selected, or the source JSON is updated during development).
  useEffect(() => {
    if (!buildingData) return;

    const nextElements = normalizeElementRecord(
      Object.keys(buildingData.thematic.envelope).length > 0
        ? buildingData.thematic.envelope
        : DEFAULT_ELEMENTS,
      Object.keys(buildingData.thematic.envelope).length > 0 ? 'city' : 'default',
    );

    const nextGeneral = {
      ...DEFAULT_GENERAL,
      buildingType:       buildingData.thematic.identity.buildingType,
      constructionPeriod: buildingData.thematic.identity.constructionPeriod,
      country:            buildingData.thematic.identity.country,
      floorArea:          buildingData.thematic.identity.floorArea || DEFAULT_GENERAL.floorArea,
      roomHeight:         buildingData.thematic.identity.roomHeight || DEFAULT_GENERAL.roomHeight,
      storeys:            buildingData.thematic.identity.storeys || DEFAULT_GENERAL.storeys,
    };

    const nextTotals = computeEnergyTotals(
      buildingData.thematic.timeseries ?? buildingData.timeseries ?? null,
      buildingData.thematic.thermalSummary ?? buildingData.thermalSummary ?? null,
    );

    setElements(nextElements);
    setGeneralRaw(nextGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setSavedState({ elements: nextElements, general: nextGeneral, roofConfig: DEFAULT_ROOF_CONFIG });
    setEnergyTotals(nextTotals);
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

  const enableCustomMode = (id: string) => {
    setElements((prev) => {
      const current = prev[id];
      if (!current || isElementEditable(current)) return prev;
      return { ...prev, [id]: { ...current, customMode: true } };
    });
    // Also switch PV geometry to manual so tilt/azimuth inputs appear in the PV tab.
    setSurfacePvConfigs((prev) => {
      const el = elements[id];
      if (!el) return prev;
      const existing = prev[id] ?? createSurfacePvConfig(el);
      return { ...prev, [id]: { ...existing, geometryMode: 'manual' } };
    });
  };

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

  const handleSelectElement = (id: string) => {
    setSelectedId(id);
    setSurfaceEditorTab('properties');
    setPanelView('surface-group');
    setActiveGroupType((elements[id]?.type as ElementGroupKey) ?? null);
    setWorkspaceView('configure');
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

  /** Opens the configure workspace for a specific technology card from the overview. */
  const handleTechnologyOpen = (id: 'solar_pv' | 'battery' | 'heat_pump' | 'ev_charger') => {
    if (id === 'solar_pv') {
      handleTechnologyPvSelect();
      return;
    }
    if (id === 'battery') {
      handleTechnologyBatterySelect();
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

  const handleApply = () => {
    console.log('Apply:', { elements, general, roofConfig });
    setSavedState({ elements, general, roofConfig });
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
        floorArea: general.floorArea,
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
  const thermalRating = getThermalRating(avgUValue);
  const snapshotRows  = buildSnapshotRows(general, elements, totalArea);
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

  return (
    <div className="cfg-panel w-[80vw] h-[88vh] rounded-lg shadow-2xl flex flex-col bg-card overflow-hidden">
      <ConfiguratorStyles />

      {/* ── Header ── */}
      <div className="h-[52px] shrink-0 px-4 flex items-center gap-3 bg-card border-b border-border">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-7 bg-foreground rounded-md flex items-center justify-center shrink-0">
            <Building2 className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground leading-tight">{buildingLabel} · {buildingType}</p>
              <span className={cn(
                'shrink-0 flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest',
                workspaceView === 'overview'
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-primary/10 text-primary',
              )}>
                {workspaceView === 'overview' ? <LayoutDashboard className="size-3" /> : <SlidersHorizontal className="size-3" />}
                {workspaceView === 'overview' ? 'Overview' : 'Configure'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">{formatCoordinates(coordinates[0], coordinates[1])}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SegmentedControl
            options={[{ value: 'basic', label: 'Basic' }, { value: 'expert', label: 'Expert' }]}
            value={mode}
            onChange={(v) => setMode(v as 'basic' | 'expert')}
          />
          <button
            type="button"
            onClick={() => setWorkspaceView(workspaceView === 'overview' ? 'configure' : 'overview')}
            className={cn(
              'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-sm',
              workspaceView === 'overview'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-slate-700 text-white hover:bg-slate-600',
            )}
          >
            {workspaceView === 'overview'
              ? <><SlidersHorizontal className="size-3.5" /> Open Configurator</>
              : <><LayoutDashboard className="size-3.5" /> Back to Overview</>}
          </button>
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
      <div className="min-h-0 flex-1 overflow-hidden bg-slate-50 flex flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">

          {workspaceView === 'overview' ? (
            // ── Overview layout: snapshot sidebar + energy/envelope column ──
            <div className="grid h-full min-h-0 grid-cols-[430px_minmax(0,1fr)] overflow-hidden">
              <BuildingSnapshotAside
                energyTotals={energyTotals}
                snapshotRows={snapshotRows}
                thermalRating={thermalRating}
                avgUValue={avgUValue}
                installedTechIds={installedTechIds}
                pvSummary={pvSummary}
                onUpdateParam={setGen}
                onToggleTech={handleTechToggle}
                onOpenTech={handleTechnologyOpen}
                mode={mode}
              />
              <EnergyEnvelopeColumn
                uploadError={uploadError}
                onClearError={() => setUploadError(null)}
                elements={elements}
                selectedId={selectedId}
                onSelectElement={handleSelectElement}
                onUpdateElement={updateElement}
                onEnableCustomMode={enableCustomMode}
                roofConfig={roofConfig}
                isActive={workspaceView === 'overview'}
                buildingId={buildingLabel}
                initialTimeseries={thematicData?.timeseries ?? buildingData?.timeseries ?? null}
                onSwitchToConfigure={handleSelectElement}
                mode={mode}
                installedTechIds={installedTechIds}
                pvSummary={pvSummary}
                onToggleTech={handleTechToggle}
                onOpenTech={handleTechnologyOpen}
              />
            </div>
          ) : (
            // ── Configure layout: preview + demand (left) | group editor + selector (right) ──
            <div className="grid h-full min-h-0 grid-cols-[430px_minmax(0,1fr)] overflow-hidden">

              {/* ── Left column: 3D preview + preliminary energy demand ── */}
              <aside className="flex min-h-0 flex-col overflow-hidden border-r border-border/80 bg-slate-50/80">

                {/* 3D preview — takes all remaining vertical space */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border/60 bg-slate-50">
                  <div className="shrink-0 px-4 pt-3 pb-2">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground">
                      3D Preview
                    </p>
                    <div className="mt-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 flex flex-col gap-0.5">
                      <p className="text-[11px] font-semibold text-blue-700">How to use</p>
                      <p className="text-[10px] text-blue-600 leading-snug">Click any surface to select it · Use the arrow buttons to rotate the view</p>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
                    <BuildingVisualization
                      elements={elements}
                      selectedGroup={selectedGroup}
                      onSelectGroup={handleGroupSelect}
                      viewIndex={vizViewIndex}
                      onViewChange={setVizViewIndex}
                    />
                  </div>
                </div>

                {/* Preliminary energy demand — card list matching overview style */}
                <div className="shrink-0 p-3">
                  <div className="overflow-hidden rounded-xl border border-slate-700/60 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]">
                    <div className="bg-slate-800 px-4 py-4">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Preliminary energy demand
                      </p>
                      <div className="flex flex-col gap-3">
                        {ENERGY_ITEMS.map(({ key, label, Icon, iconBg, iconColor, valueColor }) => {
                          const value = energyTotals[key as keyof EnergyTotals];
                          return (
                            <div key={key} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', iconBg)}>
                                  <Icon className={cn('size-3.5', iconColor)} />
                                </div>
                                <span className="text-xs text-slate-300">{label}</span>
                              </div>
                              <div className="text-right">
                                <span className={cn('text-lg font-bold leading-none', value === '—' ? 'text-slate-500' : valueColor)}>
                                  {value}
                                </span>
                                <span className="ml-1 text-[10px] text-slate-500">{energyTotals.unit}</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Thermal efficiency — separated by subtle rule */}
                        <div className="flex items-center justify-between border-t border-slate-700/60 pt-3">
                          <div className="flex items-center gap-2">
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-600/50">
                              <Gauge className="size-3.5 text-slate-300" />
                            </div>
                            <span className="text-xs text-slate-300">Thermal efficiency</span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-bold leading-none" style={{ color: thermalRating.color }}>
                              {thermalRating.label}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-500">{avgUValue.toFixed(2)} W/m²K</span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-[9px] text-slate-600">
                        Will update live as surface properties change
                      </p>
                    </div>
                  </div>
                </div>
              </aside>

              {/* ── Right column: group editor (main) + group selector (narrow sidebar) ── */}
              <section className="flex min-h-0 flex-row overflow-hidden">

                {/* Center panel — building editor or surface editor */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
                  {uploadError && (
                    <div className="m-3 mb-0 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
                      <p className="flex-1 text-[11px] leading-snug text-destructive">{uploadError}</p>
                      <button
                        type="button"
                        onClick={() => setUploadError(null)}
                        className="shrink-0 cursor-pointer text-sm leading-none text-destructive"
                      >×</button>
                    </div>
                  )}
                  {/* PV invalidation warning — shown after a roof type change removes PV surfaces */}
                  {pvInvalidated && (
                    <div className="m-3 mb-0 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
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

                  <div key={`${panelView}-${selectedId ?? ''}`} className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  {panelView === 'building' ? (
                    <BuildingEditor general={general} setGen={setGen} mode={mode} />
                  ) : panelView === 'surface-group' && activeGroupType ? (
                    activeGroupType === 'roof' ? (
                      // Roof: type picker (no card grid) + embedded editor when selected
                      <SurfaceGroupGrid
                        groupType="roof"
                        elements={elements}
                        selectedElementId={selectedId}
                        onSelect={handleElementSelect}
                        onDeleteSurface={deleteSurface}
                        onApplyRoofType={handleApplyRoofType}
                        onCreateSurface={createSurface}
                        surfacePvConfigs={surfacePvConfigs}
                        hideCardGrid
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
                    ) : selectedId ? (
                      // Non-roof with surface selected: pure editor, no card grid
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
                      />
                    ) : (
                      // No surface selected yet — prompt
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center p-8">
                        <p className="text-sm font-semibold text-slate-500">Select a surface</p>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Pick a surface from the list on the right to configure it.
                        </p>
                      </div>
                    )
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
                </div>

                {/* Panel selector column */}
                <div className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border/60 bg-slate-50/60">
                  <ScrollHintContainer>
                    <SurfaceGroupSelector
                      elements={elements}
                      activeGroupType={activeGroupType}
                      onSelectGroupType={handleGroupTypeSelect}
                      onCreateSurface={createSurface}
                      buildingSubtitle={`${general.buildingType || buildingType}${general.floorArea ? ` · ${general.floorArea} m²` : ''}`}
                      buildingSelected={panelView === 'building'}
                      onSelectBuilding={handleBuildingSelect}
                      selectedSurfaceId={selectedId}
                      onSelectSurface={handleElementSelect}
                      onDeleteSurface={deleteSurface}
                      surfacePvConfigs={surfacePvConfigs}
                      pvSelected={panelView === 'technology-pv'}
                      pvSurfaceCount={pvSummary.surfaceCount}
                      pvCapacityKw={pvSummary.totalCapacityKw}
                      onSelectTechnologyPv={handleTechnologyPvSelect}
                      batterySelected={panelView === 'technology-battery'}
                      batteryInstalled={batteryConfig.installed}
                      onSelectTechnologyBattery={handleTechnologyBatterySelect}
                    />
                  </ScrollHintContainer>
                </div>

              </section>

            </div>
          )}

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
              onClick={handleApply}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90 shadow-[0_10px_20px_rgba(47,93,138,0.22)]"
            >
              <Check className="size-3.5" />
              Apply
            </button>
            </div>
          </div>
        </div>
      </div>

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
                  onClick={() => { handleApply(); onClose?.(); setShowCloseDialog(false); }}
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
