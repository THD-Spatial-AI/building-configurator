// Storeys of the 3D model. The model has no per-storey geometry, so storeys
// are bands from the ground to the eaves, each its share of that height in
// proportion to the storey heights given (equal bands without them). Under a
// pitched roof the attic is one band more, number storeys + 1, from the eaves
// up. The bottom band extends below the ground and the top one upwards, so the
// ground floor belongs to storey 1 and the roof to the attic or top storey.

import { polygonArea, type SurfacePolygon } from './surfaceMesh';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

type Point = number[];

/** Where storey 1 starts, the mean storey height, and where each storey starts and ends, in the geometry's own units. */
export interface StoreyBands {
  ground: number;
  height: number;
  /** bounds[i] is where storey i + 1 starts; the last entry is the eaves, where the attic starts. */
  bounds: number[];
  /** The bands: the storeys, and the attic where there is one. */
  count: number;
}

/** How far a roof must rise above the eaves for the space under it to count as an attic. */
const ATTIC_MIN_RISE = 0.5;

/** City2TABULA geometry names surfaces as CityGML does (WallSurface, RoofSurface); other sources as BuEM (wall, roof). */
const isKind = (polygon: SurfacePolygon, kind: 'wall' | 'roof') => polygon.type.toLowerCase().startsWith(kind);

/**
 * The ground is the lowest vertex; the eaves the lowest edge of the highest
 * roof. `heights`, one per storey from the ground, set each band's share of
 * that height; without them, or with any not positive, the bands are equal.
 */
export function storeyBands(polygons: SurfacePolygon[], storeys: number, heights?: readonly number[]): StoreyBands {
  const zs = (polygon: SurfacePolygon) => polygon.coordinates[0].map((p) => p[2]);
  const ground = Math.min(...polygons.flatMap(zs));
  const roofs = polygons.filter((polygon) => isKind(polygon, 'roof'));
  const eaves = roofs.length > 0
    ? Math.max(...roofs.map((roof) => Math.min(...zs(roof))))
    : Math.max(...polygons.flatMap(zs));
  const count = Math.max(1, storeys);
  const usable = heights && heights.length === count && heights.every((h) => h > 0) ? heights : Array(count).fill(1);
  const sum = usable.reduce((a, b) => a + b, 0);
  const bounds = [ground];
  for (const h of usable) bounds.push(bounds[bounds.length - 1] + ((eaves - ground) * h) / sum);
  const ridge = roofs.length > 0 ? Math.max(...roofs.flatMap(zs)) : eaves;
  return { ground, height: (eaves - ground) / count, bounds, count: count + (ridge - eaves > ATTIC_MIN_RISE ? 1 : 0) };
}

/** Whether the model has a pitched roof rising above its eaves, and so an attic. */
export function hasAttic(polygons: SurfacePolygon[]): boolean {
  return polygons.length > 0 && storeyBands(polygons, 1).count > 1;
}

/** Clear heights in m from which attic floor counts in full and by half, as Germany's living-space rule (WoFlV) counts it. */
const ATTIC_FULL_HEADROOM = 2;
const ATTIC_HALF_HEADROOM = 1;

/** Area of a ring projected onto the ground, taken from its first point so a projected CRS keeps its precision. */
function groundArea(ring: Point[]): number {
  const [ox, oy] = ring[0];
  let twice = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    twice += (ax - ox) * (by - oy) - (bx - ox) * (ay - oy);
  }
  return Math.abs(twice) / 2;
}

/**
 * The attic's usable floor area, in the geometry's units squared, on a floor
 * at the eaves: in full under roof 2 m or more above it, half under roof 1 m
 * to 2 m above it. 0 without an attic.
 */
export function atticFloorArea(polygons: SurfacePolygon[]): number {
  if (!hasAttic(polygons)) return 0;
  const eaves = storeyBands(polygons, 1).bounds[1];
  const over = (ring: Point[], headroom: number) => {
    const part = clipZ(ring, (z) => z >= eaves + headroom, eaves + headroom);
    return part.length >= 3 ? groundArea(part) : 0;
  };
  return polygons.filter((polygon) => isKind(polygon, 'roof')).reduce((sum, roof) => {
    const ring = roof.coordinates[0].slice(0, -1);
    const full = over(ring, ATTIC_FULL_HEADROOM);
    return sum + full + (over(ring, ATTIC_HALF_HEADROOM) - full) / 2;
  }, 0);
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

/** A line across every wall at each floor level between bands, the eaves under an attic too, as [start, end] in the geometry's coordinates. */
export function storeyLines(polygons: SurfacePolygon[], storeys: number, heights?: readonly number[]): [Point, Point][] {
  const bands = storeyBands(polygons, storeys, heights);
  const lines: [Point, Point][] = [];
  for (const wall of polygons.filter((polygon) => isKind(polygon, 'wall'))) {
    const ring = wall.coordinates[0].slice(0, -1);
    for (let storey = 1; storey < bands.count; storey += 1) {
      const points = crossings(ring, bands.bounds[storey]);
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

/** The part of an open ring inside one band, [lower, upper), the outer bands unbounded. */
function clipToStorey(ring: Point[], bands: StoreyBands, storey: number): Point[] {
  const lower = storey === 1 ? -Infinity : bands.bounds[storey - 1];
  const upper = storey === bands.count ? Infinity : bands.bounds[storey];
  let part = ring;
  if (lower > -Infinity) part = clipZ(part, (z) => z >= lower, lower);
  if (upper < Infinity) part = clipZ(part, (z) => z < upper, upper);
  return part.length >= 3 ? part : [];
}

/** Share of a polygon's area inside the given bands. */
function polygonShare(polygon: SurfacePolygon, bands: StoreyBands, modelled: readonly number[]): number {
  const ring = polygon.coordinates[0].slice(0, -1);
  const total = ringArea(ring);
  if (total === 0) return 0;
  const inside = modelled.reduce((sum, storey) => {
    const part = clipToStorey(ring, bands, storey);
    return sum + (part.length > 0 ? ringArea(part) : 0);
  }, 0);
  return Math.min(1, inside / total);
}

/** The band (1-based) at a height; below the ground is storey 1, above the eaves the attic or top storey. */
export function storeyAt(z: number, bands: StoreyBands): number {
  if (bands.height <= 0) return 1;
  let storey = 1;
  while (storey < bands.count && z >= bands.bounds[storey]) storey += 1;
  return storey;
}

/** Every surface cut to the given storeys, one closed polygon per surface and storey. */
export function storeyParts(polygons: SurfacePolygon[], storeys: number, chosen: readonly number[], heights?: readonly number[]): SurfacePolygon[] {
  const bands = storeyBands(polygons, storeys, heights);
  return polygons.flatMap((polygon) => {
    const ring = polygon.coordinates[0].slice(0, -1);
    return chosen
      .map((storey) => clipToStorey(ring, bands, storey))
      .filter((part) => part.length > 0 && ringArea(part) > 0)
      .map((part) => ({ ...polygon, coordinates: [[...part, part[0]]] }));
  });
}

/**
 * Each element's share of its area inside the modelled bands (1-based, the
 * attic storeys + 1). A window or door takes its parent's share; a surface
 * with no polygon, such as one added by hand, the share of storeys modelled.
 */
export function storeyShares(
  polygons: SurfacePolygon[],
  elements: Record<string, BuildingElement>,
  storeys: number,
  modelled: readonly number[],
  heights?: readonly number[],
): Record<string, number> {
  const bands = storeyBands(polygons, storeys, heights);
  const byId = new Map(polygons.map((polygon) => [polygon.id, polygon]));
  const fallback = modelled.filter((storey) => storey <= storeys).length / Math.max(1, storeys);
  const own = (id: string) => {
    const polygon = byId.get(id);
    return polygon ? polygonShare(polygon, bands, modelled) : fallback;
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

/**
 * The dwellings in what is modelled while part of the building is left out:
 * the modelled storeys' counts with a heated attic's, or with every storey
 * modelled, the building's less a cold attic's. Null while a count it needs
 * is missing or nothing is left out.
 */
export function modelledUnits(
  modelled: readonly number[] | undefined,
  dwellings: StoreyDwellings,
  attic: { modelled: boolean; dwellings?: number } | undefined,
  total: number | null | undefined,
): number | null {
  const atticUnits = attic?.dwellings ?? 0;
  const atticOut = attic?.modelled === false;
  if (modelled) {
    const storeys = modelledDwellings(modelled, dwellings);
    return storeys === null ? null : storeys + (atticOut ? 0 : atticUnits);
  }
  return atticOut && atticUnits > 0 && Number(total) > atticUnits ? Number(total) - atticUnits : null;
}

/** The modelled storeys with no dwelling count; none while every storey is modelled. */
export function missingDwellings(modelled: readonly number[] | null, dwellings: StoreyDwellings): number[] {
  return modelled ? modelled.filter((storey) => !(dwellings[storey] >= 1)) : [];
}

/** The building's dwellings from its counts per storey: the sum of those given, or null when none is. */
export function dwellingsTotal(storeys: number, dwellings: StoreyDwellings): number | null {
  const counts = Array.from({ length: storeys }, (_, i) => dwellings[i + 1]).filter((count) => count >= 1);
  return counts.length > 0 ? counts.reduce((a, b) => a + b, 0) : null;
}

/** A storey's own height where the user gave one, 1-based from the ground; the rest take the room height. */
export type StoreyHeights = Readonly<Record<number, number>>;

/** The lowest storey height a field accepts: a crawl space or store room can be heated too. */
export const MIN_STOREY_HEIGHT_M = 0.5;
/** Slack for rounding in the model's height before storeys and room height count as too tall. */
const HEIGHT_SLACK_M = 0.1;

/** Each storey's height, from the ground: its own where given, else the room height. */
export function storeyHeightList(storeys: number, roomHeight: number, own: StoreyHeights = {}): number[] {
  return Array.from({ length: Math.max(0, storeys) }, (_, i) => (own[i + 1] > 0 ? own[i + 1] : roomHeight));
}

/** The mean height of the given storeys (all where `modelled` is null): the one room height BuEM takes. */
export function meanStoreyHeight(heights: readonly number[], modelled: readonly number[] | null): number {
  const chosen = modelled ? modelled.map((storey) => heights[storey - 1]).filter((h) => h > 0) : heights;
  return chosen.length > 0 ? chosen.reduce((a, b) => a + b, 0) / chosen.length : 0;
}

/** Whether these storeys together are taller than the model to its eaves. */
export function tallerThanModel(modelHeight: number, heights: readonly number[]): boolean {
  return heights.reduce((a, b) => a + b, 0) > modelHeight + HEIGHT_SLACK_M;
}

/** Whether these storeys are taller than the 3D model to its eaves; false without a model. */
export function storeysTooTall(storeys: number, roomHeight: number, own: StoreyHeights, modelHeight?: number): boolean {
  return modelHeight !== undefined && tallerThanModel(modelHeight, storeyHeightList(storeys, roomHeight, own));
}

/**
 * The most each input may reach before the storeys are taller than the model
 * to its eaves: the storey count at the room height, the room height of the
 * storeys without their own, and one storey's own height. Down to the
 * centimetre, so a limit reads as a height.
 */
export function heightLimits(modelHeight: number, storeys: number, roomHeight: number, own: StoreyHeights = {}): {
  maxStoreys: number;
  maxRoomHeight: number;
  maxStoreyHeight: (storey: number) => number;
} {
  const heights = storeyHeightList(storeys, roomHeight, own);
  const total = heights.reduce((a, b) => a + b, 0);
  const room = modelHeight + HEIGHT_SLACK_M;
  const ownTotal = heights.reduce((sum, h, i) => sum + (own[i + 1] > 0 ? h : 0), 0);
  const shared = heights.filter((_, i) => !(own[i + 1] > 0)).length;
  const cm = (value: number) => Math.floor(value * 100 + 1e-6) / 100;
  return {
    maxStoreys: storeys + Math.max(0, Math.floor((room - total) / Math.max(roomHeight, MIN_STOREY_HEIGHT_M))),
    maxRoomHeight: shared > 0 ? cm((room - ownTotal) / shared) : roomHeight,
    maxStoreyHeight: (storey) => cm(room - (total - (heights[storey - 1] ?? 0))),
  };
}

/** The model's height from the ground to the eaves, in metres. */
export function eavesHeight(polygons: SurfacePolygon[]): number {
  return storeyBands(polygons, 1).height;
}


