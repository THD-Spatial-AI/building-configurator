// Main building configurator panel.
// Owns all application state and handlers; delegates rendering to sub-components.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Download, Upload, X, Building2, RotateCcw, Check, AlertTriangle,
  Flame, Zap, Droplets, Gauge,
} from 'lucide-react';

import { BuildingVisualization, VIEW_ORDER } from './configure/BuildingVisualization';
import type { BuildingElement, FaceGroup } from './configure/BuildingVisualization';
import { elementToGroup } from './configure/BuildingVisualization';
import { type EnergyTotals, type LoadDataPoint } from './overview/LoadProfileViewer';
import { RoofConfig, DEFAULT_ROOF_CONFIG } from './configure/RoofConfigurator';
import { SegmentedControl, ConfiguratorStyles } from './shared/ui';
import { cn } from '../../../lib/utils';

import { DEFAULT_ELEMENTS, DEFAULT_GENERAL } from './shared/buildingDefaults';
import type { BuildingState, ThermalSummary } from '../../lib/buemAdapter';
import { formatCoordinates } from '../../lib/buemAdapter';
import {
  getThermalRating,
  buildSnapshotRows,
} from './shared/snapshotUtils';
import { BuildingSnapshotAside } from './overview/BuildingSnapshotAside';
import { EnergyEnvelopeColumn } from './overview/EnergyEnvelopeColumn';
import { SurfaceGroupSelector } from './configure/SurfaceGroupSelector';
import { SurfaceGroupEditor } from './configure/SurfaceGroupEditor';

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
  // Merge model identity fields into general config, keeping defaults for any missing fields.
  const initialGeneral = buildingData ? {
    ...DEFAULT_GENERAL,
    buildingType:       buildingData.identity.buildingType,
    constructionPeriod: buildingData.identity.constructionPeriod,
    country:            buildingData.identity.country,
    floorArea:          buildingData.identity.floorArea || DEFAULT_GENERAL.floorArea,
    roomHeight:         buildingData.identity.roomHeight || DEFAULT_GENERAL.roomHeight,
    storeys:            buildingData.identity.storeys    || DEFAULT_GENERAL.storeys,
  } : DEFAULT_GENERAL;

  const initialElements = buildingData && Object.keys(buildingData.envelope).length > 0
    ? buildingData.envelope
    : DEFAULT_ELEMENTS;

  const initialEnergyTotals = computeEnergyTotals(
    buildingData?.timeseries ?? null,
    buildingData?.thermalSummary ?? null,
  );

  const [workspaceView, setWorkspaceView] = useState<'overview' | 'configure'>('overview');
  const [mode,          setMode]          = useState<'basic' | 'expert'>('basic');
  const [elements,      setElements]      = useState(initialElements);
  const [general,       setGeneralRaw]    = useState(initialGeneral);
  const [roofConfig,    setRoofConfig]    = useState<RoofConfig>(DEFAULT_ROOF_CONFIG);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
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

    const nextElements = Object.keys(buildingData.envelope).length > 0
      ? buildingData.envelope
      : DEFAULT_ELEMENTS;

    const nextGeneral = {
      ...DEFAULT_GENERAL,
      buildingType:       buildingData.identity.buildingType,
      constructionPeriod: buildingData.identity.constructionPeriod,
      country:            buildingData.identity.country,
      floorArea:          buildingData.identity.floorArea || DEFAULT_GENERAL.floorArea,
      roomHeight:         buildingData.identity.roomHeight || DEFAULT_GENERAL.roomHeight,
      storeys:            buildingData.identity.storeys    || DEFAULT_GENERAL.storeys,
    };

    const nextTotals = computeEnergyTotals(
      buildingData.timeseries ?? null,
      buildingData.thermalSummary ?? null,
    );

    setElements(nextElements);
    setGeneralRaw(nextGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setSavedState({ elements: nextElements, general: nextGeneral, roofConfig: DEFAULT_ROOF_CONFIG });
    setEnergyTotals(nextTotals);
    setSelectedId(null);
    setUploadError(null);
  }, [buildingData]);

  const hasUnsavedChanges = JSON.stringify({ elements, general, roofConfig }) !== JSON.stringify(savedState);

  // --- Handlers ---------------------------------------------------------------

  const updateElement = (id: string, patch: Partial<BuildingElement>) =>
    setElements((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleSelectElement = (id: string) => {
    setSelectedId(id);
    setWorkspaceView('configure');
  };

  const setGen = (key: string, value: any) =>
    setGeneralRaw((prev) => ({ ...prev, [key]: value }));

  /** Called when the user clicks a face in the 3D preview.
   *  Selects the first element in that face group and rotates the preview to front-face it. */
  const handleGroupSelect = (group: FaceGroup) => {
    const firstEl = Object.values(elements).find((e) => {
      const g = elementToGroup(e);
      return g.type === group.type && g.face === group.face;
    });
    if (firstEl) setSelectedId(firstEl.id);
    if (group.face !== 'roof' && group.face !== 'floor') {
      const idx = VIEW_ORDER.findIndex((v) => v.frontWallId === group.face);
      if (idx !== -1) setVizViewIndex(idx);
    }
  };

  /** Called when the user clicks an element row in the surface selector.
   *  Sets the selected element and rotates the 3D preview to its face direction. */
  const handleElementSelect = (elementId: string) => {
    setSelectedId(elementId);
    const el = elements[elementId];
    if (el) {
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
    setVizViewIndex(0);
    setUploadError(null);
  };

  const handleApply = () => {
    console.log('Apply:', { elements, general, roofConfig });
    setSavedState({ elements, general, roofConfig });
  };

  // --- JSON export ------------------------------------------------------------

  const handleDownload = () => {
    const payload = {
      version: '1.0',
      exported: new Date().toISOString(),
      elements,
      generalConfig: general,
      roofConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'building-config.json'; a.click();
    URL.revokeObjectURL(url);
  };

  // --- JSON import ------------------------------------------------------------

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const cfg = JSON.parse(ev.target?.result as string);
        if (cfg.elements)      setElements({ ...DEFAULT_ELEMENTS, ...cfg.elements });
        if (cfg.generalConfig) setGeneralRaw({ ...DEFAULT_GENERAL, ...cfg.generalConfig });
        if (cfg.roofConfig)    setRoofConfig(cfg.roofConfig);
      } catch {
        setUploadError('Could not parse JSON — ensure the file was exported from this configurator.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Derived ---------------------------------------------------------------

  const identity = buildingData?.identity;
  const buildingLabel = identity?.label ?? 'Building';
  const buildingType  = identity?.buildingType ?? general.buildingType;
  const coordinates: [number, number] = identity?.coordinates ?? [11.5820, 48.1351];

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

  return (
    <div className="cfg-panel mr-[10px] h-[min(920px,calc(100vh-24px))] w-[min(1540px,calc(100vw-60px))] rounded-lg shadow-2xl flex flex-col bg-card overflow-hidden">
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
          {workspaceView === 'configure' && (
            <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
              Under Construction (Alpha Preview)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SegmentedControl
            options={[{ value: 'overview', label: 'Overview' }, { value: 'configure', label: 'Configure' }]}
            value={workspaceView}
            onChange={(v) => setWorkspaceView(v as 'overview' | 'configure')}
          />
          <SegmentedControl
            options={[{ value: 'basic', label: 'Basic' }, { value: 'expert', label: 'Expert' }]}
            value={mode}
            onChange={(v) => setMode(v as 'basic' | 'expert')}
          />
          <HeaderBtn onClick={handleDownload} tooltip="Export JSON"><Download /></HeaderBtn>
          <HeaderBtn onClick={() => fileInputRef.current?.click()} tooltip="Import JSON"><Upload /></HeaderBtn>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
          <div className="w-px h-5 bg-border shrink-0 mx-1" />
          {onClose && (
            <HeaderBtn onClick={() => setShowCloseDialog(true)} tooltip="Close"><X /></HeaderBtn>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-hidden bg-white flex flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">

          {workspaceView === 'overview' ? (
            // ── Overview layout: snapshot sidebar + energy/envelope column ──
            <div className="grid h-full min-h-0 grid-cols-[430px_minmax(0,1fr)] overflow-hidden">
              <BuildingSnapshotAside
                energyTotals={energyTotals}
                snapshotRows={snapshotRows}
                thermalRating={thermalRating}
                avgUValue={avgUValue}
                installedTechIds={buildingData?.installedTechIds ?? []}
                onUpdateParam={setGen}
                mode={mode}
              />
              <EnergyEnvelopeColumn
                uploadError={uploadError}
                onClearError={() => setUploadError(null)}
                elements={elements}
                selectedId={selectedId}
                onSelectElement={handleSelectElement}
                onUpdateElement={updateElement}
                roofConfig={roofConfig}
                isActive={workspaceView === 'overview'}
                buildingId={buildingLabel}
                initialTimeseries={buildingData?.timeseries ?? null}
                onSwitchToConfigure={handleSelectElement}
                mode={mode}
              />
            </div>
          ) : (
            // ── Configure layout: preview + demand (left) | group editor + selector (right) ──
            <div className="grid h-full min-h-0 grid-cols-[430px_minmax(0,1fr)] overflow-hidden">

              {/* ── Left column: 3D preview + preliminary energy demand ── */}
              <aside className="flex min-h-0 flex-col overflow-hidden border-r border-border/80 bg-slate-50/80">

                {/* 3D preview — takes all remaining vertical space */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border/60 bg-white">
                  <p className="shrink-0 px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    3D Preview
                  </p>
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

                {/* Surface group editor — fills available width */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
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
                  <SurfaceGroupEditor
                    selectedElementId={selectedId}
                    elements={elements}
                    onUpdateElement={updateElement}
                  />
                </div>

                {/* Group selector column — narrow, scrollable */}
                <div className="flex w-44 shrink-0 flex-col overflow-hidden border-l border-border/60 bg-slate-50/60">
                  <p className="sticky top-0 shrink-0 border-b border-border/60 bg-slate-50/90 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
                    Surfaces
                  </p>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <SurfaceGroupSelector
                      elements={elements}
                      selectedElementId={selectedId}
                      onSelect={handleElementSelect}
                    />
                  </div>
                </div>

              </section>

            </div>
          )}

        </div>

        {/* ── Footer: reset / apply ── */}
        <div className="border-t border-border/80 bg-white px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-end gap-2">
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
