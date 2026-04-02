import React, { useState, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Download, Upload, X, Building2, RotateCcw, Check, AlertTriangle, ChevronDown,
} from 'lucide-react';

import { ElementPanel } from './ElementPanel';
import { GeneralConfig } from './GeneralConfig';
import { BuildingVisualization } from './BuildingVisualization';
import { LoadProfileViewer } from './LoadProfileViewer';
import { RoofConfig, DEFAULT_ROOF_CONFIG } from './RoofConfigurator';
import {
  SegmentedControl, SectionLabel,
  ELEMENT_DOTS, ConfiguratorStyles,
} from './ui';
import { cn } from '../../lib/utils';
import type { BuildingElement } from './BuildingVisualization';

// --- Default state --------------------------------------------------------------

const DEFAULT_ELEMENTS: Record<string, BuildingElement> = {
  south_wall:     { id: 'south_wall',     label: 'South Wall',     type: 'wall',   area: 56.0, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180 },
  east_wall:      { id: 'east_wall',      label: 'East Wall',      type: 'wall',   area: 37.8, uValue: 0.24, gValue: null, tilt: 90, azimuth: 90  },
  north_wall:     { id: 'north_wall',     label: 'North Wall',     type: 'wall',   area: 56.0, uValue: 0.24, gValue: null, tilt: 90, azimuth: 0   },
  west_wall:      { id: 'west_wall',      label: 'West Wall',      type: 'wall',   area: 37.8, uValue: 0.24, gValue: null, tilt: 90, azimuth: 270 },
  roof:           { id: 'roof',           label: 'Roof',           type: 'roof',   area: 98.0, uValue: 0.18, gValue: null, tilt: 35, azimuth: 180 },
  floor:          { id: 'floor',          label: 'Ground Floor',   type: 'floor',  area: 90.0, uValue: 0.30, gValue: null, tilt: 0,  azimuth: 0   },
  south_window_1: { id: 'south_window_1', label: 'South Window 1', type: 'window', area: 4.5,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 180 },
  south_window_2: { id: 'south_window_2', label: 'South Window 2', type: 'window', area: 4.5,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 180 },
  east_window:    { id: 'east_window',    label: 'East Window',    type: 'window', area: 3.0,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 90  },
  door:           { id: 'door',           label: 'Front Door',     type: 'door',   area: 2.1,  uValue: 1.80, gValue: null, tilt: 90, azimuth: 180 },
};

const DEFAULT_GENERAL = {
  buildingType:       'MFH',
  constructionPeriod: 'Post-2010',
  country:            'DE',
  floorArea:          363.4,
  roomHeight:         2.7,
  storeys:            4,
  n_air_infiltration: 0.4,
  n_air_use:          0.4,
  phi_int:            3.0,
  q_w_nd:             12.5,
  massClass:          'Medium',
  c_m:                110,
  use_milp:           false,
  electricityDemand:  4000,
  spaceHeatingDemand: 15000,
  dhwDemand:          2500,
};

// --- Header icon button --------------------------------------------------------

function HeaderBtn({
  onClick, children, tooltip,
}: { onClick?: () => void; children: React.ReactNode; tooltip?: string }) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className="size-7 flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted transition-colors duration-100 shrink-0 [&_svg]:size-4"
    >
      {children}
    </button>
  );
  return btn;
}

// --- Element list ------------------------------------------------------------

interface ElementListProps {
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  roofConfig: RoofConfig;
}

function ElementList({ elements, selectedId, onSelect, roofConfig }: ElementListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    wall: true,
    roof: false,
    floor: false,
    window: false,
    door: false,
  });

  const grouped = {
    wall:   Object.values(elements).filter(e => e.type === 'wall'),
    window: Object.values(elements).filter(e => e.type === 'window'),
    door:   Object.values(elements).filter(e => e.type === 'door'),
    roof:   Object.values(elements).filter(e => e.type === 'roof'),
    floor:  Object.values(elements).filter(e => e.type === 'floor'),
  };

  const typeLabels: Record<string, string> = {
    wall: 'Walls', window: 'Windows', door: 'Doors', roof: 'Roof', floor: 'Floor',
  };

  const getRoofInfo = () => {
    const n = roofConfig.surfaces.length;
    const desc: Record<string, string> = {
      flat: '1 surface · low-slope',
      'mono-pitch': '1 surface · single slope',
      gabled: '2 surfaces · S + N',
      hipped: '4 surfaces · S/N/E/W',
      'v-shape': '2 surfaces · inward slopes',
      'saw-tooth': `${n} surfaces · S-facing`,
      custom: `${n} surface${n !== 1 ? 's' : ''} · custom`,
    };
    return { count: n, description: desc[roofConfig.type] ?? `${n} surfaces` };
  };

  const roofInfo = getRoofInfo();

  return (
    <div className="flex flex-col gap-2">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((type) => {
          const items = grouped[type];
          if (items.length === 0) return null;

          const isExpanded         = expandedGroups[type] ?? false;
          const totalTypeArea      = items.reduce((sum, item) => sum + item.area, 0);
          const displayCount       = type === 'roof' ? roofInfo.count : items.length;
          const displayDescription = type === 'roof' ? roofInfo.description : null;

          return (
            <div key={type} className="overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,1))] shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
              <button
                type="button"
                onClick={() => setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }))}
                className="flex w-full items-center gap-2 border-b border-border/70 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100/80"
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_DOTS[type] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">{typeLabels[type]}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {displayCount} surface{displayCount !== 1 ? 's' : ''}
                    {displayDescription ? ` · ${displayDescription}` : ` · ${totalTypeArea.toFixed(1)} m²`}
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {displayCount}
                </div>
                <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')} />
              </button>

              {isExpanded && (
                <div className="px-2 py-2">
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full table-fixed border-collapse text-left">
                      <thead className="bg-slate-100/90 text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5 font-semibold">Surface</th>
                          <th className="w-16 px-2 py-1.5 font-semibold">Area</th>
                          <th className="w-16 px-2 py-1.5 font-semibold">U</th>
                          <th className="w-16 px-2 py-1.5 font-semibold">Az</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white text-[11px]">
                        {items.map((el) => {
                          const active = selectedId === el.id;

                          return (
                            <tr
                              key={el.id}
                              className={cn(
                                'cursor-pointer border-t border-slate-100 transition-colors',
                                active ? 'bg-primary/10' : 'hover:bg-slate-50',
                              )}
                              onClick={() => onSelect(el.id)}
                            >
                              <td className="px-2 py-2 font-medium text-foreground">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="size-2 rounded-full shrink-0"
                                    style={{ backgroundColor: ELEMENT_DOTS[el.type] }}
                                  />
                                  <span className="truncate">{el.label}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-muted-foreground">{el.area.toFixed(1)}</td>
                              <td className="px-2 py-2 text-muted-foreground">{el.uValue.toFixed(2)}</td>
                              <td className="px-2 py-2 text-muted-foreground">{Math.round(el.azimuth)}°</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function SummaryCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  const accent = label === 'Total Area'
    ? 'from-sky-50 to-white text-sky-700 border-sky-200'
    : label === 'Avg U-value'
      ? 'from-amber-50 to-white text-amber-700 border-amber-200'
      : 'from-emerald-50 to-white text-emerald-700 border-emerald-200';

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-br px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]',
      accent,
    )}>
      <p className="text-[9px] text-muted-foreground uppercase tracking-[0.06em]">{label}</p>
      <p className="mt-1 text-lg font-bold leading-none text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{unit}</p>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-right text-[11px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

function ElementTypeCard({
  label, count, area, type,
}: { label: string; count: number; area: number; type: keyof typeof ELEMENT_DOTS }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,1))] p-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2">
        <span
          className="size-2 rounded-full shrink-0"
          style={{ backgroundColor: ELEMENT_DOTS[type] }}
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold leading-none text-foreground">{count}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{area.toFixed(1)} m² total area</p>
    </div>
  );
}

// --- Main component ----------------------------------------------------------

interface BuildingConfiguratorProps {
  onClose?: () => void;
}

export function BuildingConfigurator({ onClose }: BuildingConfiguratorProps) {
  const [workspaceView, setWorkspaceView] = useState<'overview' | 'configure'>('overview');
  const [mode,        setMode]       = useState<'basic' | 'expert'>('basic');
  const [elements,    setElements]   = useState(DEFAULT_ELEMENTS);
  const [general,     setGeneralRaw] = useState(DEFAULT_GENERAL);
  const [roofConfig,  setRoofConfig] = useState<RoofConfig>(DEFAULT_ROOF_CONFIG);
  const [selectedId,  setSelectedId] = useState<string | null>(null);
  const [hoveredId,   setHoveredId]  = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expanded,    setExpanded]   = useState<Record<string, boolean>>({
    identity: true, metrics: true, demand: true,
    ventilation: false, internal: false, thermal: false, solver: false,
  });

  const [savedState,       setSavedState]       = useState({ elements: DEFAULT_ELEMENTS, general: DEFAULT_GENERAL, roofConfig: DEFAULT_ROOF_CONFIG });
  const [showCloseDialog,  setShowCloseDialog]  = useState(false);

  const hasUnsavedChanges = JSON.stringify({ elements, general, roofConfig }) !== JSON.stringify(savedState);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setElements(DEFAULT_ELEMENTS);
    setGeneralRaw(DEFAULT_GENERAL);
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

  const totalArea = Object.values(elements).reduce((sum, e) => sum + (e.area || 0), 0);
  const avgUValue = totalArea > 0
    ? Object.values(elements).reduce((sum, e) => sum + e.uValue * e.area, 0) / totalArea
    : 0;
  const buildingStats = [
    { label: 'Total Area', value: totalArea.toFixed(1), unit: 'm²' },
    { label: 'Avg U-value', value: avgUValue.toFixed(2), unit: 'W/m²K' },
    { label: 'Elements', value: String(Object.keys(elements).length), unit: 'surfaces' },
  ];
  const selectedElement = selectedId ? elements[selectedId] ?? null : null;
  const elementOverview = [
    { type: 'wall' as const, label: 'Walls', count: Object.values(elements).filter((element) => element.type === 'wall').length, area: Object.values(elements).filter((element) => element.type === 'wall').reduce((sum, element) => sum + element.area, 0) },
    { type: 'roof' as const, label: 'Roofs', count: roofConfig.surfaces.length, area: Object.values(elements).filter((element) => element.type === 'roof').reduce((sum, element) => sum + element.area, 0) },
    { type: 'floor' as const, label: 'Floors', count: Object.values(elements).filter((element) => element.type === 'floor').length, area: Object.values(elements).filter((element) => element.type === 'floor').reduce((sum, element) => sum + element.area, 0) },
    { type: 'window' as const, label: 'Windows', count: Object.values(elements).filter((element) => element.type === 'window').length, area: Object.values(elements).filter((element) => element.type === 'window').reduce((sum, element) => sum + element.area, 0) },
    { type: 'door' as const, label: 'Doors', count: Object.values(elements).filter((element) => element.type === 'door').length, area: Object.values(elements).filter((element) => element.type === 'door').reduce((sum, element) => sum + element.area, 0) },
  ];

  return (
    <div className="cfg-panel h-[min(920px,calc(100vh-24px))] w-[min(1540px,calc(100vw-20px))] rounded-2xl shadow-2xl flex flex-col bg-card overflow-hidden">
      <ConfiguratorStyles />

      {/* ── Header ── */}
      <div className="h-[52px] shrink-0 px-4 flex items-center gap-3 bg-card border-b border-border">
        {/* Icon + title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="size-7 bg-foreground rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight">Building 3 · MFH</p>
            <p className="text-[11px] text-muted-foreground leading-tight">48.1351° N, 11.5820° E</p>
          </div>
        </div>

        {/* Controls */}
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
      <div className="min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))]">
        {workspaceView === 'overview' ? (
          <div className="grid h-full min-h-0 grid-cols-[430px_minmax(0,1fr)] overflow-hidden">
            <aside className="min-h-0 border-r border-border/80 bg-slate-50/80 p-4">
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="rounded-2xl border border-slate-200/90 bg-white/80 px-4 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Overview</p>
                  <p className="mt-1 text-base font-semibold text-foreground">Building dashboard</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    Review building-wide performance, inspect the envelope composition, and enter configuration mode only when you need to make changes.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWorkspaceView('configure')}
                    className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    Open configuration workspace
                  </button>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Building Snapshot</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">Building 3</p>
                      <p className="text-sm text-muted-foreground">Multi-Family House</p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                      {mode}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {buildingStats.map(({ label, value, unit }) => (
                      <SummaryCard key={label} label={label} value={value} unit={unit} />
                    ))}
                  </div>

                  <div className="mt-4 divide-y divide-border/70 rounded-xl border border-slate-200/80 bg-white/80 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <SnapshotRow label="Coordinates" value="48.1351° N, 11.5820° E" />
                    <SnapshotRow label="Building type" value={general.buildingType} />
                    <SnapshotRow label="Construction period" value={general.constructionPeriod} />
                    <SnapshotRow label="Country / region" value={general.country} />
                    <SnapshotRow label="Floor area" value={`${general.floorArea.toFixed(1)} m²`} />
                    <SnapshotRow label="Approx. volume" value={`${(general.floorArea * general.roomHeight).toFixed(0)} m³`} />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                  <div className="mb-3">
                    <SectionLabel>Element Composition</SectionLabel>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Counts and aggregate area by element type.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {elementOverview.map(({ type, label, count, area }) => (
                      <ElementTypeCard key={type} type={type} label={label} count={count} area={area} />
                    ))}
                  </div>
                </section>

                <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                  <div className="border-b border-border/80 px-4 py-3">
                    <SectionLabel>Elements</SectionLabel>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Browse the available elements. Selecting one opens the dedicated configuration workspace.
                    </p>
                  </div>
                  <div className="h-full overflow-y-auto px-4 pb-4 pt-3">
                    <ElementList
                      elements={elements}
                      selectedId={selectedId}
                      onSelect={handleSelectElement}
                      roofConfig={roofConfig}
                    />
                  </div>
                </section>
              </div>
            </aside>

            <section className="min-h-0 bg-[linear-gradient(180deg,rgba(250,250,252,0.9),rgba(255,255,255,1))] p-4">
              <div className="flex h-full min-h-0 flex-col gap-4">
                {uploadError && (
                  <div className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 shadow-[0_10px_24px_rgba(239,68,68,0.08)]">
                    <p className="flex-1 text-[11px] leading-snug text-destructive">{uploadError}</p>
                    <button
                      type="button"
                      onClick={() => setUploadError(null)}
                      className="shrink-0 cursor-pointer text-sm leading-none text-destructive"
                    >×</button>
                  </div>
                )}

                <section className="h-[320px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                  <LoadProfileViewer buildingId="Building 3" />
                </section>

                <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_42px_rgba(15,23,42,0.08)]">
                  <div className="border-b border-border/80 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground">3D Building Overview</p>
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                          Review surfaces in context. Selecting a surface takes you into configuration mode with that element loaded.
                        </p>
                      </div>
                      {selectedId && (
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-full overflow-hidden p-3">
                    <BuildingVisualization
                      elements={elements}
                      selectedId={selectedId}
                      hoveredId={hoveredId}
                      onSelect={handleSelectElement}
                      onHover={setHoveredId}
                    />
                  </div>
                </section>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-[340px_minmax(0,1fr)] overflow-hidden">
            <aside className="min-h-0 border-r border-border/80 bg-slate-50/80 p-4">
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="rounded-2xl border border-slate-200/90 bg-white/80 px-4 py-4 shadow-[0_12px_24px_rgba(15,23,42,0.05)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Configure</p>
                  <p className="mt-1 text-base font-semibold text-foreground">Editing workspace</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    Minimal helper context stays here while detailed editing controls remain on the right.
                  </p>
                  <button
                    type="button"
                    onClick={() => setWorkspaceView('overview')}
                    className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Return to overview
                  </button>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Active Element</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedElement ? selectedElement.label : 'No element selected'}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                    {selectedElement
                      ? `Editing ${selectedElement.type} with area ${selectedElement.area.toFixed(1)} m² and U-value ${selectedElement.uValue.toFixed(2)}.`
                      : 'Choose an element from the helper list or the mini preview below.'}
                  </p>
                </section>

                <section className="h-[260px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
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

                <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
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
              <div className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 shadow-[0_10px_24px_rgba(239,68,68,0.08)]">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Configuration</p>
                      <p className="mt-1 text-base font-semibold text-foreground">Editing workspace</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                        Change detailed properties here without mixing them into the overview panels.
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                      {selectedElement ? `${selectedElement.label}` : 'No element selected'}
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
                  <div className="rounded-2xl border border-dashed border-border bg-white p-5 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
                    <p className="text-sm font-semibold text-foreground">Select an element to start editing</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use the overview column to inspect the building and choose a surface. Detailed parameters will open here.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_32px_rgba(15,23,42,0.08)]">
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

        <div className="border-t border-border/80 bg-white px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-slate-50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-100 hover:bg-muted"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90 shadow-[0_10px_20px_rgba(47,93,138,0.22)]"
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
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-xl p-6 shadow-xl w-full max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
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
                  <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
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
                className="px-3 py-1.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                Continue Editing
              </button>
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={() => { handleApply(); onClose?.(); setShowCloseDialog(false); }}
                  className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Save &amp; Close
                </button>
              )}
              <button
                type="button"
                onClick={() => { onClose?.(); setShowCloseDialog(false); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer',
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
