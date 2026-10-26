// Building envelope summary — one row per group (walls, windows, ...). A row
// opens the group's surface configurator, or expands to list its surfaces.

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS } from '../shared/ui';
import { hasInvalidArea } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { RoofConfig } from '@/app/components/BuildingConfigurator/configure/model/roof';
import {
  ElementGroupKey,
  elementGroupLabels,
  getGroupedElements,
  getRoofGroupInfo,
} from '../shared/elementListUtils';
import {
  SnapshotStatus,
  SnapshotStatusBadge,
  getElementStatus,
} from '../shared/snapshotUtils';
import { useFormatNumber, useT } from '@/app/i18n';

export interface ElementCompositionSectionProps {
  elements: Record<string, BuildingElement>;
  baselineElements?: Record<string, BuildingElement>;
  roofConfig: RoofConfig;
  /** When set, a group row expands to its surfaces instead, and picking one calls this. */
  onSelectSurface?: (id: string) => void;
}

/** One row per building envelope group; with onSelectSurface a row expands to its surfaces. */
export function ElementCompositionSection({
  elements,
  baselineElements,
  roofConfig,
  onSelectSurface,
}: ElementCompositionSectionProps) {
  const t = useT();
  const format = useFormatNumber();
  const [expanded, setExpanded] = useState<ElementGroupKey | null>(null);
  const grouped  = getGroupedElements(elements);
  const roofInfo = getRoofGroupInfo(roofConfig, t);
  const groupLabels = elementGroupLabels(t);
  const types    = (Object.keys(grouped) as ElementGroupKey[]).filter((key) => grouped[key].length > 0);

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
              invalidCount > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card',
            )}
          >
            <button
              type="button"
              aria-expanded={onSelectSurface ? isOpen : undefined}
              onClick={() => onSelectSurface && setExpanded(isOpen ? null : type)}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/80"
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ELEMENT_DOTS[type] }} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
                {groupLabels[type]}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {items.length}
                  {type === 'roof' && roofInfo.description ? ` · ${roofInfo.description}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {format(totalArea, 1)} m² · U {format(avgUValue, 2)}
              </span>
              {invalidCount > 0 && (
                <span
                  title={t('envelope.invalidAreaTip', { count: invalidCount })}
                  className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-destructive"
                >
                  <AlertTriangle className="size-3" />
                  {invalidCount}
                </span>
              )}
              <SnapshotStatusBadge status={groupStatus} />
              {onSelectSurface && (
                <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
              )}
            </button>

            {isOpen && (
              <ul className="border-t border-border">
                {/* Surfaces a simulation would reject come first, then by name so a facing's surfaces sit together. */}
                {[...items].sort((a, b) =>
                  Number(hasInvalidArea(b)) - Number(hasInvalidArea(a))
                  || a.label.localeCompare(b.label, undefined, { numeric: true }),
                ).map((el) => {
                  const invalid = hasInvalidArea(el);
                  return (
                    <li key={el.id}>
                      <button
                        type="button"
                        onClick={() => onSelectSurface(el.id)}
                        className="flex w-full cursor-pointer items-center gap-2 py-1.5 pl-7 pr-3 text-left text-[11px] transition-colors hover:bg-muted"
                      >
                        {invalid && <AlertTriangle className="size-3 shrink-0 text-destructive" />}
                        <span className={cn('min-w-0 flex-1 truncate', invalid ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                          {el.label}
                        </span>
                        <span className={cn('shrink-0 tabular-nums', invalid ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                          {invalid ? t('envelope.noArea') : `${format(el.area, 1)} m²`}
                        </span>
                        <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">U {format(el.uValue, 2)}</span>
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
