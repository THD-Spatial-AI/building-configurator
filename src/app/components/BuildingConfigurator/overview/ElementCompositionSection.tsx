// Accordion table of building envelope surfaces — read-only in the Overview.
// Users who want to edit values should open the configurator.

import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS } from '../shared/ui';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { isUserDefinedElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
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
import { scheduleScrollIntoView } from '../shared/scrollUtils';

export interface ElementCompositionSectionProps {
  elements: Record<string, BuildingElement>;
  baselineElements?: Record<string, BuildingElement>;
  roofConfig: RoofConfig;
}

/** Maps an azimuth angle (0–360°) to the nearest 8-point compass direction. */
function azimuthToDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % 8];
}

/** Accordion of element groups with expandable read-only tables. */
export function ElementCompositionSection({
  elements,
  baselineElements,
  roofConfig,
}: ElementCompositionSectionProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    wall: false, roof: false, floor: false, window: false, door: false,
  });
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const grouped    = getGroupedElements(elements);
  const roofInfo   = getRoofGroupInfo(roofConfig);
  const types      = (Object.keys(grouped) as ElementGroupKey[]).filter((t) => grouped[t].length > 0);
  const activeType = types.find((t) => expandedGroups[t]) ?? null;

  const toggleGroup = (type: string) => {
    const willExpand = !expandedGroups[type];
    setExpandedGroups((prev) => {
      const allClosed = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
      return { ...allClosed, [type]: !prev[type] };
    });
    if (willExpand) {
      requestAnimationFrame(() => scheduleScrollIntoView(cardRefs.current[type]));
    }
  };

  const renderHeader = (type: ElementGroupKey, compact: boolean) => {
    const items         = grouped[type];
    const isExpanded    = expandedGroups[type] ?? false;
    const totalArea     = items.reduce((sum, el) => sum + el.area, 0);
    const displayCount  = items.length;
    const areaStr       = `${totalArea.toFixed(1)} m²`;
    const description   = type === 'roof' && roofInfo.description
      ? `${areaStr} · ${roofInfo.description}`
      : areaStr;
    const modifiedCount = items.filter((el) => getElementStatus(el, baselineElements?.[el.id]) === 'modified').length;
    const groupStatus: SnapshotStatus = modifiedCount > 0 ? 'modified' : 'default';

    return (
      <button
        type="button"
        onClick={() => toggleGroup(type)}
        className={cn(
          'flex w-full flex-col px-3 text-left transition-colors hover:bg-slate-50',
          compact ? 'py-2.5' : 'py-3',
        )}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-700 leading-tight">
            {ELEMENT_GROUP_LABELS[type]}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {!compact && <SnapshotStatusBadge status={groupStatus} />}
            <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-300', isExpanded && 'rotate-180')} />
          </div>
        </div>

        {!compact && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {displayCount} surface{displayCount !== 1 ? 's' : ''} · {description}
            {modifiedCount > 0 ? ` · ${modifiedCount} modified` : ''}
          </p>
        )}
      </button>
    );
  };

  const renderTable = (type: ElementGroupKey) => {
    const items      = grouped[type];
    const isExpanded = expandedGroups[type] ?? false;

    return (
      <div
        className="overflow-hidden"
        style={{
          maxHeight: isExpanded ? '500px' : '0px',
          transition: 'max-height 300ms ease-in-out',
        }}
      >
        <div className="border-t border-slate-200 bg-white/80 px-3 py-3">
          <table className="w-full table-fixed border-collapse text-left bg-white">
            <thead className="text-[10px] uppercase tracking-[0.05em] text-slate-400">
              <tr className="border-b border-slate-200/80">
                <th className="px-2 py-1.5 font-semibold">Surface</th>
                <th className="w-24 border-l border-slate-100 px-2 py-1.5 font-semibold">Status</th>
                <th className="w-20 border-l border-slate-100 px-2 py-1.5 font-semibold">Area</th>
                <th className="w-[72px] border-l border-slate-100 px-2 py-1.5 font-semibold">U</th>
                <th className="w-[72px] border-l border-slate-100 px-2 py-1.5 font-semibold">g</th>
                <th className="w-20 border-l border-slate-100 px-2 py-1.5 font-semibold">Tilt</th>
                <th className="w-24 border-l border-slate-100 px-2 py-1.5 font-semibold">Azimuth</th>
              </tr>
            </thead>
            <tbody className="text-[11px] divide-y divide-slate-100">
              {items.map((el) => {
                const elementStatus = getElementStatus(el, baselineElements?.[el.id]);
                const userDefined   = isUserDefinedElement(el);
                return (
                  <tr key={el.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-2 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{el.label}</span>
                        {userDefined && (
                          <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                            User
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
                      <SnapshotStatusBadge status={elementStatus} />
                    </td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
                      {el.area.toFixed(1)}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
                      {el.uValue.toFixed(2)}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
                      {el.gValue === null ? '—' : el.gValue.toFixed(2)}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
                      {`${Math.round(el.tilt)}°`}
                    </td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
                      {`${Math.round(el.azimuth)}° (${azimuthToDirection(el.azimuth)})`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const getCardClass = () =>
    'overflow-hidden rounded-lg border border-white bg-white shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]';

  if (activeType) {
    const chipTypes = types.filter((t) => t !== activeType);
    return (
      <div className="flex flex-col gap-3">
        {chipTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chipTypes.map((type) => {
              const items       = grouped[type];
              const hasModified = items.some((el) => getElementStatus(el, baselineElements?.[el.id]) === 'modified');
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleGroup(type)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                >
                  {hasModified && <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  {ELEMENT_GROUP_LABELS[type]}
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">
                    {items.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div ref={(el) => { cardRefs.current[activeType] = el; }} className={getCardClass()}>
          {renderHeader(activeType, false)}
          {renderTable(activeType)}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-3">
      {types.map((type) => (
        <div key={type} ref={(el) => { cardRefs.current[type] = el; }} className={getCardClass()}>
          {renderHeader(type, false)}
          {renderTable(type)}
        </div>
      ))}
    </div>
  );
}
