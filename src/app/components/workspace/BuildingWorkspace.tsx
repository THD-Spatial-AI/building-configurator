/**
 * Map first, one building at a time: the 2D map picks the building, the 3D view
 * takes the whole screen for as long as that building is being worked on, and
 * Escape returns to the map. Only the selected building's geometry is ever
 * fetched or rendered.
 */

import { useState } from 'react';
import { AlertTriangle, Box, Loader2, Satellite } from 'lucide-react';
import { LoenenLiveMap } from '../LoenenLiveMap';
import { useFixtureBuilding, useLoenenBuildings, useSurfaceGeometry } from '../../lib/useLoenen';
import { Building3DView } from './Building3DView';
import type { BuildingState } from '../../lib/buemAdapter';

export function BuildingWorkspace() {
  const data = useLoenenBuildings();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Buildings saved on leaving the 3D view, by id; they replace the loaded ones on reopen. */
  const [edited, setEdited] = useState<Record<string, BuildingState>>({});

  const selectedBuilding = selectedId && data.buildings
    ? edited[selectedId] ?? data.buildings[selectedId]
    : undefined;
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
          <span className="inline-block size-2.5 rounded-sm bg-destructive" />
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
        <Building3DView
          key={selectedId}
          building={selectedBuilding}
          geometry={selectedObjectId ? geometry : { surfaces: [] }}
          onExit={(building) => {
            if (building && building !== data.buildings?.[selectedId]) {
              setEdited((prev) => ({ ...prev, [selectedId]: building }));
            }
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

/** Bundled Loenen building with surfaces that have no area, so every part of the 3D view has something to show. */
const FIXTURE_OSM_ID = '268428620';

/** The 3D view on one bundled building, opened straight away with no backend calls. */
export function FixtureWorkspace() {
  const fixture = useFixtureBuilding(FIXTURE_OSM_ID);
  const [open, setOpen] = useState(true);
  /** What was saved on leaving, reopened in place of the bundled building. */
  const [saved, setSaved] = useState<BuildingState | null>(null);

  if (!fixture) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Adapting the bundled building…
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex h-full items-center justify-center">
        <button
          onClick={() => setOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(47,93,138,0.22)] transition-colors duration-100 hover:bg-primary/90"
        >
          <Box className="size-4" />
          Reopen building {FIXTURE_OSM_ID}
        </button>
      </div>
    );
  }

  return (
    <Building3DView
      building={saved ?? fixture.building}
      geometry={fixture.geometry}
      onExit={(building) => {
        if (building) setSaved(building);
        setOpen(false);
      }}
    />
  );
}
