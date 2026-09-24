// One building, full screen: its 3D envelope in the middle, its load profile
// across the top, its parameters down the right, and a surface editor that
// pops up beside whichever surface was clicked.
//
// Escape backs out one level at a time — first the open surface, then the
// building itself, each asking first when it has unsaved edits.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Download, Loader2, Play, Table2, Undo2 } from 'lucide-react';
import { SurfaceGeometryViewer } from '../BuildingConfigurator/configure/surfaces/SurfaceGeometryViewer';
import { SurfaceQuickEditor } from './SurfaceQuickEditor';
import { BuildingDetailsCard } from '../BuildingConfigurator/overview/BuildingDetailsCard';
import { BuildingSnapshotAside } from '../BuildingConfigurator/overview/BuildingSnapshotAside';
import { CostSummaryCard } from '../BuildingConfigurator/overview/CostSummaryCard';
import { RenewablesKpis } from '../BuildingConfigurator/overview/RenewablesKpis';
import { PvPlanner } from './PvPlanner';
import { pvCandidates } from '../BuildingConfigurator/shared/pvSuitability';
import { DEFAULT_PV_CONFIG, createSurfacePvConfig } from '../BuildingConfigurator/shared/buildingDefaults';
import { TechnologiesSection } from '../BuildingConfigurator/overview/TechnologiesSection';
import { LoadProfileBar } from './LoadProfileBar';
import { ConfiguratorStyles, SegmentedControl, UnsavedChangesDialog } from '../BuildingConfigurator/shared/ui';
import { BuildingEditor } from '../BuildingConfigurator/configure/building/BuildingEditor';
import { BatteryEditor } from '../BuildingConfigurator/configure/pv/BatteryEditor';
import { PvEditor } from '../BuildingConfigurator/configure/pv/PvEditor';
import { useBuildingModel } from '../BuildingConfigurator/useBuildingModel';
import { hasInvalidArea } from '../BuildingConfigurator/configure/model/buildingElements';
import { cn } from '@/lib/utils';
import { isEnvelopeDetached, polygonArea, type SurfaceGeometry } from '../../lib/surfaceMesh';
import { useMediaQuery, WIDE_LAYOUT } from '../../lib/useMediaQuery';
import { tabulaUValueOptions } from '../../lib/ignisAdapter';
import { SurfacePopover, anchorCard } from './SurfacePopover';
import type { BuildingState } from '../../lib/buemAdapter';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';

type SurfaceSelection = { id: string; at: { x: number; y: number } };

export interface Building3DViewProps {
  building: BuildingState;
  /** Null while the envelope geometry is still loading. */
  geometry: SurfaceGeometry | null;
  /** Leaves the building, handing back its edits (the building unchanged when there are none). */
  onExit: (building: BuildingState | undefined) => void;
}

export function Building3DView({ building, geometry, onExit }: Building3DViewProps) {
  // No rating is shown here, so the annual demand estimate behind it is not run.
  const model = useBuildingModel(building, { estimateHeatDemand: false });
  const { elements } = model;
  // Below this the panel cannot sit beside the model, so it stacks under it and
  // the load profile moves inside it rather than taking a third band.
  const wide = useMediaQuery(WIDE_LAYOUT);
  const [selected, setSelected] = useState<SurfaceSelection | null>(null);
  /** The open surface as it was when its editor opened, to tell whether it was changed. */
  const [surfaceOriginal, setSurfaceOriginal] = useState<BuildingElement | null>(null);
  /** Where the editor was about to go when it asked about the open surface's changes. */
  const [pendingSurface, setPendingSurface] = useState<{ next: SurfaceSelection | null } | null>(null);
  /** The PV planner is open: its candidates are lit in the model while it is. */
  const [pvPlannerOpen, setPvPlannerOpen] = useState(false);
  /** Expert shows the full BuEM building parameters and technology settings. */
  const [mode, setMode] = useState<'basic' | 'expert'>('basic');
  /** Which technology's own parameters are open, if any. */
  const [techPanel, setTechPanel] = useState<'battery' | null>(null);
  /** The surface whose full PV parameters are open, if any. */
  const [pvEditorId, setPvEditorId] = useState<string | null>(null);
  /** The export choices, open over the header button. */
  const [exportOpen, setExportOpen] = useState(false);
  /** Leaving was asked for while there are unsaved edits. */
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  /** Bumped to turn the model towards a surface picked from a list. */
  const [focus, setFocus] = useState<{ id: string; token: number } | null>(null);

  const openSurface = (next: SurfaceSelection | null) => {
    setSelected(next);
    setSurfaceOriginal(next ? elements[next.id] ?? null : null);
  };

  /** Moves the editor to another surface, or closes it, asking first when the open one was changed. */
  const requestSurface = (next: SurfaceSelection | null) => {
    if (selected && next?.id === selected.id) {
      setSelected(next);
      return;
    }
    const changed = selected !== null && surfaceOriginal !== null
      && JSON.stringify(elements[selected.id]) !== JSON.stringify(surfaceOriginal);
    if (changed) setPendingSurface({ next });
    else openSurface(next);
  };

  /** Picks a surface from a list: shows it in the model and opens its editor. */
  const selectFromList = (id: string) => {
    setFocus((prev) => ({ id, token: (prev?.token ?? 0) + 1 }));
    // The card places itself against the surface as soon as the turn starts, so
    // this is only where it appears from.
    requestSurface({ id, at: { x: window.innerWidth / 2, y: window.innerHeight / 2 } });
  };
  // The editor follows its surface while the model turns. That is a per-frame
  // move, so the viewer writes to the node instead of pushing state through a
  // tree that carries a chart and a parameter table.
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const movePopover = useCallback((at: { x: number; y: number }) => {
    if (popoverRef.current) anchorCard(popoverRef.current, at);
  }, []);

  const envelopeIds = useMemo(() => new Set(Object.keys(elements)), [elements]);
  const invalidIds = useMemo(
    () => new Set(Object.values(elements).filter(hasInvalidArea).map((el) => el.id)),
    [elements],
  );
  const surfaces = geometry?.surfaces ?? [];

  const pvIds = useMemo(
    () => new Set(model.pvInstalledSurfaces.map(({ element }) => element.id)),
    [model.pvInstalledSurfaces],
  );
  const candidates = useMemo(
    () => pvCandidates(elements, DEFAULT_PV_CONFIG.usable_area_pct),
    [elements],
  );
  const candidateIds = useMemo(
    () => new Set(candidates.map((candidate) => candidate.element.id)),
    [candidates],
  );

  // Held apart from the envelope: a surface edit fires on every pointer move
  // while a dial is dragged, and re-rendering a year of hourly data with it is
  // what makes that drag stutter.
  const { buildingLabel, chartTimeseries, setGroundTruthTimeseries } = model;
  const profileBar = useMemo(() => (
    <LoadProfileBar
      buildingId={buildingLabel}
      timeseries={chartTimeseries ?? undefined}
      onGroundTruthChange={setGroundTruthTimeseries}
    />
  ), [buildingLabel, chartTimeseries, setGroundTruthTimeseries]);
  const detached = isEnvelopeDetached(surfaces, envelopeIds);

  const { undo, undoLabel, hasUnsavedChanges, toBuildingState } = model;
  const requestExit = useCallback(() => {
    if (hasUnsavedChanges) setExitPromptOpen(true);
    else onExit(toBuildingState('current'));
  }, [hasUnsavedChanges, toBuildingState, onExit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // An open prompt's own dialog closes itself on Escape.
        if (exitPromptOpen || pendingSurface) return;
        if (exportOpen) setExportOpen(false);
        else if (selected) requestSurface(null);
        else requestExit();
        return;
      }
      // Not while typing into a field, where the browser's own undo applies.
      const typing = e.target instanceof HTMLElement
        && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (!typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, exportOpen, exitPromptOpen, pendingSurface, requestSurface, requestExit, undo]);

  const selectedElement = selected ? elements[selected.id] : undefined;
  // The measured area of the clicked polygon, offered when the envelope's own
  // figure is missing or disagrees with it.
  const selectedGeometryArea = selected
    ? (() => {
        const polygon = surfaces.find((surface) => surface.id === selected.id);
        return polygon ? polygonArea(polygon.coordinates) : null;
      })()
    : null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-slate-100">
      <ConfiguratorStyles />

      {/* ── Header ── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <button
          type="button"
          onClick={requestExit}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-3.5" />
          Map
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {model.buildingLabel} · {model.buildingType}
          </p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {Object.keys(elements).length} surfaces
            <span className="hidden sm:inline"> · avg U {model.avgUValue.toFixed(2)} W/m²K</span>
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setExportOpen((open) => !open)}
            aria-expanded={exportOpen}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-[248px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
                <button
                  type="button"
                  onClick={() => { model.download(); setExportOpen(false); }}
                  className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <Download className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                  <span>
                    <span className="block text-[12px] font-semibold text-slate-700">Model (JSON)</span>
                    <span className="block text-[10px] leading-snug text-muted-foreground">
                      BuEM GeoJSON: everything a simulation needs
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { model.downloadTables(); setExportOpen(false); }}
                  className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <Table2 className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                  <span>
                    <span className="block text-[12px] font-semibold text-slate-700">Tables (CSV)</span>
                    <span className="block text-[10px] leading-snug text-muted-foreground">
                      building.csv and surfaces.csv, zipped
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
        <SegmentedControl
          options={[{ value: 'basic', label: 'Basic' }, { value: 'expert', label: 'Expert' }]}
          value={mode}
          onChange={(v) => setMode(v as 'basic' | 'expert')}
        />
        <button
          type="button"
          onClick={undo}
          disabled={!undoLabel}
          title={undoLabel ? `Undo ${undoLabel.toLowerCase()} (Ctrl+Z)` : 'Nothing to undo'}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Undo2 className="size-3.5" />
          <span className="hidden sm:inline">{undoLabel ? `Undo ${undoLabel.toLowerCase()}` : 'Undo'}</span>
        </button>
      </div>

      {/* ── Wide: load profile + model | parameters. Narrow: model over parameters. ── */}
      <div className={cn('flex min-h-0 flex-1 gap-3 p-3', wide ? 'flex-row' : 'flex-col')}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="relative min-h-[240px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {!geometry ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading surface geometry…
            </div>
          ) : surfaces.length > 0 && !detached ? (
            <SurfaceGeometryViewer
              surfaces={surfaces}
              selectedId={selected?.id ?? null}
              invalidIds={invalidIds}
              visibleIds={envelopeIds}
              pvIds={pvIds}
              candidateIds={pvPlannerOpen ? candidateIds : undefined}
              focusId={focus?.id}
              focusToken={focus?.token}
              onSelectSurface={(id, at) => requestSurface(id && elements[id] && at ? { id, at } : null)}
              onSelectedAnchorMove={wide ? movePopover : undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs leading-snug text-muted-foreground">
              {detached
                ? 'This geometry belongs to a different City2TABULA generation than the envelope, so no surface can be matched to it. Reload the buildings to fetch both from the current one.'
                : 'City2TABULA holds no 3D geometry for this building.'}
            </div>
          )}

          {geometry?.note && (
            <div className="absolute inset-x-3 top-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 shadow-sm">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {geometry.note}
            </div>
          )}

          {invalidIds.size > 0 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
              <span className="inline-block size-2.5 rounded-sm bg-destructive" />
              {invalidIds.size} surface{invalidIds.size > 1 ? 's' : ''} a simulation would reject
            </div>
          )}
        </div>
        </div>

        <div className={cn(
          'flex shrink-0 flex-col gap-3',
          wide ? 'w-[360px] xl:w-[440px]' : 'h-[46%] min-h-[220px] w-full',
        )}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <BuildingDetailsCard
              snapshotRows={model.snapshotRows}
              onEditField={model.setGen}
              elements={elements}
              baselineElements={model.baselineElements}
              roofConfig={model.roofConfig}
              onSelectSurface={selectFromList}
              parametersSlot={mode === 'expert' ? (
                // Air, thermal mass, calculation method and refurbishment
                // level: the BuEM building fields the table does not carry.
                <div className="h-[460px] border-t border-slate-100">
                  <BuildingEditor
                    general={model.general}
                    setGen={model.setGen}
                    mode={mode}
                    ignis={model.ignis}
                    onIgnisVariantSelect={model.selectIgnisVariant}
                    avgUValue={model.avgUValue}
                    hideIdentity
                  />
                </div>
              ) : undefined}
              overviewSlot={(
                <div className="flex flex-col gap-3">
                  {profileBar}
                  <BuildingSnapshotAside
                    energyTotals={model.displayEnergyTotals}
                    thermalRating={model.thermalRating}
                    showThermalRating={false}
                    avgUValue={model.avgUValue}
                    installedTechIds={model.installedTechIds}
                    pvSummary={model.pvSummary}
                    mode="basic"
                    embedded
                    showEstimateNotice={false}
                    showTechnologies={false}
                  />
                  <RenewablesKpis
                    pvSurfaces={model.pvInstalledSurfaces}
                    elements={elements}
                    battery={model.batteryConfig}
                  />
                </div>
              )}
              technologySlot={(
                <div className="flex flex-col gap-3">
                  <TechnologiesSection
                    installedTechIds={model.installedTechIds}
                    pvSummary={model.pvSummary}
                    onToggle={model.setTechInstalled}
                    onOpen={(id) => {
                      if (id === 'solar_pv') setPvPlannerOpen((open) => !open);
                      if (id === 'battery') setTechPanel((open) => (open === 'battery' ? null : 'battery'));
                    }}
                  />
                  {techPanel === 'battery' && (
                    <div className="h-[460px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <BatteryEditor battery={model.batteryConfig} onUpdate={model.updateBattery} mode={mode} />
                    </div>
                  )}
                  {pvPlannerOpen && (
                    <PvPlanner
                      candidates={candidates}
                      installedIds={pvIds}
                      // Only the switch: the array takes its angles from the
                      // surface and its size from the coverage share, and the
                      // module comes from the building.
                      onToggle={(candidate, installed) =>
                        model.updateSurfacePv(candidate.element.id, { installed })}
                      onSelect={selectFromList}
                      onConfigure={mode === 'expert' ? setPvEditorId : undefined}
                    />
                  )}
                  {pvEditorId && elements[pvEditorId] && (
                    <div className="h-[460px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <PvEditor
                        key={pvEditorId}
                        pvConfig={model.surfacePvConfigs[pvEditorId] ?? createSurfacePvConfig(elements[pvEditorId])}
                        onUpdate={(patch) => model.updateSurfacePv(pvEditorId, patch)}
                        mode={mode}
                        // The panel takes its angles from the surface it was
                        // installed on, not from the largest south-facing roof
                        // that notice describes.
                        roofInferred={false}
                      />
                    </div>
                  )}
                  <CostSummaryCard
                    pvSurfaces={model.pvInstalledSurfaces}
                    battery={model.batteryConfig}
                  />
                </div>
              )}
            />
          </div>

          {model.uploadError && (
            <div className="flex shrink-0 items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="flex-1 text-[11px] leading-snug text-destructive">{model.uploadError}</p>
              <button
                type="button"
                onClick={() => model.setUploadError(null)}
                className="shrink-0 cursor-pointer text-sm leading-none text-destructive"
              >×</button>
            </div>
          )}

          <button
            type="button"
            onClick={model.runSimulation}
            disabled={model.isRunningSimulation}
            className="flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(47,93,138,0.22)] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {model.isRunningSimulation
              ? <><Loader2 className="size-4 animate-spin" /> Working out the energy…</>
              : <><Play className="size-4" /> Save &amp; preview energy</>}
          </button>
        </div>
      </div>

      {selected && selectedElement && (
        <SurfacePopover
          at={selected.at}
          cardRef={popoverRef}
          title={`${selectedElement.type[0].toUpperCase()}${selectedElement.type.slice(1)}`}
          subtitle={`${selectedElement.area.toFixed(1)} m² · U ${selectedElement.uValue.toFixed(2)} W/m²K`}
          onClose={() => requestSurface(null)}
        >
          <SurfaceQuickEditor
            key={selected.id}
            element={selectedElement}
            geometryArea={selectedGeometryArea}
            uValuePresets={tabulaUValueOptions(model.ignis, selectedElement.type)}
            pv={model.surfacePvConfigs[selected.id] ?? null}
            mode={mode}
            onUpdate={(patch) => model.updateElement(selected.id, patch)}
            onUpdatePv={(patch) => model.updateSurfacePv(selected.id, patch)}
            onDelete={() => { model.deleteSurface(selected.id); openSurface(null); }}
          />
        </SurfacePopover>
      )}

      <UnsavedChangesDialog
        open={pendingSurface !== null}
        message="You changed this surface. Keep the changes?"
        note="Discarding puts the surface back as it was when its editor opened."
        onCancel={() => setPendingSurface(null)}
        onSave={() => { openSurface(pendingSurface?.next ?? null); setPendingSurface(null); }}
        onDiscard={() => {
          if (surfaceOriginal) model.restoreElement(surfaceOriginal);
          openSurface(pendingSurface?.next ?? null);
          setPendingSurface(null);
        }}
      />

      <UnsavedChangesDialog
        open={exitPromptOpen}
        onCancel={() => setExitPromptOpen(false)}
        onSave={() => onExit(toBuildingState('current'))}
        onDiscard={() => onExit(toBuildingState('saved'))}
      />
    </div>
  );
}
