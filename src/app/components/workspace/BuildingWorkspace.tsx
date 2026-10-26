/**
 * Map first, one building at a time: the 2D map picks the building, the 3D view
 * takes the whole screen for as long as that building is being worked on, and
 * Escape returns to the map. Only the selected building's geometry is ever
 * fetched or rendered.
 */

import { useCallback, useMemo, useState } from 'react';
import { Box, Loader2 } from 'lucide-react';
import { LoenenLiveMap } from '../LoenenLiveMap';
import { surfaceGeometry, useFixtureBuilding, useLoenenBuildings } from '../../../demo/useLoenen';
import { fixtureDemandProfile, fixtureSeriesCsvUrl, fixtureServices } from '../../../demo/services';
import { FIXTURE_ATTRIBUTION, MAP_ATTRIBUTIONS } from '../../../demo/attribution';
import { useDemoPvHost } from '../../../demo/pvHost';
import { useDemoTechnologies } from '../../../demo/technologyHost';
import { Building3DView } from './Building3DView';
import type { BuildingState } from '../../lib/buemAdapter';
import type { Language } from '../../i18n';

export function BuildingWorkspace({ language }: { language: Language }) {
  const data = useLoenenBuildings();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Buildings saved on leaving the 3D view, by id; they replace the loaded ones on reopen. */
  const [edited, setEdited] = useState<Record<string, BuildingState>>({});

  const selectedBuilding = selectedId && data.buildings
    ? edited[selectedId] ?? data.buildings[selectedId]
    : undefined;
  const selectedObjectId = selectedId ? data.objectIds[selectedId] : undefined;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!data.buildings && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-md bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            Adapting the bundled buildings…
          </div>
        </div>
      )}

      {data.footprints && (
        <LoenenLiveMap
          buildings={data.footprints}
          resolvedIds={data.resolvedIds}
          onBuildingClick={setSelectedId}
          attributions={MAP_ATTRIBUTIONS}
        />
      )}

      {selectedId && selectedBuilding && (
        <Building3DView
          key={selectedId}
          language={language}
          building={selectedBuilding}
          geometry={surfaceGeometry(selectedObjectId)}
          services={fixtureServices}
          demandProfile={fixtureDemandProfile(selectedId)}
          seriesCsvUrl={fixtureSeriesCsvUrl(selectedId)}
          attribution={FIXTURE_ATTRIBUTION}
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

/**
 * The 3D view on one bundled building, opened straight away with no backend
 * calls. The dev shell plays the host for its technologies and PV: the PV
 * card's button opens PV mode, and leaving it returns to the normal view.
 */
export function FixtureWorkspace({ language }: { language: Language }) {
  const fixture = useFixtureBuilding(FIXTURE_OSM_ID);
  if (!fixture) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Adapting the bundled building…
      </div>
    );
  }
  return <FixtureView building={fixture.building} geometry={fixture.geometry} language={language} />;
}

function FixtureView({ building, geometry, language }: Pick<Parameters<typeof Building3DView>[0], 'building' | 'geometry'> & { language: Language }) {
  const [open, setOpen] = useState(true);
  const [pvOpen, setPvOpen] = useState(false);
  /** What was saved on leaving, reopened in place of the bundled building. */
  const [saved, setSaved] = useState<BuildingState | null>(null);
  const pv = useDemoPvHost(building.envelope);
  const openPv = useCallback(() => setPvOpen(true), []);
  const technologies = useDemoTechnologies(pv, openPv);
  const installedPvIds = useMemo(
    () => Object.entries(pv.surfaces).filter(([, surface]) => surface.state === 'installed').map(([id]) => id),
    [pv.surfaces],
  );
  const pvShares = useMemo(
    () => Object.fromEntries(Object.entries(pv.surfaces).map(([id, surface]) => [id, surface.usableShare])),
    [pv.surfaces],
  );

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

  if (pvOpen) {
    return (
      <Building3DView
        key="pv"
        language={language}
        building={saved ?? building}
        geometry={geometry}
        services={fixtureServices}
        attribution={FIXTURE_ATTRIBUTION}
        pv={pv}
        onExit={() => setPvOpen(false)}
      />
    );
  }

  return (
    <Building3DView
      key="normal"
      language={language}
      building={saved ?? building}
      geometry={geometry}
      services={fixtureServices}
      demandProfile={fixtureDemandProfile(FIXTURE_OSM_ID)}
      seriesCsvUrl={fixtureSeriesCsvUrl(FIXTURE_OSM_ID)}
      attribution={FIXTURE_ATTRIBUTION}
      pvSurfaceIds={installedPvIds}
      pvSurfaceShares={pvShares}
      technologies={technologies}
      onExit={(edited) => {
        if (edited) setSaved(edited);
        setOpen(false);
      }}
    />
  );
}
