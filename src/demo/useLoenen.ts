// The Loenen smoke area from bundled captures (src/assets/data/loenen_*_fixture.json):
// the PyLovo grid, the City2TABULA envelope enrichment for every building, and
// each building's 3D surface geometry. Nothing here reaches a backend.

import { useEffect, useMemo, useState } from 'react';
import { fixtureServices } from './services';
import { buildBuildingStates } from '../app/lib/city2tabulaAdapter';
import { surfacesFromGeometryResponse, type SurfaceGeometry } from '../app/lib/surfaceMesh';
import type { BuildingGeometry, EnrichEntry } from '../app/lib/enerplanet';
import type { BuildingState } from '../app/lib/buemAdapter';
import loenenFixture from '../assets/data/loenen_live_fixture.json';
import surfaceFixture from '../assets/data/loenen_surfaces_fixture.json';

const SURFACE_FIXTURE = surfaceFixture as unknown as Record<string, BuildingGeometry>;
const ENRICH = loenenFixture.enrich.data as unknown as Record<string, EnrichEntry>;

export type FootprintCollection = { type: 'FeatureCollection'; features: unknown[] };

/** City2TABULA building id per osm_id. The geometry is keyed by object_id, everything else by osm_id. */
const OBJECT_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(ENRICH).map(([osmId, entry]) => [osmId, entry.object_id]),
);

function buildStates(features: unknown[]): Promise<Record<string, BuildingState>> {
  return buildBuildingStates(
    fixtureServices,
    { features } as unknown as Parameters<typeof buildBuildingStates>[1],
    ENRICH as unknown as Parameters<typeof buildBuildingStates>[2],
  );
}

/** The whole area's buildings. Null while they are adapted. */
export function useLoenenBuildings() {
  const [buildings, setBuildings] = useState<Record<string, BuildingState> | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildStates(loenenFixture.buildings.features).then((states) => {
      if (!cancelled) setBuildings(states);
    });
    return () => { cancelled = true; };
  }, []);

  const resolvedIds = useMemo(() => new Set(Object.keys(buildings ?? {})), [buildings]);

  return {
    buildings,
    footprints: loenenFixture.buildings as unknown as FootprintCollection,
    objectIds: OBJECT_IDS,
    resolvedIds,
  };
}

export type { SurfaceGeometry };

/** One building's bundled envelope polygons; no surfaces when none are bundled for `objectId`. */
export function surfaceGeometry(objectId: string | undefined): SurfaceGeometry {
  const fixture = objectId ? SURFACE_FIXTURE[objectId] : undefined;
  return { surfaces: fixture ? surfacesFromGeometryResponse([fixture]) : [] };
}

/** One bundled building and its geometry, for working on the 3D view alone. Null while it is adapted. */
export function useFixtureBuilding(osmId: string): { building: BuildingState; geometry: SurfaceGeometry } | null {
  const [building, setBuilding] = useState<BuildingState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const features = (loenenFixture.buildings.features as { properties: { osm_id: unknown } }[])
      .filter((feature) => String(feature.properties.osm_id) === osmId);
    buildStates(features).then((states) => {
      if (cancelled) return;
      if (!states[osmId]) throw new Error(`No bundled Loenen building with osm_id ${osmId}`);
      setBuilding(states[osmId]);
    });
    return () => { cancelled = true; };
  }, [osmId]);

  const geometry = useMemo(() => surfaceGeometry(OBJECT_IDS[osmId]), [osmId]);
  return building ? { building, geometry } : null;
}
