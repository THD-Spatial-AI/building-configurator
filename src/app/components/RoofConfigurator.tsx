import React, { useState } from 'react';
import { ShieldCheck, CloudDownload, Sun, Check, Plus, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { T, NumberInput, RangeSlider, FieldRow, FieldLabel, SegmentedControl, SectionLabel } from './ui';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoofSurface {
  id: string;
  name: string;
  tilt: number;
  azimuth: number;
  area: number;
  usefulArea: number;
  useForPV: boolean;
  fromCityData: boolean;
}

export type RoofType = 'flat' | 'mono-pitch' | 'gabled' | 'hipped' | 'v-shape' | 'saw-tooth' | 'custom';

export interface RoofConfig {
  type: RoofType;
  surfaces: RoofSurface[];
  from3DData: boolean;
}

// ─── Roof type definitions ────────────────────────────────────────────────────

interface RoofTypeDef {
  id: RoofType;
  label: string;
  subtitle: string;
  path: string;
}

const ROOF_TYPES: RoofTypeDef[] = [
  { id: 'flat',       label: 'Flat',       subtitle: '1 surface · low-slope',    path: 'M8,32 H72' },
  { id: 'mono-pitch', label: 'Mono-pitch', subtitle: '1 surface · single slope', path: 'M8,34 L72,14' },
  { id: 'gabled',     label: 'Gabled',     subtitle: '2 surfaces · S + N',       path: 'M8,36 L40,10 L72,36' },
  { id: 'hipped',     label: 'Hipped',     subtitle: '4 surfaces · S/N/E/W',     path: 'M8,36 L22,14 L58,14 L72,36' },
  { id: 'v-shape',    label: 'Butterfly',  subtitle: '2 inward slopes · ↓ PV',   path: 'M8,12 L40,36 L72,12' },
  { id: 'saw-tooth',  label: 'Saw-tooth',  subtitle: '3+ S-facing slopes',       path: 'M8,36 L8,18 L26,36 L26,18 L44,36 L44,18 L62,36' },
  { id: 'custom',     label: 'Custom',     subtitle: 'Define manually',           path: 'M8,36 L16,22 L30,28 L46,12 L60,20 L72,36' },
];

// ─── Default surfaces per roof type ──────────────────────────────────────────

const DEFAULT_SURFACES: Record<RoofType, Omit<RoofSurface, 'id'>[]> = {
  flat:        [{ name: 'Flat Roof',   tilt: 3,  azimuth: 180, area: 90, usefulArea: 76, useForPV: true,  fromCityData: false }],
  'mono-pitch':[{ name: 'Main Slope',  tilt: 15, azimuth: 180, area: 96, usefulArea: 82, useForPV: true,  fromCityData: false }],
  gabled: [
    { name: 'South Slope', tilt: 35, azimuth: 180, area: 52, usefulArea: 44, useForPV: true,  fromCityData: false },
    { name: 'North Slope', tilt: 35, azimuth: 0,   area: 52, usefulArea: 18, useForPV: false, fromCityData: false },
  ],
  hipped: [
    { name: 'South Face', tilt: 35, azimuth: 180, area: 44, usefulArea: 37, useForPV: true,  fromCityData: false },
    { name: 'North Face', tilt: 35, azimuth: 0,   area: 44, usefulArea: 12, useForPV: false, fromCityData: false },
    { name: 'East Face',  tilt: 35, azimuth: 90,  area: 28, usefulArea: 20, useForPV: false, fromCityData: false },
    { name: 'West Face',  tilt: 35, azimuth: 270, area: 28, usefulArea: 20, useForPV: false, fromCityData: false },
  ],
  'v-shape': [
    { name: 'East Wing', tilt: 20, azimuth: 90,  area: 52, usefulArea: 0, useForPV: false, fromCityData: false },
    { name: 'West Wing', tilt: 20, azimuth: 270, area: 52, usefulArea: 0, useForPV: false, fromCityData: false },
  ],
  'saw-tooth': [
    { name: 'S-Slope 1', tilt: 15, azimuth: 180, area: 30, usefulArea: 26, useForPV: true, fromCityData: false },
    { name: 'S-Slope 2', tilt: 15, azimuth: 180, area: 30, usefulArea: 26, useForPV: true, fromCityData: false },
    { name: 'S-Slope 3', tilt: 15, azimuth: 180, area: 30, usefulArea: 26, useForPV: true, fromCityData: false },
  ],
  custom: [],
};

// ─── Demo 3D city data (CityGML LoD2) ────────────────────────────────────────

interface Demo3D { source: string; buildingRef: string; surfaces: Omit<RoofSurface, 'id'>[] }

const DEMO_3D: Partial<Record<RoofType, Demo3D>> = {
  gabled: {
    source: 'CityGML LoD2', buildingRef: 'DEBW_0123456789',
    surfaces: [
      { name: 'South Slope', tilt: 38.5, azimuth: 176.2, area: 54.8, usefulArea: 47.2, useForPV: true,  fromCityData: true },
      { name: 'North Slope', tilt: 38.5, azimuth: 356.2, area: 54.8, usefulArea: 16.4, useForPV: false, fromCityData: true },
    ],
  },
  hipped: {
    source: 'CityGML LoD2', buildingRef: 'DEBW_0123456789',
    surfaces: [
      { name: 'South Face', tilt: 32.1, azimuth: 178.5, area: 44.2, usefulArea: 38.6, useForPV: true,  fromCityData: true },
      { name: 'North Face', tilt: 32.1, azimuth: 358.5, area: 44.2, usefulArea: 12.8, useForPV: false, fromCityData: true },
      { name: 'East Face',  tilt: 32.1, azimuth: 88.5,  area: 28.6, usefulArea: 21.4, useForPV: false, fromCityData: true },
      { name: 'West Face',  tilt: 32.1, azimuth: 268.5, area: 28.6, usefulArea: 18.2, useForPV: false, fromCityData: true },
    ],
  },
  flat: {
    source: 'CityGML LoD2', buildingRef: 'DEBW_0123456789',
    surfaces: [{ name: 'Flat Roof', tilt: 2.8, azimuth: 0, area: 92.4, usefulArea: 78.6, useForPV: true, fromCityData: true }],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function buildSurfaces(type: RoofType, use3D: boolean): RoofSurface[] {
  const demo = DEMO_3D[type];
  const base = use3D && demo ? demo.surfaces : DEFAULT_SURFACES[type];
  return base.map((s) => ({ ...s, id: uid() }));
}

/** PV yield score 0–100 based on tilt and azimuth (simplified). */
function pvScore(tilt: number, az: number) {
  const tiltS = Math.max(0, 1 - Math.abs(tilt - 35) / 50);
  const azRad = (((az % 360) + 360) % 360 - 180) * (Math.PI / 180);
  const azS   = (Math.cos(azRad) + 1) / 2;
  const score = Math.round(tiltS * azS * 100);

  if (score >= 78) return { score, label: 'Excellent', color: '#16a34a', bg: '#dcfce7' };
  if (score >= 56) return { score, label: 'Good',      color: '#65a30d', bg: '#ecfccb' };
  if (score >= 34) return { score, label: 'Fair',      color: '#ca8a04', bg: '#fef9c3' };
  if (score >= 12) return { score, label: 'Poor',      color: '#ea580c', bg: '#ffedd5' };
  return             { score, label: 'Not suitable', color: '#dc2626', bg: '#fee2e2' };
}

function cardinalDir(az: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

function tiltDesc(t: number) {
  if (t <= 5)  return 'Flat / near-horizontal';
  if (t <= 20) return 'Low-pitch';
  if (t <= 40) return 'Standard pitch (optimal for PV)';
  if (t <= 60) return 'Steep pitch';
  return 'Very steep / near-vertical';
}

// ─── Mini compass SVG ─────────────────────────────────────────────────────────

function MiniCompass({ azimuth }: { azimuth: number }) {
  const cx = 24, cy = 24, r = 16;
  const rad = (azimuth - 90) * (Math.PI / 180);
  const ax  = cx + r * Math.cos(rad);
  const ay  = cy + r * Math.sin(rad);
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={22} fill={T.inputBg} stroke={T.border} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r}  fill="none" stroke={T.border} strokeWidth={0.6} strokeDasharray="2 3" />
      <line x1={cx} y1={cy} x2={ax} y2={ay} stroke={T.primary} strokeWidth={2} strokeLinecap="round" />
      <circle cx={ax} cy={ay} r={3} fill={T.primary} />
      <circle cx={cx} cy={cy} r={2.5} fill={T.foreground} />
      <circle cx={cx} cy={3}  r={3} fill="#c53030" />
      <text x={cx} y={2.5} textAnchor="middle" fontSize="6" fill="white" fontWeight="700" style={{ userSelect: 'none' }}>N</text>
    </svg>
  );
}

// ─── Tilt diagram SVG ─────────────────────────────────────────────────────────

function TiltDiagram({ tilt }: { tilt: number }) {
  const rad = tilt * (Math.PI / 180);
  const bx = 6, by = 38, len = 34;
  const ex  = bx + len * Math.cos(rad);
  const ey  = by - len * Math.sin(rad);
  const ar  = 12;
  const arx = bx + ar * Math.cos(rad);
  const ary = by - ar * Math.sin(rad);
  return (
    <svg width={56} height={48} viewBox="0 0 56 48" style={{ flexShrink: 0 }}>
      <line x1={2} y1={40} x2={54} y2={40} stroke={T.border} strokeWidth={1.5} strokeLinecap="round" />
      <path d={`M ${bx + ar} ${by} A ${ar} ${ar} 0 0 0 ${arx} ${ary}`} fill="none" stroke="#93c5fd" strokeWidth={1.5} />
      <line x1={bx} y1={by} x2={ex} y2={ey} stroke={T.primary} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={bx} cy={by} r={2.5} fill={T.primary} />
      <text x={bx + ar + 8} y={by - 5} fontSize="9" fill={T.primary} fontWeight="600" style={{ userSelect: 'none' }}>
        {tilt.toFixed(1)}°
      </text>
    </svg>
  );
}

// ─── Mini toggle switch ───────────────────────────────────────────────────────

function MiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'w-9 h-5 rounded-full shrink-0 relative cursor-pointer transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-switch-background',
      )}
    >
      <span
        className="absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-[left] duration-200"
        style={{ left: checked ? '18px' : '2px' }}
      />
    </button>
  );
}

// ─── Surface card ─────────────────────────────────────────────────────────────

interface SurfaceCardProps {
  surface: RoofSurface;
  index: number;
  canDelete: boolean;
  onChange: (s: RoofSurface) => void;
  onDelete: () => void;
}

function SurfaceCard({ surface, index, canDelete, onChange, onDelete }: SurfaceCardProps) {
  const pv  = pvScore(surface.tilt, surface.azimuth);
  const dir = cardinalDir(surface.azimuth);

  const update = (patch: Partial<RoofSurface>) => onChange({ ...surface, ...patch });

  const dirBg    = dir === 'S' ? '#dcfce7' : ['SE', 'SW'].includes(dir) ? '#fef9c3' : 'var(--color-muted)';
  const dirColor = dir === 'S' ? '#16a34a' : ['SE', 'SW'].includes(dir) ? '#92400e' : 'var(--color-muted-foreground)';

  return (
    <div
      className={cn(
        'border-[1.5px] rounded-lg overflow-hidden bg-card transition-colors duration-200',
        surface.useForPV ? 'border-primary/50' : 'border-border',
      )}
    >
      {/* Card header */}
      <div
        className="px-3 py-2 border-b border-border flex items-center gap-1.5"
        style={{ backgroundColor: surface.useForPV ? 'rgba(47,93,138,0.05)' : 'var(--color-input-background)' }}
      >
        {/* Editable name */}
        <input
          type="text"
          value={surface.name}
          onChange={(e) => update({ name: e.target.value })}
          className={cn(
            'flex-1 border-none outline-none bg-transparent text-xs font-semibold min-w-0',
            surface.useForPV ? 'text-primary' : 'text-foreground',
          )}
        />

        {/* 3D badge */}
        {surface.fromCityData && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 shrink-0">
            <ShieldCheck className="size-2.5 text-blue-700" />
            <span className="text-[9px] font-semibold text-blue-700">3D</span>
          </span>
        )}

        {/* PV score */}
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0"
          style={{ backgroundColor: pv.bg, color: pv.color }}
        >
          {pv.label} {pv.score}%
        </span>

        {/* Delete */}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="size-5 flex items-center justify-center rounded cursor-pointer text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-3">

        {/* Pitch */}
        <div className="bg-input-background rounded-md p-2.5 border border-border">
          <div className="flex items-start gap-2">
            <TiltDiagram tilt={Math.round(surface.tilt)} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                  PITCH
                </span>
                <NumberInput
                  value={parseFloat(surface.tilt.toFixed(1))}
                  onChange={(v) => update({ tilt: Math.min(90, Math.max(0, v)), fromCityData: false })}
                  unit="°" min={0} max={90} step={0.5}
                  width={80}
                />
              </div>
              <RangeSlider
                value={surface.tilt}
                min={0} max={90} step={0.5}
                marks={[
                  { value: 0,  label: '0° flat' },
                  { value: 15, label: '15°'      },
                  { value: 30, label: '30°'      },
                  { value: 45, label: '45°'      },
                  { value: 90, label: '90° wall' },
                ]}
                onChange={(v) => update({ tilt: v, fromCityData: false })}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">{tiltDesc(surface.tilt)}</p>
            </div>
          </div>
        </div>

        {/* Azimuth */}
        <div className="bg-input-background rounded-md p-2.5 border border-border">
          <div className="flex items-start gap-2">
            <MiniCompass azimuth={surface.azimuth} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1 gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                    AZIMUTH
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ backgroundColor: dirBg, color: dirColor }}
                  >
                    {dir}
                  </span>
                </div>
                <NumberInput
                  value={parseFloat(surface.azimuth.toFixed(1))}
                  onChange={(v) => update({ azimuth: ((v % 360) + 360) % 360, fromCityData: false })}
                  unit="°" min={0} max={360} step={0.5}
                  width={80}
                />
              </div>
              <RangeSlider
                value={surface.azimuth}
                min={0} max={360} step={1}
                marks={[
                  { value: 0,   label: 'N'    },
                  { value: 90,  label: 'E'    },
                  { value: 180, label: 'S ★'  },
                  { value: 270, label: 'W'    },
                  { value: 360, label: 'N'    },
                ]}
                onChange={(v) => update({ azimuth: v, fromCityData: false })}
              />
            </div>
          </div>
        </div>

        {/* Areas */}
        <FieldRow>
          <div title="Total gross surface area of this roof face.">
            <NumberInput
              label="Gross area"
              value={surface.area}
              onChange={(v) => update({ area: v, usefulArea: Math.min(surface.usefulArea, v) })}
              unit="m²" step={0.1} min={0}
            />
          </div>
          <div title={`Net area usable for PV — after setbacks and exclusions. Max: ${surface.area.toFixed(1)} m².`}>
            <NumberInput
              label="Useful (PV)"
              value={surface.usefulArea}
              onChange={(v) => update({ usefulArea: Math.min(v, surface.area) })}
              unit="m²" step={0.1} min={0}
            />
          </div>
        </FieldRow>

        {/* PV toggle */}
        <div
          className={cn(
            'px-2.5 py-2 rounded-md flex items-center justify-between gap-2 border transition-all duration-200',
            surface.useForPV
              ? 'bg-green-50/70 border-green-300/50'
              : 'bg-input-background border-border',
          )}
        >
          <div className="flex items-center gap-1.5">
            <Sun className={cn('size-3.5', surface.useForPV ? 'text-amber-500' : 'text-muted-foreground')} />
            <div>
              <p className={cn('text-[11px]', surface.useForPV ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                Include in PV simulation
              </p>
              {surface.useForPV && (
                <p className="text-[10px] text-green-600">{surface.usefulArea.toFixed(1)} m² contributing</p>
              )}
            </div>
          </div>
          <MiniToggle checked={surface.useForPV} onChange={(v) => update({ useForPV: v })} />
        </div>
      </div>
    </div>
  );
}

// ─── Main RoofConfigurator ────────────────────────────────────────────────────

interface RoofConfiguratorProps {
  config: RoofConfig;
  onChange: (c: RoofConfig) => void;
}

export function RoofConfigurator({ config, onChange }: RoofConfiguratorProps) {
  const demo3D = DEMO_3D[config.type];
  const has3D  = Boolean(demo3D);
  const [showWarning, setShowWarning] = useState(false);

  const hasModifiedSurfaces = config.from3DData && config.surfaces.some((s) => !s.fromCityData);

  const handleTypeChange = (type: RoofType) => {
    const demo = DEMO_3D[type];
    onChange({ type, from3DData: Boolean(demo), surfaces: buildSurfaces(type, Boolean(demo)) });
    setShowWarning(false);
  };

  const handleUse3D = () => {
    if (!demo3D) return;
    onChange({ ...config, from3DData: true, surfaces: demo3D.surfaces.map((s) => ({ ...s, id: uid() })) });
    setShowWarning(false);
  };

  const handleManual = () => {
    onChange({ ...config, from3DData: false, surfaces: DEFAULT_SURFACES[config.type].map((s) => ({ ...s, id: uid() })) });
    setShowWarning(false);
  };

  const handleReset = () => {
    if (config.from3DData && demo3D) {
      onChange({ ...config, surfaces: demo3D.surfaces.map((s) => ({ ...s, id: uid() })) });
    } else {
      onChange({ ...config, surfaces: DEFAULT_SURFACES[config.type].map((s) => ({ ...s, id: uid() })) });
    }
    setShowWarning(false);
  };

  const updateSurface = (id: string, updated: RoofSurface) =>
    onChange({ ...config, surfaces: config.surfaces.map((s) => (s.id === id ? updated : s)) });

  const deleteSurface = (id: string) =>
    onChange({ ...config, surfaces: config.surfaces.filter((s) => s.id !== id) });

  const addSurface = () => {
    if (config.from3DData) { setShowWarning(true); return; }
    onChange({
      ...config,
      surfaces: [...config.surfaces, {
        id: uid(), name: `Surface ${config.surfaces.length + 1}`,
        tilt: 30, azimuth: 180, area: 20, usefulArea: 17, useForPV: true, fromCityData: false,
      }],
    });
  };

  const totalArea = config.surfaces.reduce((s, r) => s + r.area, 0);
  const pvSurfs   = config.surfaces.filter((s) => s.useForPV);
  const pvArea    = pvSurfs.reduce((s, r) => s + r.usefulArea, 0);
  const coverPct  = totalArea > 0 ? Math.round((pvArea / totalArea) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Sun className="size-4 text-amber-500" />
        <span className="text-xs font-semibold text-foreground">Roof Geometry &amp; PV Surfaces</span>
      </div>

      {/* 3D data banner */}
      {has3D ? (
        config.from3DData ? (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1.5">
            <ShieldCheck className="size-3.5 text-blue-700 shrink-0" />
            <span className="text-[11px] text-blue-700 flex-1">
              <strong>{demo3D!.source}</strong> · {demo3D!.buildingRef} · Inferred from 3D city model
            </span>
            <button
              type="button"
              onClick={handleManual}
              className="px-2 py-1 rounded border border-blue-200 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer transition-colors shrink-0"
            >
              Edit manually
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
            <span className="text-[11px] text-amber-800 flex-1">
              Manual mode — <strong>{demo3D!.source}</strong> data available for this roof type.
            </span>
            <button
              type="button"
              onClick={handleUse3D}
              className="flex items-center gap-1 px-2 py-1 rounded border border-amber-200 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer transition-colors shrink-0"
            >
              <CloudDownload className="size-3" />
              Use 3D data
            </button>
          </div>
        )
      ) : (
        <div className="bg-input-background border border-border rounded-md px-2.5 py-1.5">
          <p className="text-[11px] text-muted-foreground">
            No 3D city data found for this building — define roof geometry manually below.
          </p>
        </div>
      )}

      {/* Roof type picker */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-1.5">
          ROOF TYPE
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {ROOF_TYPES.map((rt) => {
            const sel = config.type === rt.id;
            return (
              <button
                key={rt.id}
                type="button"
                onClick={() => handleTypeChange(rt.id)}
                className={cn(
                  'cursor-pointer rounded-lg p-2 border-[1.5px] flex items-center gap-2 text-left transition-all duration-150',
                  sel
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary hover:bg-primary/[0.03]',
                )}
              >
                <svg width={48} height={30} viewBox="0 0 80 50" style={{ flexShrink: 0 }}>
                  <rect width={80} height={50} fill={sel ? 'rgba(47,93,138,0.1)' : 'var(--color-input-background)'} rx={4} />
                  <line x1={8}  y1={36} x2={8}  y2={44} stroke={T.border} strokeWidth={1.5} />
                  <line x1={72} y1={36} x2={72} y2={44} stroke={T.border} strokeWidth={1.5} />
                  <line x1={8}  y1={44} x2={72} y2={44} stroke={T.border} strokeWidth={1.5} />
                  <path d={rt.path} fill="none"
                    stroke={sel ? T.primary : T.mutedFg}
                    strokeWidth={sel ? 2.2 : 1.8}
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                <div>
                  <p className={cn('text-[11px]', sel ? 'font-semibold text-primary' : 'font-medium text-foreground')}>
                    {rt.label}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{rt.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Warning banner */}
      {showWarning && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
          <AlertTriangle className="size-3.5 text-amber-800 shrink-0 mt-px" />
          <div className="flex-1">
            <p className="text-[11px] text-amber-800 font-semibold mb-0.5">
              Cannot add surfaces in 3D data mode
            </p>
            <p className="text-[10px] text-amber-800 leading-snug">
              This roof geometry is inferred from 3D city data. Switch to manual mode first to add custom surfaces.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWarning(false)}
            className="text-amber-800 hover:text-amber-900 cursor-pointer text-base leading-none shrink-0"
          >×</button>
        </div>
      )}

      {/* Surfaces header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
          SURFACES ({config.surfaces.length})
        </span>
        <div className="flex items-center gap-1.5">
          {hasModifiedSurfaces && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] font-semibold text-foreground hover:bg-amber-50 cursor-pointer transition-colors"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={addSurface}
            className="flex items-center gap-1 px-2 py-1 rounded border border-border text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            <Plus className="size-3" />
            Add surface
          </button>
        </div>
      </div>

      {/* Surface cards */}
      {config.surfaces.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            No surfaces — add one or select a roof type above.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {config.surfaces.map((surf, i) => (
            <SurfaceCard
              key={surf.id}
              surface={surf}
              index={i}
              canDelete={config.surfaces.length > 1 || config.type === 'custom'}
              onChange={(updated) => updateSurface(surf.id, updated)}
              onDelete={() => deleteSurface(surf.id)}
            />
          ))}
        </div>
      )}

      {/* PV summary */}
      <div
        className={cn(
          'border-[1.5px] rounded-lg p-3',
          pvArea > 0 ? 'border-green-400/40 bg-green-50/50' : 'border-border bg-input-background',
        )}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sun className={cn('size-3.5', pvArea > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-[0.06em]',
            pvArea > 0 ? 'text-foreground' : 'text-muted-foreground',
          )}>
            PV Simulation Summary
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2">
          {[
            { label: 'Total roof', value: `${totalArea.toFixed(1)} m²`, hl: false },
            { label: 'PV area',    value: `${pvArea.toFixed(1)} m²`,    hl: pvArea > 0 },
            { label: 'Coverage',   value: `${coverPct}%`,               hl: pvArea > 0 },
          ].map(({ label, value, hl }) => (
            <div key={label}>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={cn('text-[13px] font-bold', hl ? 'text-green-600' : 'text-foreground')}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {pvSurfs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pvSurfs.map((s) => (
              <span key={s.id} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-100 text-[10px] font-semibold text-green-700">
                <Check className="size-2.5" />
                {s.name} · {s.usefulArea.toFixed(1)} m²
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Default export ────────────────────────────────────────────────────────────

export const DEFAULT_ROOF_CONFIG: RoofConfig = {
  type: 'gabled',
  from3DData: true,
  surfaces: [
    { id: 'r1', name: 'South Slope', tilt: 38.5, azimuth: 176.2, area: 54.8, usefulArea: 47.2, useForPV: true,  fromCityData: true },
    { id: 'r2', name: 'North Slope', tilt: 38.5, azimuth: 356.2, area: 54.8, usefulArea: 16.4, useForPV: false, fromCityData: true },
  ],
};
