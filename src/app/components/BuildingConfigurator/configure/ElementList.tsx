// Compact read-only element list used in the Configure sidebar.
// Shows surfaces grouped by type with area, U-value, and azimuth.

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS } from '../shared/ui';
import type { BuildingElement } from './BuildingVisualization';
import type { RoofConfig } from './RoofConfigurator';
import {
  ElementGroupKey,
  ELEMENT_GROUP_LABELS,
  getGroupedElements,
  getRoofGroupInfo,
} from '../shared/elementListUtils';

export interface ElementListProps {
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  roofConfig: RoofConfig;
}

/** Grouped, collapsible list of building surfaces for quick selection. */
export function ElementList({ elements, selectedId, onSelect, roofConfig }: ElementListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    wall: true, roof: false, floor: false, window: false, door: false,
  });

  const grouped  = getGroupedElements(elements);
  const roofInfo = getRoofGroupInfo(roofConfig);

  return (
    <div className="flex flex-col gap-2">
      {(Object.keys(grouped) as ElementGroupKey[]).map((type) => {
        const items = grouped[type];
        if (items.length === 0) return null;

        const isExpanded      = expandedGroups[type] ?? false;
        const totalTypeArea   = items.reduce((sum, item) => sum + item.area, 0);
        const displayCount    = items.length;
        const displayDesc     = type === 'roof' ? roofInfo.description : null;

        return (
          <div key={type} className="overflow-hidden border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,1))] shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
            <button
              type="button"
              onClick={() => setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }))}
              className="flex w-full items-center gap-2 border-b border-border/70 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100/80"
            >
              <span className="size-2 shrink-0" style={{ backgroundColor: ELEMENT_DOTS[type] }} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">
                  {ELEMENT_GROUP_LABELS[type]}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {displayCount} surface{displayCount !== 1 ? 's' : ''}
                  {displayDesc ? ` · ${displayDesc}` : ` · ${totalTypeArea.toFixed(1)} m²`}
                </p>
              </div>
              <div className="rounded-[6px] border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {displayCount}
              </div>
              <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')} />
            </button>

            {isExpanded && (
              <div className="px-2 py-2">
                <table className="w-full table-fixed border-collapse text-left bg-white">
                  <thead className="text-[10px] uppercase tracking-[0.05em] text-slate-400">
                    <tr className="border-b border-slate-200/80">
                      <th className="px-2 py-1.5 font-semibold">Surface</th>
                      <th className="w-16 border-l border-slate-100 px-2 py-1.5 font-semibold">Area</th>
                      <th className="w-16 border-l border-slate-100 px-2 py-1.5 font-semibold">U-value</th>
                      <th className="w-16 border-l border-slate-100 px-2 py-1.5 font-semibold">Azimuth</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-100">
                    {items.map((el) => (
                      <tr
                        key={el.id}
                        className={cn(
                          'cursor-pointer transition-colors',
                          selectedId === el.id ? 'bg-primary/10' : 'hover:bg-slate-50',
                        )}
                        onClick={() => onSelect(el.id)}
                      >
                        <td className="px-2 py-2.5 font-medium text-foreground">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: ELEMENT_DOTS[el.type] }} />
                            <span className="truncate">{el.label}</span>
                          </div>
                        </td>
                        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">{el.area.toFixed(1)}</td>
                        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">{el.uValue.toFixed(2)}</td>
                        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">{Math.round(el.azimuth)}°</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
