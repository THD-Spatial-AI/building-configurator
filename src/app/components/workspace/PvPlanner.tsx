// Where PV can go on this building: every surface worth offering, best first,
// with what would fit on it and a switch to put it there.
//
// While this is open the same surfaces are lit in the 3D view, so the list and
// the model are describing the same thing.

import React from 'react';
import { Settings2, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  compassDir,
  suitabilityLabel,
  type PvCandidate,
} from '../BuildingConfigurator/shared/pvSuitability';

interface PvPlannerProps {
  candidates: PvCandidate[];
  installedIds: ReadonlySet<string>;
  /** Installs or removes PV on a surface, at the capacity that fits it. */
  onToggle: (candidate: PvCandidate, installed: boolean) => void;
  /** Shows the surface in the 3D view. */
  onSelect?: (elementId: string) => void;
  /** Opens an installed surface's full PV parameters. Expert mode only. */
  onConfigure?: (elementId: string) => void;
}

export function PvPlanner({ candidates, installedIds, onToggle, onSelect, onConfigure }: PvPlannerProps) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3">
        <p className="text-[11px] leading-snug text-muted-foreground">
          No surface on this building faces within 90° of south, so none is worth
          putting PV on.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] leading-snug text-muted-foreground">
        Rated by orientation, tilt and area. The same surfaces are lit in the model.
      </p>
      {candidates.map((candidate) => {
        const { element, score, capacityKwp } = candidate;
        const installed = installedIds.has(element.id);
        const suit = suitabilityLabel(score);
        return (
          <div
            key={element.id}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-2',
              installed ? 'border-primary/40 bg-primary/5' : 'border-slate-200 bg-white',
            )}
          >
            <button
              type="button"
              onClick={() => onSelect?.(element.id)}
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-semibold capitalize text-slate-700">
                  {element.type} · {compassDir(element.azimuth)}
                </span>
                <span className={cn('shrink-0 rounded border px-1 py-px text-[9px] font-semibold', suit.bg, suit.color)}>
                  {suit.text}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {element.area.toFixed(1)} m² · {element.tilt.toFixed(0)}° · fits ~{capacityKwp.toFixed(1)} kWp
              </p>
            </button>

            {installed && onConfigure && (
              <button
                type="button"
                title="PV parameters for this surface"
                onClick={() => onConfigure(element.id)}
                className="flex shrink-0 cursor-pointer items-center rounded-md border border-slate-300 bg-white p-1.5 text-slate-500 transition-colors hover:bg-muted"
              >
                <Settings2 className="size-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggle(candidate, !installed)}
              className={cn(
                'flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                installed
                  ? 'border-primary/30 bg-white text-primary hover:bg-primary/10'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-muted',
              )}
            >
              <Sun className={cn('size-3', installed && 'text-yellow-500')} />
              {installed ? 'Installed' : 'Install'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
