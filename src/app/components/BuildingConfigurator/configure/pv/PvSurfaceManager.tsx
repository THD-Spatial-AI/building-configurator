import { ChevronRight, Sun } from 'lucide-react';

import type { PvConfig } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';

interface PvSurfaceEntry {
  element: BuildingElement;
  pv: PvConfig;
}

interface PvSurfaceManagerProps {
  surfaces: PvSurfaceEntry[];
  totalCapacityKw: number;
  mode: 'basic' | 'expert';
  onEditSurface: (surfaceId: string) => void;
}

function compassDir(azimuth: number): string {
  const dirs: Array<[number, string]> = [
    [22.5, 'N'], [67.5, 'NE'], [112.5, 'E'], [157.5, 'SE'],
    [202.5, 'S'], [247.5, 'SW'], [292.5, 'W'], [337.5, 'NW'],
  ];
  return dirs.find(([limit]) => azimuth < limit)?.[1] ?? 'N';
}

function effectiveGeometry(element: BuildingElement, pv: PvConfig) {
  return pv.geometryMode === 'surface'
    ? { tilt: element.tilt, azimuth: element.azimuth }
    : { tilt: pv.tilt, azimuth: pv.azimuth };
}

/**
 * Middle-panel manager for PV systems distributed across multiple surfaces.
 * It summarizes all installed PV surfaces and routes edits back to the surface PV tab.
 */
export function PvSurfaceManager({
  surfaces,
  totalCapacityKw,
  mode,
  onEditSurface,
}: PvSurfaceManagerProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-yellow-50">
          <Sun className="size-5 text-yellow-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-800">PV Surfaces</p>
          <p className="text-[11px] text-muted-foreground">
            {surfaces.length} configured {surfaces.length === 1 ? 'surface' : 'surfaces'} · {totalCapacityKw.toFixed(1)} kWp total
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Installed surfaces</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{surfaces.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Total capacity</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{totalCapacityKw.toFixed(1)} <span className="text-sm font-semibold text-slate-500">kWp</span></p>
        </div>
      </div>

      {surfaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-white shadow-sm">
            <Sun className="size-5 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No PV systems configured yet</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Select a roof or facade surface and enable PV in that surface&apos;s PV tab.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {surfaces.map(({ element, pv }) => {
            const geometry = effectiveGeometry(element, pv);
            return (
              <div
                key={element.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-yellow-50">
                    <Sun className="size-4 text-yellow-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{element.label}</p>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {element.type}
                      </span>
                      {pv.geometryMode === 'manual' && (
                        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Custom geometry
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Capacity</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-700">{pv.system_capacity.toFixed(1)} kWp</p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Host area</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-700">{element.area.toFixed(1)} m²</p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Orientation</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-700">
                          {geometry.tilt}° · {compassDir(geometry.azimuth)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Estimated panel area</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-700">{(pv.system_capacity * 6.5).toFixed(1)} m²</p>
                      </div>
                    </div>

                    {mode === 'expert' && (
                      <p className="mt-2 text-[10px] text-slate-400">
                        Losses {Math.round(pv.losses * 100)}% · Inverter {Math.round(pv.inv_eff * 100)}% · Lifetime {pv.cont_lifetime} years
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onEditSurface(element.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                  >
                    Edit
                    <ChevronRight className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}