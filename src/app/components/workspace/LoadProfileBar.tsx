// The load profile as data rather than a chart: where the current profile came
// from, an upload that stays in the browser, and a download of the simulated
// profiles, built here or served by the host.
// Hourly only, which is the resolution the whole stack runs at.

import { useId, useRef, useState } from 'react';
import { Download, Upload } from '@/app/components/icons';
import { useLoadProfileState } from '../BuildingConfigurator/overview/useLoadProfileState';
import { profileCsv, type LoadDataPoint } from '../../lib/loadProfile';
import { useT } from '../../i18n';

interface LoadProfileBarProps {
  /** The model's hourly profile, replaced by whatever the user uploads. */
  timeseries?: LoadDataPoint[];
  /** The host's CSV of the building's stored series; no download without it. */
  seriesCsvUrl?: string;
  onGroundTruthChange?: (rows: LoadDataPoint[] | null, label: string | null) => void;
}

const PROFILE_FILE = 'hourly-profiles.csv';

/** Saves text as a CSV file through a temporary link. */
function downloadCsv(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function LoadProfileBar({ timeseries, seriesCsvUrl, onGroundTruthChange }: LoadProfileBarProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSoonId = useId();
  // A click shows the note too, where there is no hover, as on a touch screen.
  const [noteOpen, setNoteOpen] = useState(false);
  const {
    handleFileUpload, hasData, sourceCaption, uploadError,
  } = useLoadProfileState({
    initialTimeseries: timeseries,
    initialResolution: 'hourly',
    onGroundTruthChange,
  });

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <p className="m-0 shrink-0 text-[12px] font-semibold text-foreground">{t('profile.title')}</p>
          <p className="m-0 truncate text-[10px] text-muted-foreground">{!hasData && seriesCsvUrl ? t('profile.stored') : sourceCaption.aggregatedFrom
            ? t('profile.source.aggregated', {
              source: t(sourceCaption.source.key, sourceCaption.source.values),
              from: t(`profile.resolution.${sourceCaption.aggregatedFrom}`),
            })
            : t(sourceCaption.source.key, sourceCaption.source.values)}</p>
        </div>
        {/* TODO: open fileInputRef once the host supports uploaded profiles; the file input below is ready for it. */}
        <div className="group relative shrink-0" onMouseLeave={() => setNoteOpen(false)}>
          {/* aria-disabled, not disabled: a disabled button gets no hover or focus, so its note could not show. */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={uploadSoonId}
            onClick={() => setNoteOpen((open) => !open)}
            onBlur={() => setNoteOpen(false)}
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground opacity-60"
          >
            <Upload className="size-3" />
            {t('profile.upload')}
          </button>
          <p
            id={uploadSoonId}
            role="tooltip"
            className={`absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] leading-snug text-popover-foreground shadow-md ${noteOpen ? 'block' : 'hidden group-hover:block group-focus-within:block'}`}
          >
            {t('profile.uploadSoon')}
          </p>
        </div>
        {/* This building's own run first; the host's stored series where it has not run here. */}
        {timeseries?.length ? (
          <button
            type="button"
            title={t('profile.downloadTip')}
            onClick={() => downloadCsv(profileCsv(timeseries), PROFILE_FILE)}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Download className="size-3" />
            {t('profile.download')}
          </button>
        ) : seriesCsvUrl && (
          <a href={seriesCsvUrl} download title={t('profile.downloadTip')} className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted">
            <Download className="size-3" />
            {t('profile.download')}
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
        <p className="text-[10px] leading-snug text-destructive">{t(uploadError.key, uploadError.values)}</p>
      )}
    </div>
  );
}
