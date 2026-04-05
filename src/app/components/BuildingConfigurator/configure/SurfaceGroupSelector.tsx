// Expandable type-grouped surface selector for the Configure view right column.
// Elements are grouped by type (Walls / Roof / Floor / Windows / Doors).
// Each expanded group lists individual elements by label and compass direction.
// Clicking an element selects it by ID — the parent handles viz sync.

import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS } from '../shared/ui';
import type { BuildingElement } from './BuildingVisualization';
import { faceFromAzimuth } from './BuildingVisualization';
import { ELEMENT_GROUP_LABELS, type ElementGroupKey } from '../shared/elementListUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Short compass label for an element's facing direction. */
function directionLabel(el: BuildingElement): string {
  if (el.type === 'roof')  return 'Top';
  if (el.type === 'floor') return 'Base';
  const MAP: Record<string, string> = {
    north_wall: 'N', northeast_wall: 'NE', east_wall: 'E', southeast_wall: 'SE',
    south_wall: 'S', southwest_wall: 'SW', west_wall: 'W', northwest_wall: 'NW',
  };
  return MAP[faceFromAzimuth(el.azimuth)] ?? '—';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SurfaceGroupSelectorProps {
  elements: Record<string, BuildingElement>;
  /** ID of the currently selected element; drives accordion expansion and row highlight. */
  selectedElementId: string | null;
  /** Called when the user clicks an element row, passing its ID. */
  onSelect: (elementId: string) => void;
}

const TYPE_ORDER: ElementGroupKey[] = ['wall', 'roof', 'floor', 'window', 'door'];

/** Expandable type-grouped list of individual building envelope elements. */
export function SurfaceGroupSelector({ elements, selectedElementId, onSelect }: SurfaceGroupSelectorProps) {
  // Build ordered, non-empty type groups; elements sorted by azimuth within each group.
  const typeGroups = TYPE_ORDER
    .map((type) => ({
      type,
      items: Object.values(elements)
        .filter((el) => el.type === type)
        .sort((a, b) => a.azimuth - b.azimuth),
    }))
    .filter((g) => g.items.length > 0);

  // Only one group open at a time; default to the first.
  const [activeType, setActiveType] = useState<ElementGroupKey | null>(
    () => typeGroups[0]?.type ?? null,
  );

  // Auto-expand the type group that contains the currently selected element.
  useEffect(() => {
    if (selectedElementId) {
      const el = elements[selectedElementId];
      if (el) setActiveType(el.type as ElementGroupKey);
    }
  }, [selectedElementId, elements]);

  const toggle = (type: ElementGroupKey) =>
    setActiveType((prev) => (prev === type ? null : type));

  return (
    <div className="flex flex-col">
      {typeGroups.map(({ type, items }) => {
        const isOpen      = activeType === type;
        const hasSelected = items.some((el) => el.id === selectedElementId);
        const dotColor    = ELEMENT_DOTS[type];

        return (
          <div key={type} className="border-b border-slate-100 last:border-0">

            {/* Type group header */}
            <button
              type="button"
              onClick={() => toggle(type)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80 cursor-pointer"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
              <span className="flex-1 text-[11px] font-semibold text-slate-700">
                {ELEMENT_GROUP_LABELS[type]}
              </span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {items.length}
              </span>
              {hasSelected && !isOpen && (
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              )}
              <ChevronRight className={cn(
                'size-3 shrink-0 text-slate-400 transition-transform duration-200',
                isOpen && 'rotate-90',
              )} />
            </button>

            {/* Individual elements — grid-rows trick for smooth height animation */}
            <div className={cn(
              'grid transition-all duration-200 ease-in-out',
              isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}>
              <div className="overflow-hidden">
                <div className="pb-1">
                  {items.map((el) => {
                    const selected = el.id === selectedElementId;
                    const dir      = directionLabel(el);
                    return (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => onSelect(el.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 py-2 pl-7 pr-3 text-left transition-colors',
                          selected ? 'bg-primary/10' : 'hover:bg-slate-50',
                        )}
                      >
                        <span
                          className="size-1.5 shrink-0 rounded-full opacity-60"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className={cn(
                          'flex-1 truncate text-[11px]',
                          selected ? 'font-semibold text-primary' : 'font-medium text-slate-700',
                        )}>
                          {el.label}
                        </span>
                        <span className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold',
                          selected
                            ? 'bg-primary/15 text-primary'
                            : 'bg-slate-100 text-slate-500',
                        )}>
                          {dir}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}
