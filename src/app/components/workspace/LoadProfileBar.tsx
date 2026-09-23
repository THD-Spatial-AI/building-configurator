// The load profile as data rather than a chart: where the current profile came
// from, and the two things done with it. Hourly only, which is the resolution
// the whole stack runs at.

import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { useLoadProfileState } from '../BuildingConfigurator/overview/useLoadProfileState';
import type { LoadDataPoint } from '../../lib/loadProfile';

interface LoadProfileBarProps {
  buildingId: string;
  /** The model's hourly profile, replaced by whatever the user uploads. */
  timeseries?: LoadDataPoint[];
  onGroundTruthChange?: (rows: LoadDataPoint[] | null, label: string | null) => void;
}

export function LoadProfileBar({ buildingId, timeseries, onGroundTruthChange }: LoadProfileBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    handleDownload, handleFileUpload, hasData, sourceCaption, uploadError,
  } = useLoadProfileState({
    buildingId,
    initialTimeseries: timeseries,
    initialResolution: 'hourly',
    onGroundTruthChange,
  });

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-slate-700">Hourly load profile</p>
          <p className="truncate text-[10px] text-muted-foreground">{sourceCaption}</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Upload className="size-3" />
          Upload
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!hasData}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="size-3" />
          Download
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {uploadError && (
        <p className="text-[10px] leading-snug text-destructive">{uploadError}</p>
      )}
    </div>
  );
}
