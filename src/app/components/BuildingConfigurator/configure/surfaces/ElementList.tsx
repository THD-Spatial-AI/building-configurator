// Sidebar element list for the Configure view.
// Shows surface groups in a 2-column grid. Expanding one group collapses
// the rest to compact chips at the top; the expanded group fills the
// remaining height with a scrollable surface table.
//
// Bidirectional sync: when selectedGroup changes (from viz click) the matching
// group type auto-expands and rows belonging to that face are highlighted.

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS, ScrollHintContainer } from '@/app/components/BuildingConfigurator/shared/ui';
import type { BuildingElement, FaceGroup } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { faceFromAzimuth } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { RoofConfig } from '@/app/components/BuildingConfigurator/configure/model/roof';
import {
  ElementGroupKey,
  ELEMENT_GROUP_LABELS,
  getGroupedElements,
  getRoofGroupInfo,
} from '@/app/components/BuildingConfigurator/shared/elementListUtils';

export interface ElementListProps {
  elements: Record<string, BuildingElement>;
  /** Which specific element row is highlighted for the right panel. */
  selectedId: string | null;
  /** Which group is highlighted from the viz — drives auto-expand and face highlighting. */
  selectedGroup: FaceGroup | null;
  /** Called when the user clicks a specific element row. */
  onSelect: (id: string) => void;
  roofConfig: RoofConfig;
}

/** 8-point direction label matching faceFromAzimuth — ensures list and 3D preview always agree. */
function surfaceDirection(el: BuildingElement): string {
  if (el.type === 'roof' && el.tilt <= 10) return 'Top';
  if (el.type === 'floor') return 'Base';
  const MAP: Record<string, string> = {
    north_wall: 'N',  northeast_wall: 'NE',
    east_wall:  'E',  southeast_wall: 'SE',
    south_wall: 'S',  southwest_wall: 'SW',
    west_wall:  'W',  northwest_wall: 'NW',
  };
  return MAP[faceFromAzimuth(el.azimuth)] ?? '—';
}

/** Returns true when an element belongs to the currently selected face group. */
function elementMatchesGroup(el: BuildingElement, group: FaceGroup): boolean {
  if (el.type !== group.type) return false;
  if (group.type === 'roof') {
    if (group.elementId) return el.id === group.elementId;
    return (el.tilt <= 10 ? 'roof' : faceFromAzimuth(el.azimuth)) === group.face;
  }
  if (group.type === 'floor') return true;
  return faceFromAzimuth(el.azimuth) === group.face;
}

/** Grouped, collapsible list of building surfaces for quick selection. */
export function ElementList({ elements, selectedId, selectedGroup, onSelect, roofConfig }: ElementListProps) {
  const [activeType, setActiveType] = useState<ElementGroupKey | null>(null);

  const grouped  = getGroupedElements(elements);
  const roofInfo = getRoofGroupInfo(roofConfig);
  const types    = (Object.keys(grouped) as ElementGroupKey[]).filter((t) => grouped[t].length > 0);

  // Auto-expand the group type that matches an incoming viz selection
  useEffect(() => {
    if (!selectedGroup) return;
    const incoming = selectedGroup.type as ElementGroupKey;
    if (types.includes(incoming)) {
      setActiveType(incoming);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup]);

  const toggleGroup = (type: ElementGroupKey) =>
    setActiveType((prev) => (prev === type ? null : type));

  const groupDesc = (type: ElementGroupKey) => {
    const items     = grouped[type];
    const totalArea = items.reduce((s, el) => s + el.area, 0).toFixed(1);
    return type === 'roof' && roofInfo.description
      ? `${totalArea} m² · ${roofInfo.description}`
      : `${totalArea} m²`;
  };

  /** Whether a row should be highlighted — either directly selected or matches the active face group. */
  const isRowHighlighted = (el: BuildingElement): boolean => {
    if (selectedId === el.id) return true;
    if (selectedGroup) return elementMatchesGroup(el, selectedGroup);
    return false;
  };

  // ── When one group is active: chips + expanded card ──────────────────────────

  if (activeType) {
    const items     = grouped[activeType];
    const chipTypes = types.filter((t) => t !== activeType);

    return (
      <div className="flex h-full flex-col gap-2">

        {/* Inactive groups as compact chips */}
        {chipTypes.length > 0 && (
          <div className="shrink-0 flex flex-wrap gap-1.5">
            {chipTypes.map((type) => {
              const hasSelected = grouped[type].some((el) => el.id === selectedId);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleGroup(type)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ELEMENT_DOTS[type] }} />
                  {ELEMENT_GROUP_LABELS[type]}
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">
                    {grouped[type].length}
                  </span>
                  {hasSelected && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Expanded group — fills remaining height */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => toggleGroup(activeType)}
            className="flex w-full shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-left transition-colors hover:bg-slate-100/80"
          >
            <span className="size-2 shrink-0" style={{ backgroundColor: ELEMENT_DOTS[activeType] }} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">
                {ELEMENT_GROUP_LABELS[activeType]}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {items.length} surface{items.length !== 1 ? 's' : ''} · {groupDesc(activeType)}
              </p>
            </div>
            <ChevronDown className="size-3.5 rotate-180 text-muted-foreground transition-transform duration-200" />
          </button>

          <ScrollHintContainer>
            <table className="w-full table-fixed border-collapse bg-white text-left">
              <thead className="sticky top-0 z-10 bg-white text-[10px] uppercase tracking-[0.05em] text-slate-400">
                <tr className="border-b border-slate-200/80">
                  <th className="px-3 py-1.5 font-semibold">Surface</th>
                  <th className="w-12 border-l border-slate-100 px-2 py-1.5 font-semibold">Dir</th>
                  <th className="w-16 border-l border-slate-100 px-2 py-1.5 font-semibold">Area</th>
                  <th className="w-16 border-l border-slate-100 px-2 py-1.5 font-semibold">U-value</th>
                  <th className="w-16 border-l border-slate-100 px-2 py-1.5 font-semibold">Azimuth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {items.map((el) => (
                  <tr
                    key={el.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isRowHighlighted(el) ? 'bg-primary/10' : 'hover:bg-slate-50',
                    )}
                    onClick={() => onSelect(el.id)}
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ELEMENT_DOTS[el.type] }} />
                        <span className="truncate">{el.label}</span>
                      </div>
                    </td>
                    <td className="border-l border-slate-100 px-2 py-2.5 font-semibold text-slate-600">{surfaceDirection(el)}</td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">{el.area.toFixed(1)}</td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">{el.uValue.toFixed(2)}</td>
                    <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">{Math.round(el.azimuth)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollHintContainer>
        </div>
      </div>
    );
  }

  // ── No group active: 2-column grid of group cards ────────────────────────────

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {types.map((type) => {
        const items       = grouped[type];
        const hasSelected = items.some((el) => el.id === selectedId);
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggleGroup(type)}
            className="flex flex-col items-start rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-slate-50"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ELEMENT_DOTS[type] }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">
                  {ELEMENT_GROUP_LABELS[type]}
                </p>
              </div>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {items.length}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{groupDesc(type)}</p>
            {hasSelected && (
              <p className="mt-0.5 text-[10px] font-medium text-primary">Active</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
