// Main building configurator dialog: panel/selection state over useBuildingModel,
// which owns the building's data.

import React, { useState, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Download, Upload, X, Building2, RotateCcw, Check, AlertTriangle, Undo2,
} from 'lucide-react';

import type { BuildingElement } from './configure/model/buildingElements';
import { SegmentedControl, ConfiguratorStyles, ElementConfiguratorModal } from './shared/ui';
import type { BuildingState } from '../../lib/buemAdapter';
import { formatCoordinates } from '../../lib/buemAdapter';
import type { SurfacePolygon } from '../../lib/surfaceMesh';
import { ELEMENT_GROUP_LABELS, type ElementGroupKey } from './shared/elementListUtils';
import { BuildingSnapshotAside } from './overview/BuildingSnapshotAside';
import { EnergyEnvelopeColumn } from './overview/EnergyEnvelopeColumn';
import { SurfaceGroupGrid } from './configure/surfaces/SurfaceGroupGrid';
import { SurfaceGroupEditor } from './configure/surfaces/SurfaceGroupEditor';
import { EnvelopeSurfaceSection } from './configure/surfaces/EnvelopeSurfaceSection';
import { BuildingEditor } from './configure/building/BuildingEditor';
import { PvSurfaceManager } from './configure/pv/PvSurfaceManager';
import { BatteryEditor } from './configure/pv/BatteryEditor';
import { TECH_REGISTRY } from '../../config/techRegistry';
import { useBuildingModel } from './useBuildingModel';

// --- Header icon button (local — only used in this file) ----------------------

function HeaderBtn({
  onClick, children, tooltip, disabled,
}: { onClick?: () => void; children: React.ReactNode; tooltip?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className="size-7 flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted transition-colors duration-100 shrink-0 [&_svg]:size-4 disabled:cursor-not-allowed disabled:opacity-40"
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
  /** The building's 3D envelope, rendered in the overview's Building Envelope
   *  tab. Its polygon ids are the envelope element ids. Absent leaves that tab
   *  showing the group cards alone. */
  geometry?: { surfaces: SurfacePolygon[]; note?: string } | null;
}

/** Full-screen panel for inspecting and editing a building's energy model configuration. */
export function BuildingConfigurator({ onClose, buildingData, geometry }: BuildingConfiguratorProps) {
  const model = useBuildingModel(buildingData);
  const {
    elements, general, roofConfig, surfacePvConfigs, batteryConfig, ignis,
    uploadError, isRunningSimulation, pvInvalidated, hasUnsavedChanges, chartTimeseries,
    baselineElements, buildingLabel, buildingType, coordinates, avgUValue, thermalRating,
    snapshotRows, displayEnergyTotals, pvInstalledSurfaces, totalPvCapacityKw, pvSummary,
    installedTechIds, setGen, updateElement, renameElement, applyRoofType, updateSurfacePv,
    updateBattery, setTechInstalled, selectIgnisVariant, runSimulation, download, upload,
    setUploadError, setGroundTruthTimeseries, setPvInvalidated,
  } = model;

  const [mode,          setMode]          = useState<'basic' | 'expert'>('basic');
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [surfaceEditorTab, setSurfaceEditorTab] = useState<'properties' | 'pv'>('properties');
  // null = element configurator modal closed; a panel name opens it on that content.
  const [panelView,     setPanelView]     = useState<string | null>(null);
  /** The group type currently driving the surface-group grid in the center panel. */
  const [activeGroupType, setActiveGroupType] = useState<ElementGroupKey | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Removes a surface, then keeps the panel on its group rather than a dead selection. */
  const deleteSurface = (id: string) => {
    const deletedType = model.deleteSurface(id);
    if (selectedId !== id) return;
    setSelectedId(null);
    setActiveGroupType((deletedType as ElementGroupKey | null) ?? null);
    setPanelView(deletedType ? 'surface-group' : null);
  };

  const createSurface = (type: BuildingElement['type']) => {
    const next = model.createSurface(type);
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

  /** Navigates to the battery editor panel. */
  const handleTechnologyBatterySelect = () => {
    setPanelView('technology-battery');
    setSelectedId(null);
    setActiveGroupType(null);
  };

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

  /** Replaces the roof elements, then shows the regenerated surfaces. */
  const handleApplyRoofType = (newRoofElements: Record<string, BuildingElement>) => {
    applyRoofType(newRoofElements);
    setSelectedId(null);
    setActiveGroupType('roof');
    setPanelView('surface-group');
  };

  /** Called when the user clicks a surface in the overview's 3D envelope. */
  const handleSurfaceSelect = (elementId: string) => {
    setSelectedId(elementId);
    setSurfaceEditorTab('properties');
    const el = elements[elementId];
    if (el) setActiveGroupType(el.type as ElementGroupKey);
  };

  /** Called when the user clicks an element row in the surface selector.
   *  Selects the element and switches to its surface panel. */
  const handleElementSelect = (elementId: string) => {
    handleSurfaceSelect(elementId);
    setPanelView('surface-group');
  };

  const handleReset = () => {
    model.reset();
    setSelectedId(null);
    setActiveGroupType(null);
    setPanelView(null);
  };

  // One instance, rendered either in the overview's 3D envelope section or in
  // the group modal — never both at once. Keyed so a different surface gets a
  // fresh editor without remounting the 3D view beside it, whose camera would
  // otherwise snap back to the framing it opened with.
  const surfaceEditor = selectedId && elements[selectedId] ? (
    <SurfaceGroupEditor
      key={selectedId}
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
  ) : null;

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
          <HeaderBtn
            onClick={model.undo}
            tooltip={model.undoLabel ? `Undo ${model.undoLabel.toLowerCase()}` : 'Nothing to undo'}
            disabled={!model.undoLabel}
          ><Undo2 /></HeaderBtn>
          <div className="w-px h-5 bg-border shrink-0 mx-1" />
          <HeaderBtn onClick={download} tooltip="Export as BUEM GeoJSON"><Download /></HeaderBtn>
          <HeaderBtn onClick={() => fileInputRef.current?.click()} tooltip="Import BUEM or legacy JSON"><Upload /></HeaderBtn>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={upload} />
          <div className="w-px h-5 bg-border shrink-0 mx-1" />
          {onClose && (
            <HeaderBtn
              onClick={() => (hasUnsavedChanges ? setShowCloseDialog(true) : onClose())}
              tooltip="Close"
            ><X /></HeaderBtn>
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
              onToggleTech={setTechInstalled}
              onOpenTech={handleTechnologyOpen}
              mode={mode}
            />
            <EnergyEnvelopeColumn
              uploadError={uploadError}
              onClearError={() => setUploadError(null)}
              elements={elements}
              baselineElements={baselineElements}
              roofConfig={roofConfig}
              isActive
              buildingId={buildingLabel}
              initialTimeseries={chartTimeseries}
              onGroundTruthChange={setGroundTruthTimeseries}
              mode={mode}
              snapshotRows={snapshotRows}
              onEditField={setGen}
              onOpenAdvanced={handleBuildingSelect}
              onEditGroup={handleGroupTypeSelect}
              envelopeSlot={geometry ? (
                <EnvelopeSurfaceSection
                  surfaces={geometry.surfaces}
                  note={geometry.note}
                  elements={elements}
                  selectedId={selectedId}
                  onSelectSurface={handleSurfaceSelect}
                  editorSlot={panelView === null ? surfaceEditor : null}
                />
              ) : undefined}
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
              onClick={runSimulation}
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

        <div className="flex min-h-0 flex-1 flex-col">
          {panelView === 'building' ? (
            <BuildingEditor
              general={general}
              setGen={setGen}
              mode={mode}
              ignis={ignis}
              onIgnisVariantSelect={selectIgnisVariant}
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
              editorSlot={surfaceEditor ?? undefined}
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
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                Unsaved Changes
              </DialogPrimitive.Title>
            </div>

            <div className="mb-4">
              <p className="text-sm text-foreground mb-2">
                You have unsaved changes to this building configuration. What would you like to do?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-[6px] px-3 py-2">
                <p className="text-xs text-amber-800">
                  Closing without saving will discard all modifications made since the last Apply.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloseDialog(false)}
                className="px-3 py-1.5 text-sm font-medium text-foreground border border-border rounded-[6px] hover:bg-muted transition-colors cursor-pointer"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => { runSimulation(); onClose?.(); setShowCloseDialog(false); }}
                className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-[6px] hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Save &amp; Close
              </button>
              <button
                type="button"
                onClick={() => { onClose?.(); setShowCloseDialog(false); }}
                className="px-3 py-1.5 text-sm font-medium rounded-[6px] transition-colors cursor-pointer text-destructive border border-destructive/30 hover:bg-destructive/5"
              >
                Discard Changes
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
