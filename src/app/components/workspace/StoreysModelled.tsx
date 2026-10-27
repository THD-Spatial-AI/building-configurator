// Which storeys of the building are in the model: one chip per storey from
// the ground up, at least one kept. Floor area and envelope follow them.

import { cn } from '@/lib/utils';
import { TOPICS } from '@/app/config/topics';
import { useFormatNumber, useT } from '../../i18n';
import { Switch } from './PvMode';
import { SectionCard } from '../BuildingConfigurator/shared/SectionCard';

/** The storeys modelled with one storey switched on or off; null when all are on, undefined when it would leave none. */
export function toggleStorey(modelled: number[] | null, storeys: number, storey: number): number[] | null | undefined {
  const all = Array.from({ length: storeys }, (_, i) => i + 1);
  const on = new Set(modelled ?? all);
  const next = all.filter((s) => (s === storey ? !on.has(s) : on.has(s)));
  if (next.length === 0) return undefined;
  return next.length === storeys ? null : next;
}

/** A storey picked in the model: whether it is in the model, with a switch. */
export function StoreyPanel({ storey, modelled, storeys, onChange }: {
  storey: number;
  modelled: number[] | null;
  storeys: number;
  onChange: (modelled: number[] | null) => void;
}) {
  const t = useT();
  const on = modelled === null || modelled.includes(storey);
  const next = toggleStorey(modelled, storeys, storey);
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
        <span className="text-[12px] font-semibold text-foreground">{t('storeys.inModel')}</span>
        <Switch on={on} label={t('storeys.inModel')} onChange={() => { if (next !== undefined) onChange(next); }} />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {next === undefined ? t('storeys.lastOne') : t('storeys.hint')}
      </p>
    </div>
  );
}

/** Above this gap between the model's storey height and BuEM's room height, the panel says so. */
const HEIGHT_NOTE_GAP_M = 0.5;

/** `modelled` null means every storey; `onChange` gets null back when all are on again. */
export function StoreysModelled({
  storeys, modelled, floorAreaPerStorey, storeyHeight, roomHeight, dwellings, disabled, onChange,
}: {
  /** Asked while a storey is left out of a residential building, since BuEM's gains follow the dwelling count. */
  dwellings?: { value: number | null; onChange: (value: number | null) => void };
  storeys: number;
  modelled: number[] | null;
  floorAreaPerStorey: number;
  /** Height of one storey band in the 3D model, ground to eaves over the storey count. */
  storeyHeight?: number;
  /** BuEM's h_room. */
  roomHeight: number;
  /** No geometry to cut the envelope with. */
  disabled?: boolean;
  onChange: (modelled: number[] | null) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const all = Array.from({ length: storeys }, (_, i) => i + 1);
  const on = new Set(modelled ?? all);
  const toggle = (storey: number) => {
    const next = toggleStorey(modelled, storeys, storey);
    if (next !== undefined) onChange(next);
  };
  return (
    <SectionCard topic={TOPICS.building} title={t('storeys.title')} info={t('storeys.hint')}>
      <div className="flex flex-col gap-2 p-3">
        {disabled && <p className="text-[11px] leading-snug text-muted-foreground">{t('storeys.noGeometry')}</p>}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('storeys.title')}>
          {all.map((storey) => (
            <button
              key={storey}
              type="button"
              disabled={disabled}
              aria-pressed={on.has(storey)}
              aria-label={t('storeys.storey', { number: storey })}
              onClick={() => toggle(storey)}
              className={cn(
                'h-8 min-w-8 cursor-pointer rounded-md border px-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                on.has(storey)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-dashed border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >{storey}</button>
          ))}
        </div>
        {storeyHeight !== undefined && Math.abs(storeyHeight - roomHeight) > HEIGHT_NOTE_GAP_M && (
          <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-300">
            {t('storeys.heightNote', { height: format(storeyHeight, 1), room: format(roomHeight, 1) })}
          </p>
        )}
        {modelled && dwellings && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">{t('storeys.dwellings')}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={dwellings.value ?? ''}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                dwellings.onChange(Number.isInteger(n) && n >= 1 ? n : null);
              }}
              className={cn(
                'h-8 w-24 rounded-md border bg-card px-2 text-[12px] text-foreground',
                dwellings.value ? 'border-border' : 'border-destructive ring-1 ring-destructive/30',
              )}
            />
            <span className="text-[10px] leading-snug text-muted-foreground">{t('storeys.dwellingsHint')}</span>
          </label>
        )}
        <div className="flex justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <span>{t('storeys.floorArea')}</span>
          <span className="font-semibold tabular-nums text-foreground">
            {on.size} × {format(floorAreaPerStorey, 0)} m² = {format(on.size * floorAreaPerStorey, 0)} m²
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
