import React, { useState, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Download, Upload, X, Building2, RotateCcw, Check, AlertTriangle,
} from 'lucide-react';

import { ElementPanel } from './ElementPanel';
import { GeneralConfig } from './GeneralConfig';
import { BuildingVisualization, SVG_ELEMENTS } from './BuildingVisualization';
import { RoofConfig, DEFAULT_ROOF_CONFIG } from './RoofConfigurator';
import {
  T, NumberInput, SegmentedControl, SectionLabel,
  ELEMENT_DOTS, ConfiguratorStyles,
} from './ui';
import { cn } from '@/lib/utils';
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
};

const SVG_IDS = new Set(SVG_ELEMENTS.map((e) => e.id));

// --- Helpers --------------------------------------------------------------

function azimuthLabel(az: number) {
  if (az < 22.5 || az >= 337.5) return 'North-facing';
  if (az < 67.5)  return 'NE-facing';
  if (az < 112.5) return 'East-facing';
  if (az < 157.5) return 'SE-facing';
  if (az < 202.5) return 'South-facing';
  if (az < 247.5) return 'SW-facing';
  if (az < 292.5) return 'West-facing';
  return 'NW-facing';
}

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

// --- Compact compass ----------------------------------------------------------

function CompassWidget({ azimuth, onChange }: { azimuth: number; onChange: (v: number) => void }) {
  const cx = 38, cy = 38, r = 26;
  const rad = (azimuth - 90) * (Math.PI / 180);
  const ax = cx + r * Math.cos(rad);
  const ay = cy + r * Math.sin(rad);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = 76 / rect.width;
    const sy = 76 / rect.height;
    const dx = (e.clientX - rect.left) * sx - cx;
    const dy = (e.clientY - rect.top) * sy - cy;
    let a = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (a < 0) a += 360;
    if (a >= 360) a -= 360;
    onChange(Math.round(a));
  };

  return (
    <div className="flex items-center gap-3">
      <svg
        width={76} height={76}
        viewBox="0 0 76 76"
        style={{ cursor: 'crosshair', flexShrink: 0 }}
        onClick={handleClick}
      >
        <circle cx={cx} cy={cy} r={r + 8} fill={T.inputBg} stroke={T.border} strokeWidth={1} />
        {[0, 90, 180, 270].map((deg) => {
          const tr = (deg - 90) * (Math.PI / 180);
          return (
            <line key={deg}
              x1={cx + (r + 2) * Math.cos(tr)} y1={cy + (r + 2) * Math.sin(tr)}
              x2={cx + (r + 7) * Math.cos(tr)} y2={cy + (r + 7) * Math.sin(tr)}
              stroke={deg === 0 ? '#c53030' : T.border} strokeWidth={1.5}
            />
          );
        })}
        <line x1={cx} y1={cy} x2={ax} y2={ay} stroke={T.primary} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={ax} cy={ay} r={4} fill={T.primary} />
        <circle cx={cx} cy={cy} r={3} fill={T.foreground} />
        <text x={cx}   y={5}    textAnchor="middle" fontSize="8" fill="#c53030" fontWeight="700" style={{ userSelect: 'none' }}>N</text>
        <text x={cx}   y={74}   textAnchor="middle" fontSize="8" fill={T.mutedFg} style={{ userSelect: 'none' }}>S</text>
        <text x={73}   y={cy+3} textAnchor="middle" fontSize="8" fill={T.mutedFg} style={{ userSelect: 'none' }}>E</text>
        <text x={4}    y={cy+3} textAnchor="middle" fontSize="8" fill={T.mutedFg} style={{ userSelect: 'none' }}>W</text>
      </svg>
      <div className="flex-1">
        <NumberInput
          value={azimuth}
          onChange={(v) => {
            let a = ((v % 360) + 360) % 360;
            onChange(Math.round(a));
          }}
          unit="°"
          min={0} max={359} step={1}
        />
        <p className="text-[10px] text-muted-foreground mt-1">{azimuthLabel(azimuth)}</p>
      </div>
    </div>
  );
}

// --- Element list ------------------------------------------------------------

interface ElementListProps {
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  roofConfig: RoofConfig;
}

function ElementList({ elements, selectedId, onSelect, roofConfig }: ElementListProps) {
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

  const renderElement = (el: BuildingElement) => {
    const active = selectedId === el.id;
    const inSvg  = SVG_IDS.has(el.id);
    const dot    = ELEMENT_DOTS[el.type];

    return (
      <button
        key={el.id}
        type="button"
        onClick={() => onSelect(el.id)}
        className={cn(
          'h-7 px-2 rounded-md flex items-center gap-2 cursor-pointer w-full text-left transition-colors duration-100 select-none',
          active ? 'bg-primary' : 'hover:bg-muted',
        )}
      >
        <span
          className="size-2 rounded-full shrink-0"
          style={{
            backgroundColor: dot,
            outline: active ? '2px solid rgba(255,255,255,0.7)' : 'none',
            outlineOffset: 1,
          }}
        />
        <span className={cn('flex-1 min-w-0 text-[11px] font-medium leading-tight truncate', active ? 'text-primary-foreground' : 'text-foreground')}>
          {el.label}
        </span>
        <span className={cn('text-[9px] shrink-0', active ? 'text-white/70' : 'text-muted-foreground')}>
          {el.area.toFixed(1)} m² · U {el.uValue}
        </span>
        {!inSvg && (
          <span className={cn(
            'px-1 py-px rounded text-[8px] border border-dashed shrink-0',
            active ? 'border-white/40 text-white/60' : 'border-border text-muted-foreground',
          )}>
            hidden
          </span>
        )}
      </button>
    );
  };

  const roofInfo = getRoofInfo();

  return (
    <div className="mt-3">
      <SectionLabel>Building Elements</SectionLabel>
      <div className="mt-2 flex flex-col gap-2">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((type) => {
          const items = grouped[type];
          if (items.length === 0) return null;

          const displayCount       = type === 'roof' ? roofInfo.count : items.length;
          const displayDescription = type === 'roof' ? roofInfo.description : null;

          return (
            <div key={type} className="border border-border rounded-lg overflow-hidden bg-card">
              {/* Group header */}
              <div className="px-2 py-1 bg-input-background border-b border-border flex items-center gap-1.5">
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_DOTS[type] }}
                />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.5px]">
                  {typeLabels[type]}
                </span>
                <span className="text-[9px] text-muted-foreground ml-auto">
                  {displayDescription ?? displayCount}
                </span>
              </div>
              {/* Rows */}
              <div className="p-1 flex flex-col gap-0.5">
                {items.map(renderElement)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main component ----------------------------------------------------------

interface BuildingConfiguratorProps {
  onClose?: () => void;
}

export function BuildingConfigurator({ onClose }: BuildingConfiguratorProps) {
  const [mode,        setMode]       = useState<'basic' | 'expert'>('basic');
  const [elements,    setElements]   = useState(DEFAULT_ELEMENTS);
  const [general,     setGeneralRaw] = useState(DEFAULT_GENERAL);
  const [roofConfig,  setRoofConfig] = useState<RoofConfig>(DEFAULT_ROOF_CONFIG);
  const [selectedId,  setSelectedId] = useState<string | null>(null);
  const [hoveredId,   setHoveredId]  = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expanded,    setExpanded]   = useState<Record<string, boolean>>({
    identity: true, metrics: true,
    ventilation: false, internal: false, thermal: false, solver: false,
  });

  const [savedState,       setSavedState]       = useState({ elements: DEFAULT_ELEMENTS, general: DEFAULT_GENERAL, roofConfig: DEFAULT_ROOF_CONFIG });
  const [showCloseDialog,  setShowCloseDialog]  = useState(false);

  const hasUnsavedChanges = JSON.stringify({ elements, general, roofConfig }) !== JSON.stringify(savedState);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---------------------------------------------------------------

  const updateElement = (id: string, patch: Partial<BuildingElement>) =>
    setElements((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

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

  return (
    <div className="cfg-panel w-[1020px] h-[820px] rounded-xl shadow-2xl flex flex-col bg-card overflow-hidden">
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
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left column — 340 px */}
        <div className="w-[340px] shrink-0 border-r border-border flex flex-col">
          {/* Building summary */}
          <div className="shrink-0 p-3 pb-2 bg-card border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-2">
              Building Overview
            </p>
            <div className="flex gap-2">
              {[
                { label: 'Total Area', value: totalArea.toFixed(1), unit: 'm²' },
                { label: 'Avg U-value', value: avgUValue.toFixed(2), unit: 'W/m²K' },
                { label: 'Elements', value: String(Object.keys(elements).length), unit: 'surfaces' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="flex-1 bg-input-background border border-border rounded-md p-2">
                  <p className="text-[9px] text-muted-foreground mb-1">{label}</p>
                  <p className="text-base font-bold text-foreground leading-none">{value}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{unit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable area */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Upload error */}
            {uploadError && (
              <div className="mb-2 bg-red-50 border border-red-200 rounded-md px-2.5 py-2 flex items-start gap-1.5">
                <p className="text-[11px] text-destructive leading-snug flex-1">{uploadError}</p>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-destructive cursor-pointer text-sm leading-none shrink-0"
                >×</button>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground mb-2">
              Click any surface on the building to open its attribute editor →
            </p>

            <BuildingVisualization
              elements={elements}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
            />

            <ElementList
              elements={elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              roofConfig={roofConfig}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 overflow-y-auto p-3">
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
            <div className="border border-dashed border-border rounded-xl p-6 mb-3 text-center bg-input-background">
              <p className="text-xs text-muted-foreground">
                Click a building surface or select an element from the list to configure its properties.
              </p>
            </div>
          )}

          <GeneralConfig
            mode={mode}
            general={general}
            setGen={setGen}
            expanded={expanded}
            toggle={toggleSection}
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="h-11 shrink-0 px-4 border-t border-border bg-card flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer transition-colors duration-100"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex items-center gap-1.5 px-4 py-1 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer transition-colors duration-100"
        >
          <Check className="size-3.5" />
          Apply
        </button>
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
