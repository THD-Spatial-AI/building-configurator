// Direct-manipulation controls for one surface: drag the dial rather than type
// the angle, pick a slider position rather than a number. Each one is also a
// keyboard slider (arrows step, Home/End jump), since a dial that only answers
// to a pointer is unusable without one.

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

/** Pointer position as an angle in degrees, clockwise from north (up). */
function pointerAngle(element: HTMLElement, clientX: number, clientY: number): number {
  const rect = element.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Drag anywhere in the control to set a value; the handler maps the pointer. */
function useDragValue(onMove: (element: HTMLElement, x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);

  const start = (event: React.PointerEvent) => {
    const element = ref.current;
    if (!element) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    onMove(element, event.clientX, event.clientY);
  };

  const move = (event: React.PointerEvent) => {
    const element = ref.current;
    if (!element || !element.hasPointerCapture(event.pointerId)) return;
    onMove(element, event.clientX, event.clientY);
  };

  return { ref, onPointerDown: start, onPointerMove: move };
}

function arrowStep(key: string, value: number, step: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowUp') return value + step;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return value - step;
  return null;
}

const COMPASS_POINTS = [
  { label: 'N', deg: 0 }, { label: 'E', deg: 90 }, { label: 'S', deg: 180 }, { label: 'W', deg: 270 },
];

/** Compass label for an azimuth, e.g. 135° -> "SE-facing". */
export function facingLabel(azimuth: number): string {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${names[Math.round(normalize360(azimuth) / 45) % 8]}-facing`;
}

interface AzimuthDialProps {
  value: number;
  onChange: (value: number) => void;
  /** Drawn behind the needle, e.g. the imported orientation. */
  reference?: number;
}

/** Compass whose needle is dragged to set which way the surface faces. */
export function AzimuthDial({ value, onChange, reference }: AzimuthDialProps) {
  const drag = useDragValue((element, x, y) => onChange(Math.round(normalize360(pointerAngle(element, x, y)))));

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium text-muted-foreground">Facing</span>
      <div
        {...drag}
        role="slider"
        aria-label="Azimuth"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)} degrees, ${facingLabel(value)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          const next = arrowStep(e.key, value, e.shiftKey ? 1 : 5);
          if (next === null) return;
          e.preventDefault();
          onChange(normalize360(next));
        }}
        className="relative size-[86px] cursor-grab touch-none rounded-full border border-slate-200 bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
      >
        {COMPASS_POINTS.map(({ label, deg }) => (
          <span
            key={label}
            className={cn('absolute text-[9px] font-bold', label === 'N' ? 'text-red-500' : 'text-slate-400')}
            style={{
              left: `${50 + 40 * Math.sin((deg * Math.PI) / 180)}%`,
              top: `${50 - 40 * Math.cos((deg * Math.PI) / 180)}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {label}
          </span>
        ))}

        {reference !== undefined && Math.round(reference) !== Math.round(value) && (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[30px] w-px origin-bottom bg-slate-300"
            style={{ transform: `translate(-50%, -100%) rotate(${reference}deg)`, transformOrigin: '50% 100%' }}
          />
        )}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[30px] w-[3px] origin-bottom rounded-full bg-primary"
          style={{ transform: `translate(-50%, -100%) rotate(${value}deg)`, transformOrigin: '50% 100%' }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      </div>
      <span className="text-[10px] font-semibold text-slate-600">
        {Math.round(value)}° · {facingLabel(value)}
      </span>
    </div>
  );
}

/** Tilt in words, matching how the surface actually sits. */
export function tiltLabel(tilt: number): string {
  if (tilt <= 5) return 'Flat';
  if (tilt >= 85) return 'Vertical';
  return 'Pitched';
}

interface TiltDialProps {
  value: number;
  onChange: (value: number) => void;
}

/** Side-on profile of the surface, hinged at the base: drag it up to stand it
 *  vertical, down to lay it flat. */
export function TiltDial({ value, onChange }: TiltDialProps) {
  const drag = useDragValue((element, x, y) => {
    const rect = element.getBoundingClientRect();
    // Hinged at the bottom-left, so the pointer's angle above the ground line is the tilt.
    const dx = Math.max(1, x - rect.left - 8);
    const dy = rect.bottom - 10 - y;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    onChange(Math.round(Math.min(90, Math.max(0, deg))));
  });

  const radians = (value * Math.PI) / 180;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium text-muted-foreground">Tilt</span>
      <div
        {...drag}
        role="slider"
        aria-label="Tilt"
        aria-valuemin={0}
        aria-valuemax={90}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)} degrees, ${tiltLabel(value).toLowerCase()}`}
        tabIndex={0}
        onKeyDown={(e) => {
          const next = arrowStep(e.key, value, e.shiftKey ? 1 : 5);
          if (next === null) return;
          e.preventDefault();
          onChange(Math.min(90, Math.max(0, next)));
        }}
        className="relative size-[86px] cursor-grab touch-none rounded-lg border border-slate-200 bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
      >
        <svg viewBox="0 0 86 86" className="pointer-events-none absolute inset-0">
          <path d="M 68 76 A 60 60 0 0 0 8 16" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="8" y1="76" x2="74" y2="76" stroke="#cbd5e1" strokeWidth="1.5" />
          <line
            x1="8" y1="76"
            x2={8 + 60 * Math.cos(radians)}
            y2={76 - 60 * Math.sin(radians)}
            stroke="var(--color-primary, #2f5d8a)" strokeWidth="3" strokeLinecap="round"
          />
          <circle
            cx={8 + 60 * Math.cos(radians)}
            cy={76 - 60 * Math.sin(radians)}
            r="5" fill="var(--color-primary, #2f5d8a)"
          />
        </svg>
      </div>
      <span className="text-[10px] font-semibold text-slate-600">
        {Math.round(value)}° · {tiltLabel(value)}
      </span>
    </div>
  );
}

interface PresetSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  /** Named values worth one click, e.g. this building's TABULA levels. */
  presets?: { label: string; value: number }[];
  /** Words for the current value, e.g. "Uninsulated". */
  quality?: string;
  onChange: (value: number) => void;
}

/** Slider with the value spelled out and one-click named positions. */
export function PresetSlider({
  label, value, min, max, step, unit, decimals = 2, presets = [], quality, onChange,
}: PresetSliderProps) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[12px] font-semibold text-slate-700">
          {value.toFixed(decimals)}{unit && <span className="ml-1 text-[10px] font-normal text-slate-400">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      {(quality || presets.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {quality && (
            <span className="mr-auto text-[10px] font-medium text-slate-500">{quality}</span>
          )}
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={`${preset.label}: ${preset.value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`}
              onClick={() => onChange(preset.value)}
              className={cn(
                'cursor-pointer rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                Math.abs(preset.value - value) < step / 2
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
