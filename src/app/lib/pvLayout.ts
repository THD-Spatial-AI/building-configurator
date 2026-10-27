// Whole PV modules placed on one surface from its geometry, for drawing and
// for the module count a host stores and sends to its yield model. Works in
// the storage CRS: metres, x east, y north, z up.

import type { SurfacePolygon } from './surfaceMesh';

/** One module of the building's PV type: portrait width and height in m, kWp per module. */
export interface PvModule {
  width: number;
  height: number;
  kwp: number;
}

/** Used when the host passes no module: 0.4 kWp on 2.0 m², 0.2 kWp/m². */
export const DEFAULT_PV_MODULE: PvModule = { width: 1.134, height: 1.762, kwp: 0.4 };

/** Flush lies in the surface's plane; racked stands at its own tilt and facing, in rows. */
export type PvMounting =
  | { kind: 'flush' }
  | { kind: 'racked'; tilt: number; azimuth: number };

export type PvOrientation = 'portrait' | 'landscape';

export interface PvLayoutOptions {
  /** Share of the surface area the modules may cover, 0 to 1. */
  usableShare: number;
  /** Absent: racked at 15° south on a surface under 10°, otherwise flush. */
  mounting?: PvMounting;
  /**
   * Absent: whichever fits more modules. On a flush surface that includes
   * filling the room one orientation leaves with modules turned the other way.
   */
  orientation?: PvOrientation;
  /** Places at most this many modules, those nearest the middle. Absent: as many as fit. */
  moduleCount?: number;
}

export interface PvLayout {
  count: number;
  /** How many fit within the usable share, before any moduleCount; count is at most this. */
  fits: number;
  kwp: number;
  /** Module surface, m². */
  area: number;
  /** True when the usable share removed modules that would fit; false when the surface's space is the limit. */
  capped: boolean;
  /** The modules' tilt (degrees from horizontal) and facing (degrees clockwise from north). */
  tilt: number;
  azimuth: number;
  mounting: PvMounting;
  /** mixed when a flush surface carries both. */
  orientation: PvOrientation | 'mixed';
  /** Each module's four corners, [x, y, z], in the surface's coordinates. */
  modules: number[][][];
}

/** Kept clear along every edge of the surface. */
export const EDGE_CLEARANCE_M = 0.3;
const MODULE_GAP_M = 0.02;
/** Spacing of the extra positions tried when filling the room a first layout leaves. */
const FILL_STEP_M = 0.1;
/** Racked rows are spaced so a row does not shade the next with the sun this high. */
const SHADING_ELEVATION_DEG = 20;
/** Surfaces flatter than this are racked by default, and only they are offered racking. */
export const FLAT_MAX_TILT_DEG = 10;
export const DEFAULT_RACK: PvMounting = { kind: 'racked', tilt: 15, azimuth: 180 };
/** Racked modules' low edge sits at least this far above the surface. */
const RACK_FOOT_M = 0.05;

type Vec = [number, number, number];
type Rect = { u: number; v: number; du: number; dv: number; portrait: boolean };

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Newell's sum: the normal's direction, and twice the polygon's area as its length. */
function newell(ring: Vec[]): Vec {
  const n: Vec = [0, 0, 0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

function insidePolygon(u: number, v: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i];
    const [uj, vj] = poly[j];
    if ((vi > v) !== (vj > v) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}

function distanceToEdges(u: number, v: number, poly: number[][]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [au, av] = poly[i];
    const [bu, bv] = poly[(i + 1) % poly.length];
    const len = (bu - au) ** 2 + (bv - av) ** 2;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((u - au) * (bu - au) + (v - av) * (bv - av)) / len));
    min = Math.min(min, Math.hypot(u - (au + t * (bu - au)), v - (av + t * (bv - av))));
  }
  return min;
}

/** A rectangle fits when its corners are inside with clearance and no vertex of the surface reaches into it. */
function fits(r: Rect, poly: number[][]): boolean {
  const corners = [[r.u, r.v], [r.u + r.du, r.v], [r.u + r.du, r.v + r.dv], [r.u, r.v + r.dv]];
  if (!corners.every(([u, v]) => insidePolygon(u, v, poly) && distanceToEdges(u, v, poly) >= EDGE_CLEARANCE_M - 1e-9)) return false;
  const c = EDGE_CLEARANCE_M;
  return !poly.some(([u, v]) => u > r.u - c && u < r.u + r.du + c && v > r.v - c && v < r.v + r.dv + c);
}

/** The most rectangles of one size that fit, over a few grid offsets. */
function grid(poly: number[][], du: number, dv: number, pitchU: number, pitchV: number, portrait: boolean): Rect[] {
  const us = poly.map((p) => p[0]);
  const vs = poly.map((p) => p[1]);
  const [minU, maxU, minV, maxV] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  let best: Rect[] = [];
  for (const fu of [0, 0.25, 0.5, 0.75]) {
    for (const fv of [0, 0.25, 0.5, 0.75]) {
      const placed: Rect[] = [];
      for (let v = minV + EDGE_CLEARANCE_M + fv * pitchV; v + dv <= maxV - EDGE_CLEARANCE_M + 1e-9; v += pitchV) {
        for (let u = minU + EDGE_CLEARANCE_M + fu * pitchU; u + du <= maxU - EDGE_CLEARANCE_M + 1e-9; u += pitchU) {
          const r = { u, v, du, dv, portrait };
          if (fits(r, poly)) placed.push(r);
        }
      }
      if (placed.length > best.length) best = placed;
    }
  }
  return best;
}

/** Closer than the module gap, which counts as overlapping. */
function overlaps(a: Rect, b: Rect): boolean {
  const g = MODULE_GAP_M - 1e-9;
  return a.u < b.u + b.du + g && b.u < a.u + a.du + g && a.v < b.v + b.dv + g && b.v < a.v + a.dv + g;
}

/** Positions from min to max every FILL_STEP_M, plus the given ones, ascending. */
function positions(min: number, max: number, extra: number[]): number[] {
  const out = [...extra];
  for (let x = min; x <= max + 1e-9; x += FILL_STEP_M) out.push(x);
  return out.sort((a, b) => a - b);
}

/** Rectangles of one size added in the room `placed` leaves, each row packed from its low end. */
function fill(poly: number[][], placed: Rect[], du: number, dv: number, portrait: boolean): Rect[] {
  const us = poly.map((p) => p[0]);
  const vs = poly.map((p) => p[1]);
  const c = EDGE_CLEARANCE_M;
  const rowsAt = positions(Math.min(...vs) + c, Math.max(...vs) - c - dv, placed.flatMap((r) => [r.v + r.dv + MODULE_GAP_M, r.v - MODULE_GAP_M - dv]));
  const columnsAt = positions(Math.min(...us) + c, Math.max(...us) - c - du, placed.flatMap((r) => [r.u + r.du + MODULE_GAP_M, r.u - MODULE_GAP_M - du]));
  const all = [...placed];
  const added: Rect[] = [];
  for (const v of rowsAt) {
    let next = -Infinity;
    for (const at of columnsAt) {
      const r = { u: Math.max(at, next), v, du, dv, portrait };
      if (all.some((o) => overlaps(r, o)) || !fits(r, poly)) continue;
      all.push(r);
      added.push(r);
      next = r.u + du + MODULE_GAP_M;
    }
  }
  return added;
}

function orientationOf(rects: Rect[], requested: PvOrientation | undefined): PvLayout['orientation'] {
  if (rects.length === 0) return requested ?? 'portrait';
  const portraits = rects.filter((r) => r.portrait).length;
  if (portraits === rects.length) return 'portrait';
  return portraits === 0 ? 'landscape' : 'mixed';
}

function layoutFor(
  ring: Vec[],
  normal: Vec,
  area: number,
  module: PvModule,
  usableShare: number,
  mounting: PvMounting,
  orientation: PvOrientation | undefined,
  roof: { tilt: number; azimuth: number },
  moduleCount: number | undefined,
): PvLayout {
  const origin = ring[0];

  // A 2D frame (u, v) and the way back to 3D for each mounting.
  let axisU: Vec;
  let axisV: Vec;
  let toWorld: (u: number, v: number, lift: number) => Vec;
  if (mounting.kind === 'flush') {
    axisU = Math.abs(normal[2]) > 0.999 ? [1, 0, 0] : norm(cross(normal, [0, 0, 1]));
    axisV = norm(cross(normal, axisU));
    toWorld = (u, v) => [
      origin[0] + u * axisU[0] + v * axisV[0],
      origin[1] + u * axisU[1] + v * axisV[1],
      origin[2] + u * axisU[2] + v * axisV[2],
    ];
  } else {
    const a = rad(mounting.azimuth);
    axisV = [Math.sin(a), Math.cos(a), 0];
    axisU = [axisV[1], -axisV[0], 0];
    const planeZ = (x: number, y: number) => (Math.abs(normal[2]) < 1e-6
      ? origin[2]
      : origin[2] - (normal[0] * (x - origin[0]) + normal[1] * (y - origin[1])) / normal[2]);
    toWorld = (u, v, lift) => {
      const x = origin[0] + u * axisU[0] + v * axisV[0];
      const y = origin[1] + u * axisU[1] + v * axisV[1];
      return [x, y, planeZ(x, y) + lift];
    };
  }

  const poly = ring.map((p) => [dot(sub(p, origin), axisU), dot(sub(p, origin), axisV)]);

  // A module's footprint in the (u, v) frame, and the row pitch: racked rows
  // are spaced against self-shading.
  const size = (o: PvOrientation) => {
    const [w, h] = o === 'portrait' ? [module.width, module.height] : [module.height, module.width];
    if (mounting.kind === 'flush') return { du: w, dv: h, pitchV: h + MODULE_GAP_M };
    const dv = h * Math.cos(rad(mounting.tilt));
    return { du: w, dv, pitchV: dv + (h * Math.sin(rad(mounting.tilt))) / Math.tan(rad(SHADING_ELEVATION_DEG)) + MODULE_GAP_M };
  };
  const place = (o: PvOrientation) => {
    const { du, dv, pitchV } = size(o);
    return grid(poly, du, dv, du + MODULE_GAP_M, pitchV, o === 'portrait');
  };
  const withFill = (base: Rect[], o: PvOrientation) => {
    const { du, dv } = size(o);
    return [...base, ...fill(poly, base, du, dv, o === 'portrait')];
  };
  const candidates: Rect[][] = orientation ? [place(orientation)] : [place('portrait'), place('landscape')];
  // Racked rows keep one orientation: a row's spacing follows its modules' height.
  if (!orientation && mounting.kind === 'flush') {
    candidates.push(withFill(candidates[0], 'landscape'), withFill(candidates[1], 'portrait'));
  }
  let rects = candidates.reduce((best, next) => (next.length > best.length ? next : best));

  // The usable share caps how many, then the chosen count: keep those nearest the middle.
  const cu = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cv = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const distance = (r: Rect) => Math.hypot(r.u + r.du / 2 - cu, r.v + r.dv / 2 - cv);
  const nearestMiddle = (n: number) => [...rects].sort((a, b) => distance(a) - distance(b)).slice(0, Math.max(0, n));
  const cap = Math.floor((Math.max(0, Math.min(1, usableShare)) * area) / (module.width * module.height));
  const capped = rects.length > cap;
  if (capped) rects = nearestMiddle(cap);
  const fits = rects.length;
  if (moduleCount !== undefined && moduleCount < fits) rects = nearestMiddle(Math.floor(moduleCount));

  const modules = rects.map((r) => {
    if (mounting.kind === 'flush') {
      return [toWorld(r.u, r.v, 0), toWorld(r.u + r.du, r.v, 0), toWorld(r.u + r.du, r.v + r.dv, 0), toWorld(r.u, r.v + r.dv, 0)];
    }
    // One level for the whole module, clear of the surface under every
    // corner, so its tilt is the rack's whatever the surface's slope. The
    // edge towards the facing (higher v) is the low one.
    const footprint = [toWorld(r.u, r.v, 0), toWorld(r.u + r.du, r.v, 0), toWorld(r.u + r.du, r.v + r.dv, 0), toWorld(r.u, r.v + r.dv, 0)];
    const base = Math.max(...footprint.map((c) => c[2])) + RACK_FOOT_M;
    const rise = (r.portrait ? module.height : module.width) * Math.sin(rad(mounting.tilt));
    return footprint.map(([x, y], i): Vec => [x, y, base + (i < 2 ? rise : 0)]);
  });

  return {
    count: modules.length,
    fits,
    kwp: modules.length * module.kwp,
    area: modules.length * module.width * module.height,
    capped,
    tilt: mounting.kind === 'racked' ? mounting.tilt : roof.tilt,
    azimuth: mounting.kind === 'racked' ? mounting.azimuth : roof.azimuth,
    mounting,
    orientation: orientationOf(rects, orientation),
    modules,
  };
}

/** Whole modules on a surface: as many as fit inside its edge clearance, up to its usable share of the area. */
export function pvLayout(surface: SurfacePolygon, module: PvModule, options: PvLayoutOptions): PvLayout {
  const ring = surface.coordinates[0].slice(0, -1) as Vec[];
  const sum = newell(ring);
  const area = Math.hypot(...sum) / 2;
  // Facing up, so a roof's normal points at the sky.
  const normal = norm(sum[2] < 0 ? [-sum[0], -sum[1], -sum[2]] : sum);
  const roof = {
    tilt: deg(Math.acos(Math.min(1, Math.abs(normal[2])))),
    azimuth: (deg(Math.atan2(normal[0], normal[1])) + 360) % 360,
  };
  const mounting = options.mounting ?? (roof.tilt < FLAT_MAX_TILT_DEG ? DEFAULT_RACK : { kind: 'flush' });
  return layoutFor(ring, normal, area, module, options.usableShare, mounting, options.orientation, roof, options.moduleCount);
}
