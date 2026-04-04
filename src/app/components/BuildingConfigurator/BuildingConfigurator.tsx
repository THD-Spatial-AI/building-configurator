// Main building configurator panel.
// Owns all application state and handlers; delegates rendering to sub-components.

import React, { useState, useRef, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Download, Upload, X, Building2, RotateCcw, Check, AlertTriangle,
} from 'lucide-react';

import { ElementPanel } from './configure/ElementPanel';
import { GeneralConfig } from './configure/GeneralConfig';
import { BuildingVisualization } from './configure/BuildingVisualization';
import type { BuildingElement } from './configure/BuildingVisualization';
import { type EnergyTotals, type LoadDataPoint } from './overview/LoadProfileViewer';
import { RoofConfig, DEFAULT_ROOF_CONFIG } from './configure/RoofConfigurator';
import { SegmentedControl, SectionLabel, ConfiguratorStyles } from './shared/ui';
import { cn } from '../../../lib/utils';

import { DEFAULT_ELEMENTS, DEFAULT_GENERAL } from './shared/buildingDefaults';
import type { BuildingState, ThermalSummary } from '../../lib/buemAdapter';
import { formatCoordinates } from '../../lib/buemAdapter';
import {
  SnapshotStatus,
  getThermalRating,
  buildSnapshotRows,
  getThermalEfficiencyStatus,
} from './shared/snapshotUtils';
import { BuildingSnapshotAside } from './overview/BuildingSnapshotAside';
import { EnergyEnvelopeColumn } from './overview/EnergyEnvelopeColumn';
import { ElementList } from './configure/ElementList';

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
  const [hoveredId,     setHoveredId]     = useState<string | null>(null);
  const [uploadError,   setUploadError]   = useState<string | null>(null);
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({
    identity: true, metrics: true, demand: true,
    ventilation: false, internal: false, thermal: false, solver: false,
  });

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

  const toggleSection = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleReset = () => {
    setElements(initialElements);
    setGeneralRaw(initialGeneral);
    setRoofConfig(DEFAULT_ROOF_CONFIG);
    setSelectedId(null);
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

  const totalArea   = Object.values(elements).reduce((sum, e) => sum + (e.area || 0), 0);
  const avgUValue   = totalArea > 0
    ? Object.values(elements).reduce((sum, e) => sum + e.uValue * e.area, 0) / totalArea
    : 0;
  const thermalRating           = getThermalRating(avgUValue);
  const thermalEfficiencyStatus: SnapshotStatus = getThermalEfficiencyStatus(avgUValue);
  const snapshotRows            = buildSnapshotRows(general, elements, totalArea);
  const selectedElement         = selectedId ? elements[selectedId] ?? null : null;

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
            // ── Configure layout: element helper sidebar + edit workspace ──
            <div className="grid h-full min-h-0 grid-cols-[340px_minmax(0,1fr)] overflow-hidden">

              {/* Under development banner */}
              <div className="col-span-2 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3">
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700">Work in progress</span>
                <p className="text-xs text-amber-800">
                  The Configure view is still under development — please focus your feedback on the Overview for now.
                </p>
              </div>

              <aside className="min-h-0 border-r border-border/80 bg-slate-50/80 p-4">
                <div className="flex h-full min-h-0 flex-col gap-4">
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Active Element</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedElement ? selectedElement.label : 'No element selected'}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {selectedElement
                        ? `Editing ${selectedElement.type} with area ${selectedElement.area.toFixed(1)} m² and U-value ${selectedElement.uValue.toFixed(2)}.`
                        : 'Choose an element from the helper list or the mini preview below.'}
                    </p>
                  </section>

                  <section className="h-[260px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                    <div className="border-b border-border/80 px-4 py-3">
                      <p className="text-xs font-semibold text-foreground">Selection Helper</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        Keep a compact preview available while editing.
                      </p>
                    </div>
                    <div className="h-full overflow-hidden p-3">
                      <BuildingVisualization
                        elements={elements}
                        selectedId={selectedId}
                        hoveredId={hoveredId}
                        onSelect={setSelectedId}
                        onHover={setHoveredId}
                      />
                    </div>
                  </section>

                  <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                    <div className="border-b border-border/80 px-4 py-3">
                      <SectionLabel>Element Helper</SectionLabel>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        Select another surface without leaving configuration mode.
                      </p>
                    </div>
                    <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
                      <ElementList
                        elements={elements}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        roofConfig={roofConfig}
                      />
                    </div>
                  </section>
                </div>
              </aside>

              <section className="min-h-0 bg-[linear-gradient(180deg,rgba(250,250,252,0.9),rgba(255,255,255,1))] p-4">
                <div className="flex h-full min-h-0 flex-col gap-4">
                  {uploadError && (
                    <div className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 shadow-[0_10px_24px_rgba(239,68,68,0.08)]">
                      <p className="flex-1 text-[11px] leading-snug text-destructive">{uploadError}</p>
                      <button
                        type="button"
                        onClick={() => setUploadError(null)}
                        className="shrink-0 cursor-pointer text-sm leading-none text-destructive"
                      >×</button>
                    </div>
                  )}

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="flex min-h-full flex-col gap-4 pb-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Configuration</p>
                            <p className="mt-1 text-base font-semibold text-foreground">Editing workspace</p>
                            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                              Change detailed properties here without mixing them into the overview panels.
                            </p>
                          </div>
                          <div className="rounded-md bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                            {selectedElement ? selectedElement.label : 'No element selected'}
                          </div>
                        </div>
                      </div>

                      {selectedId ? (
                        <ElementPanel
                          selectedId={selectedId}
                          elements={elements}
                          onUpdate={updateElement}
                          onDeselect={() => setSelectedId(null)}
                          roofConfig={roofConfig}
                          onRoofConfigChange={setRoofConfig}
                        />
                      ) : (
                        <div className="rounded-lg border border-dashed border-border bg-white p-5 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                          <p className="text-sm font-semibold text-foreground">Select an element to start editing</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Use the overview column to inspect the building and choose a surface. Detailed parameters will open here.
                          </p>
                        </div>
                      )}

                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                        <GeneralConfig
                          mode={mode}
                          general={general}
                          setGen={setGen}
                          expanded={expanded}
                          toggle={toggleSection}
                        />
                      </div>
                    </div>
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
