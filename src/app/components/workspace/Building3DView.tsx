// One building, full screen: its 3D envelope in the middle, its load profile
// across the top, its parameters down the right, and a surface editor that
// pops up beside whichever surface was clicked.
//
// Escape backs out one level at a time — first the open surface, then the
// building itself, each asking first when it has unsaved edits.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, CircleHelp, Download, Layers, Loader2, Play, Table2, Undo2 } from '@/app/components/icons';
import { SurfaceGeometryViewer } from '../BuildingConfigurator/configure/surfaces/SurfaceGeometryViewer';
import { SurfaceQuickEditor } from './SurfaceQuickEditor';
import { BuildingDetailsCard, type DetailsTab } from '../BuildingConfigurator/overview/BuildingDetailsCard';
import { BuildingSnapshotAside } from '../BuildingConfigurator/overview/BuildingSnapshotAside';
import { LoadProfileBar } from './LoadProfileBar';
import { ConfiguratorStyles, SegmentedControl, UnsavedChangesDialog } from '../BuildingConfigurator/shared/ui';
import { BuildingEditor } from '../BuildingConfigurator/configure/building/BuildingEditor';
import { useBuildingModel } from '../BuildingConfigurator/useBuildingModel';
import { hasInvalidArea } from '../BuildingConfigurator/configure/model/buildingElements';
import { cn } from '@/lib/utils';
import { drawnSurfaceIds, isEnvelopeDetached, polygonArea, type SurfaceGeometry } from '../../lib/surfaceMesh';
import { useMediaQuery, WIDE_LAYOUT } from '../../lib/useMediaQuery';
import { tabulaUValueOptions } from '../../lib/ignisAdapter';
import { SurfacePanel } from './SurfacePanel';
import { SectionCard } from '../BuildingConfigurator/shared/SectionCard';
import { TOPICS } from '@/app/config/topics';
import { ModelLegend, PvHintPill, PvHoverCard, pvRenderSets, surfaceName, surfaceProduct, type PvMode } from './PvMode';
import { TechnologiesTab } from './TechnologiesTab';
import { StepHints, Tour } from './Guidance';
import { DEFAULT_WEATHER, WeatherSection, weatherChoice, type WeatherSelection } from './WeatherSection';
import type { WeatherOptions } from '../../lib/services';
import { PvSurfaceSection } from './PvSurfaceSection';
import type { Technologies } from './TechnologyCards';
import { StoreysModelled, toggleSelected } from './StoreysModelled';
import { storeyBands, storeyShares } from '../../lib/storeys';
import type { BuildingState } from '../../lib/buemAdapter';
import type { ConfiguratorServices } from '../../lib/services';
import type { BuildingDemandProfile } from '../../lib/demandProfile';
import type { EnergyTotals } from '../../lib/loadProfile';
import type { RunContext } from '../../lib/buemRun';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { DEFAULT_PV_MODULE } from '../../lib/pvLayout';
import { productModule } from '../../lib/pvProducts';
import { fittedPvIds, pvLayouts, unfittedPvIds } from '../../lib/pvSurfaces';
import { LanguageProvider, formatNumber, resolveLanguage, translate, type Translate } from '../../i18n';
import { buildingTypeName, isServiceBuildingType } from '../BuildingConfigurator/shared/buildingOptions';

type SurfaceSelection = { id: string };

/** BuEM's space heating per A_ref of the modelled storeys, or null when the figure is not BuEM's (ignis, an upload) or missing. */
function buemHeatingPerM2(
  totals: EnergyTotals,
  general: { floorArea: number; storeys: number; storeysModelled: number[] | null },
): number | null {
  const heating = Number(totals.heating);
  const aRef = general.floorArea * (general.storeysModelled?.length ?? general.storeys);
  const fromBuem = totals.heatingSource === undefined || totals.heatingSource === 'buem';
  return fromBuem && Number.isFinite(heating) && heating > 0 && aRef > 0 ? heating / aRef : null;
}

export interface Building3DViewProps {
  building: BuildingState;
  /** Null while the envelope geometry is still loading. */
  geometry: SurfaceGeometry | null;
  /** Leaves the building, handing back its edits (the building unchanged when there are none). */
  onExit: (building: BuildingState | undefined) => void;
  /**
   * The calls this view makes. Hold the object and each function in a module
   * constant, a useMemo or a useCallback: an inline object is a new identity
   * every render, and the effects here key on the callbacks they use.
   */
  services: ConfiguratorServices;
  /** The period a BuEM run covers. Without it a run covers 2018. */
  runContext?: RunContext;
  /**
   * The building's stored demand: undefined while it loads, null when none is
   * stored. Hold it stable; a new object resets the energy card to it.
   */
  demandProfile?: BuildingDemandProfile | null;
  /** Where the building's series CSV downloads from. Without it there is no download. */
  seriesCsvUrl?: string;
  /** Credits for the building's data, as its licences require; shown in a corner of the 3D view. */
  attribution?: ReactNode;
  /**
   * The building's PV. Its modules are drawn and a clicked surface shows its
   * PV settings on every tab; on the Technologies tab suggested surfaces are
   * highlighted and products can be dropped on surfaces. Controlled; hold it
   * stable as for `services`.
   */
  pv?: PvMode;
  /** The host's technologies on this building, shown as cards in a Technologies tab. Controlled; hold it stable as for `services`. */
  technologies?: Technologies;
  /** The mode the view opens in. The user can still switch; the next opening starts here again. */
  defaultMode?: 'basic' | 'expert';
  /** The tab the view opens on. Absent: Building. */
  defaultTab?: 'building' | 'technologies';
  /**
   * The language of the view's own text: en, de, es, fr, it, nl, pl or cs. A region tag counts as its
   * language (de-DE), anything else as en. Host-supplied text (PV notice, technology cards) is shown as passed.
   */
  language?: string;
  /**
   * The guided tour. With run true it starts as the view opens; onFinish is
   * called when it is finished or skipped, for the host to remember the visit.
   * The header's Tour button starts it again either way.
   */
  tour?: { run: boolean; onFinish: () => void };
}

export function Building3DView({
  building, geometry, onExit, services, runContext, demandProfile, seriesCsvUrl, attribution, pv, technologies, defaultMode = 'basic', defaultTab, language: languageCode, tour,
}: Building3DViewProps) {
  // No rating is shown here, so the annual demand estimate behind it is not run.
  // This component sits above its own LanguageProvider, so it translates directly.
  const language = resolveLanguage(languageCode);
  const t: Translate = useCallback((key, values) => translate(language, key, values), [language]);
  // Every surface that takes PV is laid out, with its own product's module,
  // for its capacity; only those with PV are drawn.
  const layouts = useMemo(() => {
    if (!pv) return {};
    const fallback = pv.module ?? DEFAULT_PV_MODULE;
    return pvLayouts(geometry?.surfaces ?? [], pv.surfaces, (id) => productModule(surfaceProduct(pv, id), fallback));
  }, [pv, geometry]);
  const pvModules = useMemo(
    () => Object.fromEntries(Object.entries(layouts).map(([id, layout]) => [id, layout.modules])),
    [layouts],
  );
  const pvSets = useMemo(() => (pv ? pvRenderSets(pv.surfaces) : null), [pv]);
  // A surface with PV on that fits no whole module is neither drawn as PV nor run.
  const installedPvIds = useMemo(() => (pv ? fittedPvIds(pv.surfaces, layouts) : []), [pv, layouts]);
  const installedPvSet = useMemo(() => new Set(installedPvIds), [installedPvIds]);
  const unfittedPv = useMemo(() => (pv ? unfittedPvIds(pv.surfaces, layouts) : []), [pv, layouts]);
  /** Null without the host's weather options, or while they load or after they failed: no weather choice. */
  const [weatherOptions, setWeatherOptions] = useState<WeatherOptions | null>(null);
  const [weatherSelection, setWeatherSelection] = useState<WeatherSelection>(DEFAULT_WEATHER);
  const { fetchWeatherOptions } = services;
  useEffect(() => {
    if (!fetchWeatherOptions) return;
    let cancelled = false;
    fetchWeatherOptions()
      .then((options) => { if (!cancelled) setWeatherOptions(options); })
      .catch((err) => console.error('[weather] options request failed', err));
    return () => { cancelled = true; };
  }, [fetchWeatherOptions]);
  const weather = useMemo(() => weatherChoice(weatherOptions, weatherSelection), [weatherOptions, weatherSelection]);
  const model = useBuildingModel(services, building, {
    estimateHeatDemand: false, runContext, weather, demandProfile, language,
    pvSurfaceIds: installedPvIds, pvLayouts: layouts,
    pvProductFor: pv ? (id) => surfaceProduct(pv, id)?.id : undefined,
  });
  const { elements } = model;
  // Below this the panel cannot sit beside the model, so it stacks under it and
  // the load profile moves inside it rather than taking a third band.
  const wide = useMediaQuery(WIDE_LAYOUT);
  const [selected, setSelected] = useState<SurfaceSelection | null>(null);
  /** The open surface as it was when its editor opened, to tell whether it was changed. */
  const [surfaceOriginal, setSurfaceOriginal] = useState<BuildingElement | null>(null);
  /** Where the editor was about to go when it asked about the open surface's changes. */
  const [pendingSurface, setPendingSurface] = useState<{ next: SurfaceSelection | null } | null>(null);
  /** Expert shows the full BuEM building parameters. */
  const [mode, setMode] = useState<'basic' | 'expert'>(defaultMode);
  /** The export choices, open over the header button. */
  const [exportOpen, setExportOpen] = useState(false);
  /** Leaving was asked for while there are unsaved edits. */
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  /** Bumped to turn the model towards a surface picked from a list. */
  const [focus, setFocus] = useState<{ id: string; token: number } | null>(null);
  /** The open tab of the panel on the right. */
  const [tab, setTab] = useState<DetailsTab>(defaultTab === 'technologies' ? 'technology' : 'building');
  /** On the Technologies tab, surfaces open their PV settings and take dropped products. */
  const onTech = tab === 'technology' && pv !== undefined;
  /** The PV surface under the pointer on the Technologies tab, for its hover card. */
  const [hover, setHover] = useState<{ id: string; at: { x: number; y: number } } | null>(null);
  /** While on, a click in the model selects a storey instead of a surface. */
  const [storeyMode, setStoreyMode] = useState(false);
  /** The storeys selected in the model or in the storey list, configured together. */
  const [selectedStoreys, setSelectedStoreys] = useState<number[]>([]);
  const leaveStoreyMode = () => setStoreyMode(false);
  const pickStorey = (storey: number | null) => {
    if (storey !== null) setSelectedStoreys((prev) => toggleSelected(prev, storey));
  };
  const [touring, setTouring] = useState(tour?.run ?? false);
  const tourRun = tour?.run ?? false;
  useEffect(() => { if (tourRun) setTouring(true); }, [tourRun]);
  const endTour = () => { setTouring(false); tour?.onFinish(); };
  /** A run was started in this view, so the step hints have done their work. */
  const [ran, setRan] = useState(false);

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

  /** Picks a surface from a list: shows it in the model and opens it in the panel. */
  const selectFromList = (id: string) => {
    leaveStoreyMode();
    setFocus((prev) => ({ id, token: (prev?.token ?? 0) + 1 }));
    requestSurface({ id });
  };

  /** A click in the model opens an envelope surface or a surface that takes PV. */
  const selectInModel = (id: string | null) => {
    requestSurface(id && (elements[id] || pv?.surfaces[id]) ? { id } : null);
  };

  /** A product dropped on a surface: it goes on that surface, which gets PV if it had none, and opens. */
  const dropProduct = (surfaceId: string, productId: string) => {
    const surface = pv?.surfaces[surfaceId];
    if (!pv || !surface) return;
    pv.onAssignProduct?.(surfaceId, productId);
    if (surface.state !== 'installed') pv.onToggle(surfaceId, true);
    requestSurface({ id: surfaceId });
  };

  const envelopeIds = useMemo(() => new Set(Object.keys(elements)), [elements]);
  const invalidIds = useMemo(
    () => new Set(Object.values(elements).filter(hasInvalidArea).map((el) => el.id)),
    [elements],
  );
  const surfaces = geometry?.surfaces ?? [];
  const drawnIds = useMemo(
    () => drawnSurfaceIds(geometry?.surfaces ?? [], building.envelope, envelopeIds),
    [geometry, building.envelope, envelopeIds],
  );
  /** Models only these storeys (null: all), each surface cut to its share inside them. */
  const setModelledStoreys = (modelled: number[] | null) => model.setStoreysModelled(
    modelled,
    modelled ? storeyShares(surfaces, elements, model.general.storeys, modelled) : {},
  );
  const hoverPv = useCallback((id: string | null, at?: { x: number; y: number }) => {
    setHover(id && at && pv?.surfaces[id] ? { id, at } : null);
  }, [pv]);

  // Held apart from the envelope: a surface edit fires on every pointer move
  // while a dial is dragged, and re-rendering a year of hourly data with it is
  // what makes that drag stutter.
  const { chartTimeseries, setGroundTruthTimeseries } = model;
  const profileBar = useMemo(() => (
    <LoadProfileBar
      timeseries={chartTimeseries ?? undefined}
      seriesCsvUrl={seriesCsvUrl}
      onGroundTruthChange={setGroundTruthTimeseries}
    />
  ), [chartTimeseries, seriesCsvUrl, setGroundTruthTimeseries]);
  const detached = isEnvelopeDetached(surfaces, envelopeIds);

  const { undo, undoLabel, hasUnsavedChanges, toBuildingState } = model;
  const requestExit = useCallback(() => {
    if (hasUnsavedChanges) setExitPromptOpen(true);
    else onExit(toBuildingState('current'));
  }, [hasUnsavedChanges, toBuildingState, onExit]);

  // Registered once and read through a ref: a host listener on document can
  // re-render this view while a key event is still on its way to window, and
  // a listener swapped during that dispatch never sees the event.
  const onKeyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  onKeyRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // An open prompt's own dialog, and the tour, close themselves on Escape.
      if (exitPromptOpen || pendingSurface || touring) return;
      if (exportOpen) setExportOpen(false);
      else if (storeyMode) leaveStoreyMode();
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
  useEffect(() => {
    // A view mounted by a key press is still in that press's dispatch and
    // would take it as its own.
    const mountedAt = performance.now();
    const onKey = (e: KeyboardEvent) => { if (e.timeStamp >= mountedAt) onKeyRef.current(e); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectedElement = selected ? elements[selected.id] : undefined;
  const selectedPv = selected ? pv?.surfaces[selected.id] : undefined;
  // The measured area of the clicked polygon, offered when the envelope's own
  // figure is missing or disagrees with it.
  const selectedGeometryArea = selected
    ? (() => {
        const polygon = surfaces.find((surface) => surface.id === selected.id);
        return polygon ? polygonArea(polygon.coordinates) : null;
      })()
    : null;

  // Envelope, then PV where the surface takes it; a roof of another building has only PV.
  const panelBody = selected && (selectedElement || selectedPv) ? (
    <div key={selected.id} className="flex flex-col gap-3 p-3">
      {selectedElement && (
        <SectionCard topic={TOPICS.envelope} title={t('surface.section.envelope')} info={t('help.envelope')}>
          <SurfaceQuickEditor
            element={selectedElement}
            geometryArea={selectedGeometryArea}
            uValuePresets={tabulaUValueOptions(model.ignis, selectedElement.type)}
            mode={mode}
            onUpdate={(patch) => model.updateElement(selected.id, patch)}
            onDelete={() => { model.deleteSurface(selected.id); openSurface(null); }}
          />
        </SectionCard>
      )}
      {selectedPv && pv && (
        <SectionCard topic={TOPICS.pv} title={t('surface.section.pv')} info={t('help.pv')}>
          <PvSurfaceSection
            surfaceId={selected.id}
            surface={selectedPv}
            pv={pv}
            elements={elements}
            layout={layouts[selected.id]}
            polygon={surfaces.find((surface) => surface.id === selected.id)}
            showGeometry={!selectedElement}
            onClose={() => openSurface(null)}
          />
        </SectionCard>
      )}
    </div>
  ) : null;
  const panelSubtitle = selectedElement
    ? `${selectedElement.label} · ${formatNumber(language, selectedElement.area, 1)} m² · U ${formatNumber(language, selectedElement.uValue, 2)} W/m²K`
    : selectedPv?.label;
  const pickable = useMemo(() => [
    ...Object.values(elements).map((element) => ({ id: element.id, label: element.label })),
    ...Object.entries(pv?.surfaces ?? {})
      .filter(([id]) => !elements[id])
      .map(([id, surface]) => ({ id, label: surface.label ?? id })),
  ], [elements, pv]);
  const surfacePanel = (
    <SurfacePanel
      docked={!wide}
      open={!storeyMode && panelBody !== null}
      title={selectedElement ? t(`surface.type.${selectedElement.type}`) : t('view.surface')}
      subtitle={storeyMode ? undefined : panelSubtitle}
      emptyText={t(storeyMode ? 'storeys.pickHint' : 'view.panel.empty')}
      picker={(
        <select
          aria-label={t('surface.pick')}
          value={selected?.id ?? ''}
          onChange={(e) => selectFromList(e.target.value)}
          className="h-8 w-full cursor-pointer rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
        >
          <option value="" disabled>{t('surface.pick')}</option>
          {pickable.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      )}
      onClose={() => requestSurface(null)}
    >
      {storeyMode ? null : panelBody}
    </SurfacePanel>
  );

  return (
    <LanguageProvider language={language}>
    <div lang={language} className="fixed inset-0 z-20 flex flex-col bg-muted">
      <ConfiguratorStyles />

      {/* ── Header ── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <button
          type="button"
          onClick={requestExit}
          title={t('view.back.title')}
          aria-keyshortcuts="Escape"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-3.5" />
          {t('view.back.label')}
          <kbd className="ml-0.5 rounded border border-border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground">Esc</kbd>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {model.buildingLabel} · {buildingTypeName(t, model.buildingType)}
          </p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {t('view.surfaceCount', { count: Object.keys(elements).length })}
            <span className="hidden sm:inline"> · {t('view.avgU', { value: formatNumber(language, model.avgUValue, 2) })}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTouring(true)}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <CircleHelp className="size-3.5" />
          <span className="hidden sm:inline">{t('tour.button')}</span>
        </button>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setExportOpen((open) => !open)}
            aria-expanded={exportOpen}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">{t('view.export.button')}</span>
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-[248px] overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
                <button
                  type="button"
                  onClick={() => { model.download(); setExportOpen(false); }}
                  className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <Download className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="block text-[12px] font-semibold text-foreground">{t('view.export.model.title')}</span>
                    <span className="block text-[10px] leading-snug text-muted-foreground">
                      {t('view.export.model.detail')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { model.downloadTables(); setExportOpen(false); }}
                  className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <Table2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="block text-[12px] font-semibold text-foreground">{t('view.export.tables.title')}</span>
                    <span className="block text-[10px] leading-snug text-muted-foreground">
                      {t('view.export.tables.detail')}
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
        <SegmentedControl
          options={[{ value: 'basic', label: t('view.mode.basic') }, { value: 'expert', label: t('view.mode.expert') }]}
          value={mode}
          onChange={(v) => setMode(v as 'basic' | 'expert')}
        />
      </div>

      {/* ── Wide: load profile + model | parameters. Narrow: model over parameters. ── */}
      <div className={cn('flex min-h-0 flex-1 gap-3 p-3', wide ? 'flex-row' : 'flex-col')}>
        {wide && surfacePanel}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div data-tour="model" className="relative min-h-[240px] flex-1 overflow-hidden rounded-lg border border-border bg-card">
          {!geometry ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('view.loadingGeometry')}
            </div>
          ) : surfaces.length > 0 && !detached ? (
            <SurfaceGeometryViewer
              surfaces={surfaces}
              selectedId={selected?.id ?? null}
              invalidIds={invalidIds}
              visibleIds={drawnIds}
              pvIds={installedPvSet}
              pvModules={pvModules}
              candidateIds={onTech ? pvSets?.suggested : undefined}
              onHoverSurface={onTech ? hoverPv : undefined}
              onDropProduct={onTech && pv?.onAssignProduct ? dropProduct : undefined}
              focusId={focus?.id}
              focusToken={focus?.token}
              storeys={{ count: model.general.storeys, modelled: model.general.storeysModelled, selected: selectedStoreys }}
              onSelectStorey={storeyMode ? pickStorey : undefined}
              onSelectSurface={selectInModel}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs leading-snug text-muted-foreground">
              {detached
                ? t('view.detached')
                : t('view.noGeometry')}
            </div>
          )}

          {geometry?.note && (
            <div className="absolute inset-x-3 top-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 shadow-sm">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {geometry.note}
            </div>
          )}

          {!onTech && surfaces.length > 0 && !detached && !geometry?.note && !storeyMode && !touring && (
            <StepHints surfaceOpened={selected !== null} edited={hasUnsavedChanges} ran={ran} />
          )}

          {!onTech && model.general.storeys > 1 && surfaces.length > 0 && !detached && (
            <button
              type="button"
              aria-pressed={storeyMode}
              onClick={() => {
                if (storeyMode) { leaveStoreyMode(); return; }
                requestSurface(null);
                setStoreyMode(true);
              }}
              className={cn(
                'absolute left-3 top-3 flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition-colors',
                storeyMode ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card/90 text-foreground hover:bg-muted',
              )}
            >
              <Layers className="size-3.5" />
              {t('storeys.pick')}
            </button>
          )}

          {undoLabel && (
            // Above the bottom row, which holds the credits and the legends.
            <button
              type="button"
              onClick={undo}
              title={t('view.undo.title', { action: t(undoLabel.key, undoLabel.values) })}
              className="absolute bottom-16 left-1/2 z-10 flex max-w-[80%] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-[13px] font-semibold text-amber-950 shadow-[0_6px_18px_rgba(27,36,48,0.25)] transition-colors hover:bg-amber-300"
            >
              <Undo2 className="size-4 shrink-0" />
              <span className="truncate">{t('view.undo.action', { action: t(undoLabel.key, undoLabel.values) })}</span>
              <kbd className="shrink-0 rounded border border-amber-950/25 bg-amber-300/60 px-1 font-sans text-[10px] font-medium">Ctrl Z</kbd>
            </button>
          )}

          <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1.5">
            {invalidIds.size > 0 && (
              <div className="flex items-center gap-1.5 rounded-md bg-card/90 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm">
                <span className="inline-block size-2.5 rounded-sm bg-destructive" />
                {t('view.invalidSurfaces', { count: invalidIds.size })}
              </div>
            )}
            {onTech && unfittedPv.length > 0 && (
              <div role="alert" className="flex max-w-[360px] items-start gap-1.5 rounded-md border border-destructive/30 bg-card/95 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-destructive shadow-sm">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                {t('pv.noFitOn', { count: unfittedPv.length, surfaces: unfittedPv.map((id) => surfaceName(id, elements, pv?.surfaces ?? {})).join(', ') })}
              </div>
            )}
            {!onTech && surfaces.length > 0 && !detached && <ModelLegend pv={false} />}
          </div>

          {/* On the Technologies tab the storey picker is not needed, so the legend takes its corner. */}
          {onTech && surfaces.length > 0 && !detached && (
            <div className="absolute left-3 top-3 flex max-w-[70%] flex-col items-start gap-2">
              <ModelLegend pv />
              {!geometry?.note && <PvHintPill />}
            </div>
          )}

          {attribution && (
            <div className="absolute bottom-3 right-3 max-w-[60%] rounded-md bg-card/90 px-2 py-1 text-right text-[10px] leading-snug text-muted-foreground shadow-sm">
              {attribution}
            </div>
          )}
        </div>
        </div>

        <div className={cn(
          'flex shrink-0 flex-col gap-3',
          wide ? 'w-[400px] xl:w-[520px]' : 'h-[46%] min-h-[220px] w-full',
        )}>
          <div data-tour="building" className="min-h-0 flex-1 overflow-y-auto">
            <BuildingDetailsCard
              snapshotRows={model.snapshotRows}
              occupancy={isServiceBuildingType(model.general.buildingType) ? undefined : {
                dwellings: model.general.residential_units,
                persons: model.general.num_persons,
              }}
              onEditField={model.setGen}
              activeTab={tab}
              onTabChange={(next) => { setTab(next); leaveStoreyMode(); }}
              technologySlot={pv || technologies ? (
                <TechnologiesTab
                  pv={pv}
                  technologies={technologies}
                  elements={elements}
                  layouts={layouts}
                  mode={mode}
                  onSelectSurface={selectFromList}
                />
              ) : undefined}
              parametersSlot={(
                // The BuEM building fields the table does not carry; Expert
                // shows more of them. No fixed height: the panel scrolls once.
                <div className="flex flex-col gap-3">
                  {model.general.storeys > 1 && (
                    <StoreysModelled
                      storeys={model.general.storeys}
                      modelled={model.general.storeysModelled}
                      selected={selectedStoreys}
                      onSelect={setSelectedStoreys}
                      floorAreaPerStorey={model.general.floorArea}
                      storeyHeight={surfaces.length > 0 ? storeyBands(surfaces, model.general.storeys).height : undefined}
                      roomHeight={model.general.roomHeight}
                      dwellings={isServiceBuildingType(model.general.buildingType) ? undefined : {
                        values: model.general.storeyDwellings,
                        onChange: (values) => model.setGen('storeyDwellings', values),
                      }}
                      disabled={surfaces.length === 0}
                      onChange={setModelledStoreys}
                    />
                  )}
                  {weatherOptions && Object.keys(weatherOptions.providers).length > 0 && (
                    <WeatherSection options={weatherOptions} selection={weatherSelection} onChange={setWeatherSelection} />
                  )}
                  <BuildingEditor
                    general={model.general}
                    setGen={model.setGen}
                    mode={mode}
                    onShowExpert={() => setMode('expert')}
                    insulation={{
                      elements,
                      levels: model.ignis?.variants ?? [],
                      states: model.refurbStates,
                      initial: model.refurbInitial,
                      variantCode: model.general.refurbishment.variantCode,
                      avgUValue: model.avgUValue,
                      onSetState: model.setRefurbishment,
                      onSetTypeUValue: model.setTypeUValue,
                      onSetTypeLossFactor: model.setTypeLossFactor,
                      onAddSurface: (type, values) => { model.createSurface(type, values); },
                      ...(model.canCompareLevels ? {
                        classes: { perM2: model.levelHeating, comparing: model.isComparingLevels, onCompare: model.compareLevels },
                      } : {}),
                    }}
                  />
                </div>
              )}
              overviewSlot={(
                <div className="flex flex-col gap-3">
                  {profileBar}
                  <BuildingSnapshotAside
                    energyTotals={model.displayEnergyTotals}
                    pvAnnualKwh={model.pvAnnualKwh}
                    heatingPerM2={buemHeatingPerM2(model.displayEnergyTotals, model.general)}
                  />
                </div>
              )}
            />
          </div>

          {model.uploadError && (
            <div className="flex shrink-0 items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="flex-1 text-[11px] leading-snug text-destructive">{t(model.uploadError.key, model.uploadError.values)}</p>
              <button
                type="button"
                onClick={() => model.setUploadError(null)}
                className="shrink-0 cursor-pointer text-sm leading-none text-destructive"
              >×</button>
            </div>
          )}

          <button
            type="button"
            data-tour="run"
            onClick={() => { setRan(true); model.runSimulation(); }}
            disabled={model.isRunningSimulation}
            className="flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(47,93,138,0.22)] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {model.isRunningSimulation
              ? <><Loader2 className="size-4 animate-spin" /> {t('view.run.working')}</>
              : <><Play className="size-4" /> {t('view.run.start')}</>}
          </button>
        </div>
      </div>

      {onTech && hover && pv?.surfaces[hover.id] && (
        <PvHoverCard surfaceId={hover.id} surface={pv.surfaces[hover.id]} elements={elements} at={hover.at} />
      )}

      {!wide && surfacePanel}

      {touring && <Tour onClose={endTour} />}

      <UnsavedChangesDialog
        open={pendingSurface !== null}
        message={t('view.discardSurface.message')}
        note={t('view.discardSurface.note')}
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
    </LanguageProvider>
  );
}
