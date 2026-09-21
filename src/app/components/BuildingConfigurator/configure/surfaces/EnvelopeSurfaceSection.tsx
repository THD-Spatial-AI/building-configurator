// The building's 3D envelope and the selected surface's editor, side by side,
// inside the overview's Building Envelope tab. Clicking a surface in the model
// is the whole path to editing it: no list to scan, no dialog to open.

import React, { useMemo } from 'react';
import { AlertTriangle, MousePointerClick } from 'lucide-react';
import { SurfaceGeometryViewer } from './SurfaceGeometryViewer';
import { isEnvelopeDetached, type SurfacePolygon } from '@/app/lib/surfaceMesh';
import {
  hasInvalidArea,
  type BuildingElement,
} from '@/app/components/BuildingConfigurator/configure/model/buildingElements';

interface EnvelopeSurfaceSectionProps {
  /** Envelope polygons, keyed by the same ids as `elements`. */
  surfaces: SurfacePolygon[];
  /** Why the geometry is not the live one, if it is not. */
  note?: string | null;
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  onSelectSurface: (id: string) => void;
  /** The selected surface's editor. */
  editorSlot?: React.ReactNode;
}

export function EnvelopeSurfaceSection({
  surfaces,
  note,
  elements,
  selectedId,
  onSelectSurface,
  editorSlot,
}: EnvelopeSurfaceSectionProps) {
  const envelopeIds = useMemo(() => new Set(Object.keys(elements)), [elements]);
  const invalidIds = useMemo(
    () => new Set(Object.values(elements).filter(hasInvalidArea).map((el) => el.id)),
    [elements],
  );
  const detached = isEnvelopeDetached(surfaces, envelopeIds);

  return (
    <div className="flex h-[340px] min-h-0 gap-3">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {surfaces.length > 0 && !detached ? (
          <SurfaceGeometryViewer
            surfaces={surfaces}
            selectedId={selectedId}
            invalidIds={invalidIds}
            visibleIds={envelopeIds}
            onSelectSurface={(id) => { if (id && elements[id]) onSelectSurface(id); }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[11px] leading-snug text-muted-foreground">
            {detached
              ? 'This geometry belongs to a different City2TABULA generation than the envelope, so no surface can be matched to it. Reload the buildings to fetch both from the current one.'
              : 'City2TABULA holds no 3D geometry for this building.'}
          </div>
        )}

        {note && (
          <div className="absolute inset-x-3 top-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900 shadow-sm">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {note}
          </div>
        )}

        {invalidIds.size > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 shadow-sm">
            <span className="inline-block size-2.5 rounded-sm bg-destructive" />
            {invalidIds.size} surface{invalidIds.size > 1 ? 's' : ''} a simulation would reject
          </div>
        )}
      </div>

      <div className="w-[460px] shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        {editorSlot ?? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <MousePointerClick className="size-5 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">No surface selected</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Click a surface in the model to edit it here. Red surfaces are missing
                an area a simulation needs.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
