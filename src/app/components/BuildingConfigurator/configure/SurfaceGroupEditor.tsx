// Editing panel for a single selected building surface element.
// Shows geometry (tilt, azimuth, area) and thermal (U-value) controls.
// The header shows direction-group area as context only — all edits apply
// exclusively to the selected element, not to the whole face group.

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Info, Layers, AlertTriangle } from 'lucide-react';
import { ELEMENT_DOTS } from '../shared/ui';
import type { BuildingElement } from './BuildingVisualization';
import { elementToGroup } from './BuildingVisualization';

// ─── Exported patch type (kept for any callers that still reference it) ────────

export type GroupPatch = Partial<Pick<BuildingElement, 'uValue' | 'tilt' | 'azimuth' | 'area'>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIR_LABELS: Record<string, string> = {
  north_wall: 'North', northeast_wall: 'NE', east_wall: 'East', southeast_wall: 'SE',
  south_wall: 'South', southwest_wall: 'SW', west_wall: 'West', northwest_wall: 'NW',
};

const TYPE_LABELS: Record<string, string> = {
  wall: 'Wall', window: 'Windows', door: 'Doors',
};

/** Human-readable label for the direction group containing the given element. */
function groupLabel(el: BuildingElement): string {
  const g = elementToGroup(el);
  if (g.face === 'roof')  return 'Roof';
  if (g.face === 'floor') return 'Floor';
  return `${DIR_LABELS[g.face] ?? g.face} ${TYPE_LABELS[el.type] ?? el.type}`;
}

/** Count and total area of all elements sharing the same face-direction group. */
function deriveGroupStats(
  elements: Record<string, BuildingElement>,
  el: BuildingElement,
): { count: number; totalArea: number } {
  const g = elementToGroup(el);
  const peers = Object.values(elements).filter((e) => {
    const eg = elementToGroup(e);
    return eg.type === g.type && eg.face === g.face;
  });
  return { count: peers.length, totalArea: peers.reduce((s, e) => s + e.area, 0) };
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

/** Returns advisory messages for physically impractical parameter values.
 *  These are informational only — they do not block the user from saving. */
function getWarnings(el: BuildingElement): string[] {
  const w: string[] = [];
  if ((el.type === 'wall' || el.type === 'window' || el.type === 'door') && el.tilt < 70) {
    w.push('Tilt is lower than expected for a vertical surface (walls and windows are typically ≥ 70°).');
  }
  if (el.type === 'roof' && el.tilt > 75) {
    w.push('Near-vertical roof pitch is unusual — roofs rarely exceed 75°.');
  }
  if (el.type === 'floor' && el.tilt > 10) {
    w.push('Floor surfaces are typically horizontal (tilt ≈ 0°).');
  }
  return w;
}

// ─── Number spinner ───────────────────────────────────────────────────────────

interface SpinnerProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  narrow?: boolean;
  onChange: (v: number) => void;
}

/** Large bold number input with integrated up/down stepper buttons and a ° badge. */
function NumberSpinner({ value, min = 0, max = 360, step = 1, narrow = false, onChange }: SpinnerProps) {
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
      <div className={`flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${narrow ? 'w-[80px]' : 'w-[96px]'}`}>
        <input
          type="number" min={min} max={max} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-right text-xl font-bold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex shrink-0 flex-col border-l border-slate-200">
          <button type="button" onClick={() => onChange(clamp(Math.round(value) + step))}
            className="flex h-6 w-7 cursor-pointer items-center justify-center border-b border-slate-200 bg-slate-800 text-white transition-colors hover:bg-slate-700">
            <ChevronUp className="size-3" />
          </button>
          <button type="button" onClick={() => onChange(clamp(Math.round(value) - step))}
            className="flex h-6 w-7 cursor-pointer items-center justify-center bg-slate-800 text-white transition-colors hover:bg-slate-700">
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
      <span className="text-[20px] text-slate-400">°</span>
    </div>
  );
}

// ─── Area spinner ─────────────────────────────────────────────────────────────

/** Number spinner for area (m²) with one decimal place. */
function AreaSpinner({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(value.toFixed(1));

  useEffect(() => { setDraft(value.toFixed(1)); }, [value]);

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n > 0) onChange(n);
    else setDraft(value.toFixed(1));
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-1 items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <input
          type="number" step={0.1} min={0.1} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-right text-xl font-bold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex shrink-0 flex-col border-l border-slate-200">
          <button type="button" onClick={() => onChange(Math.max(0.1, parseFloat(draft || '0') + 1))}
            className="flex h-6 w-7 cursor-pointer items-center justify-center border-b border-slate-200 bg-slate-800 text-white transition-colors hover:bg-slate-700">
            <ChevronUp className="size-3" />
          </button>
          <button type="button" onClick={() => onChange(Math.max(0.1, parseFloat(draft || '0') - 1))}
            className="flex h-6 w-7 cursor-pointer items-center justify-center bg-slate-800 text-white transition-colors hover:bg-slate-700">
            <ChevronDown className="size-3" />
          </button>
        </div>
      </div>
      <span className="text-[11px] text-slate-400">m²</span>
    </div>
  );
}

// ─── Tilt control ─────────────────────────────────────────────────────────────

// Pivot position and geometry constants for the 80×80 tilt SVG viewBox
const TILT_PX    = 12;   // pivot x
const TILT_PY    = 66;   // pivot y
const TILT_L     = 55;   // surface line length
const TILT_ARC_R = 22;   // arc radius
const TILT_STEPS = [0, 15, 30, 45, 60, 75, 90];

function tiltLabel(tilt: number): string {
  if (tilt === 0)  return 'Flat';
  if (tilt <= 15)  return 'Low slope';
  if (tilt <= 35)  return 'Pitched';
  if (tilt <= 50)  return 'Standard pitch';
  if (tilt <= 80)  return 'Steep';
  return 'Vertical';
}

/** Interactive SVG showing a tilted surface. Click or drag to change the angle.
 *  Snaps to 5° increments. Step marks at every 15° for orientation. */
function TiltVisual({ tilt, onChange }: { tilt: number; onChange: (v: number) => void }) {
  const rad   = (tilt * Math.PI) / 180;
  const ex    = TILT_PX + TILT_L     * Math.cos(rad);
  const ey    = TILT_PY - TILT_L     * Math.sin(rad);
  const arcEx = TILT_PX + TILT_ARC_R * Math.cos(rad);
  const arcEy = TILT_PY - TILT_ARC_R * Math.sin(rad);
  const arcHx = TILT_PX + TILT_ARC_R;

  const svgRef   = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  // Release drag when mouse button is released anywhere on the page
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
    const vx     = (clientX - rect.left) * scaleX;
    const vy     = (clientY - rect.top)  * scaleY;
    const dx     = vx - TILT_PX;
    const dy     = TILT_PY - vy;
    const raw    = (Math.atan2(dy, dx) * 180) / Math.PI;
    return Math.max(0, Math.min(90, Math.round(raw / 5) * 5));
  };

  // Angle label placed at mid-arc with a small outward offset
  const midRad  = rad / 2;
  const labelR  = TILT_ARC_R + 15;
  const labelX  = TILT_PX + labelR * Math.cos(midRad);
  const labelY  = TILT_PY - labelR * Math.sin(midRad);

  return (
    <svg
      ref={svgRef}
      width="80" height="80" viewBox="0 0 80 80"
      className="shrink-0 cursor-crosshair select-none"
      onMouseDown={(e) => { dragging.current = true; onChange(angleFromClient(e.clientX, e.clientY)); }}
      onMouseMove={(e) => { if (dragging.current) onChange(angleFromClient(e.clientX, e.clientY)); }}
      onMouseUp={(e) => { dragging.current = false; onChange(angleFromClient(e.clientX, e.clientY)); }}
    >
      {/* Ground line */}
      <line x1={4} y1={TILT_PY} x2={76} y2={TILT_PY} stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" />

      {/* Step tick marks at each 15° interval along the arc */}
      {TILT_STEPS.map((step) => {
        const sr  = (step * Math.PI) / 180;
        const r1  = TILT_ARC_R + 3;
        const r2  = TILT_ARC_R + 8;
        const x1  = TILT_PX + r1 * Math.cos(sr);
        const y1  = TILT_PY - r1 * Math.sin(sr);
        const x2  = TILT_PX + r2 * Math.cos(sr);
        const y2  = TILT_PY - r2 * Math.sin(sr);
        const near = Math.abs(step - tilt) < 8;
        return (
          <line key={step} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={near ? '#3b82f6' : '#e2e8f0'} strokeWidth={near ? 1.5 : 1} />
        );
      })}

      {/* Angle arc from horizontal (0°) to current tilt */}
      {tilt > 1 && (
        <path
          d={`M ${arcHx} ${TILT_PY} A ${TILT_ARC_R} ${TILT_ARC_R} 0 0 0 ${arcEx} ${arcEy}`}
          fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round"
        />
      )}

      {/* Surface line */}
      <line x1={TILT_PX} y1={TILT_PY} x2={ex} y2={ey} stroke="#1e3a5f" strokeWidth={2.5} strokeLinecap="round" />

      {/* Pivot dot */}
      <circle cx={TILT_PX} cy={TILT_PY} r={3.5} fill="#1e3a5f" />

      {/* Angle label at mid-arc */}
      <text
        x={tilt < 10 ? TILT_PX + TILT_ARC_R + 8 : labelX}
        y={tilt < 10 ? TILT_PY - 6 : labelY}
        fontSize="10" fontWeight="700" fill="#3b82f6"
        textAnchor="middle" dominantBaseline="middle"
        style={{ userSelect: 'none' }}
      >
        {Math.round(tilt)}°
      </text>
    </svg>
  );
}

/** Tilt control: interactive SVG figure + spinner. No slider — click or drag the figure. */
function TiltControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-semibold text-slate-700">Tilt</span>
        <Info className="size-3 text-slate-400" />
      </div>
      <div className="flex items-center gap-5">
        <TiltVisual tilt={value} onChange={onChange} />
        <div className="flex flex-col gap-1.5">
          <NumberSpinner value={value} min={0} max={90} onChange={onChange} />
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

// 120×120 SVG compass: center (60,60), ring radius 42.
// Labels placed outside the ring at radius 54; blue dot sits on the ring border.
const CX_C   = 60;
const CY_C   = 60;
const R_RING = 42;
const R_LBLS = 54;   // label radius — outside the ring

const COMPASS_DIRS = [
  { label: 'N',  az: 0,   bold: true,  red: true  },
  { label: 'NE', az: 45,  bold: false, red: false },
  { label: 'E',  az: 90,  bold: true, red: false },
  { label: 'SE', az: 135, bold: false, red: false },
  { label: 'S',  az: 180, bold: true, red: false },
  { label: 'SW', az: 225, bold: false, red: false },
  { label: 'W',  az: 270, bold: true, red: false },
  { label: 'NW', az: 315, bold: false, red: false },
] as const;

/** Interactive SVG compass rose — click or drag to set azimuth, snaps to 45° steps. */
function CompassRose({ azimuth, onChange }: { azimuth: number; onChange: (v: number) => void }) {
  const R_NEEDLE = 28; const TAIL = 10;
  const rad   = (azimuth * Math.PI) / 180;
  const tipX  = CX_C + R_NEEDLE * Math.sin(rad);
  const tipY  = CY_C - R_NEEDLE * Math.cos(rad);
  const tailX = CX_C - TAIL * Math.sin(rad);
  const tailY = CY_C + TAIL * Math.cos(rad);

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

  // Blue dot sits exactly on the ring border at the snapped direction
  const snappedAz = Math.round(((azimuth % 360) + 360) % 360 / 45) * 45 % 360;
  const hr = (snappedAz * Math.PI) / 180;
  const hx = CX_C + R_RING * Math.sin(hr);
  const hy = CY_C - R_RING * Math.cos(hr);

  return (
    <svg
      width="120" height="120" viewBox="0 0 120 120"
      className="shrink-0 cursor-pointer select-none"
      onMouseDown={(e) => { dragging.current = true; onChange(angleFromEvent(e)); }}
      onMouseMove={(e) => { if (dragging.current) onChange(angleFromEvent(e)); }}
      onMouseUp={(e) => { dragging.current = false; onChange(angleFromEvent(e)); }}
    >
      {/* Outer ring */}
      <circle cx={CX_C} cy={CY_C} r={R_RING} fill="white" stroke="#e2e8f0" strokeWidth={1.5} />

      {/* Inward tick marks at each 45° snap point */}
      {COMPASS_DIRS.map(({ az }) => {
        const r  = (az * Math.PI) / 180;
        const ox = CX_C + R_RING       * Math.sin(r); const oy = CY_C - R_RING       * Math.cos(r);
        const ix = CX_C + (R_RING - 5) * Math.sin(r); const iy = CY_C - (R_RING - 5) * Math.cos(r);
        return <line key={az} x1={ix} y1={iy} x2={ox} y2={oy} stroke="#cbd5e1" strokeWidth={1.5} />;
      })}

      {/* Direction labels — outside the ring */}
      {COMPASS_DIRS.map(({ label, az, bold, red }) => {
        const r = (az * Math.PI) / 180;
        const x = CX_C + R_LBLS * Math.sin(r);
        const y = CY_C - R_LBLS * Math.cos(r);
        return (
          <text key={az} x={x} y={y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={label.length === 1 ? '10' : '8'}
            fontWeight={bold ? '1000' : '500'}
            fill={red ? '#c53030' : '#94a3b8'}
            style={{ userSelect: 'none' }}
          >
            {label}
          </text>
        );
      })}

      {/* Active direction highlight — solid dot on the ring border */}
      <circle cx={hx} cy={hy} r={4} fill="#3b82f6" />

      {/* Needle */}
      <line x1={tailX} y1={tailY} x2={tipX} y2={tipY} stroke="#1e3a5f" strokeWidth={3} strokeLinecap="round" />
      <circle cx={tailX} cy={tailY} r={2.5} fill="#475569" />
      <circle cx={tipX}  cy={tipY}  r={5}   fill="#1e3a5f" />
      <circle cx={CX_C}  cy={CY_C}  r={3}   fill="#475569" />
    </svg>
  );
}

/** Azimuth control: interactive compass rose + number spinner + direction label. */
function AzimuthControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className="text-[12px] font-semibold text-slate-700">Azimuth</span>
        <Info className="size-3 text-slate-400" />
      </div>
      <div className="flex items-center gap-10">
        <CompassRose azimuth={value} onChange={onChange} />
        <div className="flex flex-col gap-1.5">
          <NumberSpinner value={value} min={0} max={359} onChange={onChange} />
          <p className="text-[10px] text-slate-500">{azimuthDirectionLabel(value)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── U-value field ────────────────────────────────────────────────────────────

/** Inline click-to-edit U-value row. */
function UValueField({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value.toFixed(2));

  useEffect(() => { setDraft(value.toFixed(2)); setEditing(false); }, [value]);

  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n > 0) onSave(n);
    setEditing(false);
  };

  return (
    <div className="group/row flex items-center justify-between gap-3">
      <span className="text-[11px] text-slate-500">U-value</span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number" step="0.01" min="0.01" autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { setEditing(false); setDraft(value.toFixed(2)); }
            }}
            className="w-20 rounded border border-blue-300 bg-white px-2 py-0.5 text-right text-[11px] font-medium text-slate-700 outline-none ring-1 ring-blue-200 focus:ring-blue-400"
          />
          <span className="text-[10px] text-slate-400">W/m²K</span>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className="flex cursor-pointer items-baseline gap-1 rounded px-1.5 py-0.5 hover:bg-slate-100 group-hover/row:ring-1 group-hover/row:ring-slate-200">
          <span className="text-[12px] font-semibold text-slate-800">{value.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400">W/m²K</span>
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SurfaceGroupEditorProps {
  /** ID of the single element being edited. Null shows the empty state. */
  selectedElementId: string | null;
  elements: Record<string, BuildingElement>;
  onUpdateElement: (id: string, patch: Partial<BuildingElement>) => void;
}

/** Shows and edits surface parameters for the single selected building element.
 *  Direction-group area is displayed in the header for context only. */
export function SurfaceGroupEditor({ selectedElementId, elements, onUpdateElement }: SurfaceGroupEditorProps) {
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
            Click a face in the 3D preview or pick a surface from the list on the right.
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

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${dotColor}22` }}>
          <span className="size-3.5 rounded-full" style={{ backgroundColor: dotColor }} />
        </div>
        <div>
          <p className="text-base font-bold text-slate-800">{el.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {el.area.toFixed(1)} m²
            {count > 1 && (
              <span className="text-muted-foreground/60">
                {' · '}{label} group: {count} surfaces, {totalArea.toFixed(1)} m² total
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Geometry card */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-sm">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Geometry
        </p>

        {/* Row 1 — Tilt | Azimuth */}
        <div className="grid grid-cols-2 gap-4">
          <TiltControl value={el.tilt} onChange={(v) => save({ tilt: v })} />
          <div className="border-l border-slate-200 pl-4">
            <AzimuthControl value={el.azimuth} onChange={(v) => save({ azimuth: v })} />
          </div>
        </div>

        {/* Row 2 — Area */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold text-slate-700">Area</span>
            <AreaSpinner value={el.area} onChange={(v) => save({ area: v })} />
          </div>
          <div className="border-l border-slate-200 pl-4 opacity-40">
            <span className="text-[11px] text-slate-400">More parameters coming soon</span>
          </div>
        </div>
      </div>

      {/* Impractical-value warnings */}
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

      {/* Thermal card */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Thermal
        </p>
        <UValueField value={el.uValue} onSave={(v) => save({ uValue: v })} />
      </div>

    </div>
  );
}
