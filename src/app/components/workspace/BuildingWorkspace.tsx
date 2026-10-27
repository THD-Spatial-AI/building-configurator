/**
 * Map first, one building at a time: the 2D map picks the building, the 3D view
 * takes the whole screen for as long as that building is being worked on, and
 * Escape returns to the map. Only the selected building's geometry is ever
 * fetched or rendered.
 */

import { useMemo, useState } from 'react';
import { Box, Loader2 } from '@/app/components/icons';
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
        <DemoBuildingView
          key={selectedId}
          osmId={selectedId}
          language={language}
          building={selectedBuilding}
          geometry={surfaceGeometry(selectedObjectId)}
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
export const FIXTURE_OSM_ID = '268428620';
/** Bundled Loenen building with a 51 m² flat roof and one at 3°, for racked PV. */
export const FLAT_ROOF_OSM_ID = '268425771';

/** The 3D view on one bundled building, opened straight away with no backend calls. */
export function FixtureWorkspace({ osmId, language }: { osmId: string; language: Language }) {
  const fixture = useFixtureBuilding(osmId);
  if (!fixture) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Adapting the bundled building…
      </div>
    );
  }
  return <FixtureView osmId={osmId} building={fixture.building} geometry={fixture.geometry} language={language} />;
}

function FixtureView({ osmId, building, geometry, language }: Pick<Parameters<typeof Building3DView>[0], 'building' | 'geometry'> & { osmId: string; language: Language }) {
  const [open, setOpen] = useState(true);
  /** What was saved on leaving, reopened in place of the bundled building. */
  const [saved, setSaved] = useState<BuildingState | null>(null);

  if (!open) {
    return (
      <div className="flex h-full items-center justify-center">
        <button
          onClick={() => setOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_20px_rgba(47,93,138,0.22)] transition-colors duration-100 hover:bg-primary/90"
        >
          <Box className="size-4" />
          Reopen building {osmId}
        </button>
      </div>
    );
  }

  return (
    <DemoBuildingView
      osmId={osmId}
      language={language}
      building={saved ?? building}
      geometry={geometry}
      onExit={(edited) => {
        if (edited) setSaved(edited);
        setOpen(false);
      }}
    />
  );
}

/** One bundled building with the dev shell playing host for its technologies and PV. */
const TOUR_SEEN_KEY = 'building-configurator-demo.tourSeen';

function DemoBuildingView({ osmId, building, geometry, language, onExit }: {
  osmId: string;
  building: BuildingState;
  geometry: Parameters<typeof Building3DView>[0]['geometry'];
  language: Language;
  onExit: (edited: BuildingState | undefined) => void;
}) {
  const pv = useDemoPvHost(building.envelope);
  const technologies = useDemoTechnologies();
  // The demo's own first-visit memory; a host keeps it with the user's account.
  const [tourRun, setTourRun] = useState(() => {
    try { return window.localStorage.getItem(TOUR_SEEN_KEY) !== '1'; } catch { return false; }
  });
  const tour = useMemo(() => ({
    run: tourRun,
    onFinish: () => {
      setTourRun(false);
      try { window.localStorage.setItem(TOUR_SEEN_KEY, '1'); } catch { /* the tour runs again next visit */ }
    },
  }), [tourRun]);

  return (
    <Building3DView
      language={language}
      building={building}
      geometry={geometry}
      services={fixtureServices}
      demandProfile={fixtureDemandProfile(osmId)}
      seriesCsvUrl={fixtureSeriesCsvUrl(osmId)}
      attribution={FIXTURE_ATTRIBUTION}
      pv={pv}
      technologies={technologies}
      tour={tour}
      onExit={onExit}
    />
  );
}
