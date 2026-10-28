// Figures for the PV overview and surface panel, from the host's PV surfaces
// and the building's own elements.

import type { PvSurface } from '@/app/components/workspace/PvMode';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { FLAT_MAX_TILT_DEG, pvLayout, type PvLayout, type PvLayoutOptions, type PvModule } from './pvLayout';
import { pvCosts, type TechnologyProduct } from './pvProducts';
import type { SurfacePolygon } from './surfaceMesh';

export interface PvGeometry {
  /** Degrees from horizontal. */
  tilt: number;
  /** Degrees clockwise from north; 180 is south. */
  azimuth: number;
  /** m² */
  area: number;
  /** Under 10°, or marked horizontal (azimuth -1): shown as flat, with no facing. */
  flat: boolean;
}

/** Whether a surface is shown as flat, with no facing. */
export const isFlat = (tilt: number, azimuth: number) => azimuth === -1 || tilt < FLAT_MAX_TILT_DEG;

/**
 * A surface's tilt, facing and area as the 3D model has them: the values it
 * was imported with. An expert's edits change what BuEM receives, not the
 * geometry PV is placed on.
 */
export function modelGeometry(element: BuildingElement): { tilt: number; azimuth: number; area: number } {
  return {
    tilt: element.defaultTilt ?? element.tilt,
    azimuth: element.defaultAzimuth ?? element.azimuth,
    area: element.defaultArea ?? element.area,
  };
}

/**
 * A PV surface's tilt, facing and area: the building's own element as the 3D
 * model has it where it is one, else the host's values, else null.
 */
export function pvGeometry(
  id: string,
  elements: Record<string, BuildingElement>,
  surface: PvSurface | undefined,
): PvGeometry | null {
  const element = elements[id];
  if (element) {
    const { tilt, azimuth, area } = modelGeometry(element);
    return { tilt, azimuth, area, flat: isFlat(tilt, azimuth) };
  }
  if (surface?.tilt === undefined || surface.azimuth === undefined || surface.area === undefined) return null;
  return { tilt: surface.tilt, azimuth: surface.azimuth, area: surface.area, flat: isFlat(surface.tilt, surface.azimuth) };
}

/** One product the building uses: on how many surfaces, with how many modules (unknown without every layout) and kWp. */
export interface InstalledProduct {
  product?: TechnologyProduct;
  surfaces: number;
  modules?: number;
  kwp: number;
}

/**
 * The surfaces with PV that hold at least one whole module. One whose layout
 * fits none has PV switched on but none on it, so it counts nowhere.
 */
export function fittedPvIds(surfaces: Record<string, PvSurface>, layouts: Readonly<Record<string, PvLayout>>): string[] {
  return Object.entries(surfaces)
    .filter(([id, surface]) => surface.state === 'installed' && layouts[id]?.count !== 0)
    .map(([id]) => id);
}

/** The surfaces with PV switched on that fit no whole module. */
export function unfittedPvIds(surfaces: Record<string, PvSurface>, layouts: Readonly<Record<string, PvLayout>>): string[] {
  return Object.entries(surfaces)
    .filter(([id, surface]) => surface.state === 'installed' && layouts[id]?.count === 0)
    .map(([id]) => id);
}

/** The installed surfaces grouped by product, in the order the products first appear. */
/** The surfaces with PV installed: of one product (its id, '' for none) or, without one, of every product. */
export function installedPvIds(
  surfaces: Record<string, PvSurface>,
  productFor: (surfaceId: string) => TechnologyProduct | undefined,
  productId?: string,
): string[] {
  return Object.entries(surfaces)
    .filter(([id, surface]) => surface.state === 'installed' && (productId === undefined || (productFor(id)?.id ?? '') === productId))
    .map(([id]) => id);
}

export function installedByProduct(
  surfaces: Record<string, PvSurface>,
  layouts: Readonly<Record<string, PvLayout>>,
  productFor: (surfaceId: string) => TechnologyProduct | undefined,
): InstalledProduct[] {
  const rows = new Map<string, InstalledProduct>();
  for (const id of fittedPvIds(surfaces, layouts)) {
    const surface = surfaces[id];
    const product = productFor(id);
    const key = product?.id ?? '';
    const row = rows.get(key) ?? { product, surfaces: 0, modules: 0, kwp: 0 };
    const layout = layouts[id];
    row.surfaces += 1;
    row.kwp += layout?.kwp ?? surface.maxKwp;
    row.modules = layout && row.modules !== undefined ? row.modules + layout.count : undefined;
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** The module layout of each surface in `surfaces` that has a polygon among `polygons`, with one module for all or one per surface. */
export function pvLayouts(
  polygons: readonly SurfacePolygon[],
  surfaces: Readonly<Record<string, PvLayoutOptions>>,
  module: PvModule | ((surfaceId: string) => PvModule),
): Record<string, PvLayout> {
  const layouts: Record<string, PvLayout> = {};
  for (const polygon of polygons) {
    const options = surfaces[polygon.id];
    if (options) layouts[polygon.id] = pvLayout(polygon, typeof module === 'function' ? module(polygon.id) : module, options);
  }
  return layouts;
}

/**
 * The surfaces that can take PV: those on which at least one of `modules`
 * fits a whole module with the surface's own settings. A surface without a
 * polygon is kept, since its fit is not known.
 */
export function pvAvailableIds(
  polygons: readonly SurfacePolygon[],
  surfaces: Readonly<Record<string, PvLayoutOptions>>,
  modules: readonly PvModule[],
): Set<string> {
  const byId = new Map(polygons.map((polygon) => [polygon.id, polygon]));
  return new Set(Object.keys(surfaces).filter((id) => {
    const polygon = byId.get(id);
    return !polygon || modules.some((module) => pvLayout(polygon, module, surfaces[id]).count > 0);
  }));
}

/** Adds b to a, where a stays undefined until some value is added. */
const add = (a: number | undefined, b: number | undefined) => (b === undefined ? a : (a ?? 0) + b);

/**
 * Installed capacity (kWp), panel area (m²), investment and yearly O&M, and
 * how many of the offered surfaces carry PV. A surface's module layout counts
 * where it has one, else the host's maxKwp and the usable share of its area.
 * Costs come from each surface's product; undefined where none carries them.
 */
export function pvSummary(
  surfaces: Record<string, PvSurface>,
  elements: Record<string, BuildingElement>,
  layouts: Readonly<Record<string, PvLayout>> = {},
  productFor: (surfaceId: string) => TechnologyProduct | undefined = () => undefined,
): { kwp: number; panelArea: number; installed: number; total: number; investment?: number; omPerYear?: number } {
  let kwp = 0;
  let panelArea = 0;
  let installed = 0;
  let investment: number | undefined;
  let omPerYear: number | undefined;
  for (const id of fittedPvIds(surfaces, layouts)) {
    const surface = surfaces[id];
    installed += 1;
    const layout = layouts[id];
    const surfaceKwp = layout?.kwp ?? surface.maxKwp;
    kwp += surfaceKwp;
    panelArea += layout?.area ?? (elements[id]?.area ?? surface.area ?? 0) * surface.usableShare;
    const costs = pvCosts(productFor(id), surfaceKwp);
    investment = add(investment, costs.investment);
    omPerYear = add(omPerYear, costs.omPerYear);
  }
  return { kwp, panelArea, installed, total: Object.keys(surfaces).length, investment, omPerYear };
}
