// PV on a building, driven entirely by the host: which surfaces carry PV, which
// are suggested, which product each uses and how much of each is usable come in
// as props, and every change goes back out through a callback. Nothing is
// stored here. Shown on the Technologies tab: the overview on the right
// (PvOverview), a clicked surface's PV section on the left (PvSurfaceSection).

import type { CSSProperties } from 'react';
import { MousePointerClick } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import { useFormatNumber, useT } from '../../i18n';
import { pvGeometry } from '../../lib/pvSurfaces';
import { SURFACE_COLOR } from '../../lib/surfaceMesh';
import type { PvModule, PvMounting, PvOrientation } from '../../lib/pvLayout';
import type { TechnologyProduct } from '../../lib/pvProducts';

/** One surface the host offers for PV. */
export interface PvSurface {
  /** installed carries PV; suggested is highlighted as worth adding; available is offered without a highlight. */
  state: 'installed' | 'suggested' | 'available';
  /** Share of the surface usable for panels, 0 to 1. */
  usableShare: number;
  /**
   * Capacity at the current usable share, in kWp. Shown only for a surface
   * the view has no polygon for; otherwise its module layout gives it.
   */
  maxKwp: number;
  /** Absent: racked at 15° south on a surface under 10°, otherwise flush. */
  mounting?: PvMounting;
  /** Absent: whichever fits more modules. */
  orientation?: PvOrientation;
  /** The product on this surface. Absent: the building's `PvMode.productId`. */
  productId?: string;
  /** Name for a surface that is not among the building's elements, such as a roof of a neighbouring 3D building. */
  label?: string;
  /**
   * The surface's geometry, shown in the list and its panel. Used only for a
   * surface that is not among the building's elements; an element's own,
   * possibly edited, geometry takes precedence.
   */
  tilt?: number;      // degrees from horizontal
  azimuth?: number;   // degrees clockwise from north, 180 = south
  area?: number;      // m²
}

/**
 * The building's PV, shown on the Technologies tab. Hold the object and its
 * callbacks stable, as for `services`: the view updates when the host passes
 * a new object after a callback.
 */
export interface PvMode {
  /** Keyed by surface id, the id the geometry and the envelope elements carry. Only these surfaces take PV. */
  surfaces: Record<string, PvSurface>;
  /** Shown under the PV overview, in the host's language. */
  notice: string;
  /** Name of the building's PV type. */
  typeLabel: string;
  onToggle: (surfaceId: string, installed: boolean) => void;
  onShareChange: (surfaceId: string, usableShare: number) => void;
  /** Store both and pass them back on the surface; orientation undefined means best fit. */
  onMountingChange: (surfaceId: string, mounting: PvMounting, orientation: PvOrientation | undefined) => void;
  /** The module of a product without module_width_m, module_height_m and module_power_kwp. Absent: DEFAULT_PV_MODULE. */
  module?: PvModule;
  /** PV products the user may choose from. Absent: no catalogue, and every surface uses `module`. */
  catalogue?: TechnologyProduct[];
  /** This building's copies of the products it uses, by product id, with the values edited for it. */
  products?: Record<string, TechnologyProduct>;
  /** The building's product, used by surfaces without their own. */
  productId?: string;
  /** A product was dropped on a surface or chosen for it. Store it on the surface with its new layout. */
  onAssignProduct?: (surfaceId: string, productId: string) => void;
  /** A constraint of this building's copy of a product was changed. Shared products are never written from here. */
  onConstraintChange?: (productId: string, key: string, value: number | string) => void;
  /** Saves this building's copy of a product as a new product of the user's own; resolves to the new product's id. */
  onSaveAsTechnology?: (productId: string, name: string) => Promise<string>;
}

/** The surface ids to draw with modules and to highlight as suggested. */
export function pvRenderSets(surfaces: Record<string, PvSurface>): { installed: Set<string>; suggested: Set<string> } {
  const installed = new Set<string>();
  const suggested = new Set<string>();
  for (const [id, surface] of Object.entries(surfaces)) {
    if (surface.state === 'installed') installed.add(id);
    else if (surface.state === 'suggested') suggested.add(id);
  }
  return { installed, suggested };
}

/** The product a surface uses: the building's copy where it has one, else the catalogue's. */
export function surfaceProduct(pv: PvMode, surfaceId: string): TechnologyProduct | undefined {
  const id = pv.surfaces[surfaceId]?.productId ?? pv.productId;
  if (!id) return undefined;
  return pv.products?.[id] ?? pv.catalogue?.find((product) => product.id === id);
}

/** The element's own label, else the host's label, else the id. */
export function surfaceName(id: string, elements: Record<string, BuildingElement>, surfaces: Record<string, PvSurface>): string {
  return elements[id]?.label ?? surfaces[id]?.label ?? id;
}

/** The compass point of an azimuth, as a message key under surface.compass. */
export function compassPoint(azimuth: number): string {
  const points = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  return points[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}

/** An on/off switch with its state for assistive technology. */
export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span className={cn('absolute top-[3px] size-[18px] rounded-full bg-card shadow-sm transition-all', on ? 'right-[3px]' : 'left-[3px]')} />
    </button>
  );
}

/** The click hint, shown over the 3D view on the Technologies tab. */
export function PvHintPill() {
  const t = useT();
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-foreground px-3.5 py-2 text-[12px] font-medium text-background shadow-md">
      <MousePointerClick className="size-4" aria-hidden />
      {t('pv.hint')}
    </div>
  );
}

/** What the three surface drawings in the 3D view mean. Colours match SurfaceGeometryViewer. */
/** A colour of the model as CSS. */
const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** One swatch and its name in the model's legend. */
function LegendSwatch({ className, style, label }: { className?: string; style?: CSSProperties; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2.5 w-3.5 rounded-sm', className)} style={style} />{label}
    </span>
  );
}

/** What the model's colours mean: the surface types, and on the Technologies tab the PV states. */
export function ModelLegend({ pv }: { pv: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-card/90 px-3 py-2 text-[11px] text-foreground shadow-sm">
      <LegendSwatch style={{ background: css(SURFACE_COLOR.RoofSurface) }} label={t('legend.roof')} />
      <LegendSwatch style={{ background: css(SURFACE_COLOR.WallSurface) }} label={t('legend.wall')} />
      <LegendSwatch style={{ background: css(SURFACE_COLOR.GroundSurface) }} label={t('legend.ground')} />
      {pv && (
        <>
          <LegendSwatch className="bg-[#1F3A5F] outline outline-1 outline-[#9FB3CC]" label={t('pv.legend.installed')} />
          <LegendSwatch className="border-2 border-[#92400E] bg-[#FDE047]" label={t('pv.legend.suggested')} />
        </>
      )}
    </div>
  );
}

/** "32° · facing 205° · 52 m²", "flat · 51 m²", or nothing without geometry. */
export function GeometryLine({ id, elements, surface }: { id: string; elements: Record<string, BuildingElement>; surface: PvSurface }) {
  const t = useT();
  const format = useFormatNumber();
  const geometry = pvGeometry(id, elements, surface);
  if (!geometry) return null;
  if (geometry.flat) return <span>{t('pv.geometryFlat', { area: format(geometry.area, 0) })}</span>;
  return (
    <span>
      {t('pv.geometry', { tilt: format(geometry.tilt, 0), azimuth: format(geometry.azimuth, 0), area: format(geometry.area, 0) })}
    </span>
  );
}

/** The card beside the pointer over a surface that takes PV: what it is, and that a click opens it. */
export function PvHoverCard({ surfaceId, surface, elements, at }: {
  surfaceId: string;
  surface: PvSurface;
  elements: Record<string, BuildingElement>;
  at: { x: number; y: number };
}) {
  const t = useT();
  return (
    <div
      className="pointer-events-none fixed z-30 flex flex-col gap-0.5 rounded-md border border-border bg-card px-2.5 py-2 text-[12px] shadow-md"
      style={{ left: at.x + 14, top: at.y + 14 }}
    >
      <span className="font-semibold text-foreground">{surfaceName(surfaceId, elements, { [surfaceId]: surface })}</span>
      <span className="text-muted-foreground">
        <GeometryLine id={surfaceId} elements={elements} surface={surface} />
        {pvGeometry(surfaceId, elements, surface) ? ' · ' : ''}{t(`pv.state.${surface.state}`)}
      </span>
      <span className="font-medium text-primary">{t('pv.hover.open')}</span>
    </div>
  );
}
