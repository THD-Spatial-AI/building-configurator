import React from 'react';
import { X } from 'lucide-react';
import {
  T, NumberInput, RangeSlider, FieldRow, FieldLabel,
  TypeBadge, ConfigSection, SegmentedControl,
} from './ui';
import { RoofConfigurator } from './RoofConfigurator';
import type { BuildingElement } from './BuildingVisualization';
import type { RoofConfig } from './RoofConfigurator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtR(u: number) { return u > 0 ? (1 / u).toFixed(3) : '∞'; }

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

function tiltLabel(t: number) {
  if (t <= 5)  return 'Horizontal';
  if (t <= 25) return 'Slightly pitched';
  if (t <= 55) return 'Pitched';
  if (t <= 80) return 'Steeply pitched';
  return 'Vertical';
}

// ─── Interactive compass widget ───────────────────────────────────────────────

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
            const a = ((v % 360) + 360) % 360;
            onChange(Math.round(a));
          }}
          unit="°" min={0} max={359} step={1}
        />
        <p className="text-[10px] text-muted-foreground mt-1">{azimuthLabel(azimuth)}</p>
      </div>
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex-1 bg-input-background border border-border rounded-md px-2.5 py-2">
      <p className="text-[9px] text-muted-foreground uppercase tracking-[0.04em] mb-0.5">{label}</p>
      <p className="text-base font-bold text-foreground leading-none">{value}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{unit}</p>
    </div>
  );
}

// ─── U-value quality badge ────────────────────────────────────────────────────

function uValueQuality(u: number, type: string) {
  const isWindow = type === 'window';
  const isDoor   = type === 'door';

  if (isWindow) {
    if (u <= 0.8)  return { label: 'Passive House', color: '#16a34a', bg: '#dcfce7' };
    if (u <= 1.1)  return { label: 'Near-zero',     color: '#65a30d', bg: '#ecfccb' };
    if (u <= 1.6)  return { label: 'Good',           color: '#ca8a04', bg: '#fef9c3' };
    if (u <= 2.0)  return { label: 'Standard',       color: '#ea580c', bg: '#ffedd5' };
    return               { label: 'Poor',            color: '#dc2626', bg: '#fee2e2' };
  }
  if (isDoor) {
    if (u <= 1.0)  return { label: 'Excellent',  color: '#16a34a', bg: '#dcfce7' };
    if (u <= 1.5)  return { label: 'Good',        color: '#65a30d', bg: '#ecfccb' };
    if (u <= 2.0)  return { label: 'Standard',    color: '#ca8a04', bg: '#fef9c3' };
    return               { label: 'Poor',         color: '#dc2626', bg: '#fee2e2' };
  }
  // Opaque elements
  if (u <= 0.10) return { label: 'Passive House', color: '#16a34a', bg: '#dcfce7' };
  if (u <= 0.20) return { label: 'Near-zero',     color: '#65a30d', bg: '#ecfccb' };
  if (u <= 0.35) return { label: 'Good',           color: '#ca8a04', bg: '#fef9c3' };
  if (u <= 0.50) return { label: 'Standard',       color: '#ea580c', bg: '#ffedd5' };
  return               { label: 'Poor',            color: '#dc2626', bg: '#fee2e2' };
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ElementPanelProps {
  selectedId: string;
  elements: Record<string, BuildingElement>;
  onUpdate: (id: string, patch: Partial<BuildingElement>) => void;
  onDeselect: () => void;
  roofConfig: RoofConfig;
  onRoofConfigChange: (config: RoofConfig) => void;
}

export function ElementPanel({
  selectedId, elements, onUpdate, onDeselect, roofConfig, onRoofConfigChange,
}: ElementPanelProps) {
  const el = elements[selectedId];
  if (!el) return null;

  const upd  = (patch: Partial<BuildingElement>) => onUpdate(selectedId, patch);
  const qual = uValueQuality(el.uValue, el.type);
  const isRoof   = el.type === 'roof';
  const isWindow = el.type === 'window';

  return (
    <div className="mb-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_36px_rgba(15,23,42,0.08)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/80 bg-slate-50 px-4 py-3">
        <TypeBadge type={el.type} />
        <span className="flex-1 text-[13px] font-semibold text-foreground">{el.label}</span>
        <button
          type="button"
          onClick={onDeselect}
          className="size-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Quick stats */}
        <div className="flex gap-2">
          <StatChip label="Area"    value={el.area.toFixed(1)}    unit="m²"    />
          <StatChip label="U-value" value={el.uValue.toFixed(2)}  unit="W/m²K" />
          <StatChip label="R-value" value={fmtR(el.uValue)}       unit="m²K/W" />
          {isWindow && el.gValue !== null && (
            <StatChip label="g-value" value={el.gValue.toFixed(2)} unit="–" />
          )}
        </div>

        {/* Area */}
        <div>
          <FieldLabel tip="Gross surface area of this building element.">Area</FieldLabel>
          <NumberInput
            value={el.area}
            onChange={(v) => upd({ area: Math.max(0.1, v) })}
            unit="m²" min={0.1} step={0.1}
          />
        </div>

        {/* Thermal properties */}
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,1))] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
            Thermal Properties
            <span
              className="px-2 py-[5px] rounded text-[10px] font-semibold mb-px shrink-0"
              style={{ backgroundColor: qual.bg, color: qual.color }}
            >
              {qual.label}
            </span>
          </p>

          {/* U-value + quality badge */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <FieldLabel tip="Thermal transmittance — lower is better insulated.">U-value</FieldLabel>
              <NumberInput
                value={el.uValue}
                onChange={(v) => upd({ uValue: Math.max(0.01, v) })}
                unit="W/m²K" min={0.01} max={10} step={0.01}
              />
            </div>
          </div>

          {/* R-value */}
          <NumberInput
            label="R-value (1/U)"
            value={parseFloat(fmtR(el.uValue))}
            onChange={(v) => {
              if (v > 0) upd({ uValue: parseFloat((1 / v).toFixed(4)) });
            }}
            unit="m²K/W" min={0.01} step={0.01}
          />

          {/* g-value — windows only */}
          {isWindow && (
            <div>
              <FieldLabel tip="Solar heat gain coefficient — fraction of solar radiation admitted.">
                g-value (SHGC)
              </FieldLabel>
              <NumberInput
                value={el.gValue ?? 0.6}
                onChange={(v) => upd({ gValue: Math.min(1, Math.max(0, v)) })}
                unit="–" min={0} max={1} step={0.01}
              />
            </div>
          )}
        </div>

        {/* Geometry */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,1))] p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
            Geometry
          </p>

          {/* Tilt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FieldLabel tip="Angle from horizontal: 0° = flat roof/floor, 90° = vertical wall.">
                Tilt
              </FieldLabel>
              <NumberInput
                value={el.tilt}
                onChange={(v) => upd({ tilt: Math.min(90, Math.max(0, v)) })}
                unit="°" min={0} max={90} step={0.5}
                width={90}
              />
            </div>
            <RangeSlider
              value={el.tilt}
              min={0} max={90} step={0.5}
              marks={[
                { value: 0,  label: '0° flat'  },
                { value: 30, label: '30°'       },
                { value: 60, label: '60°'       },
                { value: 90, label: '90° wall'  },
              ]}
              onChange={(v) => upd({ tilt: v })}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">{tiltLabel(el.tilt)}</p>
          </div>

          {/* Azimuth */}
          <div>
            <FieldLabel tip="Compass direction the surface faces. 0° = North, 180° = South. Click the compass to set.">
              Azimuth
            </FieldLabel>
            <CompassWidget azimuth={el.azimuth} onChange={(v) => upd({ azimuth: v })} />
          </div>
        </div>

        {/* Roof configurator */}
        {isRoof && (
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="border-b border-border/80 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                Roof Geometry &amp; PV Configuration
              </p>
            </div>
            <div className="bg-white p-3">
              <RoofConfigurator config={roofConfig} onChange={onRoofConfigChange} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
