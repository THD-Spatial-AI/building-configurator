// PV placement for a building, driven entirely by the host: which surfaces
// carry PV, which are suggested, and how much of each is usable come in as
// props, and every change goes back out through a callback. Nothing is stored
// here.

import { Info, MousePointerClick, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PresetSlider } from './surfaceControls';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import { pvGeometry, pvSummary } from '../../lib/pvSurfaces';

/** One surface the host offers for PV. */
export interface PvSurface {
  /** installed carries PV; suggested is highlighted as worth adding; available is offered without a highlight. */
  state: 'installed' | 'suggested' | 'available';
  /** Share of the surface usable for panels, 0 to 1. */
  usableShare: number;
  /** Capacity of the panels at the current usable share, in kWp. */
  maxKwp: number;
  /** Name for a surface that is not among the building's elements, such as a roof of a neighbouring 3D building. */
  label?: string;
  /**
   * The surface's geometry, shown in the list and its card. Used only for a
   * surface that is not among the building's elements; an element's own,
   * possibly edited, geometry takes precedence.
   */
  tilt?: number;      // degrees from horizontal
  azimuth?: number;   // degrees clockwise from north, 180 = south
  area?: number;      // m²
}

/**
 * PV mode. Hold the object and both callbacks stable, as for `services`: the
 * view updates when the host passes a new `surfaces` after a callback.
 */
export interface PvMode {
  /** Keyed by surface id, the id the geometry and the envelope elements carry. Only these surfaces can be clicked. */
  surfaces: Record<string, PvSurface>;
  /** Shown for as long as PV mode is open, in the host's language. */
  notice: string;
  /** Name of the PV type installed on this building. */
  typeLabel: string;
  onToggle: (surfaceId: string, installed: boolean) => void;
  onShareChange: (surfaceId: string, usableShare: number) => void;
}

const STATE_ORDER: PvSurface['state'][] = ['installed', 'suggested', 'available'];

/** The surface ids to draw with panels and to highlight as suggested. */
export function pvRenderSets(surfaces: Record<string, PvSurface>): { installed: Set<string>; suggested: Set<string> } {
  const installed = new Set<string>();
  const suggested = new Set<string>();
  for (const [id, surface] of Object.entries(surfaces)) {
    if (surface.state === 'installed') installed.add(id);
    else if (surface.state === 'suggested') suggested.add(id);
  }
  return { installed, suggested };
}

/** The element's own label, else the host's label, else the id. */
function surfaceName(id: string, elements: Record<string, BuildingElement>, surfaces: Record<string, PvSurface>): string {
  return elements[id]?.label ?? surfaces[id]?.label ?? id;
}

/** The compass point of an azimuth, as a message key under surface.compass. */
function compassPoint(azimuth: number): string {
  const points = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  return points[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}

/** An on/off switch with its state for assistive technology. */
function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span className={cn('absolute top-[3px] size-[18px] rounded-full bg-card shadow-sm transition-all', on ? 'right-[3px]' : 'left-[3px]')} />
    </button>
  );
}

/** The click hint, shown over the 3D view while PV mode is open. */
export function PvHintPill() {
  const t = useT();
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-foreground px-3.5 py-2 text-[12px] font-medium text-background shadow-md">
      <MousePointerClick className="size-4" aria-hidden />
      {t('pv.hint')}
    </div>
  );
}

/** What the three surface drawings in the 3D view mean. Colours match SurfaceGeometryViewer. */
export function PvLegend() {
  const t = useT();
  return (
    <div className="flex gap-3 rounded-md bg-card/90 px-3 py-2 text-[11px] text-foreground shadow-sm">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-sm bg-[#1F3A5F] outline outline-1 outline-[#9FB3CC]" />{t('pv.legend.installed')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-sm border-2 border-dashed border-[#B45309] bg-[#F2D9B8]" />{t('pv.legend.suggested')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-sm bg-[#B4664A]" />{t('pv.legend.available')}
      </span>
    </div>
  );
}

/** "32° · facing 205° · 52 m²", or nothing without geometry. */
function GeometryLine({ id, elements, surface }: { id: string; elements: Record<string, BuildingElement>; surface: PvSurface }) {
  const t = useT();
  const format = useFormatNumber();
  const geometry = pvGeometry(id, elements, surface);
  if (!geometry) return null;
  return (
    <span>
      {t('pv.geometry', { tilt: format(geometry.tilt, 0), azimuth: format(geometry.azimuth, 0), area: format(geometry.area, 0) })}
    </span>
  );
}

/** The side panel in PV mode: title, hint, totals, every offered surface with its switch, and the host's notice. */
export function PvPanel({ pv, elements, onSelect }: {
  pv: PvMode;
  elements: Record<string, BuildingElement>;
  /** Shows a surface in the model and opens its card. */
  onSelect: (surfaceId: string) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const summary = pvSummary(pv.surfaces, elements);
  const entries = Object.entries(pv.surfaces);
  const suggestedIds = entries.filter(([, surface]) => surface.state === 'suggested').map(([id]) => id);
  const ordered = STATE_ORDER.flatMap((state) => entries
    .filter(([, surface]) => surface.state === state)
    .sort(([a], [b]) => surfaceName(a, elements, pv.surfaces).localeCompare(surfaceName(b, elements, pv.surfaces), undefined, { numeric: true })));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[17px] font-bold text-foreground">{t('pv.title')}</h2>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Sun className="size-3.5 text-yellow-500" aria-hidden />{pv.typeLabel}
        </p>
      </div>

      <div role="note" className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-[12px] leading-snug text-foreground">
        <Info className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
        {t('pv.hint')}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          [`${format(summary.kwp, 1)} kWp`, t('pv.summary.capacity')],
          [t('pv.summary.count', { installed: summary.installed, total: summary.total }), t('pv.summary.surfaces')],
          [`${format(summary.panelArea, 0)} m²`, t('pv.summary.panelArea')],
        ].map(([value, label]) => (
          <div key={label} className="rounded-md bg-muted px-2.5 py-2">
            <div className="text-[15px] font-bold text-foreground">{value}</div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {ordered.map(([id, surface]) => {
          const name = surfaceName(id, elements, pv.surfaces);
          const installed = surface.state === 'installed';
          return (
            <li key={id} className={cn('flex items-center gap-2.5 px-3 py-2', surface.state === 'suggested' && 'bg-amber-500/5')}>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    className="min-w-0 cursor-pointer truncate text-left text-[13px] font-semibold text-foreground hover:underline"
                  >{name}</button>
                  {surface.state === 'suggested' && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">{t('pv.state.suggested')}</span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  <GeometryLine id={id} elements={elements} surface={surface} />
                </div>
              </div>
              <span className={cn('shrink-0 text-[12px]', installed ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {installed ? `${format(surface.maxKwp, 1)} kWp` : t('pv.upTo', { kwp: format(surface.maxKwp, 1) })}
              </span>
              <Switch on={installed} label={t('pv.toggle', { surface: name })} onChange={(on) => pv.onToggle(id, on)} />
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] leading-snug text-muted-foreground">{pv.notice}</p>

      <button
        type="button"
        disabled={suggestedIds.length === 0}
        onClick={() => suggestedIds.forEach((id) => pv.onToggle(id, true))}
        className="h-10 cursor-pointer self-start rounded-md border border-border bg-card px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >{t('pv.useSuggested')}</button>
    </div>
  );
}

/** A small drawing of the modules inside the usable share of a surface. */
function LayoutPreview({ share }: { share: number }) {
  const t = useT();
  const scale = Math.sqrt(Math.min(1, Math.max(0, share)));
  const w = 112 * scale;
  const h = 70 * scale;
  const x0 = 10 + (112 - w) / 2;
  const y0 = 9 + (70 - h) / 2;
  const cols = Math.max(1, Math.floor(w / 14));
  const rows = Math.max(1, Math.floor(h / 17));
  const modules = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      modules.push(<rect key={`${r}-${c}`} x={x0 + c * (w / cols) + 1} y={y0 + r * (h / rows) + 1} width={w / cols - 2} height={h / rows - 2} />);
    }
  }
  return (
    <svg width="132" height="88" viewBox="0 0 132 88" role="img" aria-label={t('pv.card.layout')} className="shrink-0">
      <rect x="1" y="1" width="130" height="86" rx="4" fill="#B4664A" />
      <g fill="#1F3A5F" stroke="#9FB3CC" strokeWidth="0.8">{modules}</g>
    </svg>
  );
}

/** The card beside a clicked surface: its geometry, PV switch, usable share and panels. */
export function PvSurfaceCard({ surfaceId, surface, pv, elements = {}, onClose }: {
  surfaceId: string;
  surface: PvSurface;
  pv: PvMode;
  elements?: Record<string, BuildingElement>;
  /** Closes the card, from its Done button. */
  onClose?: () => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const installed = surface.state === 'installed';
  const geometry = pvGeometry(surfaceId, elements, surface);
  const area = elements[surfaceId]?.area ?? surface.area;

  return (
    <div className="flex flex-col gap-3 p-3">
      {geometry && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              [t('surface.tilt'), `${format(geometry.tilt, 0)}°`],
              [t('surface.facing'), `${format(geometry.azimuth, 0)}° ${t(`surface.compass.${compassPoint(geometry.azimuth)}`)}`],
              [t('surface.area'), `${format(geometry.area, 0)} m²`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-muted px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="text-[13px] font-semibold text-foreground">{value}</div>
              </div>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">{t('pv.card.fromModel')}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
        <span className="text-[12px] font-semibold text-foreground">{t('pv.thisSurface')}</span>
        <Switch on={installed} label={t('pv.thisSurface')} onChange={(on) => pv.onToggle(surfaceId, on)} />
      </div>

      {installed ? (
        <>
          <PresetSlider
            label={t('pv.usableShare')}
            value={surface.usableShare * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            decimals={0}
            quality={t('pv.usableShareNote')}
            onChange={(percent) => pv.onShareChange(surfaceId, percent / 100)}
          />
          <div className="flex items-center gap-3 rounded-md bg-muted p-2">
            <LayoutPreview share={surface.usableShare} />
            <span className="text-[12px] text-foreground">
              {area === undefined
                ? `${format(surface.maxKwp, 1)} kWp`
                : t('pv.card.panels', { kwp: format(surface.maxKwp, 1), area: format(area * surface.usableShare, 0) })}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <button
              type="button"
              onClick={() => pv.onToggle(surfaceId, false)}
              className="h-9 cursor-pointer rounded-md border border-destructive/40 bg-card px-3 text-[12px] font-medium text-destructive hover:bg-destructive/10"
            >{t('pv.card.remove')}</button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-9 cursor-pointer rounded-md bg-foreground px-4 text-[12px] font-semibold text-background hover:opacity-90"
              >{t('pv.card.done')}</button>
            )}
          </div>
        </>
      ) : (
        <>
          <span className="text-[12px] text-muted-foreground">{t('pv.upTo', { kwp: format(surface.maxKwp, 1) })}</span>
          {surface.state === 'suggested' && (
            <button
              type="button"
              onClick={() => pv.onToggle(surfaceId, true)}
              className="h-9 cursor-pointer self-start rounded-md bg-primary px-4 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
            >{t('pv.card.add')}</button>
          )}
        </>
      )}
    </div>
  );
}

/** The card beside the pointer over a clickable surface: what it is and what a click does. */
export function PvHoverCard({ surfaceId, surface, elements, at }: {
  surfaceId: string;
  surface: PvSurface;
  elements: Record<string, BuildingElement>;
  at: { x: number; y: number };
}) {
  const t = useT();
  const installed = surface.state === 'installed';
  return (
    <div
      className="pointer-events-none fixed z-30 flex flex-col gap-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-[12px] shadow-md"
      style={{ left: at.x + 14, top: at.y + 14 }}
    >
      <span className="font-semibold text-foreground">{surfaceName(surfaceId, elements, { [surfaceId]: surface })}</span>
      <span className="text-muted-foreground">
        <GeometryLine id={surfaceId} elements={elements} surface={surface} />
        {pvGeometry(surfaceId, elements, surface) ? ' · ' : ''}{t(`pv.state.${surface.state}`)}
      </span>
      <span className="font-medium text-primary">{t(installed ? 'pv.hover.remove' : 'pv.hover.add')}</span>
    </div>
  );
}
