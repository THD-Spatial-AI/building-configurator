// Center-panel surface grid for a single element group type.
// Shown when the user selects a group card in the right-column overview panel.
// Surfaces are displayed as cards in a 3-column grid.
// For the Roof group, the roof-type gallery expands inline — no separate navigation.

import { useState } from 'react';
import { Sun, Trash2, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS, ScrollHintContainer } from '@/app/components/BuildingConfigurator/shared/ui';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { faceFromAzimuth, isUserDefinedElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import {
  ELEMENT_GROUP_LABELS,
  type ElementGroupKey,
} from '@/app/components/BuildingConfigurator/shared/elementListUtils';
import type { PvConfig } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';
import {
  RoofTypeCards,
  detectRoofType,
} from '@/app/components/BuildingConfigurator/configure/roof/RoofTypeGallery';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Short compass label for a surface's facing direction. */
function directionLabel(el: BuildingElement): string {
  if (el.type === 'floor') return 'Base';
  if (el.type === 'roof' && el.tilt <= 10) return 'Top';
  const MAP: Record<string, string> = {
    north_wall: 'N',  northeast_wall: 'NE',
    east_wall:  'E',  southeast_wall: 'SE',
    south_wall: 'S',  southwest_wall: 'SW',
    west_wall:  'W',  northwest_wall: 'NW',
  };
  return MAP[faceFromAzimuth(el.azimuth)] ?? '—';
}

const TYPE_ORDER: ElementGroupKey[] = ['wall', 'roof', 'floor', 'window', 'door'];

// ─── Component ────────────────────────────────────────────────────────────────

interface SurfaceGroupGridProps {
  groupType: ElementGroupKey;
  elements: Record<string, BuildingElement>;
  selectedElementId: string | null;
  onSelect: (id: string) => void;
  onDeleteSurface: (id: string) => void;
  /** Required for the Roof group — regenerates roof elements on type change. */
  onApplyRoofType?: (newRoofElements: Record<string, BuildingElement>) => void;
  /** Adds a new surface of this group's type. */
  onCreateSurface: (type: BuildingElement['type']) => void;
  /** Per-surface PV configurations — used to show a PV badge on cards. */
  surfacePvConfigs?: Record<string, PvConfig>;
}

/** Grid of surface cards for a single element group, shown in the center panel.
 *  For the Roof group, includes an inline expandable roof-type picker. */
export function SurfaceGroupGrid({
  groupType,
  elements,
  selectedElementId,
  onSelect,
  onDeleteSurface,
  onApplyRoofType,
  onCreateSurface,
  surfacePvConfigs = {},
}: SurfaceGroupGridProps) {
  const [roofGalleryOpen, setRoofGalleryOpen] = useState(false);

  const items = TYPE_ORDER
    .flatMap((t) => (t === groupType ? Object.values(elements).filter((el) => el.type === t) : []))
    .sort((a, b) => a.azimuth - b.azimuth);

  const totalArea = items.reduce((s, el) => s + el.area, 0);
  const avgUValue = totalArea > 0
    ? items.reduce((s, el) => s + el.uValue * el.area, 0) / totalArea
    : 0;

  const dotColor = ELEMENT_DOTS[groupType];

  // Detect current roof type label for display
  const roofElements   = groupType === 'roof' ? items : [];
  const currentRoofType = groupType === 'roof' ? detectRoofType(roofElements) : null;
  const roofTypeLabel  = currentRoofType
    ? currentRoofType.charAt(0).toUpperCase() + currentRoofType.slice(1)
    : null;

  return (
    <ScrollHintContainer className="flex-1 overflow-y-auto bg-slate-50">
      <div className="p-5 flex flex-col gap-5">

        {/* ── Section header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
            <h2 className="text-sm font-semibold text-slate-700">
              {ELEMENT_GROUP_LABELS[groupType]}
            </h2>
            {roofTypeLabel && (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {roofTypeLabel}
              </span>
            )}
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {items.length}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>{totalArea.toFixed(1)} m² total</span>
            <span>avg U {avgUValue.toFixed(2)} W/m²K</span>
          </div>
        </div>

        {/* ── Roof type section — expandable, Roof group only ── */}
        {groupType === 'roof' && onApplyRoofType && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setRoofGalleryOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <div>
                <p className="text-sm font-semibold text-slate-700">Roof Type</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {roofTypeLabel
                    ? `Current: ${roofTypeLabel} · click to change`
                    : 'Flat, mono-pitch, gabled, hipped and more'}
                </p>
              </div>
              <ChevronDown className={cn(
                'size-4 shrink-0 text-slate-400 transition-transform duration-200',
                roofGalleryOpen && 'rotate-180',
              )} />
            </button>

            <div className={cn(
              'overflow-hidden transition-[max-height] duration-300 ease-in-out',
              roofGalleryOpen ? 'max-h-[400px]' : 'max-h-0',
            )}>
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <RoofTypeCards elements={elements} onApplyRoofType={onApplyRoofType} />
              </div>
            </div>
          </div>
        )}

        {/* ── Surface cards + add card ── */}
        <div className="grid grid-cols-3 gap-3">
          {items.map((el) => {
            const selected    = el.id === selectedElementId;
            const dir         = directionLabel(el);
            const userDefined = isUserDefinedElement(el);
            const hasPv       = surfacePvConfigs[el.id]?.installed ?? false;

            return (
              <div key={el.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(el.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-all cursor-pointer',
                    selected
                      ? 'border-primary/40 bg-primary/8 shadow-sm shadow-primary/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
                  )}
                >
                  {/* Label + direction badge */}
                  <div className="mb-2.5 flex items-start justify-between gap-1.5">
                    <span className={cn(
                      'min-w-0 flex-1 truncate text-[11px] font-semibold leading-tight',
                      selected ? 'text-primary' : 'text-slate-700',
                    )}>
                      {el.label}
                    </span>
                    <span className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold',
                      selected ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-500',
                    )}>
                      {dir}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-end justify-between">
                    <div className="flex gap-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.06em] text-slate-400">Area</p>
                        <p className={cn('text-[11px] font-medium', selected ? 'text-primary/80' : 'text-slate-600')}>
                          {el.area.toFixed(1)} m²
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.06em] text-slate-400">U-value</p>
                        <p className={cn('text-[11px] font-medium', selected ? 'text-primary/80' : 'text-slate-600')}>
                          {el.uValue.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {userDefined && (
                        <span className="rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[8px] font-semibold text-blue-700">
                          User
                        </span>
                      )}
                      {hasPv && <Sun className="size-3 text-yellow-500" title="PV installed" />}
                    </div>
                  </div>
                </button>

                {/* Delete — hover on all surfaces */}
                <button
                  type="button"
                  title="Delete surface"
                  onClick={() => onDeleteSurface(el.id)}
                  className="invisible absolute right-1.5 top-1.5 flex size-5 cursor-pointer items-center justify-center rounded bg-white/80 text-slate-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-500 group-hover:visible [&_svg]:size-3"
                >
                  <Trash2 />
                </button>
              </div>
            );
          })}

          {/* Add new surface of this type — stretches to match adjacent card height */}
          <div className="h-full min-h-[88px]">
            <button
              type="button"
              onClick={() => onCreateSurface(groupType)}
              className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-200 bg-transparent text-slate-400 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary cursor-pointer"
            >
              <Plus className="size-5" />
              <span className="text-[10px] font-semibold">Add surface</span>
            </button>
          </div>
        </div>

      </div>
    </ScrollHintContainer>
  );
}
