// Figures for the PV panel and cards, from the host's PV surfaces and the
// building's own elements.

import type { PvSurface } from '@/app/components/workspace/PvMode';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { pvLayout, type PvLayout, type PvLayoutOptions, type PvModule } from './pvLayout';
import type { SurfacePolygon } from './surfaceMesh';

export interface PvGeometry {
  /** Degrees from horizontal. */
  tilt: number;
  /** Degrees clockwise from north; 180 is south. */
  azimuth: number;
  /** m² */
  area: number;
}

/**
 * A PV surface's tilt, facing and area: the building's own element where it
 * is one, as the user has edited it, else the host's values, else null.
 */
export function pvGeometry(
  id: string,
  elements: Record<string, BuildingElement>,
  surface: PvSurface | undefined,
): PvGeometry | null {
  const element = elements[id];
  if (element) return { tilt: element.tilt, azimuth: element.azimuth, area: element.area };
  if (surface?.tilt === undefined || surface.azimuth === undefined || surface.area === undefined) return null;
  return { tilt: surface.tilt, azimuth: surface.azimuth, area: surface.area };
}

/** The module layout of each surface in `surfaces` that has a polygon among `polygons`. */
export function pvLayouts(
  polygons: readonly SurfacePolygon[],
  surfaces: Readonly<Record<string, PvLayoutOptions>>,
  module: PvModule,
): Record<string, PvLayout> {
  const layouts: Record<string, PvLayout> = {};
  for (const polygon of polygons) {
    const options = surfaces[polygon.id];
    if (options) layouts[polygon.id] = pvLayout(polygon, module, options);
  }
  return layouts;
}

/**
 * Installed capacity (kWp), panel area (m²) and how many of the offered
 * surfaces carry PV. A surface's module layout counts where it has one, else
 * the host's maxKwp and the usable share of its area.
 */
export function pvSummary(
  surfaces: Record<string, PvSurface>,
  elements: Record<string, BuildingElement>,
  layouts: Readonly<Record<string, PvLayout>> = {},
): { kwp: number; panelArea: number; installed: number; total: number } {
  let kwp = 0;
  let panelArea = 0;
  let installed = 0;
  for (const [id, surface] of Object.entries(surfaces)) {
    if (surface.state !== 'installed') continue;
    installed += 1;
    const layout = layouts[id];
    kwp += layout?.kwp ?? surface.maxKwp;
    panelArea += layout?.area ?? (elements[id]?.area ?? surface.area ?? 0) * surface.usableShare;
  }
  return { kwp, panelArea, installed, total: Object.keys(surfaces).length };
}
