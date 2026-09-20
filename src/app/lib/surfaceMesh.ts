// GeoJSON-polygon-to-renderable-mesh conversion for the experimental 3D surface
// viewer. Mirrors cityviz's approach (same workspace, same data source) since it
// already solved the two non-obvious problems here: float32 precision at native
// storage-CRS coordinate magnitudes, and triangulating a polygon in arbitrary 3D
// orientation (walls in particular) without Three.js's own 2D-only ShapeUtils.
import * as THREE from 'three';
import earcut from 'earcut';
import type { BuildingGeometry } from './enerplanetApi';

export interface SurfacePolygon {
  /** City2TABULA surface row id, which is also the BuildingState element id. */
  id: string;
  type: string;
  /** GeoJSON Polygon coordinates: outer ring only, [x, y, z] per vertex, ring closed. */
  coordinates: number[][][];
}

/** Flattens a geometry response into the surfaces this viewer renders. A surface
 * row with no geometry is skipped rather than rendered as an empty mesh. */
export function surfacesFromGeometryResponse(buildings: BuildingGeometry[]): SurfacePolygon[] {
  const surfaces: SurfacePolygon[] = [];
  for (const building of buildings) {
    for (const surface of building.surfaces ?? []) {
      if (!surface.geojson) continue;
      surfaces.push({
        id: surface.id,
        type: surface.type,
        coordinates: surface.geojson.coordinates,
      });
    }
  }
  return surfaces;
}

/**
 * True when no rendered surface resolves to an envelope element, meaning the
 * geometry and the envelope came from different City2TABULA generations.
 *
 * A database rebuild regenerates every surface id at once, so a real mismatch
 * is total. A few unresolved surfaces are normal, since a surface type with no
 * envelope counterpart (ClosureSurface) is skipped upstream, so a partial miss
 * is not a detach.
 */
export function isEnvelopeDetached(surfaces: SurfacePolygon[], elementIds: Set<string>): boolean {
  return surfaces.length > 0 && !surfaces.some((surface) => elementIds.has(surface.id));
}

/** Mean of every vertex's x/y/z across all surfaces. Native storage CRS eastings and
 * northings are 100,000+ m (WebGL's float32 positions would visibly jitter at that
 * scale without subtracting a shared origin first), and elevation is an absolute
 * NAP-style value (tens of metres) rather than a height above the building's own
 * ground — subtracting it too is what puts the building near the scene origin. */
export function computeOrigin(surfaces: SurfacePolygon[]): [number, number, number] {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let count = 0;
  for (const surface of surfaces) {
    for (const ring of surface.coordinates) {
      for (const [x, y, z] of ring) {
        sumX += x;
        sumY += y;
        sumZ += z;
        count += 1;
      }
    }
  }
  return count > 0 ? [sumX / count, sumY / count, sumZ / count] : [0, 0, 0];
}

/** Storage CRS (x east, y north, z up) to three.js (x east, y up, z south). */
function toLocal([x, y, z]: number[], origin: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(x - origin[0], z - origin[2], -(y - origin[1]));
}

/** Newell's method for a polygon normal: sums every edge's contribution instead of
 * reading it off the first three vertices, which fails for a wall ring whose first
 * few vertices run along a straight bottom edge (a real, common case here). */
function newellNormal(points: THREE.Vector3[]): THREE.Vector3 {
  const normal = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    normal.x += (a.y - b.y) * (a.z + b.z);
    normal.y += (a.z - b.z) * (a.x + b.x);
    normal.z += (a.x - b.x) * (a.y + b.y);
  }
  return normal.normalize();
}

/** Projects the ring onto the 2D plane most aligned with its normal, triangulates
 * with earcut, then remaps the resulting indices back onto the original 3D points. */
function triangulateRing(points: THREE.Vector3[]): { positions: number[]; indices: number[] } {
  const normal = newellNormal(points);
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);
  const dropAxis = absX > absY && absX > absZ ? 0 : absY > absZ ? 1 : 2;

  const flat: number[] = [];
  for (const p of points) {
    if (dropAxis === 0) flat.push(p.y, p.z);
    else if (dropAxis === 1) flat.push(p.x, p.z);
    else flat.push(p.x, p.y);
  }

  const indices = earcut(flat) as number[];
  const positions: number[] = [];
  for (const p of points) positions.push(p.x, p.y, p.z);
  return { positions, indices };
}

const SURFACE_COLOR: Record<string, number> = {
  RoofSurface: 0xb45309,
  GroundSurface: 0x15803d,
  WallSurface: 0x8ab4d0,
};

/** One Group per surface: a filled, pickable mesh (named 'surface-fill') plus an
 * edge overlay, tagged with the surface id so a raycast hit maps back to it. */
export function buildSurfaceGroup(surface: SurfacePolygon, origin: [number, number, number]): THREE.Group {
  const ring = surface.coordinates[0];
  const points = ring.slice(0, ring.length - 1).map((c) => toLocal(c, origin));
  const { positions, indices } = triangulateRing(points);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // DoubleSide: city2tabula polygons carry inconsistent winding, and Three.js's
  // Raycaster honours material.side, so FrontSide would make half the surfaces
  // both invisible and unclickable.
  const material = new THREE.MeshStandardMaterial({
    color: SURFACE_COLOR[surface.type] ?? 0x94a3b8,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'surface-fill';

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0x1e293b }),
  );

  const group = new THREE.Group();
  group.add(mesh, edges);
  group.userData = { id: surface.id, type: surface.type };
  return group;
}
