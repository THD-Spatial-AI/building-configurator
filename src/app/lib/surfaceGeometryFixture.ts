// Stand-in for the per-surface geometry endpoint city2tabula does not expose
// yet. Shape matches what that endpoint is expected to return: one Polygon
// per surface, native storage CRS, 3D coordinates, ids matching the enrich
// response's Surface.id. A synthetic gabled house at coordinates in the same
// range as a real NL sample (198216 E / 458493 N, ~25-31 m elevation), not
// real data.
import type { SurfacePolygon } from './surfaceMesh';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

const ORIGIN_X = 198216;
const ORIGIN_Y = 458493;
const GROUND_Z = 24.845;
const EAVE_Z = 28.345;
const RIDGE_Z = 30.845;

// Local footprint: 8 m x 6 m, ridge running along x at y = 3 (mid-depth).
const A: [number, number] = [0, 0];
const B: [number, number] = [8, 0];
const C: [number, number] = [8, 6];
const D: [number, number] = [0, 6];

function pt(local: [number, number], z: number): number[] {
  return [ORIGIN_X + local[0], ORIGIN_Y + local[1], z];
}

function ring(points: number[][]): number[][][] {
  return [[...points, points[0]]];
}

export const LOENEN_HOUSE_FIXTURE: SurfacePolygon[] = [
  {
    id: 'fixture-ground-1',
    type: 'GroundSurface',
    label: 'Ground floor slab',
    coordinates: ring([pt(A, GROUND_Z), pt(B, GROUND_Z), pt(C, GROUND_Z), pt(D, GROUND_Z)]),
  },
  {
    id: 'fixture-wall-south',
    type: 'WallSurface',
    label: 'Wall (south)',
    coordinates: ring([pt(A, GROUND_Z), pt(B, GROUND_Z), pt(B, EAVE_Z), pt(A, EAVE_Z)]),
  },
  {
    id: 'fixture-wall-north',
    type: 'WallSurface',
    label: 'Wall (north)',
    coordinates: ring([pt(D, GROUND_Z), pt(C, GROUND_Z), pt(C, EAVE_Z), pt(D, EAVE_Z)]),
  },
  {
    id: 'fixture-wall-east-gable',
    type: 'WallSurface',
    label: 'Wall (east gable)',
    coordinates: ring([
      pt(B, GROUND_Z), pt(C, GROUND_Z), pt(C, EAVE_Z), [ORIGIN_X + 8, ORIGIN_Y + 3, RIDGE_Z], pt(B, EAVE_Z),
    ]),
  },
  {
    id: 'fixture-wall-west-gable',
    type: 'WallSurface',
    label: 'Wall (west gable)',
    coordinates: ring([
      pt(A, GROUND_Z), pt(D, GROUND_Z), pt(D, EAVE_Z), [ORIGIN_X + 0, ORIGIN_Y + 3, RIDGE_Z], pt(A, EAVE_Z),
    ]),
  },
  {
    id: 'fixture-roof-front',
    type: 'RoofSurface',
    label: 'Roof slope (front)',
    coordinates: ring([
      pt(A, EAVE_Z), pt(B, EAVE_Z), [ORIGIN_X + 8, ORIGIN_Y + 3, RIDGE_Z], [ORIGIN_X + 0, ORIGIN_Y + 3, RIDGE_Z],
    ]),
  },
  {
    id: 'fixture-roof-back',
    type: 'RoofSurface',
    label: 'Roof slope (back)',
    coordinates: ring([
      pt(D, EAVE_Z), pt(C, EAVE_Z), [ORIGIN_X + 8, ORIGIN_Y + 3, RIDGE_Z], [ORIGIN_X + 0, ORIGIN_Y + 3, RIDGE_Z],
    ]),
  },
];

/** Each fixture surface's real-world type and compass-bearing orientation, used only
 * to pick the closest-oriented real element below — not a claim that the fixture's
 * shape matches the real building's. */
const FIXTURE_ORIENTATION: Record<string, { type: BuildingElement['type']; azimuth: number }> = {
  'fixture-wall-south':      { type: 'wall', azimuth: 180 },
  'fixture-wall-north':      { type: 'wall', azimuth: 0 },
  'fixture-wall-east-gable': { type: 'wall', azimuth: 90 },
  'fixture-wall-west-gable': { type: 'wall', azimuth: 270 },
  'fixture-roof-front':      { type: 'roof', azimuth: 180 },
  'fixture-roof-back':       { type: 'roof', azimuth: 0 },
};

function azimuthDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Resolves a clicked fixture surface to the real building element it stands in
 * for, so a click can open that element's real PV configuration.
 *
 * ponytail: nearest-azimuth heuristic, not a true geometric correspondence —
 * the fixture is a placeholder shape until the real per-surface geometry
 * endpoint ships. Upgrade path: once that endpoint exists, render the real
 * building's own geometry instead of the fixture and this function goes away.
 *
 * Returns undefined for surfaces with no PV-eligible counterpart (ground/floor).
 */
export function resolveFixtureElementId(
  fixtureId: string,
  elements: Record<string, BuildingElement>,
): string | undefined {
  const target = FIXTURE_ORIENTATION[fixtureId];
  if (!target) return undefined;

  const candidates = Object.values(elements).filter((el) => el.type === target.type);
  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, el) =>
    azimuthDistance(el.azimuth, target.azimuth) < azimuthDistance(best.azimuth, target.azimuth) ? el : best,
  ).id;
}
