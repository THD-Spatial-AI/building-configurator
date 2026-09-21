// Building envelope summary — one row per group (walls, windows, ...). A row
// opens the group's surface configurator, or expands to list its surfaces.

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS } from '../shared/ui';
import { hasInvalidArea } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { RoofConfig } from '@/app/components/BuildingConfigurator/configure/model/roof';
import {
  ElementGroupKey,
  ELEMENT_GROUP_LABELS,
  getGroupedElements,
  getRoofGroupInfo,
} from '../shared/elementListUtils';
import {
  SnapshotStatus,
  SnapshotStatusBadge,
  getElementStatus,
} from '../shared/snapshotUtils';

export interface ElementCompositionSectionProps {
  elements: Record<string, BuildingElement>;
  baselineElements?: Record<string, BuildingElement>;
  roofConfig: RoofConfig;
  /** Opens the surface configurator modal for the given group. */
  onEditGroup?: (type: ElementGroupKey) => void;
  /** When set, a group row expands to its surfaces instead, and picking one calls this. */
  onSelectSurface?: (id: string) => void;
}

/** One row per building envelope group; a row opens the group's configurator or expands to its surfaces. */
export function ElementCompositionSection({
  elements,
  baselineElements,
  roofConfig,
  onEditGroup,
  onSelectSurface,
}: ElementCompositionSectionProps) {
  const [expanded, setExpanded] = useState<ElementGroupKey | null>(null);
  const grouped  = getGroupedElements(elements);
  const roofInfo = getRoofGroupInfo(roofConfig);
  const types    = (Object.keys(grouped) as ElementGroupKey[]).filter((t) => grouped[t].length > 0);

  return (
    <div className="flex flex-col gap-1.5">
      {types.map((type) => {
        const items      = grouped[type];
        const totalArea  = items.reduce((sum, el) => sum + el.area, 0);
        const avgUValue  = totalArea > 0
          ? items.reduce((sum, el) => sum + el.uValue * el.area, 0) / totalArea
          : (items[0]?.uValue ?? 0);
        const modifiedCount = items.filter((el) => getElementStatus(el, baselineElements?.[el.id]) === 'modified').length;
        const groupStatus: SnapshotStatus = modifiedCount > 0 ? 'modified' : 'default';
        const invalidCount = items.filter(hasInvalidArea).length;
        const isOpen = onSelectSurface !== undefined && expanded === type;

        return (
          <div
            key={type}
            className={cn(
              'overflow-hidden rounded-lg border',
              invalidCount > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-slate-200 bg-white',
            )}
          >
            <button
              type="button"
              aria-expanded={onSelectSurface ? isOpen : undefined}
              onClick={() => (onSelectSurface ? setExpanded(isOpen ? null : type) : onEditGroup?.(type))}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50/80"
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ELEMENT_DOTS[type] }} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-700">
                {ELEMENT_GROUP_LABELS[type]}
                <span className="ml-1.5 font-normal text-slate-400">
                  {items.length}
                  {type === 'roof' && roofInfo.description ? ` · ${roofInfo.description}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                {totalArea.toFixed(1)} m² · U {avgUValue.toFixed(2)}
              </span>
              {invalidCount > 0 && (
                <span
                  title={`${invalidCount} with no area, fix before running a simulation`}
                  className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-destructive"
                >
                  <AlertTriangle className="size-3" />
                  {invalidCount}
                </span>
              )}
              <SnapshotStatusBadge status={groupStatus} />
              {onSelectSurface && (
                <ChevronDown className={cn('size-3.5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
              )}
            </button>

            {isOpen && (
              <ul className="border-t border-slate-100">
                {/* Surfaces a simulation would reject come first. */}
                {[...items].sort((a, b) => Number(hasInvalidArea(b)) - Number(hasInvalidArea(a))).map((el) => {
                  const invalid = hasInvalidArea(el);
                  return (
                    <li key={el.id}>
                      <button
                        type="button"
                        onClick={() => onSelectSurface(el.id)}
                        className="flex w-full cursor-pointer items-center gap-2 py-1.5 pl-7 pr-3 text-left text-[11px] transition-colors hover:bg-slate-50"
                      >
                        {invalid && <AlertTriangle className="size-3 shrink-0 text-destructive" />}
                        <span className={cn('min-w-0 flex-1 truncate', invalid ? 'font-medium text-destructive' : 'text-slate-600')}>
                          {el.label}
                        </span>
                        <span className={cn('shrink-0 tabular-nums', invalid ? 'font-medium text-destructive' : 'text-slate-500')}>
                          {invalid ? 'no area' : `${el.area.toFixed(1)} m²`}
                        </span>
                        <span className="w-12 shrink-0 text-right tabular-nums text-slate-400">U {el.uValue.toFixed(2)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
