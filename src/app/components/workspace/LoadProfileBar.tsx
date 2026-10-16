// The load profile as data rather than a chart: where the current profile came
// from, an upload that stays in the browser, and a download the host serves.
// Hourly only, which is the resolution the whole stack runs at.

import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { useLoadProfileState } from '../BuildingConfigurator/overview/useLoadProfileState';
import type { LoadDataPoint } from '../../lib/loadProfile';

interface LoadProfileBarProps {
  /** The model's hourly profile, replaced by whatever the user uploads. */
  timeseries?: LoadDataPoint[];
  /** The host's CSV of the building's stored series; no download without it. */
  seriesCsvUrl?: string;
  onGroundTruthChange?: (rows: LoadDataPoint[] | null, label: string | null) => void;
}

export function LoadProfileBar({ timeseries, seriesCsvUrl, onGroundTruthChange }: LoadProfileBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    handleFileUpload, hasData, sourceCaption, uploadError,
  } = useLoadProfileState({
    initialTimeseries: timeseries,
    initialResolution: 'hourly',
    onGroundTruthChange,
  });

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-slate-700">Hourly load profile</p>
          <p className="truncate text-[10px] text-muted-foreground">{!hasData && seriesCsvUrl ? 'Stored BuEM result' : sourceCaption}</p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Upload className="size-3" />
          Upload
        </button>
        {seriesCsvUrl && (
          <a
            href={seriesCsvUrl}
            download
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Download className="size-3" />
            Download
          </a>
        )}
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
