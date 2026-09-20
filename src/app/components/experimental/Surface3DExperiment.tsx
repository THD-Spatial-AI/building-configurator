/**
 * 3D surface view for one building: fetches its real City2TABULA envelope
 * polygons and renders them, so a surface is picked by clicking the building
 * rather than by reading a flat list.
 *
 * A surface id is the BuildingState element id (City2TABULA hands the same row
 * id to the geometry and the enrich responses), so a click resolves to the real
 * element with a lookup, not a geometric guess.
 *
 * Falls back to the bundled capture of the same call when the backend is
 * unreachable, the same arrangement LoenenLiveTest uses; the banner says which
 * one is showing.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { SurfaceGeometryViewer } from './SurfaceGeometryViewer';
import { useConfiguratorApi } from '../../lib/provider';
import { surfacesFromGeometryResponse, type SurfacePolygon } from '../../lib/surfaceMesh';
import { T } from '../BuildingConfigurator/shared/ui';
import type { BuildingGeometry } from '../../lib/enerplanetApi';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import surfaceFixture from '../../../assets/data/loenen_surfaces_fixture.json';

const FIXTURE = surfaceFixture as unknown as Record<string, BuildingGeometry>;

interface Surface3DExperimentProps {
  /** City2TABULA building id (EnrichEntry.object_id), not the osm_id. */
  objectId: string;
  country: string;
  /** The building's envelope, keyed by the same ids the surfaces carry. */
  elements: Record<string, BuildingElement>;
  onOpenSurface: (elementId: string) => void;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'live'; surfaces: SurfacePolygon[] }
  | { phase: 'fixture'; reason: string; surfaces: SurfacePolygon[] }
  | { phase: 'error'; message: string };

export function Surface3DExperiment({ objectId, country, elements, onOpenSurface }: Surface3DExperimentProps) {
  const { enerplanet } = useConfiguratorApi();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });
    setSelectedId(null);

    enerplanet.getSurfaceGeometry(objectId, country)
      .then((building) => {
        if (cancelled) return;
        if (!building) {
          setState({ phase: 'error', message: `City2TABULA holds no geometry for ${objectId}` });
          return;
        }
        setState({ phase: 'live', surfaces: surfacesFromGeometryResponse([building]) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const fallback = FIXTURE[objectId];
        if (!fallback) {
          setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
          return;
        }
        setState({
          phase: 'fixture',
          reason: err instanceof Error ? err.message : String(err),
          surfaces: surfacesFromGeometryResponse([fallback]),
        });
      });

    return () => { cancelled = true; };
  }, [enerplanet, objectId, country]);

  const surfaces = state.phase === 'live' || state.phase === 'fixture' ? state.surfaces : null;
  const selectedElement = selectedId ? elements[selectedId] : undefined;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {state.phase === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading surface geometry…
            </div>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {state.message}
          </div>
        )}

        {surfaces && (
          <SurfaceGeometryViewer
            surfaces={surfaces}
            onSelectSurface={(surface) => setSelectedId(surface?.id ?? null)}
          />
        )}

        {state.phase === 'fixture' && (
          <div className="absolute top-3 left-3 right-3 z-[5] flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm">
            <AlertTriangle className="size-3.5 shrink-0" />
            Showing bundled geometry. Live backend unreachable ({state.reason}).
          </div>
        )}
      </div>

      <div style={{ width: 280, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.card, padding: 16, overflowY: 'auto' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: T.foreground, margin: '0 0 8px' }}>Surface details</p>
        {selectedElement ? (
          <>
            <div style={{ fontSize: 12, color: T.foreground, lineHeight: 1.7 }}>
              {/* Not element.label: City2TABULA ids are UUIDs, which buemAdapter's
                  labelFromId passes through unchanged. */}
              <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedElement.type}</div>
              <div style={{ color: T.mutedFg }}>{selectedElement.area.toFixed(2)} m²</div>
              <div style={{ color: T.mutedFg }}>U {selectedElement.uValue.toFixed(2)} W/m²K</div>
              <div style={{ color: T.mutedFg }}>
                tilt {selectedElement.tilt.toFixed(0)}° · azimuth {selectedElement.azimuth.toFixed(0)}°
              </div>
            </div>
            <button
              onClick={() => onOpenSurface(selectedElement.id)}
              className="mt-3 w-full cursor-pointer rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90"
            >
              Configure this surface
            </button>
          </>
        ) : (
          <p style={{ fontSize: 12, color: T.mutedFg, lineHeight: 1.6 }}>
            {selectedId
              ? 'This surface has no matching envelope element, so there is nothing to configure.'
              : 'Drag to orbit. Click a surface to see its properties and open its configuration.'}
          </p>
        )}
      </div>
    </div>
  );
}
