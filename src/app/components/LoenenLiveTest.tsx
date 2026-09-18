/**
 * EnerPlanET backend integration test: fetches a real PyLovo grid + real
 * City2TABULA envelope enrichment for the fixed Loenen smoke area, plots the
 * buildings on a real map, and opens the existing BuildingConfigurator with
 * the merged result — see city2tabulaAdapter.ts for the merge.
 *
 * Falls back to the bundled fixture (src/assets/data/loenen_live_fixture.json,
 * a trimmed real capture of both calls) when the backend isn't reachable, so
 * this stays demoable without the full local stack running. The banner always
 * says which one is showing.
 */

import { useCallback, useMemo, useState } from 'react';
import { Satellite, Loader2, AlertTriangle } from 'lucide-react';
import { BuildingConfigurator } from './BuildingConfigurator';
import { LoenenLiveMap, LOENEN_BBOX } from './LoenenLiveMap';
import { useConfiguratorApi } from '../lib/provider';
import { ensureDemoSession } from '../../demoClient';
import { buildBuildingStates } from '../lib/city2tabulaAdapter';
import type { IgnisApi } from '../lib/ignisApi';
import type { BuildingState } from '../lib/buemAdapter';
import { hasInvalidArea } from './BuildingConfigurator/configure/model/buildingElements';
import loenenFixture from '../../assets/data/loenen_live_fixture.json';

type FootprintCollection = { type: 'FeatureCollection'; features: unknown[] };

type LoadState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'live'; buildings: Record<string, BuildingState>; footprints: FootprintCollection }
  | { phase: 'fixture'; reason: string; buildings: Record<string, BuildingState>; footprints: FootprintCollection }
  | { phase: 'error'; message: string };

function loenenBboxPolygon() {
  const { xmin, ymin, xmax, ymax } = LOENEN_BBOX;
  return {
    type: 'Polygon' as const,
    coordinates: [[[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]]],
  };
}

function buildFromFixture(ignis: IgnisApi): Promise<Record<string, BuildingState>> {
  return buildBuildingStates(
    ignis,
    loenenFixture.buildings as unknown as Parameters<typeof buildBuildingStates>[1],
    loenenFixture.enrich.data as unknown as Parameters<typeof buildBuildingStates>[2],
  );
}

export function LoenenLiveTest() {
  const { enerplanet, ignis } = useConfiguratorApi();
  const [state, setState] = useState<LoadState>({ phase: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      await ensureDemoSession();
      const grid = await enerplanet.generateGrid(loenenBboxPolygon());
      const osmIds = grid.buildings.features.map((f) => String((f.properties as { osm_id: string }).osm_id));
      const enrich = await enerplanet.enrichBuildings('netherlands', LOENEN_BBOX, osmIds);

      const buildings = await buildBuildingStates(
        ignis,
        grid.buildings as unknown as Parameters<typeof buildBuildingStates>[1],
        enrich.data,
      );
      setState({ phase: 'live', buildings, footprints: grid.buildings as FootprintCollection });
    } catch (err) {
      // Any failure (auth, network, CORS, backend down) falls back to the fixture
      // rather than leaving the tester with a dead screen.
      const message = err instanceof Error ? err.message : String(err);
      setState({ phase: 'fixture', reason: message, buildings: await buildFromFixture(ignis), footprints: loenenFixture.buildings as unknown as FootprintCollection });
    }
  }, [enerplanet, ignis]);

  const buildings = state.phase === 'live' || state.phase === 'fixture' ? state.buildings : null;
  const footprints = state.phase === 'live' || state.phase === 'fixture' ? state.footprints : null;
  const resolvedIds = useMemo(() => new Set(Object.keys(buildings ?? {})), [buildings]);
  const problematicIds = useMemo(() => new Set(
    Object.entries(buildings ?? {})
      .filter(([, state]) => Object.values(state.envelope).some(hasInvalidArea))
      .map(([osmId]) => osmId),
  ), [buildings]);
  const selectedBuilding = selectedId && buildings ? buildings[selectedId] : undefined;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {state.phase === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={load}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(47,93,138,0.22)] transition-colors duration-100 hover:bg-primary/90"
          >
            <Satellite className="size-4" />
            Load Loenen from EnerPlanET backend
          </button>
        </div>
      )}

      {state.phase === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-md bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading grid + envelope data…
          </div>
        </div>
      )}

      {footprints && (
        <LoenenLiveMap
          buildings={footprints}
          resolvedIds={resolvedIds}
          problematicIds={problematicIds}
          onBuildingClick={setSelectedId}
        />
      )}

      {problematicIds.size > 0 && (
        <div className="absolute bottom-3 left-3 z-[5] flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: '#dc2626' }} />
          {problematicIds.size} building{problematicIds.size > 1 ? 's' : ''} with a surface simulations will reject
        </div>
      )}

      {state.phase === 'fixture' && (
        <div className="absolute top-14 left-3 right-3 z-[5] flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm">
          <AlertTriangle className="size-3.5 shrink-0" />
          Showing bundled fixture data — live backend unreachable ({state.reason}).
        </div>
      )}

      {selectedId && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)',
        }}>
          <BuildingConfigurator onClose={() => setSelectedId(null)} buildingData={selectedBuilding} />
        </div>
      )}
    </div>
  );
}
