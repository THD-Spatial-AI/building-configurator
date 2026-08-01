// Top bar of the configurator panel: building identity, basic/expert toggle,
// overview/configure switch, and the export/import/close actions.

import React from 'react';
import { Download, Upload, X, Building2, LayoutDashboard, SlidersHorizontal } from 'lucide-react';
import { SegmentedControl } from '../shared/ui';
import { cn } from '@/lib/utils';
import { formatCoordinates } from '../../../lib/buemAdapter';

function HeaderBtn({
  onClick, children, tooltip,
}: { onClick?: () => void; children: React.ReactNode; tooltip?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className="size-7 flex items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted transition-colors duration-100 shrink-0 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

export interface ConfiguratorHeaderProps {
  buildingLabel: string;
  buildingType: string;
  coordinates: [number, number];
  workspaceView: 'overview' | 'configure';
  onWorkspaceViewChange: (view: 'overview' | 'configure') => void;
  mode: 'basic' | 'expert';
  onModeChange: (mode: 'basic' | 'expert') => void;
  onDownload: () => void;
  onUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRequestClose?: () => void;
}

export function ConfiguratorHeader({
  buildingLabel, buildingType, coordinates, workspaceView, onWorkspaceViewChange,
  mode, onModeChange, onDownload, onUploadClick, fileInputRef, onUploadChange, onRequestClose,
}: ConfiguratorHeaderProps) {
  return (
    <div className="h-[52px] shrink-0 px-4 flex items-center gap-3 bg-card border-b border-border">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="size-7 bg-foreground rounded-md flex items-center justify-center shrink-0">
          <Building2 className="size-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground leading-tight">{buildingLabel} · {buildingType}</p>
            <span className={cn(
              'shrink-0 flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest',
              workspaceView === 'overview'
                ? 'bg-slate-100 text-slate-500'
                : 'bg-primary/10 text-primary',
            )}>
              {workspaceView === 'overview' ? <LayoutDashboard className="size-3" /> : <SlidersHorizontal className="size-3" />}
              {workspaceView === 'overview' ? 'Overview' : 'Configure'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">{formatCoordinates(coordinates[0], coordinates[1])}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <SegmentedControl
          options={[{ value: 'basic', label: 'Basic' }, { value: 'expert', label: 'Expert' }]}
          value={mode}
          onChange={(v) => onModeChange(v as 'basic' | 'expert')}
        />
        <button
          type="button"
          onClick={() => onWorkspaceViewChange(workspaceView === 'overview' ? 'configure' : 'overview')}
          className={cn(
            'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-sm',
            workspaceView === 'overview'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-slate-700 text-white hover:bg-slate-600',
          )}
        >
          {workspaceView === 'overview'
            ? <><SlidersHorizontal className="size-3.5" /> Open Configurator</>
            : <><LayoutDashboard className="size-3.5" /> Back to Overview</>}
        </button>
        <div className="w-px h-5 bg-border shrink-0 mx-1" />
        <HeaderBtn onClick={onDownload} tooltip="Export as BUEM GeoJSON"><Download /></HeaderBtn>
        <HeaderBtn onClick={onUploadClick} tooltip="Import BUEM or legacy JSON"><Upload /></HeaderBtn>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onUploadChange} />
        <div className="w-px h-5 bg-border shrink-0 mx-1" />
        {onRequestClose && (
          <HeaderBtn onClick={onRequestClose} tooltip="Close"><X /></HeaderBtn>
        )}
      </div>
    </div>
  );
}
