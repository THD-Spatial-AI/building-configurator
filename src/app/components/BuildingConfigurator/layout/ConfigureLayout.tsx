// Configure workspace: 3D preview + preliminary demand (left) | surface/tech
// editor + group selector (right).

import React from 'react';
import { BuildingVisualization } from '../configure/visualization/BuildingVisualization';
import type { FaceGroup, BuildingElement } from '../configure/model/buildingElements';
import { ScrollHintContainer } from '../shared/ui';
import { SurfaceGroupSelector, type SurfaceGroupSelectorProps } from '../configure/surfaces/SurfaceGroupSelector';
import { EnergyDemandCard, type EnergyDemandCardProps } from './EnergyDemandCard';
import { ConfigurePanel, type ConfigurePanelProps } from './ConfigurePanel';

export interface ConfigureLayoutProps {
  elements: Record<string, BuildingElement>;
  selectedGroup: FaceGroup | null;
  onSelectGroup: (group: FaceGroup) => void;
  vizViewIndex: number;
  onViewChange: (index: number) => void;

  energyDemand: EnergyDemandCardProps;

  uploadError: string | null;
  onClearUploadError: () => void;
  pvInvalidated: boolean;
  onClearPvInvalidated: () => void;

  panelView: string;
  selectedId: string | null;
  panel: ConfigurePanelProps;
  selector: SurfaceGroupSelectorProps;
}

export function ConfigureLayout({
  elements, selectedGroup, onSelectGroup, vizViewIndex, onViewChange,
  energyDemand, uploadError, onClearUploadError, pvInvalidated, onClearPvInvalidated,
  panelView, selectedId, panel, selector,
}: ConfigureLayoutProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[430px_minmax(0,1fr)] overflow-hidden">

      {/* ── Left column: 3D preview + preliminary energy demand ── */}
      <aside className="flex min-h-0 flex-col overflow-hidden border-r border-border/80 bg-slate-50/80">

        {/* 3D preview — takes all remaining vertical space */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border/60 bg-slate-50">
          <div className="shrink-0 px-4 pt-3 pb-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground">
              3D Preview
            </p>
            <div className="mt-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 flex flex-col gap-0.5">
              <p className="text-[11px] font-semibold text-blue-700">How to use</p>
              <p className="text-[10px] text-blue-600 leading-snug">Click any surface to select it · Use the arrow buttons to rotate the view</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
            <BuildingVisualization
              elements={elements}
              selectedGroup={selectedGroup}
              onSelectGroup={onSelectGroup}
              viewIndex={vizViewIndex}
              onViewChange={onViewChange}
            />
          </div>
        </div>

        <EnergyDemandCard {...energyDemand} />
      </aside>

      {/* ── Right column: group editor (main) + group selector (narrow sidebar) ── */}
      <section className="flex min-h-0 flex-row overflow-hidden">

        {/* Center panel — building editor or surface editor */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
          {uploadError && (
            <div className="m-3 mb-0 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
              <p className="flex-1 text-[11px] leading-snug text-destructive">{uploadError}</p>
              <button
                type="button"
                onClick={onClearUploadError}
                className="shrink-0 cursor-pointer text-sm leading-none text-destructive"
              >×</button>
            </div>
          )}
          {/* PV invalidation warning — shown after a roof type change removes PV surfaces */}
          {pvInvalidated && (
            <div className="m-3 mb-0 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="flex-1 text-[11px] leading-snug text-amber-700">
                One or more roof surfaces with PV installed were replaced by the new roof type.
                Please reassign PV to the updated roof surfaces.
              </p>
              <button
                type="button"
                onClick={onClearPvInvalidated}
                className="shrink-0 cursor-pointer text-sm leading-none text-amber-600"
              >×</button>
            </div>
          )}

          <div key={`${panelView}-${selectedId ?? ''}`} className="flex min-h-0 flex-1 flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            <ConfigurePanel {...panel} />
          </div>
        </div>

        {/* Panel selector column */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border/60 bg-slate-50/60">
          <ScrollHintContainer>
            <SurfaceGroupSelector {...selector} />
          </ScrollHintContainer>
        </div>

      </section>

    </div>
  );
}
