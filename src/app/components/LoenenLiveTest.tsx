/**
 * EnerPlanET backend integration test: plots the Loenen smoke area's real
 * buildings on a map and opens the existing BuildingConfigurator dialog for the
 * one clicked, with its City2TABULA surface geometry. See useLoenen.ts for the
 * loading and city2tabulaAdapter.ts for the PyLovo/City2TABULA merge.
 *
 * The 3D workspace (BuildingWorkspace) is the successor to this view; both
 * stay until it covers everything the dialog does.
 */

import { Satellite, Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { BuildingConfigurator } from './BuildingConfigurator';
import { LoenenLiveMap } from './LoenenLiveMap';
import { useLoenenBuildings, useSurfaceGeometry } from '../lib/useLoenen';

export function LoenenLiveTest() {
  const data = useLoenenBuildings();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedBuilding = selectedId && data.buildings ? data.buildings[selectedId] : undefined;
  const selectedObjectId = selectedId ? data.objectIds[selectedId] : undefined;
  const geometry = useSurfaceGeometry(selectedObjectId);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {data.phase === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={data.load}
            className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(47,93,138,0.22)] transition-colors duration-100 hover:bg-primary/90"
          >
            <Satellite className="size-4" />
            Load Loenen from EnerPlanET backend
          </button>
        </div>
      )}

      {data.phase === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-md bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading grid + envelope data…
          </div>
        </div>
      )}

      {data.footprints && (
        <LoenenLiveMap
          buildings={data.footprints}
          resolvedIds={data.resolvedIds}
          problematicIds={data.problematicIds}
          onBuildingClick={setSelectedId}
        />
      )}

      {data.problematicIds.size > 0 && (
        <div className="absolute bottom-3 left-3 z-[5] flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: '#dc2626' }} />
          {data.problematicIds.size} building{data.problematicIds.size > 1 ? 's' : ''} with a surface simulations will reject
        </div>
      )}

      {data.fixtureReason && (
        <div className="absolute top-14 left-3 right-3 z-[5] flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm">
          <AlertTriangle className="size-3.5 shrink-0" />
          Showing bundled fixture data — live backend unreachable ({data.fixtureReason}).
        </div>
      )}

      {selectedId && selectedBuilding && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10, padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)',
        }}>
          <BuildingConfigurator
            onClose={() => setSelectedId(null)}
            buildingData={selectedBuilding}
            geometry={selectedObjectId ? geometry : { surfaces: [], note: `No City2TABULA building id for osm_id ${selectedId}, so no geometry can be fetched.` }}
          />
        </div>
      )}
    </div>
  );
}
