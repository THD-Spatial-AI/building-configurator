// The dev shell playing host for PV mode: it decides which surfaces to offer
// and what capacity they carry, and keeps the user's choices. A real host derives
// these from its own PV placement and stores them.

import { useCallback, useMemo, useState } from 'react';
import type { PvMode, PvSurface } from '../app/components/workspace/PvMode';
import type { PvMounting, PvOrientation } from '../app/lib/pvLayout';
import type { BuildingElement } from '../app/components/BuildingConfigurator/configure/model/buildingElements';

/** Demo module density; a real host takes it from the PV type. */
const KWP_PER_M2 = 0.2;

function capacity(area: number, usableShare: number): number {
  return Number((area * usableShare * KWP_PER_M2).toFixed(1));
}

/** Roofs facing east through west are suggested; the other roofs and every wall are offered without a highlight. */
function offered(elements: Record<string, BuildingElement>): Record<string, PvSurface> {
  const surfaces: Record<string, PvSurface> = {};
  for (const el of Object.values(elements)) {
    if ((el.type !== 'roof' && el.type !== 'wall') || !(el.area > 0)) continue;
    const southish = el.azimuth === -1 || (el.azimuth >= 90 && el.azimuth <= 270);
    const usableShare = el.type === 'roof' ? 0.6 : 0.4;
    surfaces[el.id] = {
      state: el.type === 'roof' && southish ? 'suggested' : 'available',
      usableShare,
      maxKwp: capacity(el.area, usableShare),
    };
  }
  return surfaces;
}

/** PV mode for one building, held in this component's state as a host would hold it. */
export function useDemoPvHost(elements: Record<string, BuildingElement>): PvMode {
  const initial = useMemo(() => offered(elements), [elements]);
  const [surfaces, setSurfaces] = useState(initial);

  const onToggle = useCallback((surfaceId: string, installed: boolean) => {
    setSurfaces((prev) => ({
      ...prev,
      // Switched off, a surface goes back to how it was first offered.
      [surfaceId]: { ...prev[surfaceId], state: installed ? 'installed' : initial[surfaceId].state },
    }));
  }, [initial]);

  const onShareChange = useCallback((surfaceId: string, usableShare: number) => {
    setSurfaces((prev) => ({
      ...prev,
      [surfaceId]: { ...prev[surfaceId], usableShare, maxKwp: capacity(elements[surfaceId].area, usableShare) },
    }));
  }, [elements]);

  const onMountingChange = useCallback((surfaceId: string, mounting: PvMounting, orientation: PvOrientation | undefined) => {
    setSurfaces((prev) => ({ ...prev, [surfaceId]: { ...prev[surfaceId], mounting, orientation } }));
  }, []);

  return useMemo(() => ({
    surfaces,
    notice: 'The simulation does not consider shading from trees or neighbouring buildings.',
    typeLabel: `Demo PV module, ${KWP_PER_M2} kWp/m²`,
    onToggle,
    onShareChange,
    onMountingChange,
  }), [surfaces, onToggle, onShareChange, onMountingChange]);
}
