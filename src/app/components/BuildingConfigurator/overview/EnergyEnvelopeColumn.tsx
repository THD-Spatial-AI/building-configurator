// Right column of the Overview view: load profile chart and element composition accordion.

import React from 'react';
import { cn } from '@/lib/utils';
import { ScrollHintContainer } from '@/app/components/BuildingConfigurator/shared/ui';
import { LoadProfileViewer, type LoadDataPoint } from './LoadProfileViewer';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { RoofConfig } from '@/app/components/BuildingConfigurator/configure/model/roof';
import { ElementCompositionSection } from './ElementCompositionSection';

export interface EnergyEnvelopeColumnProps {
  uploadError: string | null;
  onClearError: () => void;
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  onSelectElement: (id: string) => void;
  onUpdateElement: (id: string, patch: Partial<BuildingElement>) => void;
  onEnableCustomMode: (id: string) => void;
  roofConfig: RoofConfig;
  /** Re-triggers the scroll indicator check when the panel becomes visible. */
  isActive: boolean;
  buildingId: string;
  /** Pre-seeded hourly timeseries from the model. Null means no model data yet. */
  initialTimeseries: LoadDataPoint[] | null;
  onSwitchToConfigure: (elementId: string) => void;
  mode: 'basic' | 'expert';
}

/** Right panel of the overview: energy chart primary, element composition secondary. */
export function EnergyEnvelopeColumn({
  uploadError,
  onClearError,
  elements,
  selectedId,
  onSelectElement,
  onUpdateElement,
  onEnableCustomMode,
  roofConfig,
  isActive,
  buildingId,
  initialTimeseries,
  onSwitchToConfigure,
  mode,
}: EnergyEnvelopeColumnProps) {
  return (
    <ScrollHintContainer className="flex flex-col bg-slate-100
        [&::-webkit-scrollbar]:w-2.5
        [&::-webkit-scrollbar-track]:bg-transparent
        [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-slate-300
        hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
      <section>
        {uploadError && (
          <div className="mx-4 mt-4 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="flex-1 text-[11px] leading-snug text-destructive">{uploadError}</p>
            <button
              type="button"
              onClick={onClearError}
              className="shrink-0 cursor-pointer text-sm leading-none text-destructive"
            >×</button>
          </div>
        )}

        {/* ── Load profile — grows to fill available space ── */}
        <div className="min-h-[240px] flex-1 bg-white px-2 pb-3 pt-2">
          <div className="h-full">
            <LoadProfileViewer
              buildingId={buildingId}
              initialTimeseries={initialTimeseries ?? undefined}
              mode={mode}
            />
          </div>
        </div>

        {/* ── Element composition — fixed size, scrolls when a group expands ── */}
        <div className="shrink-0 border-t border-border/60 px-4 pb-6 pt-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-semibold text-foreground">Envelope Composition</p>
            <p className="text-[11px] text-slate-400">Click a group to expand</p>
          </div>
          <ElementCompositionSection
            elements={elements}
            selectedId={selectedId}
            onSelect={onSelectElement}
            onUpdate={onUpdateElement}
            onEnableCustomMode={onEnableCustomMode}
            roofConfig={roofConfig}
            onSwitchToConfigure={onSwitchToConfigure}
          />
        </div>
      </section>

    </ScrollHintContainer>
  );
}
