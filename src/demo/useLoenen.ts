// Loading for the Loenen smoke area: the PyLovo grid + City2TABULA envelope
// enrichment for every building, and the 3D surface geometry for one at a time.
//
// Both fall back to the bundled captures (src/assets/data/loenen_*_fixture.json)
// when the backend is unreachable, so the views stay demoable without the full
// local stack; the returned phase/note says which one is in hand.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureDemoSession } from '../demoClient';
import { demoHttp } from '../demoClient';
import { createEnerplanetApi } from './enerplanetApi';
import { demoServices } from './services';
import { buildBuildingStates } from '../app/lib/city2tabulaAdapter';
import { surfacesFromGeometryResponse, type SurfaceGeometry } from '../app/lib/surfaceMesh';
import { hasInvalidArea } from '../app/components/BuildingConfigurator/configure/model/buildingElements';
import { LOENEN_BBOX } from '../app/components/LoenenLiveMap';
import type { BuildingGeometry, EnrichEntry } from '../app/lib/enerplanet';
import type { BuildingState } from '../app/lib/buemAdapter';
import loenenFixture from '../assets/data/loenen_live_fixture.json';
import surfaceFixture from '../assets/data/loenen_surfaces_fixture.json';

const demoEnerplanet = createEnerplanetApi(demoHttp);

const SURFACE_FIXTURE = surfaceFixture as unknown as Record<string, BuildingGeometry>;

export const LOENEN_COUNTRY = 'netherlands';

export type FootprintCollection = { type: 'FeatureCollection'; features: unknown[] };

type LoadState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'live'; buildings: Record<string, BuildingState>; footprints: FootprintCollection; objectIds: Record<string, string> }
  | { phase: 'fixture'; reason: string; buildings: Record<string, BuildingState>; footprints: FootprintCollection; objectIds: Record<string, string> };

/** City2TABULA building id per osm_id. The geometry endpoint is keyed by
 * object_id, while everything else here is keyed by osm_id. */
function objectIdsFrom(enrichData: Record<string, EnrichEntry>): Record<string, string> {
  return Object.fromEntries(Object.entries(enrichData).map(([osmId, entry]) => [osmId, entry.object_id]));
}

function loenenBboxPolygon() {
  const { xmin, ymin, xmax, ymax } = LOENEN_BBOX;
  return {
    type: 'Polygon' as const,
    coordinates: [[[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]]],
  };
}

function buildFromFixture(): Promise<Record<string, BuildingState>> {
  return buildBuildingStates(
    demoServices,
    loenenFixture.buildings as unknown as Parameters<typeof buildBuildingStates>[1],
    loenenFixture.enrich.data as unknown as Parameters<typeof buildBuildingStates>[2],
  );
}

/** The whole area's buildings, loaded on demand by calling `load`. */
export function useLoenenBuildings() {
  const [state, setState] = useState<LoadState>({ phase: 'idle' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      await ensureDemoSession();
      const grid = await demoEnerplanet.generateGrid(loenenBboxPolygon());
      const osmIds = grid.buildings.features.map((f) => String((f.properties as { osm_id: string }).osm_id));
      const enrich = await demoEnerplanet.enrichBuildings(LOENEN_BBOX, osmIds, LOENEN_COUNTRY);

      const buildings = await buildBuildingStates(
        demoServices,
        grid.buildings as unknown as Parameters<typeof buildBuildingStates>[1],
        enrich.data,
      );
      setState({
        phase: 'live',
        buildings,
        footprints: grid.buildings as FootprintCollection,
        objectIds: objectIdsFrom(enrich.data),
      });
    } catch (err) {
      // Any failure (auth, network, CORS, backend down) falls back to the fixture
      // rather than leaving the tester with a dead screen.
      setState({
        phase: 'fixture',
        reason: err instanceof Error ? err.message : String(err),
        buildings: await buildFromFixture(),
        footprints: loenenFixture.buildings as unknown as FootprintCollection,
        objectIds: objectIdsFrom(loenenFixture.enrich.data as unknown as Record<string, EnrichEntry>),
      });
    }
  }, []);

  const loaded = state.phase === 'live' || state.phase === 'fixture' ? state : null;
  const buildings = loaded?.buildings ?? null;

  const resolvedIds = useMemo(() => new Set(Object.keys(buildings ?? {})), [buildings]);
  const problematicIds = useMemo(() => new Set(
    Object.entries(buildings ?? {})
      .filter(([, building]) => Object.values(building.envelope).some(hasInvalidArea))
      .map(([osmId]) => osmId),
  ), [buildings]);

  return {
    phase: state.phase,
    fixtureReason: state.phase === 'fixture' ? state.reason : null,
    buildings,
    footprints: loaded?.footprints ?? null,
    objectIds: loaded?.objectIds ?? {},
    resolvedIds,
    problematicIds,
    load,
  };
}

export type { SurfaceGeometry };

/**
 * One building's envelope polygons, fetched when `objectId` changes and cached
 * for the life of the calling view. Null while a fetch is in flight.
 */
export function useSurfaceGeometry(objectId: string | undefined, country = LOENEN_COUNTRY): SurfaceGeometry | null {
  const [geometry, setGeometry] = useState<SurfaceGeometry | null>(null);
  // The buildings load once per view mount, so everything cached here is one
  // City2TABULA generation.
  const cache = useRef(new Map<string, BuildingGeometry | null>()).current;

  useEffect(() => {
    if (!objectId) {
      setGeometry(null);
      return;
    }

    const toGeometry = (building: BuildingGeometry | null): SurfaceGeometry =>
      ({ surfaces: building ? surfacesFromGeometryResponse([building]) : [] });

    // An absent entry reads as undefined, so a cached "no geometry" null is a
    // hit rather than a miss.
    const cached = cache.get(objectId);
    if (cached !== undefined) {
      setGeometry(toGeometry(cached));
      return;
    }

    let cancelled = false;
    setGeometry(null);
    demoEnerplanet.getSurfaceGeometry(objectId, country)
      .then((building) => {
        if (cancelled) return;
        // Only a successful answer is cached: a failure falls through to the
        // bundled geometry below and must be retried on the next selection.
        cache.set(objectId, building);
        setGeometry(toGeometry(building));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const reason = err instanceof Error ? err.message : String(err);
        const fallback = SURFACE_FIXTURE[objectId];
        setGeometry(fallback
          ? { surfaces: surfacesFromGeometryResponse([fallback]), note: `Showing bundled geometry. Live backend unreachable (${reason}).` }
          : { surfaces: [], note: reason });
      });

    return () => { cancelled = true; };
  }, [cache, objectId, country]);

  return geometry;
}

/**
 * One bundled building and its bundled geometry, with no EnerPlanET calls, for
 * working on the 3D view without loading the area. Null while it is adapted.
 */
export function useFixtureBuilding(osmId: string): { building: BuildingState; geometry: SurfaceGeometry } | null {
  const [building, setBuilding] = useState<BuildingState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const features = (loenenFixture.buildings.features as { properties: { osm_id: unknown } }[])
      .filter((feature) => String(feature.properties.osm_id) === osmId);
    buildBuildingStates(
      demoServices,
      { features } as unknown as Parameters<typeof buildBuildingStates>[1],
      loenenFixture.enrich.data as unknown as Parameters<typeof buildBuildingStates>[2],
    ).then((states) => {
      if (cancelled) return;
      if (!states[osmId]) throw new Error(`No bundled Loenen building with osm_id ${osmId}`);
      setBuilding(states[osmId]);
    });
    return () => { cancelled = true; };
  }, [osmId]);

  const objectId = (loenenFixture.enrich.data as unknown as Record<string, EnrichEntry>)[osmId]?.object_id;
  const geometry = useMemo<SurfaceGeometry>(() => {
    const fixture = objectId ? SURFACE_FIXTURE[objectId] : undefined;
    return { surfaces: fixture ? surfacesFromGeometryResponse([fixture]) : [] };
  }, [objectId]);

  return building ? { building, geometry } : null;
}
