// Which storeys of the building are in the model, and the dwellings on each.
// Storeys are selected, one or many, here or in the 3D model; the selection is
// then left out, put back, or given a dwelling count. At least one stays in.

import { cn } from '@/lib/utils';
import { useFormatNumber, useT } from '../../i18n';
import { DecimalInput, InfoTip } from '../BuildingConfigurator/shared/ui';
import { Switch } from './PvMode';
import type { StoreyDwellings } from '../../lib/storeys';

/** The storeys modelled with `chosen` left out or put back; null when all are in, undefined when none would be. */
export function withStoreys(modelled: number[] | null, storeys: number, chosen: readonly number[], inModel: boolean): number[] | null | undefined {
  const all = Array.from({ length: storeys }, (_, i) => i + 1);
  const on = new Set(modelled ?? all);
  for (const storey of chosen) {
    if (inModel) on.add(storey);
    else on.delete(storey);
  }
  const next = all.filter((s) => on.has(s));
  if (next.length === 0) return undefined;
  return next.length === storeys ? null : next;
}

/** The selection with one storey added or taken out. */
export function toggleSelected(selected: readonly number[], storey: number): number[] {
  return selected.includes(storey) ? selected.filter((s) => s !== storey) : [...selected, storey].sort((a, b) => a - b);
}

/** The selection after a click on a storey: several at once while `multi`, else that storey alone, or none if it was. */
export function pickInSelection(selected: readonly number[], storey: number, multi: boolean): number[] {
  if (multi) return toggleSelected(selected, storey);
  return selected.length === 1 && selected[0] === storey ? [] : [storey];
}

/** The dwelling count every chosen storey shares, or null when they differ or have none. */
function sharedCount(chosen: readonly number[], dwellings: StoreyDwellings): number | null {
  const counts = new Set(chosen.map((storey) => dwellings[storey] ?? null));
  return counts.size === 1 ? [...counts][0] : null;
}

/** `modelled` null means every storey; `onChange` gets null back when all are in again. */
export function StoreysModelled({
  storeys, modelled, selected, onSelect, multi = false, onMultiChange, floorAreaPerStorey, dwellings, disabled, onChange,
}: {
  storeys: number;
  modelled: number[] | null;
  /** The storeys selected, here or in the model. */
  selected: readonly number[];
  onSelect: (selected: number[]) => void;
  /** Clicks add storeys to the selection instead of selecting one, to configure several at once. */
  multi?: boolean;
  onMultiChange?: (multi: boolean) => void;
  /** A residential building's dwellings per storey; BuEM's gains follow the count of the storeys modelled. */
  dwellings?: { values: StoreyDwellings; onChange: (values: Record<number, number>) => void };
  floorAreaPerStorey: number;
  /** No geometry to cut the envelope with. */
  disabled?: boolean;
  onChange: (modelled: number[] | null) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const all = Array.from({ length: storeys }, (_, i) => i + 1);
  const on = new Set(modelled ?? all);
  const leaveOut = withStoreys(modelled, storeys, selected, false);
  /** The switch is on while every selected storey is in the model; turning it on puts them all back. */
  const allIn = selected.every((storey) => on.has(storey));
  const missing = modelled && dwellings ? [...on].filter((storey) => !(dwellings.values[storey] >= 1)) : [];
  const setDwellings = (count: number | null) => {
    if (!dwellings) return;
    const next: Record<number, number> = { ...dwellings.values };
    for (const storey of selected) {
      if (count && count >= 1) next[storey] = count;
      else delete next[storey];
    }
    dwellings.onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
          {t('storeys.title')}<InfoTip tip={t('storeys.hint')} />
        </span>
        {disabled && <p className="text-[11px] leading-snug text-muted-foreground">{t('storeys.noGeometry')}</p>}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('storeys.title')}>
          {all.map((storey) => {
            const count = dwellings?.values[storey];
            return (
              <button
                key={storey}
                type="button"
                disabled={disabled}
                aria-pressed={selected.includes(storey)}
                aria-label={t(on.has(storey) ? 'storeys.chip.in' : 'storeys.chip.out', { number: storey })}
                onClick={() => onSelect(pickInSelection(selected, storey, multi))}
                className={cn(
                  'flex h-9 min-w-9 cursor-pointer flex-col items-center justify-center rounded-md border px-2 text-[12px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  on.has(storey)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-dashed border-border bg-card text-muted-foreground hover:bg-muted',
                  selected.includes(storey) && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-card',
                )}
              >
                {storey}
                {count !== undefined && <span className="mt-0.5 text-[9px] font-medium opacity-80">{t('storeys.chip.dwellings', { count })}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
          {onMultiChange && (
            <span className="flex items-center gap-1.5 text-foreground">
              <Switch on={multi} label={t('storeys.select.multi')} onChange={onMultiChange} />
              {t('storeys.select.multi')}
            </span>
          )}
          {multi && (
            <button type="button" disabled={disabled} onClick={() => onSelect(all)} className="cursor-pointer text-[11px] font-medium text-primary hover:underline disabled:cursor-not-allowed">
              {t('storeys.select.all')}
            </button>
          )}
          {selected.length > 0 && (
            <button type="button" onClick={() => onSelect([])} className="cursor-pointer text-[11px] font-medium text-primary hover:underline">
              {t('storeys.select.clear')}
            </button>
          )}
        </div>

        {selected.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
            <span className="text-[12px] font-semibold text-foreground">
              {selected.length === 1 ? t('storeys.select.one', { number: selected[0] }) : t('storeys.select.count', { count: selected.length })}
            </span>
            <div className="flex items-center justify-between gap-2" title={allIn && leaveOut === undefined ? t('storeys.lastOne') : undefined}>
              <span className="text-[12px] text-foreground">{t('storeys.inModel')}</span>
              <Switch
                on={allIn}
                label={t('storeys.inModel')}
                onChange={(next) => {
                  const modelledNext = withStoreys(modelled, storeys, selected, next);
                  if (modelledNext !== undefined) onChange(modelledNext);
                }}
              />
            </div>
            {dwellings && (
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">{t('storeys.dwellingsPerStorey')}</span>
                <DecimalInput
                  integer
                  min={1}
                  value={sharedCount(selected, dwellings.values)}
                  placeholder={selected.length > 1 ? t('storeys.mixed') : undefined}
                  aria-label={t('storeys.dwellingsPerStorey')}
                  onChange={setDwellings}
                  className="h-8 w-20 rounded-md border border-border bg-card px-2 text-right text-[12px] text-foreground"
                />
              </label>
            )}
          </div>
        )}

        {missing.length > 0 && (
          <p className="text-[11px] leading-snug text-destructive">
            {t('storeys.dwellingsMissing', { storeys: missing.join(', ') })}
          </p>
        )}
        <div className="flex justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <span>{t('storeys.floorArea')}</span>
          <span className="font-semibold tabular-nums text-foreground">
            {on.size} × {format(floorAreaPerStorey, 0)} m² = {format(on.size * floorAreaPerStorey, 0)} m²
          </span>
        </div>
    </div>
  );
}
