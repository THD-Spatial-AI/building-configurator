// PV placement for a building, driven entirely by the host: which surfaces
// carry PV, which are suggested, and how much of each is usable come in as
// props, and every change goes back out through a callback. Nothing is stored
// here.

import { Info, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PresetSlider } from './surfaceControls';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';

/** One surface the host offers for PV. */
export interface PvSurface {
  /** installed carries PV; suggested is highlighted as worth adding; available is offered without a highlight. */
  state: 'installed' | 'suggested' | 'available';
  /** Share of the surface usable for panels, 0 to 1. */
  usableShare: number;
  /** Capacity of the panels at the current usable share, in kWp. */
  maxKwp: number;
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
const STATE_LABEL: Record<PvSurface['state'], string> = {
  installed: 'With PV',
  suggested: 'Suggested',
  available: 'Available',
};

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

function surfaceName(id: string, elements: Record<string, BuildingElement>): string {
  return elements[id]?.label ?? id;
}

/** The side panel in PV mode: the PV type, the host's notice, and every offered surface with its switch. */
export function PvPanel({ pv, elements, onSelect }: {
  pv: PvMode;
  elements: Record<string, BuildingElement>;
  /** Shows a surface in the model and opens its card. */
  onSelect: (surfaceId: string) => void;
}) {
  const entries = Object.entries(pv.surfaces);
  const installedCount = entries.filter(([, surface]) => surface.state === 'installed').length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Sun className="size-4 text-yellow-500" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-800">{pv.typeLabel}</p>
        <p className="shrink-0 text-[11px] text-muted-foreground">
          {installedCount} {installedCount === 1 ? 'surface' : 'surfaces'} with PV
        </p>
      </div>

      <div role="note" className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] leading-snug text-sky-900">
        <Info className="mt-px size-3.5 shrink-0" />
        {pv.notice}
      </div>

      {STATE_ORDER.map((state) => {
        const group = entries
          .filter(([, surface]) => surface.state === state)
          .sort(([a], [b]) => surfaceName(a, elements).localeCompare(surfaceName(b, elements), undefined, { numeric: true }));
        if (group.length === 0) return null;
        return (
          <div key={state}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{STATE_LABEL[state]}</p>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
              {group.map(([id, surface]) => (
                <li key={id} className="flex items-center gap-2 px-2.5 py-1.5">
                  <input
                    type="checkbox"
                    aria-label={`PV on ${surfaceName(id, elements)}`}
                    checked={surface.state === 'installed'}
                    onChange={(e) => pv.onToggle(id, e.target.checked)}
                    className="size-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    className="min-w-0 flex-1 cursor-pointer truncate text-left text-[12px] text-slate-700 hover:underline"
                  >
                    {surfaceName(id, elements)}
                  </button>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {elements[id]?.type ?? ''} · {surface.maxKwp.toFixed(1)} kWp
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The card beside a clicked surface: its PV switch and, with PV on it, the usable share. */
export function PvSurfaceCard({ surfaceId, surface, pv }: { surfaceId: string; surface: PvSurface; pv: PvMode }) {
  const installed = surface.state === 'installed';
  return (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={installed}
          onChange={(e) => pv.onToggle(surfaceId, e.target.checked)}
          className="size-4 cursor-pointer accent-primary"
        />
        <Sun className={cn('size-4', installed ? 'text-yellow-500' : 'text-slate-300')} />
        <span className="flex-1 text-[12px] font-semibold text-slate-700">PV on this surface</span>
      </label>
      {installed && (
        <PresetSlider
          label="Usable share"
          value={surface.usableShare * 100}
          min={0}
          max={100}
          step={5}
          unit="%"
          decimals={0}
          quality="of this surface, after obstructions"
          onChange={(percent) => pv.onShareChange(surfaceId, percent / 100)}
        />
      )}
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">Capacity</span>
        <span className="text-[12px] font-semibold text-slate-700">
          {surface.maxKwp.toFixed(1)}<span className="ml-1 text-[10px] font-normal text-slate-400">kWp</span>
        </span>
      </div>
    </div>
  );
}
