// Bottom bar of the configurator panel: reset draft / run recalculation.

import React from 'react';
import { RotateCcw, Check } from 'lucide-react';

export interface ConfiguratorFooterProps {
  onReset: () => void;
  onRecalculate: () => void;
  isRunningSimulation: boolean;
}

export function ConfiguratorFooter({ onReset, onRecalculate, isRunningSimulation }: ConfiguratorFooterProps) {
  return (
    <div className="border-t border-border/80 bg-slate-50 px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-slate-50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-100 hover:bg-muted"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={onRecalculate}
            disabled={isRunningSimulation}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors duration-100 hover:bg-primary/90 shadow-[0_10px_20px_rgba(47,93,138,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="size-3.5" />
            {isRunningSimulation ? 'Running simulation…' : 'Recalculate'}
          </button>
        </div>
      </div>
    </div>
  );
}
