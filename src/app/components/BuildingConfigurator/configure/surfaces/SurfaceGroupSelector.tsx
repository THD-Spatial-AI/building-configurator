// Right-column panel selector for the Configure view.
// Shows Building, Surfaces (expandable card groups), and Technologies
// as card-like clickable elements with visual depth.
// Each item gives a clear affordance that it is selectable.

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Building2, Sun, Plus, X, Trash2 } from 'lucide-react';
import type { PvConfig } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS } from '@/app/components/BuildingConfigurator/shared/ui';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { faceFromAzimuth, isUserDefinedElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { ELEMENT_GROUP_LABELS, type ElementGroupKey } from '@/app/components/BuildingConfigurator/shared/elementListUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Short compass label for an element's facing direction.
 *  Flat roofs (tilt ≤ 10°) show "Top"; pitched roofs show the slope's azimuth direction. */
function directionLabel(el: BuildingElement): string {
  if (el.type === 'floor') return 'Base';
  if (el.type === 'roof' && el.tilt <= 10) return 'Top';
  const MAP: Record<string, string> = {
    north_wall: 'N', northeast_wall: 'NE', east_wall: 'E', southeast_wall: 'SE',
    south_wall: 'S', southwest_wall: 'SW', west_wall: 'W', northwest_wall: 'NW',
  };
  return MAP[faceFromAzimuth(el.azimuth)] ?? '—';
}

const TYPE_ORDER: ElementGroupKey[] = ['wall', 'roof', 'floor', 'window', 'door'];

/** Surface types the user can create via the "+ New" menu. */
const CREATE_OPTIONS: Array<{ type: BuildingElement['type']; label: string; detail: string }> = [
  { type: 'wall',   label: 'Wall',   detail: 'Vertical opaque surface' },
  { type: 'window', label: 'Window', detail: 'Transparent facade opening' },
  { type: 'door',   label: 'Door',   detail: 'Opaque entrance opening' },
  { type: 'roof',   label: 'Roof',   detail: 'Top envelope surface' },
  { type: 'floor',  label: 'Floor',  detail: 'Ground-contact surface' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface SurfaceGroupSelectorProps {
  elements: Record<string, BuildingElement>;
  /** ID of the currently selected element; drives accordion expansion and row highlight. */
  selectedElementId: string | null;
  /** Called when the user clicks an element row, passing its ID. */
  onSelect: (elementId: string) => void;
  /** Called when the user confirms deletion of a user-defined surface. */
  onDeleteSurface: (elementId: string) => void;
  /** Called when the user picks a surface type from the "+ New" menu. */
  onCreateSurface: (type: BuildingElement['type']) => void;
  /** Whether the "Building" card is the active selection in the center panel. */
  buildingSelected: boolean;
  /** Called when the user clicks the "Building" card. */
  onSelectBuilding: () => void;
  /** Whether the roof-type gallery is the active panel in the center. */
  roofTypeSelected?: boolean;
  /** Called when the user clicks "Type" on the Roof group header. */
  onSelectRoofType?: () => void;
  /** Whether the configure center panel is showing the PV surface manager. */
  pvSelected?: boolean;
  /** Count of surfaces with PV installed. */
  pvSurfaceCount?: number;
  /** Total PV capacity across configured surfaces. */
  pvCapacityKw?: number;
  /** Called when the user selects the PV technology entry. */
  onSelectTechnologyPv?: () => void;
  /** Per-surface PV configurations — used to render the PV badge on surfaces. */
  surfacePvConfigs?: Record<string, PvConfig>;
}

/** Card-style panel selector listing Building and surface groups. */
export function SurfaceGroupSelector({
  elements,
  selectedElementId,
  onSelect,
  onDeleteSurface,
  onCreateSurface,
  buildingSelected,
  onSelectBuilding,
  roofTypeSelected,
  onSelectRoofType,
  pvSelected = false,
  pvSurfaceCount = 0,
  pvCapacityKw = 0,
  onSelectTechnologyPv,
  surfacePvConfigs = {},
}: SurfaceGroupSelectorProps) {

  const typeGroups = TYPE_ORDER
    .map((type) => ({
      type,
      items: Object.values(elements)
        .filter((el) => el.type === type)
        .sort((a, b) => a.azimuth - b.azimuth),
    }))
    .filter((g) => g.items.length > 0);

  const [activeType, setActiveType] = useState<ElementGroupKey | null>(
    () => typeGroups[0]?.type ?? null,
  );
  const [showCreate, setShowCreate] = useState(false);

  // Refs to each group's root div — used to scroll the opened group into view.
  const groupRefs = useRef<Partial<Record<ElementGroupKey, HTMLDivElement | null>>>({});

  // Auto-expand the group containing the selected element.
  useEffect(() => {
    if (selectedElementId) {
      const el = elements[selectedElementId];
      if (el) setActiveType(el.type as ElementGroupKey);
    }
  }, [selectedElementId, elements]);

  // After the expand CSS transition finishes, scroll the opened group into view
  // so that its content stays visible within the panel's scroll area.
  useEffect(() => {
    if (!activeType) return;
    const timer = setTimeout(() => {
      groupRefs.current[activeType]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 310); // just after the 300 ms CSS transition
    return () => clearTimeout(timer);
  }, [activeType]);

  const toggle = (type: ElementGroupKey) =>
    setActiveType((prev) => (prev === type ? null : type));

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2">

      {/* ── Building card ── */}
      <button
        type="button"
        onClick={onSelectBuilding}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer',
          buildingSelected
            ? 'border-primary/40 bg-primary/10 shadow-sm shadow-primary/10'
            : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow',
        )}
      >
        <Building2 className={cn('size-3.5 shrink-0', buildingSelected ? 'text-primary' : 'text-slate-400')} />
        <span className={cn(
          'flex-1 text-[11px] font-semibold',
          buildingSelected ? 'text-primary' : 'text-slate-700',
        )}>
          Building
        </span>
        <ChevronRight className={cn(
          'size-3 shrink-0 transition-transform',
          buildingSelected ? 'text-primary rotate-90' : 'text-slate-400',
        )} />
      </button>

      {/* ── SURFACES section header ── */}
      <div className="flex items-center justify-between px-1 pt-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Surfaces
        </p>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
            showCreate
              ? 'border-slate-300 bg-slate-100 text-slate-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          {showCreate ? <X className="size-2.5" /> : <Plus className="size-2.5" />}
          New
        </button>
      </div>

      {/* Create-surface dropdown */}
      {showCreate && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {CREATE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => { onCreateSurface(opt.type); setShowCreate(false); }}
              className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-slate-50 border-b border-slate-100 last:border-0"
            >
              <span className="text-[10px] font-semibold text-slate-700">{opt.label}</span>
              <span className="text-[9px] text-slate-400">{opt.detail}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Type group cards ── */}
      {typeGroups.map(({ type, items }) => {
        const isOpen      = activeType === type;
        const hasSelected = items.some((el) => el.id === selectedElementId);
        const dotColor    = ELEMENT_DOTS[type];

        return (
          <div
            key={type}
            ref={(el) => { groupRefs.current[type] = el; }}
            className={cn(
              'overflow-hidden rounded-lg border transition-all',
              isOpen ? 'border-slate-200 shadow-sm' : 'border-slate-200',
              hasSelected && !isOpen ? 'border-primary/25 bg-primary/5' : 'bg-white',
            )}
          >
            {/* Group header — clickable toggle */}
            <button
              type="button"
              onClick={() => toggle(type)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors',
                isOpen
                  ? 'border-b border-slate-100 bg-slate-50/80'
                  : hasSelected ? 'hover:bg-primary/8' : 'hover:bg-slate-50/60',
              )}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
              <span className="flex-1 text-[11px] font-semibold text-slate-700">
                {ELEMENT_GROUP_LABELS[type]}
              </span>

              {/* Roof-type gallery trigger */}
              {type === 'roof' && onSelectRoofType && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelectRoofType(); }}
                  className={cn(
                    'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold transition-colors',
                    roofTypeSelected
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
                  )}
                >
                  Type
                </button>
              )}

              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {items.length}
              </span>
              {hasSelected && !isOpen && (
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              )}
              <ChevronRight className={cn(
                'size-3 shrink-0 text-slate-400 transition-transform duration-300 ease-out',
                isOpen && 'rotate-90',
              )} />
            </button>

            {/* Individual surface rows — animated expand */}
            <div className={cn(
              'grid transition-all duration-300 ease-out',
              isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}>
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1 p-1.5">
                  {items.map((el) => {
                    const selected    = el.id === selectedElementId;
                    const dir         = directionLabel(el);
                    const userDefined = isUserDefinedElement(el);
                    return (
                      <div key={el.id} className="group flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onSelect(el.id)}
                          className={cn(
                            'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all',
                            selected
                              ? 'border-primary/30 bg-primary/10 shadow-sm'
                              : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm',
                          )}
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full opacity-60"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className={cn(
                            'min-w-0 flex-1 truncate text-[10px]',
                            selected ? 'font-semibold text-primary' : 'font-medium text-slate-700',
                          )}>
                            {el.label}
                          </span>
                          {userDefined && (
                            <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[8px] font-semibold text-blue-700">
                              User
                            </span>
                          )}
                          {/* PV badge — shown when this surface has a PV system installed */}
                          {surfacePvConfigs[el.id]?.installed && (
                            <span title="PV installed" className="flex shrink-0 items-center">
                              <Sun className="size-2.5 text-yellow-500" />
                            </span>
                          )}
                          <span className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold',
                            selected ? 'bg-primary/15 text-primary' : 'bg-slate-100 text-slate-500',
                          )}>
                            {dir}
                          </span>
                        </button>

                        {/* Delete — visible on row hover, user-defined surfaces only */}
                        {userDefined && (
                          <button
                            type="button"
                            title="Delete surface"
                            onClick={() => onDeleteSurface(el.id)}
                            className="invisible flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:visible"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Technologies section ── */}
      {onSelectTechnologyPv && (
        <>
          <div className="px-1 pt-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Technologies
            </p>
          </div>

          <button
            type="button"
            onClick={onSelectTechnologyPv}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer',
              pvSelected
                ? 'border-primary/40 bg-primary/10 shadow-sm shadow-primary/10'
                : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow',
            )}
          >
            <Sun className={cn('size-3.5 shrink-0', pvSelected ? 'text-primary' : 'text-yellow-500')} />

            <div className="min-w-0 flex-1">
              <p className={cn('text-[11px] font-semibold', pvSelected ? 'text-primary' : 'text-slate-700')}>
                Solar PV
              </p>
              <p className="text-[9px] text-slate-400">
                {pvSurfaceCount > 0
                  ? `${pvSurfaceCount} ${pvSurfaceCount === 1 ? 'surface' : 'surfaces'} · ${pvCapacityKw.toFixed(1)} kWp`
                  : 'No surfaces configured'}
              </p>
            </div>

            {pvSurfaceCount > 0 && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                {pvSurfaceCount}
              </span>
            )}

            <ChevronRight className={cn(
              'size-3 shrink-0 transition-transform',
              pvSelected ? 'text-primary rotate-90' : 'text-slate-400',
            )} />
          </button>
        </>
      )}

    </div>
  );
}
