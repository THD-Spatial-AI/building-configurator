// Right column of the Overview view: load profile chart and element composition accordion.

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadProfileViewer, type LoadDataPoint } from './LoadProfileViewer';
import type { BuildingElement } from '../configure/BuildingVisualization';
import type { RoofConfig } from '../configure/RoofConfigurator';
import { ElementCompositionSection } from './ElementCompositionSection';

export interface EnergyEnvelopeColumnProps {
  uploadError: string | null;
  onClearError: () => void;
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  onSelectElement: (id: string) => void;
  onUpdateElement: (id: string, patch: Partial<BuildingElement>) => void;
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
  roofConfig,
  isActive,
  buildingId,
  initialTimeseries,
  onSwitchToConfigure,
  mode,
}: EnergyEnvelopeColumnProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const [hasMore, setHasMore] = useState(false);

  // Recheck scroll indicator whenever content height changes (accordion expand/collapse).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setHasMore(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isActive]);

  return (
    <div className="relative min-h-0 overflow-hidden">
      <section
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setHasMore(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
        }}
        className="flex h-full flex-col overflow-y-auto bg-slate-100
          [&::-webkit-scrollbar]:w-2.5
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-slate-300
          hover:[&::-webkit-scrollbar-thumb]:bg-slate-400"
      >
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
            roofConfig={roofConfig}
            onSwitchToConfigure={onSwitchToConfigure}
          />
        </div>
      </section>

      {/* Floating scroll-down indicator */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-end transition-opacity duration-300',
          hasMore ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="h-16 w-full bg-gradient-to-t from-white/80 to-transparent" />
        <button
          type="button"
          aria-label="Scroll down"
          onClick={() => scrollRef.current?.scrollBy({ top: 200, behavior: 'smooth' })}
          className="pointer-events-auto absolute bottom-4 right-5 flex size-7 items-center justify-center rounded-md border border-slate-200 bg-white shadow-md text-muted-foreground transition-colors hover:bg-slate-50 hover:text-foreground [&_svg]:size-4"
        >
          <ChevronDown />
        </button>
      </div>
    </div>
  );
}
