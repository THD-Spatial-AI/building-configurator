// Storeys of the 3D model. The model has no per-storey geometry, so storeys
// are equal bands from the ground to the eaves; the bottom band extends below
// the ground and the top one above the eaves, so the ground floor belongs to
// storey 1 and gables and roofs to the top storey.

import { polygonArea, type SurfacePolygon } from './surfaceMesh';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

type Point = number[];

/** Where storey 1 starts and how tall each storey is, in the geometry's own units. */
export interface StoreyBands {
  ground: number;
  height: number;
}

/** The ground is the lowest vertex; the eaves the lowest edge of the highest roof. */
export function storeyBands(polygons: SurfacePolygon[], storeys: number): StoreyBands {
  const zs = (polygon: SurfacePolygon) => polygon.coordinates[0].map((p) => p[2]);
  const ground = Math.min(...polygons.flatMap(zs));
  const roofs = polygons.filter((polygon) => polygon.type === 'roof');
  const eaves = roofs.length > 0
    ? Math.max(...roofs.map((roof) => Math.min(...zs(roof))))
    : Math.max(...polygons.flatMap(zs));
  return { ground, height: (eaves - ground) / Math.max(1, storeys) };
}

/** Area of an open ring, for polygonArea, which takes a closed one. */
const ringArea = (ring: Point[]) => polygonArea([[...ring, ring[0]]]);

/** The part of a ring on one side of a horizontal plane (Sutherland-Hodgman, one edge). */
function clipZ(ring: Point[], inside: (z: number) => boolean, plane: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (inside(a[2])) out.push(a);
    if (inside(a[2]) !== inside(b[2])) {
      const t = (plane - a[2]) / (b[2] - a[2]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), plane]);
    }
  }
  return out;
}

/** Share of a polygon's area inside the given storeys; a band is [lower, upper), the outer ones unbounded. */
function polygonShare(polygon: SurfacePolygon, bands: StoreyBands, storeys: number, modelled: readonly number[]): number {
  const ring = polygon.coordinates[0].slice(0, -1);
  const total = ringArea(ring);
  if (total === 0) return 0;
  let inside = 0;
  for (const storey of modelled) {
    const lower = storey === 1 ? -Infinity : bands.ground + (storey - 1) * bands.height;
    const upper = storey === storeys ? Infinity : bands.ground + storey * bands.height;
    let part = ring;
    if (lower > -Infinity) part = clipZ(part, (z) => z >= lower, lower);
    if (upper < Infinity) part = clipZ(part, (z) => z < upper, upper);
    inside += part.length >= 3 ? ringArea(part) : 0;
  }
  return Math.min(1, inside / total);
}

/**
 * Each element's share of its area inside the modelled storeys (1-based). A
 * window or door takes its parent's share; a surface with no polygon, such as
 * one added by hand, the share of storeys modelled.
 */
export function storeyShares(
  polygons: SurfacePolygon[],
  elements: Record<string, BuildingElement>,
  storeys: number,
  modelled: readonly number[],
): Record<string, number> {
  const bands = storeyBands(polygons, storeys);
  const byId = new Map(polygons.map((polygon) => [polygon.id, polygon]));
  const fallback = modelled.length / Math.max(1, storeys);
  const own = (id: string) => {
    const polygon = byId.get(id);
    return polygon ? polygonShare(polygon, bands, storeys, modelled) : fallback;
  };
  return Object.fromEntries(Object.values(elements).map((element) => [
    element.id,
    element.parentId && (element.type === 'window' || element.type === 'door') && !byId.has(element.id)
      ? own(element.parentId)
      : own(element.id),
  ]));
}
