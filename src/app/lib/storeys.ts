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

/** City2TABULA geometry names surfaces as CityGML does (WallSurface, RoofSurface); other sources as BuEM (wall, roof). */
const isKind = (polygon: SurfacePolygon, kind: 'wall' | 'roof') => polygon.type.toLowerCase().startsWith(kind);

/** The ground is the lowest vertex; the eaves the lowest edge of the highest roof. */
export function storeyBands(polygons: SurfacePolygon[], storeys: number): StoreyBands {
  const zs = (polygon: SurfacePolygon) => polygon.coordinates[0].map((p) => p[2]);
  const ground = Math.min(...polygons.flatMap(zs));
  const roofs = polygons.filter((polygon) => isKind(polygon, 'roof'));
  const eaves = roofs.length > 0
    ? Math.max(...roofs.map((roof) => Math.min(...zs(roof))))
    : Math.max(...polygons.flatMap(zs));
  return { ground, height: (eaves - ground) / Math.max(1, storeys) };
}

/** Where a ring's edges cross the plane z = level, in order along the ring's horizontal direction. */
function crossings(ring: Point[], level: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if ((a[2] < level) === (b[2] < level)) continue;
    const t = (level - a[2]) / (b[2] - a[2]);
    points.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), level]);
  }
  if (points.length < 2) return points;
  const [dx, dy] = [points[1][0] - points[0][0], points[1][1] - points[0][1]];
  return points.sort((p, q) => (p[0] - q[0]) * dx + (p[1] - q[1]) * dy);
}

/** A line across every wall at each floor level between storeys, as [start, end] in the geometry's coordinates. */
export function storeyLines(polygons: SurfacePolygon[], storeys: number): [Point, Point][] {
  if (storeys < 2) return [];
  const bands = storeyBands(polygons, storeys);
  const lines: [Point, Point][] = [];
  for (const wall of polygons.filter((polygon) => isKind(polygon, 'wall'))) {
    const ring = wall.coordinates[0].slice(0, -1);
    for (let storey = 1; storey < storeys; storey += 1) {
      const points = crossings(ring, bands.ground + storey * bands.height);
      for (let i = 0; i + 1 < points.length; i += 2) lines.push([points[i], points[i + 1]]);
    }
  }
  return lines;
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

/** The part of an open ring inside one storey's band, [lower, upper), the outer bands unbounded. */
function clipToStorey(ring: Point[], bands: StoreyBands, storeys: number, storey: number): Point[] {
  const lower = storey === 1 ? -Infinity : bands.ground + (storey - 1) * bands.height;
  const upper = storey === storeys ? Infinity : bands.ground + storey * bands.height;
  let part = ring;
  if (lower > -Infinity) part = clipZ(part, (z) => z >= lower, lower);
  if (upper < Infinity) part = clipZ(part, (z) => z < upper, upper);
  return part.length >= 3 ? part : [];
}

/** Share of a polygon's area inside the given storeys. */
function polygonShare(polygon: SurfacePolygon, bands: StoreyBands, storeys: number, modelled: readonly number[]): number {
  const ring = polygon.coordinates[0].slice(0, -1);
  const total = ringArea(ring);
  if (total === 0) return 0;
  const inside = modelled.reduce((sum, storey) => {
    const part = clipToStorey(ring, bands, storeys, storey);
    return sum + (part.length > 0 ? ringArea(part) : 0);
  }, 0);
  return Math.min(1, inside / total);
}

/** The storey (1-based) at a height; below the ground is storey 1, above the eaves the top storey. */
export function storeyAt(z: number, bands: StoreyBands, storeys: number): number {
  if (bands.height <= 0) return 1;
  return Math.min(storeys, Math.max(1, Math.floor((z - bands.ground) / bands.height) + 1));
}

/** Every surface cut to the given storeys, one closed polygon per surface and storey. */
export function storeyParts(polygons: SurfacePolygon[], storeys: number, chosen: readonly number[]): SurfacePolygon[] {
  const bands = storeyBands(polygons, storeys);
  return polygons.flatMap((polygon) => {
    const ring = polygon.coordinates[0].slice(0, -1);
    return chosen
      .map((storey) => clipToStorey(ring, bands, storeys, storey))
      .filter((part) => part.length > 0 && ringArea(part) > 0)
      .map((part) => ({ ...polygon, coordinates: [[...part, part[0]]] }));
  });
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

/** Dwellings per storey, 1-based from the ground, as the user gave them. */
export type StoreyDwellings = Readonly<Record<number, number>>;

/** The dwellings in the modelled storeys: their sum, or null while a modelled storey has no count. */
export function modelledDwellings(modelled: readonly number[], dwellings: StoreyDwellings): number | null {
  let sum = 0;
  for (const storey of modelled) {
    const count = dwellings[storey];
    if (!(count >= 1)) return null;
    sum += count;
  }
  return modelled.length > 0 ? sum : null;
}
