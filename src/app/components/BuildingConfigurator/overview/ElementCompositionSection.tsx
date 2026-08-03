// Building envelope summary — one clickable card per group (walls, windows, ...).
// Clicking a card opens the surface configurator modal directly for that group.

import React from 'react';
import { ELEMENT_DOTS } from '../shared/ui';
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
}

/** Grid of building envelope group cards — each opens the surface configurator directly when clicked. */
export function ElementCompositionSection({
  elements,
  baselineElements,
  roofConfig,
  onEditGroup,
}: ElementCompositionSectionProps) {
  const grouped  = getGroupedElements(elements);
  const roofInfo = getRoofGroupInfo(roofConfig);
  const types    = (Object.keys(grouped) as ElementGroupKey[]).filter((t) => grouped[t].length > 0);

  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-3">
      {types.map((type) => {
        const items      = grouped[type];
        const totalArea  = items.reduce((sum, el) => sum + el.area, 0);
        const avgUValue  = totalArea > 0
          ? items.reduce((sum, el) => sum + el.uValue * el.area, 0) / totalArea
          : (items[0]?.uValue ?? 0);
        const modifiedCount = items.filter((el) => getElementStatus(el, baselineElements?.[el.id]) === 'modified').length;
        const groupStatus: SnapshotStatus = modifiedCount > 0 ? 'modified' : 'default';

        return (
          <button
            key={type}
            type="button"
            onClick={() => onEditGroup?.(type)}
            className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3.5 text-left transition-all cursor-pointer hover:border-primary/40 hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ELEMENT_DOTS[type] }} />
                <p className="truncate text-[12px] font-semibold uppercase tracking-[0.05em] text-slate-700">
                  {ELEMENT_GROUP_LABELS[type]}
                </p>
              </div>
              <SnapshotStatusBadge status={groupStatus} />
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-slate-800">{items.length}</span>
              <span className="text-[11px] text-slate-400">{items.length === 1 ? 'surface' : 'surfaces'}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{totalArea.toFixed(1)} m²</span>
              <span>avg U {avgUValue.toFixed(2)} W/m²K</span>
            </div>

            {type === 'roof' && roofInfo.description && (
              <p className="text-[10px] text-slate-400">{roofInfo.description}</p>
            )}
            {modifiedCount > 0 && (
              <p className="text-[10px] text-emerald-600">{modifiedCount} modified</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
