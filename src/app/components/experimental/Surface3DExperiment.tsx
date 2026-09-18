// Standalone page for the 3D surface-viewer concept. Renders fixture geometry
// (no real per-surface endpoint exists yet) but resolves a click to the real
// building's matching element and opens its actual PV configuration —
// proving the click-to-configure flow end to end ahead of real geometry.
import { useState } from 'react';
import { SurfaceGeometryViewer } from './SurfaceGeometryViewer';
import { LOENEN_HOUSE_FIXTURE, resolveFixtureElementId } from '../../lib/surfaceGeometryFixture';
import { T } from '../BuildingConfigurator/shared/ui';
import type { SurfacePolygon } from '../../lib/surfaceMesh';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';

interface Surface3DExperimentProps {
  /** The real building's elements, used only to resolve a clicked fixture
   * surface to the real element whose PV configuration it should open. */
  elements: Record<string, BuildingElement>;
  onOpenSurface: (elementId: string) => void;
}

export function Surface3DExperiment({ elements, onOpenSurface }: Surface3DExperimentProps) {
  const [selected, setSelected] = useState<SurfacePolygon | null>(null);

  const handleSelect = (surface: SurfacePolygon | null) => {
    setSelected(surface);
    const elementId = surface ? resolveFixtureElementId(surface.id, elements) : undefined;
    if (elementId) onOpenSurface(elementId);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <SurfaceGeometryViewer surfaces={LOENEN_HOUSE_FIXTURE} onSelectSurface={handleSelect} />
        <div style={{
          position: 'absolute', top: 12, left: 12, maxWidth: 280,
          background: 'rgba(255,255,255,0.92)', borderRadius: 6, padding: '8px 10px',
          fontSize: 11, color: T.mutedFg, lineHeight: 1.5,
        }}>
          Experimental concept — drag to orbit, click a surface. Shape is
          fixture geometry, not the real building; a click opens the real
          PV editor for the closest-oriented actual surface.
        </div>
      </div>
      <div style={{ width: 280, flexShrink: 0, borderLeft: `1px solid ${T.border}`, background: T.card, padding: 16, overflowY: 'auto' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: T.foreground, margin: '0 0 8px' }}>Surface details</p>
        {selected ? (
          <div style={{ fontSize: 12, color: T.foreground, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600 }}>{selected.label}</div>
            <div style={{ color: T.mutedFg }}>{selected.type}</div>
            <div style={{ color: T.mutedFg, marginTop: 8, fontSize: 11 }}>id: {selected.id}</div>
            {!resolveFixtureElementId(selected.id, elements) && (
              <p style={{ color: T.mutedFg, marginTop: 8, fontSize: 11, lineHeight: 1.5 }}>
                Ground surfaces have no PV configuration to open.
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: T.mutedFg, lineHeight: 1.6 }}>
            Click a wall or roof surface on the building to open its real PV
            configuration.
          </p>
        )}
      </div>
    </div>
  );
}
