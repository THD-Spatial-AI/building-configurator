// Direct-manipulation controls for one surface: drag the dial rather than type
// the angle, pick a slider position rather than a number. Each one is also a
// keyboard slider (arrows step, Home/End jump), since a dial that only answers
// to a pointer is unusable without one.

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useT, type Translate } from '../../i18n';

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
  { point: 'n', deg: 0 }, { point: 'e', deg: 90 }, { point: 's', deg: 180 }, { point: 'w', deg: 270 },
];

/** Compass label for an azimuth, e.g. 135° -> "SE-facing". */
export function facingLabel(azimuth: number, t: Translate): string {
  const points = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const point = points[Math.round(normalize360(azimuth) / 45) % 8];
  return t('surface.facingDirection', { direction: t(`surface.compass.${point}`) });
}

interface AzimuthDialProps {
  value: number;
  onChange: (value: number) => void;
  /** Drawn behind the needle, e.g. the imported orientation. */
  reference?: number;
}

/** Compass whose needle is dragged to set which way the surface faces. */
export function AzimuthDial({ value, onChange, reference }: AzimuthDialProps) {
  const t = useT();
  const drag = useDragValue((element, x, y) => onChange(Math.round(normalize360(pointerAngle(element, x, y)))));

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-medium text-muted-foreground">{t('surface.facing')}</span>
      <div
        {...drag}
        role="slider"
        aria-label={t('surface.azimuth')}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(value)}
        aria-valuetext={t('surface.degrees', { degrees: Math.round(value), label: facingLabel(value, t) })}
        tabIndex={0}
        onKeyDown={(e) => {
          const next = arrowStep(e.key, value, e.shiftKey ? 1 : 5);
          if (next === null) return;
          e.preventDefault();
          onChange(normalize360(next));
        }}
        className="relative size-[86px] cursor-grab touch-none rounded-full border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
      >
        {COMPASS_POINTS.map(({ point, deg }) => (
          <span
            key={point}
            className={cn('absolute text-[9px] font-bold', point === 'n' ? 'text-red-500' : 'text-muted-foreground')}
            style={{
              left: `${50 + 40 * Math.sin((deg * Math.PI) / 180)}%`,
              top: `${50 - 40 * Math.cos((deg * Math.PI) / 180)}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {t(`surface.compass.${point}`)}
          </span>
        ))}

        {reference !== undefined && Math.round(reference) !== Math.round(value) && (
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[30px] w-px origin-bottom bg-muted-foreground/40"
            style={{ transform: `translate(-50%, -100%) rotate(${reference}deg)`, transformOrigin: '50% 100%' }}
          />
        )}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[30px] w-[3px] origin-bottom rounded-full bg-primary"
          style={{ transform: `translate(-50%, -100%) rotate(${value}deg)`, transformOrigin: '50% 100%' }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground">
        {Math.round(value)}° · {facingLabel(value, t)}
      </span>
    </div>
  );
}

/** Tilt in words, matching how the surface actually sits. */
export function tiltLabel(tilt: number, t: Translate): string {
  if (tilt <= 5) return t('surface.tiltShape.flat');
  if (tilt >= 85) return t('surface.tiltShape.vertical');
  return t('surface.tiltShape.pitched');
}

interface TiltDialProps {
  value: number;
  onChange: (value: number) => void;
}

/** Side-on profile of the surface, hinged at the base: drag it up to stand it
 *  vertical, down to lay it flat. */
export function TiltDial({ value, onChange }: TiltDialProps) {
  const t = useT();
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
      <span className="text-[10px] font-medium text-muted-foreground">{t('surface.tilt')}</span>
      <div
        {...drag}
        role="slider"
        aria-label={t('surface.tilt')}
        aria-valuemin={0}
        aria-valuemax={90}
        aria-valuenow={Math.round(value)}
        aria-valuetext={t('surface.degrees', { degrees: Math.round(value), label: tiltLabel(value, t).toLowerCase() })}
        tabIndex={0}
        onKeyDown={(e) => {
          const next = arrowStep(e.key, value, e.shiftKey ? 1 : 5);
          if (next === null) return;
          e.preventDefault();
          onChange(Math.min(90, Math.max(0, next)));
        }}
        className="relative size-[86px] cursor-grab touch-none rounded-lg border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
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
      <span className="text-[10px] font-semibold text-muted-foreground">
        {Math.round(value)}° · {tiltLabel(value, t)}
      </span>
    </div>
  );
}
