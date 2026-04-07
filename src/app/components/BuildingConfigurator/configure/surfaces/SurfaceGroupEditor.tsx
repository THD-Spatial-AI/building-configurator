// Editing panel for a single selected building surface element.
// Geometry and Thermal properties are presented as tabs.
// The custom-mode toggle lives in the header — no separate banner row.

import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Info, Layers, AlertTriangle, Wand2, Sun, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { ELEMENT_DOTS, SegmentedControl, ToggleSwitch, NumberInput, FieldLabel, ScrollHintContainer } from '@/app/components/BuildingConfigurator/shared/ui';
import { createSurfacePvConfig, type PvConfig } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { elementToGroup, isElementEditable, isUserDefinedElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';

// ─── Exported patch type ───────────────────────────────────────────────────────

export type GroupPatch = Partial<Pick<BuildingElement, 'uValue' | 'tilt' | 'azimuth' | 'area'>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIR_LABELS: Record<string, string> = {
  north_wall: 'North', northeast_wall: 'NE', east_wall: 'East', southeast_wall: 'SE',
  south_wall: 'South', southwest_wall: 'SW', west_wall: 'West', northwest_wall: 'NW',
};

const TYPE_LABELS: Record<string, string> = {
  wall: 'Wall', window: 'Windows', door: 'Doors',
};

function groupLabel(el: BuildingElement): string {
  const g = elementToGroup(el);
  if (g.face === 'roof')  return 'Roof';
  if (g.face === 'floor') return 'Floor';
  return `${DIR_LABELS[g.face] ?? g.face} ${TYPE_LABELS[el.type] ?? el.type}`;
}

function deriveGroupStats(
  elements: Record<string, BuildingElement>,
  el: BuildingElement,
): { count: number; totalArea: number } {
  const g = Object.values(elements).filter((e) => {
    const eg = elementToGroup(e);
    const eg2 = elementToGroup(el);
    return eg.type === eg2.type && eg.face === eg2.face;
  });
  return { count: g.length, totalArea: g.reduce((s, e) => s + e.area, 0) };
}

function getWarnings(el: BuildingElement): string[] {
  const w: string[] = [];
  if ((el.type === 'wall' || el.type === 'window' || el.type === 'door') && el.tilt < 70)
    w.push('Tilt is lower than expected for a vertical surface (typically ≥ 70°).');
  if (el.type === 'roof' && el.tilt > 75)
    w.push('Near-vertical roof pitch is unusual — roofs rarely exceed 75°.');
  if (el.type === 'floor' && el.tilt > 10)
    w.push('Floor surfaces are typically horizontal (tilt ≈ 0°).');
  return w;
}

// ─── Number spinner ───────────────────────────────────────────────────────────

interface SpinnerProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  narrow?: boolean;
  disabled?: boolean;
  onChange: (v: number) => void;
}

function NumberSpinner({ value, min = 0, max = 360, step = 1, narrow = false, disabled = false, onChange }: SpinnerProps) {
  const [draft, setDraft] = useState(String(Math.round(value)));

  useEffect(() => { setDraft(String(Math.round(value))); }, [value]);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n)) onChange(clamp(n));
    else setDraft(String(Math.round(value)));
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${narrow ? 'w-[80px]' : 'w-[96px]'} ${disabled ? 'opacity-50' : ''}`}>
        <input
          type="number" min={min} max={max} value={draft} disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-right text-xl font-bold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex shrink-0 flex-col border-l border-slate-200">
          <button type="button" disabled={disabled} onClick={() => onChange(clamp(Math.round(value) + step))}
            className="flex h-6 w-7 items-center justify-center border-b border-slate-200 bg-slate-800 text-white transition-colors enabled:cursor-pointer enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
            <ChevronUp className="size-3" />
          </button>
          <button type="button" disabled={disabled} onClick={() => onChange(clamp(Math.round(value) - step))}
            className="flex h-6 w-7 items-center justify-center bg-slate-800 text-white transition-colors enabled:cursor-pointer enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
      <span className="text-[20px] text-slate-400">°</span>
    </div>
  );
}

// ─── Area spinner ─────────────────────────────────────────────────────────────

function AreaSpinner({ value, disabled = false, onChange }: { value: number; disabled?: boolean; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(value.toFixed(1));

  useEffect(() => { setDraft(value.toFixed(1)); }, [value]);

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n > 0) onChange(n);
    else setDraft(value.toFixed(1));
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex flex-1 items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${disabled ? 'opacity-50' : ''}`}>
        <input
          type="number" step={0.1} min={0.1} value={draft} disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-right text-xl font-bold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex shrink-0 flex-col border-l border-slate-200">
          <button type="button" disabled={disabled} onClick={() => onChange(Math.max(0.1, parseFloat(draft || '0') + 1))}
            className="flex h-6 w-7 items-center justify-center border-b border-slate-200 bg-slate-800 text-white transition-colors enabled:cursor-pointer enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
            <ChevronUp className="size-3" />
          </button>
          <button type="button" disabled={disabled} onClick={() => onChange(Math.max(0.1, parseFloat(draft || '0') - 1))}
            className="flex h-6 w-7 items-center justify-center bg-slate-800 text-white transition-colors enabled:cursor-pointer enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400">
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
      <span className="text-[11px] text-slate-400">m²</span>
    </div>
  );
}

// ─── Tilt control ─────────────────────────────────────────────────────────────

const TILT_PX = 12; const TILT_PY = 66; const TILT_L = 55; const TILT_ARC_R = 22;
const TILT_STEPS = [0, 15, 30, 45, 60, 75, 90];

function tiltLabel(tilt: number): string {
  if (tilt === 0)  return 'Flat';
  if (tilt <= 15)  return 'Low slope';
  if (tilt <= 35)  return 'Pitched';
  if (tilt <= 50)  return 'Standard pitch';
  if (tilt <= 80)  return 'Steep';
  return 'Vertical';
}

function TiltVisual({ tilt, disabled = false, onChange }: { tilt: number; disabled?: boolean; onChange: (v: number) => void }) {
  const rad   = (tilt * Math.PI) / 180;
  const ex    = TILT_PX + TILT_L     * Math.cos(rad);
  const ey    = TILT_PY - TILT_L     * Math.sin(rad);
  const arcEx = TILT_PX + TILT_ARC_R * Math.cos(rad);
  const arcEy = TILT_PY - TILT_ARC_R * Math.sin(rad);
  const arcHx = TILT_PX + TILT_ARC_R;
  const midRad = rad / 2;
  const labelR = TILT_ARC_R + 15;
  const labelX = TILT_PX + labelR * Math.cos(midRad);
  const labelY = TILT_PY - labelR * Math.sin(midRad);

  const svgRef   = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  const angleFromClient = (clientX: number, clientY: number): number => {
    if (!svgRef.current) return tilt;
    const rect   = svgRef.current.getBoundingClientRect();
    const scaleX = 80 / rect.width;
    const scaleY = 80 / rect.height;
    const dx     = (clientX - rect.left) * scaleX - TILT_PX;
    const dy     = TILT_PY - (clientY - rect.top) * scaleY;
    const raw    = (Math.atan2(dy, dx) * 180) / Math.PI;
    return Math.max(0, Math.min(90, Math.round(raw / 5) * 5));
  };

  return (
    <svg ref={svgRef} width="80" height="80" viewBox="0 0 80 80"
      className={`shrink-0 select-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'}`}
      onMouseDown={(e) => { if (disabled) return; dragging.current = true; onChange(angleFromClient(e.clientX, e.clientY)); }}
      onMouseMove={(e) => { if (!disabled && dragging.current) onChange(angleFromClient(e.clientX, e.clientY)); }}
      onMouseUp={(e)   => { if (disabled) return; dragging.current = false; onChange(angleFromClient(e.clientX, e.clientY)); }}
    >
      <line x1={4} y1={TILT_PY} x2={76} y2={TILT_PY} stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" />
      {TILT_STEPS.map((step) => {
        const sr = (step * Math.PI) / 180;
        const r1 = TILT_ARC_R + 3; const r2 = TILT_ARC_R + 8;
        const near = Math.abs(step - tilt) < 8;
        return (
          <line key={step}
            x1={TILT_PX + r1 * Math.cos(sr)} y1={TILT_PY - r1 * Math.sin(sr)}
            x2={TILT_PX + r2 * Math.cos(sr)} y2={TILT_PY - r2 * Math.sin(sr)}
            stroke={near ? '#3b82f6' : '#e2e8f0'} strokeWidth={near ? 1.5 : 1} />
        );
      })}
      {tilt > 1 && (
        <path d={`M ${arcHx} ${TILT_PY} A ${TILT_ARC_R} ${TILT_ARC_R} 0 0 0 ${arcEx} ${arcEy}`}
          fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" />
      )}
      <line x1={TILT_PX} y1={TILT_PY} x2={ex} y2={ey} stroke="#1e3a5f" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={TILT_PX} cy={TILT_PY} r={3.5} fill="#1e3a5f" />
      <text
        x={tilt < 10 ? TILT_PX + TILT_ARC_R + 8 : labelX}
        y={tilt < 10 ? TILT_PY - 6 : labelY}
        fontSize="10" fontWeight="700" fill="#3b82f6"
        textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none' }}
      >{Math.round(tilt)}°</text>
    </svg>
  );
}

function TiltControl({ value, disabled = false, onChange }: { value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-semibold text-slate-700">Tilt</span>
        <Info className="size-3 text-slate-400" />
      </div>
      <div className="flex items-center gap-5">
        <TiltVisual tilt={value} disabled={disabled} onChange={onChange} />
        <div className="flex flex-col gap-1.5">
          <NumberSpinner value={value} min={0} max={90} disabled={disabled} onChange={onChange} />
          <p className="text-[10px] text-slate-500">{tiltLabel(value)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Azimuth control ──────────────────────────────────────────────────────────

function azimuthDirectionLabel(az: number): string {
  const dirs = ['North-facing', 'NE-facing', 'East-facing', 'SE-facing',
                 'South-facing', 'SW-facing', 'West-facing', 'NW-facing'];
  return dirs[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

const CX_C = 60; const CY_C = 60; const R_RING = 42; const R_LBLS = 54;

const COMPASS_DIRS = [
  { label: 'N',  az: 0,   bold: true,  red: true  },
  { label: 'NE', az: 45,  bold: false, red: false },
  { label: 'E',  az: 90,  bold: true,  red: false },
  { label: 'SE', az: 135, bold: false, red: false },
  { label: 'S',  az: 180, bold: true,  red: false },
  { label: 'SW', az: 225, bold: false, red: false },
  { label: 'W',  az: 270, bold: true,  red: false },
  { label: 'NW', az: 315, bold: false, red: false },
] as const;

function CompassRose({ azimuth, disabled = false, onChange }: { azimuth: number; disabled?: boolean; onChange: (v: number) => void }) {
  const R_NEEDLE = 28; const TAIL = 10;
  const rad   = (azimuth * Math.PI) / 180;
  const tipX  = CX_C + R_NEEDLE * Math.sin(rad);
  const tipY  = CY_C - R_NEEDLE * Math.cos(rad);
  const tailX = CX_C - TAIL * Math.sin(rad);
  const tailY = CY_C + TAIL * Math.cos(rad);
  const snappedAz = Math.round(((azimuth % 360) + 360) % 360 / 45) * 45 % 360;
  const hr = (snappedAz * Math.PI) / 180;
  const hx = CX_C + R_RING * Math.sin(hr);
  const hy = CY_C - R_RING * Math.cos(hr);
  const dragging = useRef(false);

  useEffect(() => {
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  const angleFromEvent = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx   = e.clientX - (rect.left + rect.width  / 2);
    const dy   = e.clientY - (rect.top  + rect.height / 2);
    const raw  = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    return Math.round(raw / 45) * 45 % 360;
  };

  return (
    <svg width="120" height="120" viewBox="0 0 120 120"
      className={`shrink-0 select-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      onMouseDown={(e) => { if (disabled) return; dragging.current = true; onChange(angleFromEvent(e)); }}
      onMouseMove={(e) => { if (!disabled && dragging.current) onChange(angleFromEvent(e)); }}
      onMouseUp={(e)   => { if (disabled) return; dragging.current = false; onChange(angleFromEvent(e)); }}
    >
      <circle cx={CX_C} cy={CY_C} r={R_RING} fill="white" stroke="#e2e8f0" strokeWidth={1.5} />
      {COMPASS_DIRS.map(({ az }) => {
        const r  = (az * Math.PI) / 180;
        const ox = CX_C + R_RING       * Math.sin(r); const oy = CY_C - R_RING       * Math.cos(r);
        const ix = CX_C + (R_RING - 5) * Math.sin(r); const iy = CY_C - (R_RING - 5) * Math.cos(r);
        return <line key={az} x1={ix} y1={iy} x2={ox} y2={oy} stroke="#cbd5e1" strokeWidth={1.5} />;
      })}
      {COMPASS_DIRS.map(({ label, az, bold, red }) => {
        const r = (az * Math.PI) / 180;
        const x = CX_C + R_LBLS * Math.sin(r); const y = CY_C - R_LBLS * Math.cos(r);
        return (
          <text key={az} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize={label.length === 1 ? '10' : '8'} fontWeight={bold ? '1000' : '500'}
            fill={red ? '#c53030' : '#94a3b8'} style={{ userSelect: 'none' }}>
            {label}
          </text>
        );
      })}
      <circle cx={hx} cy={hy} r={4} fill="#3b82f6" />
      <line x1={tailX} y1={tailY} x2={tipX} y2={tipY} stroke="#1e3a5f" strokeWidth={3} strokeLinecap="round" />
      <circle cx={tailX} cy={tailY} r={2.5} fill="#475569" />
      <circle cx={tipX}  cy={tipY}  r={5}   fill="#1e3a5f" />
      <circle cx={CX_C}  cy={CY_C}  r={3}   fill="#475569" />
    </svg>
  );
}

function AzimuthControl({ value, disabled = false, onChange }: { value: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-semibold text-slate-700">Azimuth</span>
        <Info className="size-3 text-slate-400" />
      </div>
      <div className="flex items-center gap-10">
        <CompassRose azimuth={value} disabled={disabled} onChange={onChange} />
        <div className="flex flex-col gap-1.5">
          <NumberSpinner value={value} min={0} max={359} disabled={disabled} onChange={onChange} />
          <p className="text-[10px] text-slate-500">{azimuthDirectionLabel(value)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Thermal field — inline click-to-edit row ─────────────────────────────────

/** Read-only display row used in basic mode and for derived values. */
function ThermalReadRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-[12px] font-semibold text-slate-800">{value}</span>
        <span className="text-[10px] text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

/** Click-to-edit inline field for numeric thermal values. */
function ThermalEditRow({
  label, value, unit, disabled = false, min = 0.001, max, step = 0.01, onSave,
}: {
  label: string; value: number; unit: string; disabled?: boolean;
  min?: number; max?: number; step?: number; onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value.toFixed(2));

  useEffect(() => { setDraft(value.toFixed(2)); setEditing(false); }, [value]);

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n > (min ?? -Infinity)) onSave(n);
    setEditing(false);
  };

  return (
    <div className="group/row flex items-center justify-between gap-3">
      <span className="text-[11px] text-slate-500">{label}</span>
      {editing && !disabled ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number" step={step} min={min} max={max} autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { setEditing(false); setDraft(value.toFixed(2)); }
            }}
            className="w-20 rounded border border-blue-300 bg-white px-2 py-0.5 text-right text-[11px] font-medium text-slate-700 outline-none ring-1 ring-blue-200 focus:ring-blue-400"
          />
          <span className="text-[10px] text-slate-400">{unit}</span>
        </div>
      ) : (
        disabled ? (
          <div className="flex items-baseline gap-1 opacity-50">
            <span className="text-[12px] font-semibold text-slate-800">{value.toFixed(2)}</span>
            <span className="text-[10px] text-slate-400">{unit}</span>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)}
            className="flex cursor-pointer items-baseline gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 group-hover/row:ring-1 group-hover/row:ring-slate-200">
            <span className="text-[12px] font-semibold text-slate-800">{value.toFixed(2)}</span>
            <span className="text-[10px] text-slate-400">{unit}</span>
          </button>
        )
      )}
    </div>
  );
}

/** Dropdown row for Code_* fields with a fixed set of valid options. */
function ThermalSelectRow({
  label, value, options, disabled = false, onSave,
}: {
  label: string; value: string; options: string[]; disabled?: boolean; onSave: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-slate-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onSave(e.target.value)}
        className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 disabled:opacity-50"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── PV helpers ──────────────────────────────────────────────────────────────

/** Short compass label from azimuth degrees. */
function compassDir(az: number): string {
  const dirs: Array<[number, string]> = [
    [22.5, 'N'], [67.5, 'NE'], [112.5, 'E'], [157.5, 'SE'],
    [202.5, 'S'], [247.5, 'SW'], [292.5, 'W'], [337.5, 'NW'],
  ];
  return dirs.find(([lim]) => az < lim)?.[1] ?? 'N';
}

/** PV configuration tab for a single surface.
 *  Shows a toggle, geometry mode selector, capacity input, and expert params. */
function PvTab({
  el,
  pvConfig,
  onUpdate,
  mode = 'basic',
}: {
  el: BuildingElement;
  pvConfig: PvConfig;
  onUpdate: (patch: Partial<PvConfig>) => void;
  mode?: 'basic' | 'expert';
}) {
  const isCustomGeom     = pvConfig.geometryMode === 'manual';
  const effectiveTilt    = isCustomGeom ? pvConfig.tilt    : el.tilt;
  const effectiveAzimuth = isCustomGeom ? pvConfig.azimuth : el.azimuth;

  /** Switch to manual on first edit, seeding the other value from the surface so there's no jump. */
  const setPvTilt    = (v: number) => onUpdate({ tilt: v, azimuth: isCustomGeom ? pvConfig.azimuth : el.azimuth, geometryMode: 'manual' });
  const setPvAzimuth = (v: number) => onUpdate({ azimuth: v, tilt: isCustomGeom ? pvConfig.tilt : el.tilt, geometryMode: 'manual' });

  return (
    <div className="flex flex-col gap-3">

      {/* Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Sun className="size-4 text-yellow-500" />
          <span className="text-[12px] font-semibold text-slate-700">PV on this surface</span>
        </div>
        <ToggleSwitch
          checked={pvConfig.installed}
          onChange={(v) => onUpdate({ installed: v })}
        />
      </div>

      {pvConfig.installed && (
        <>
          {/* Geometry mode */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-sm">
            <div className="mb-3">
              <FieldLabel tip="Panel tilt and azimuth are pre-filled from the surface geometry. Edit them to set custom values for the PV panels specifically.">
                Panel geometry
              </FieldLabel>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TiltControl value={effectiveTilt} onChange={setPvTilt} />
              <div className="border-l border-slate-200 pl-4">
                <AzimuthControl value={effectiveAzimuth} onChange={setPvAzimuth} />
              </div>
            </div>

            {/* Footer: infer-from-surface reset (only when user has set custom values) */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-[10px] text-slate-400">
                {isCustomGeom
                  ? `Custom · was ${el.tilt}° / ${el.azimuth}° (${compassDir(el.azimuth)})`
                  : `Inferred from surface · ${effectiveTilt}° / ${effectiveAzimuth}° (${compassDir(effectiveAzimuth)})`}
              </span>
              {isCustomGeom && (
                <button
                  type="button"
                  onClick={() => onUpdate({ geometryMode: 'surface' })}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-600"
                >
                  <RotateCcw className="size-3" />
                  Infer from surface
                </button>
              )}
            </div>
          </div>

          {/* Capacity */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-sm">

            {/* Usable area */}
            <div className="mb-3">
              <FieldLabel tip="Percentage of the surface area that can be covered with panels. Reduce this to account for obstructions such as chimneys, skylights, vents, or required edge clearances.">
                Usable area
              </FieldLabel>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="range"
                  min={10} max={100} step={5}
                  value={pvConfig.usable_area_pct ?? 80}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    const usableM2 = el.area * pct / 100;
                    // ~6.5 m² per kWp for standard silicon panels
                    const derivedMaxKwp = usableM2 / 6.5;
                    onUpdate({
                      usable_area_pct: pct,
                      cont_energy_cap_max: +derivedMaxKwp.toFixed(2),
                      // Cap system_capacity if it now exceeds the available area
                      system_capacity: Math.min(pvConfig.system_capacity, +derivedMaxKwp.toFixed(2)),
                    });
                  }}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary"
                />
                <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-800">
                  {pvConfig.usable_area_pct ?? 80}%
                </span>
              </div>
              {/* Derived stats row */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-slate-100 bg-white px-3 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Usable area</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-700">
                    {(el.area * (pvConfig.usable_area_pct ?? 80) / 100).toFixed(1)} m²
                    <span className="ml-1 text-[9px] font-normal text-slate-400">
                      of {el.area.toFixed(1)} m²
                    </span>
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-white px-3 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Max capacity</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-700">
                    {(el.area * (pvConfig.usable_area_pct ?? 80) / 100 / 6.5).toFixed(1)} kWp
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <FieldLabel tip="Nameplate DC rated capacity of the PV system installed on this surface. Cannot exceed the max capacity derived from usable area.">
                System capacity
              </FieldLabel>
              <NumberInput
                value={pvConfig.system_capacity}
                onChange={(v) => {
                  const maxKwp = el.area * (pvConfig.usable_area_pct ?? 80) / 100 / 6.5;
                  onUpdate({
                    system_capacity: Math.max(0, Math.min(v, maxKwp)),
                    cont_energy_cap_max: Math.max(Math.min(v, maxKwp), pvConfig.cont_energy_cap_max),
                  });
                }}
                unit="kWp"
                min={0}
                max={+(el.area * (pvConfig.usable_area_pct ?? 80) / 100 / 6.5).toFixed(2)}
                step={0.5}
              />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-[11px] text-muted-foreground">Estimated panel area needed</span>
              <span className="text-xs font-semibold text-foreground">
                {(pvConfig.system_capacity * 6.5).toFixed(1)}{' '}
                <span className="text-[10px] font-normal text-muted-foreground">m²</span>
              </span>
            </div>
          </div>

          {/* Expert: efficiency + economics */}
          {mode === 'expert' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-sm">
              <p className="mb-3 text-[11px] font-semibold text-slate-600">Efficiency</p>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <FieldLabel tip="Combined panel and wiring efficiency (0–1).">Panel efficiency</FieldLabel>
                  <div className="w-28">
                    <NumberInput value={pvConfig.cont_energy_eff} onChange={(v) => onUpdate({ cont_energy_eff: Math.max(0, Math.min(1, v)) })} unit="–" min={0} max={1} step={0.01} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <FieldLabel tip="DC-to-AC inverter efficiency (0–1).">Inverter efficiency</FieldLabel>
                  <div className="w-28">
                    <NumberInput value={pvConfig.inv_eff} onChange={(v) => onUpdate({ inv_eff: Math.max(0, Math.min(1, v)) })} unit="–" min={0} max={1} step={0.01} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <FieldLabel tip="System losses fraction (dust, temperature, wiring).">System losses</FieldLabel>
                  <div className="w-28">
                    <NumberInput value={+(pvConfig.losses * 100).toFixed(1)} onChange={(v) => onUpdate({ losses: v / 100 })} unit="%" min={0} max={50} step={0.5} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Inline label editor ──────────────────────────────────────────────────────

/**
 * Displays a surface label inline. Clicking the pencil icon (or double-clicking
 * the text) activates an input. Enter or blur commits the new name; Escape cancels.
 */
function InlineLabel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          className="min-w-0 flex-1 rounded border border-blue-300 bg-white px-2 py-0.5 text-sm font-bold text-slate-800 outline-none ring-1 ring-blue-200 focus:ring-blue-400"
        />
        <button type="button" onClick={commit}
          className="flex size-5 shrink-0 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer">
          <Check className="size-3" />
        </button>
        <button type="button" onClick={cancel}
          className="flex size-5 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer">
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5">
      <span
        className="text-base font-bold text-slate-800 cursor-text"
        onDoubleClick={() => setEditing(true)}
      >
        {value}
      </span>
      <button
        type="button"
        title="Rename surface"
        onClick={() => setEditing(true)}
        className="invisible size-5 shrink-0 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer transition-colors group-hover:visible"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SurfaceGroupEditorProps {
  selectedElementId: string | null;
  elements: Record<string, BuildingElement>;
  onUpdateElement: (id: string, patch: Partial<BuildingElement>) => void;
  onEnableCustomMode: (id: string) => void;
  /** Renames a surface label without requiring custom mode — display-only field. */
  onRenameElement?: (id: string, label: string) => void;
  /** Which tab to open when a surface is selected from another workflow. */
  preferredTab?: 'geometry' | 'thermal' | 'pv';
  /** Per-surface PV config for the selected element, or null if none exists yet. */
  surfacePvConfig: PvConfig | null;
  /** Called when the user modifies the PV config for the selected surface. */
  onUpdatePv: (patch: Partial<PvConfig>) => void;
  mode?: 'basic' | 'expert';
}

export function SurfaceGroupEditor({
  selectedElementId, elements, onUpdateElement, onEnableCustomMode,
  onRenameElement, preferredTab = 'geometry', surfacePvConfig, onUpdatePv, mode = 'basic',
}: SurfaceGroupEditorProps) {
  const [activeTab, setActiveTab] = useState<'geometry' | 'thermal' | 'pv'>('geometry');

  // Reset tab when a different element is selected
  useEffect(() => { setActiveTab(preferredTab); }, [preferredTab, selectedElementId]);

  const el = selectedElementId ? elements[selectedElementId] : null;

  if (!el) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          <Layers className="size-5 text-slate-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600">No surface selected</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Click a face in the 3D preview, pick a surface from the list, or use the New button above.
          </p>
        </div>
      </div>
    );
  }

  const dotColor          = ELEMENT_DOTS[el.type];
  const { count, totalArea } = deriveGroupStats(elements, el);
  const label             = groupLabel(el);
  const warnings          = getWarnings(el);
  const save              = (patch: Partial<BuildingElement>) => onUpdateElement(selectedElementId!, patch);
  const editable          = isElementEditable(el);
  const userDefined       = isUserDefinedElement(el);
  const isImported        = el.source === 'city' || el.source === 'default';
  const isWindow          = el.type === 'window';
  const hasTransmission   = el.type !== 'window';

  const rValue = el.uValue > 0 ? (1 / el.uValue).toFixed(3) : '∞';

  return (
    <ScrollHintContainer className="flex flex-col p-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${dotColor}22` }}>
          <span className="size-3.5 rounded-full" style={{ backgroundColor: dotColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <InlineLabel
              value={el.label}
              onChange={(v) => onRenameElement?.(selectedElementId!, v)}
            />

            {/* Source badges */}
            {userDefined && (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                User defined
              </span>
            )}
            {isImported && !editable && (
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Read only
              </span>
            )}

            {/* Custom mode toggle — solid primary button, right side of header */}
            {isImported && !editable && (
              <button
                type="button"
                onClick={() => onEnableCustomMode(el.id)}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Wand2 className="size-3" />
                Enable custom mode
              </button>
            )}
          </div>

          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {el.area.toFixed(1)} m²
            {count > 1 && (
              <span className="text-muted-foreground/60">
                {' · '}{label} group: {count} surfaces, {totalArea.toFixed(1)} m² total
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="mb-3">
        <SegmentedControl
          fullWidth
          options={[
            { value: 'geometry', label: 'Geometry' },
            { value: 'thermal',  label: 'Thermal'  },
            { value: 'pv',       label: 'PV'        },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'geometry' | 'thermal' | 'pv')}
        />
      </div>

      {/* ── Geometry tab ────────────────────────────────────────────────────── */}
      {activeTab === 'geometry' && (
        <>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <TiltControl value={el.tilt} disabled={!editable} onChange={(v) => save({ tilt: v })} />
              <div className="border-l border-slate-200 pl-4">
                <AzimuthControl value={el.azimuth} disabled={!editable} onChange={(v) => save({ azimuth: v })} />
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <span className="mb-2 block text-[12px] font-semibold text-slate-700">Area</span>
              <AreaSpinner value={el.area} disabled={!editable} onChange={(v) => save({ area: v })} />
            </div>

            {/* Reset to imported values — only when custom mode is on and something has drifted */}
            {editable && el.defaultTilt !== undefined && (
              el.tilt !== el.defaultTilt || el.azimuth !== el.defaultAzimuth || el.area !== el.defaultArea
            ) && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-[10px] text-slate-400">
                  Imported: {el.defaultTilt}° / {el.defaultAzimuth}° · {el.defaultArea?.toFixed(1)} m²
                </span>
                <button
                  type="button"
                  onClick={() => save({ tilt: el.defaultTilt ?? el.tilt, azimuth: el.defaultAzimuth ?? el.azimuth, area: el.defaultArea ?? el.area })}
                  className="flex items-center gap-1 text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-600"
                >
                  <RotateCcw className="size-3" />
                  Reset to imported
                </button>
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <div className="flex flex-col gap-1">
                {warnings.map((w, i) => (
                  <p key={i} className="text-[10px] leading-snug text-amber-700">{w}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Thermal tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'thermal' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-3">

            {/* U-value — always shown */}
            <ThermalEditRow
              label="U-value"
              value={el.uValue}
              unit="W/m²K"
              disabled={!editable}
              min={0.01} max={10} step={0.01}
              onSave={(v) => save({ uValue: Math.max(0.01, v) })}
            />

            {/* Expert fields */}
            {mode === 'expert' && (
              <>
                {/* R-value — derived, read-only */}
                <ThermalReadRow label="R-value (1/U)" value={rValue} unit="m²K/W" />

                {/* g-value — windows only */}
                {isWindow && (
                  <ThermalEditRow
                    label="g-value (SHGC)"
                    value={el.gValue ?? 0.6}
                    unit="–"
                    disabled={!editable}
                    min={0} max={1} step={0.01}
                    onSave={(v) => save({ gValue: Math.min(1, Math.max(0, v)) })}
                  />
                )}

                <div className="border-t border-slate-200 pt-3 flex flex-col gap-3">

                  {/* Insulation thickness — opaque elements */}
                  {!isWindow && el.dInsulation !== undefined && (
                    <ThermalEditRow
                      label="Insulation thickness"
                      value={el.dInsulation}
                      unit="m"
                      disabled={!editable}
                      min={0} max={1} step={0.01}
                      onSave={(v) => save({ dInsulation: Math.max(0, v) })}
                    />
                  )}

                  {/* Heat loss correction factor — non-window elements */}
                  {hasTransmission && el.bTransmission !== undefined && (
                    <ThermalEditRow
                      label="Heat loss factor (b)"
                      value={el.bTransmission}
                      unit="–"
                      disabled={!editable}
                      min={0} max={1} step={0.01}
                      onSave={(v) => save({ bTransmission: Math.min(1, Math.max(0, v)) })}
                    />
                  )}

                  {/* Measure type — dropdown when options are available */}
                  {el.measureType !== undefined && el.measureTypeOptions && el.measureTypeOptions.length > 0 && (
                    <ThermalSelectRow
                      label="Measure type"
                      value={el.measureType}
                      options={el.measureTypeOptions}
                      disabled={!editable}
                      onSave={(v) => save({ measureType: v })}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PV tab -- surfacePvConfig is null until the user first interacts; use defaults */}
      {activeTab === 'pv' && (
        <PvTab
          el={el}
          pvConfig={surfacePvConfig ?? createSurfacePvConfig(el)}
          onUpdate={onUpdatePv}
          mode={mode}
        />
      )}

    </ScrollHintContainer>
  );
}
