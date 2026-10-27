// The clicked surface's panel: a fixed column left of the model on a wide
// screen, so it never covers the building while it turns; a sheet over the
// bottom of the screen on a narrow one. It holds every section of one
// surface, whichever tab the building panel shows.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { useFormatNumber, useT } from '../../i18n';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';

interface SurfacePanelProps {
  /** A sheet over the bottom of the screen instead of a column. */
  docked: boolean;
  /** Nothing selected: the column shows `emptyText`, the sheet nothing. */
  open: boolean;
  /** Names the panel for assistive technology, and heads the sheet on a narrow screen. */
  title?: string;
  emptyText: string;
  /** Picks a surface without the model; shown above the content in the column. */
  picker?: React.ReactNode;
  onClose: () => void;
  children?: React.ReactNode;
}

export function SurfacePanel({ docked, open, title, emptyText, picker, onClose, children }: SurfacePanelProps) {
  if (docked && !open) return null;
  return (
    <aside
      data-tour="surface"
      aria-label={title}
      className={cn(
        'flex flex-col border-border bg-card',
        docked
          ? 'fixed inset-x-0 bottom-0 z-30 max-h-[58vh] overflow-hidden rounded-t-2xl border-t shadow-[0_18px_50px_rgba(15,23,42,0.28)]'
          : 'w-[300px] shrink-0 rounded-lg border',
      )}
    >
      {picker && !docked && (
        // The picker names the open surface, so the column needs no title of its own.
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border p-2">
          <div className="min-w-0 flex-1">{picker}</div>
          {open && <CloseButton onClose={onClose} />}
        </div>
      )}
      {open ? (
        <>
          {docked && (
            // A form stretched across a tablet's full width reads worse than a column.
            <div className="mx-auto flex w-full max-w-[560px] shrink-0 items-start gap-2 px-3 pb-2.5 pt-4">
              <span className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-muted-foreground/40" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{title}</p>
              <CloseButton onClose={onClose} />
            </div>
          )}
          <div className={cn('min-h-0 w-full flex-1 overflow-y-auto [scrollbar-gutter:stable]', docked && 'mx-auto max-w-[560px]')}>
            {children}
          </div>
        </>
      ) : (
        <p className="m-auto max-w-[220px] px-4 text-center text-[12px] leading-snug text-muted-foreground">{emptyText}</p>
      )}
    </aside>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={t('surface.close')}
      title={t('surface.close')}
      className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted [&_svg]:size-4"
    >
      <X />
    </button>
  );
}

/** The surface under the pointer in the model: its name, type and area, and that a click opens it. */
export function SurfaceHoverCard({ element, at }: { element: BuildingElement; at: { x: number; y: number } }) {
  const t = useT();
  const format = useFormatNumber();
  return (
    <div
      className="pointer-events-none fixed z-30 flex flex-col gap-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-[12px] shadow-md"
      style={{ left: at.x + 14, top: at.y + 14 }}
    >
      <span className="font-semibold text-foreground">{element.label}</span>
      <span className="text-muted-foreground">{t(`surface.type.${element.type}`)} · {format(element.area, 1)} m²</span>
      <span className="font-medium text-primary">{t('surface.hover.open')}</span>
    </div>
  );
}

/** One surface in the picker: its name, its type beneath, and the element type it is grouped under. */
export interface PickerSurface {
  id: string;
  label: string;
  type?: string;
  /** The envelope element type (roof, wall, floor, window, door); others are grouped as "other". */
  group?: string;
}

/** The element types in the order the picker lists them; any other type goes under "other", last. */
const GROUP_ORDER = ['roof', 'wall', 'floor', 'window', 'door'];

/** The surfaces under their element type, in GROUP_ORDER, each group by name; empty groups are left out. */
export function groupSurfaces(surfaces: readonly PickerSurface[]): { group: string; surfaces: PickerSurface[] }[] {
  const groupOf = (surface: PickerSurface) => (surface.group && GROUP_ORDER.includes(surface.group) ? surface.group : 'other');
  return [...GROUP_ORDER, 'other']
    .map((group) => ({
      group,
      surfaces: surfaces
        .filter((surface) => groupOf(surface) === group)
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })),
    }))
    .filter(({ surfaces: members }) => members.length > 0);
}

/**
 * The surfaces as a list to pick from, in the panel's style. Hovering one
 * calls onPreview with it, so the model can show where it is.
 */
export function SurfacePicker({ surfaces, value, placeholder, onSelect, onPreview }: {
  surfaces: PickerSurface[];
  value: string | null;
  placeholder: string;
  onSelect: (id: string) => void;
  onPreview: (id: string | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => { setOpen(false); onPreview(null); };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const current = surfaces.find((surface) => surface.id === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1 text-left shadow-xs transition-colors hover:bg-muted"
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[12px] font-semibold', current ? 'text-foreground' : 'text-muted-foreground')}>
            {current?.label ?? placeholder}
          </span>
          {current?.type && <span className="block truncate text-[10px] leading-tight text-muted-foreground">{current.type}</span>}
        </span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={placeholder}
          onMouseLeave={() => onPreview(null)}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-card pb-1 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
        >
          {groupSurfaces(surfaces).map(({ group, surfaces: members }) => (
            <div key={group} role="group" aria-label={t(`surface.group.${group}`)}>
              <div className="sticky top-0 z-10 border-b border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`surface.group.${group}`)} ({members.length})
              </div>
              {members.map((surface) => (
                <button
                  key={surface.id}
                  type="button"
                  role="option"
                  aria-selected={surface.id === value}
                  onMouseEnter={() => onPreview(surface.id)}
                  onFocus={() => onPreview(surface.id)}
                  onClick={() => { onSelect(surface.id); close(); }}
                  className={cn(
                    'flex w-full cursor-pointer px-2.5 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                    surface.id === value && 'bg-primary/10',
                  )}
                >
                  <span className="truncate text-[12px] font-medium text-foreground">{surface.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
