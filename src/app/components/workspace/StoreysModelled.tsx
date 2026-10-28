// The building's storeys: how many, how tall, which are in the model, and the
// dwellings on each. Storeys are selected, one or many, here or in the 3D
// model; the selection is then left out, put back, given a dwelling count or
// its own height. At least one stays in.
// They are numbered from 1 here and in what is stored; the UI names them
// from 0, the ground floor, as the countries the tool serves count floors.

import { cn } from '@/lib/utils';
import { useFormatNumber, useT } from '../../i18n';
import { DecimalInput, InfoTip, NumberInput, Switch, TEXT_INPUT } from '../BuildingConfigurator/shared/ui';
import {
  MIN_STOREY_HEIGHT_M, heightLimits, missingDwellings, storeyHeightList, storeysTooTall,
  type StoreyDwellings, type StoreyHeights,
} from '../../lib/storeys';

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

/** The selection after a click where `attic` is the attic's band: the attic is selected on its own, never with storeys. */
export function pickWithAttic(selected: readonly number[], storey: number, multi: boolean, attic: number): number[] {
  if (storey === attic) return selected.length === 1 && selected[0] === attic ? [] : [attic];
  return pickInSelection(selected.filter((s) => s !== attic), storey, multi);
}

/** The dwelling count every chosen storey shares, or null when they differ or have none. */
function sharedCount(chosen: readonly number[], dwellings: StoreyDwellings): number | null {
  const counts = new Set(chosen.map((storey) => dwellings[storey] ?? null));
  return counts.size === 1 ? [...counts][0] : null;
}

/** The height every chosen storey shares as its own, or null when they differ or have none. */
function sharedHeight(chosen: readonly number[], heights: StoreyHeights): number | null {
  const own = new Set(chosen.map((storey) => heights[storey] ?? null));
  return own.size === 1 ? [...own][0] : null;
}

/** `modelled` null means every storey; `onChange` gets null back when all are in again. */
export function StoreysModelled({
  storeys, modelled, selected, onSelect, multi = false, onMultiChange, floorAreaPerStorey, dwellings, disabled, onChange,
  roomHeight, heights, modelHeight, onStoreysChange, onRoomHeightChange, attic,
}: {
  storeys: number;
  /** Under a pitched roof: the attic, selected as band storeys + 1. */
  attic?: {
    modelled: boolean;
    /** m2; null counts none. */
    floorArea: number | null;
    /** The usable floor area measured from the 3D model, in m2; offered, never counted until taken. */
    measuredArea?: number;
    onModelledChange: (modelled: boolean) => void;
    onFloorAreaChange: (area: number | null) => void;
    /** A residential building's dwellings in the attic, as for a storey. */
    dwellings?: number | null;
    onDwellingsChange?: (count: number | null) => void;
  };
  roomHeight: number;
  /** The storeys' own heights; the rest take the room height. */
  heights: { values: StoreyHeights; onChange: (values: Record<number, number>) => void };
  /** The 3D model's height to the eaves, in metres; the storeys stop there. */
  modelHeight?: number;
  onStoreysChange: (storeys: number) => void;
  onRoomHeightChange: (roomHeight: number) => void;
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
  const atticBand = storeys + 1;
  const atticSelected = attic !== undefined && selected.includes(atticBand);
  const atticArea = attic?.modelled && attic.floorArea ? attic.floorArea : 0;
  const leaveOut = withStoreys(modelled, storeys, selected, false);
  /** The switch is on while every selected storey is in the model; turning it on puts them all back. */
  const allIn = selected.every((storey) => on.has(storey));
  /** Some selected storeys are in the model and some are not: the switch is off and says so. */
  const someIn = !allIn && selected.some((storey) => on.has(storey));
  const missing = dwellings ? missingDwellings(modelled, dwellings.values) : [];
  const limits = modelHeight !== undefined ? heightLimits(modelHeight, storeys, roomHeight, heights.values) : null;
  const eaves = modelHeight !== undefined ? format(modelHeight, 1) : '';
  const totalHeight = storeyHeightList(storeys, roomHeight, heights.values).reduce((a, b) => a + b, 0);
  const tooTall = storeysTooTall(storeys, roomHeight, heights.values, modelHeight);
  const ownHeightMax = limits ? Math.min(...selected.map(limits.maxStoreyHeight)) : undefined;
  const setHeights = (height: number | null) => {
    const next: Record<number, number> = { ...heights.values };
    for (const storey of selected) {
      if (height && height > 0) next[storey] = height;
      else delete next[storey];
    }
    heights.onChange(next);
  };
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
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label={t('snapshot.row.storeys')}
            value={storeys}
            onChange={(next) => onStoreysChange(Math.max(1, Math.round(next)))}
            min={1}
            max={limits?.maxStoreys}
            maxReason={limits ? t('storeys.limit.storeys', { room: format(roomHeight, 1), height: eaves }) : undefined}
            unit=""
            step={1}
            integer
          />
          <NumberInput
            label={t('snapshot.row.roomHeight')}
            tip={t('storeys.roomHeightTip')}
            value={roomHeight}
            onChange={(next) => onRoomHeightChange(Math.max(MIN_STOREY_HEIGHT_M, next))}
            unit="m"
            min={MIN_STOREY_HEIGHT_M}
            max={limits?.maxRoomHeight}
            maxReason={limits ? t('storeys.limit.height', { height: eaves }) : undefined}
            step={0.1}
          />
        </div>
        {tooTall && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            {t('storeys.heightConflict', { total: format(totalHeight, 1), height: eaves })}
          </p>
        )}
        {(storeys > 1 || attic) && <>
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
                aria-label={t(on.has(storey) ? 'storeys.chip.in' : 'storeys.chip.out', { number: storey - 1 })}
                onClick={() => onSelect(pickWithAttic(selected, storey, multi, atticBand))}
                className={cn(
                  'flex h-9 min-w-9 cursor-pointer flex-col items-center justify-center rounded-md border px-2 text-[12px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  on.has(storey)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-dashed border-border bg-card text-muted-foreground hover:bg-muted',
                  selected.includes(storey) && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-card',
                )}
              >
                {storey - 1}
                {count !== undefined && <span className="mt-0.5 text-[9px] font-medium opacity-80">{t('storeys.chip.dwellings', { count })}</span>}
              </button>
            );
          })}
          {attic && (
            <button
              type="button"
              disabled={disabled}
              aria-pressed={atticSelected}
              aria-label={t(attic.modelled ? 'storeys.attic.chipIn' : 'storeys.attic.chipOut')}
              onClick={() => onSelect(pickWithAttic(selected, atticBand, multi, atticBand))}
              className={cn(
                'flex h-9 cursor-pointer flex-col items-center justify-center rounded-md border px-3 text-[12px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                attic.modelled
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-dashed border-border bg-card text-muted-foreground hover:bg-muted',
                atticSelected && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-card',
              )}
            >
              {t('storeys.attic.label')}
              {attic.dwellings && <span className="mt-0.5 text-[9px] font-medium opacity-80">{t('storeys.chip.dwellings', { count: attic.dwellings })}</span>}
            </button>
          )}
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

        {attic && atticSelected && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
            <span className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
              {t('storeys.attic.label')}<InfoTip tip={t('storeys.attic.hint')} />
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-foreground">{t('storeys.inModel')}</span>
              <Switch on={attic.modelled} label={t('storeys.inModel')} onChange={attic.onModelledChange} />
            </div>
            {attic.modelled && (
              <label className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  {t('storeys.attic.floorArea')}<InfoTip tip={t('storeys.attic.floorAreaTip')} />
                </span>
                <span className="flex items-center gap-1">
                  <DecimalInput
                    min={0}
                    value={attic.floorArea}
                    placeholder={t('storeys.attic.noArea')}
                    aria-label={t('storeys.attic.floorArea')}
                    onChange={(area) => attic.onFloorAreaChange(area && area > 0 ? area : null)}
                    className={`${TEXT_INPUT} w-24 text-right`}
                  />
                  <span className="text-[11px] text-muted-foreground">m²</span>
                </span>
              </label>
            )}
            {attic.modelled && attic.measuredArea !== undefined && attic.measuredArea > 0 && attic.floorArea !== attic.measuredArea && (
              <button
                type="button"
                onClick={() => attic.onFloorAreaChange(attic.measuredArea ?? null)}
                className="cursor-pointer self-end text-[11px] font-medium text-primary hover:underline"
              >
                {t('storeys.attic.useMeasured', { area: format(attic.measuredArea, 1) })}
              </button>
            )}
            {attic.onDwellingsChange && (
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">{t('storeys.attic.dwellings')}</span>
                <DecimalInput
                  integer
                  min={1}
                  value={attic.dwellings ?? null}
                  aria-label={t('storeys.attic.dwellings')}
                  onChange={(count) => attic.onDwellingsChange?.(count && count >= 1 ? count : null)}
                  className={`${TEXT_INPUT} w-20 text-right`}
                />
              </label>
            )}
          </div>
        )}

        {selected.length > 0 && !atticSelected && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
            <span className="text-[12px] font-semibold text-foreground">
              {selected.length === 1 ? t('storeys.select.one', { number: selected[0] - 1 }) : t('storeys.select.count', { count: selected.length })}
            </span>
            <div className="flex items-center justify-between gap-2" title={allIn && leaveOut === undefined ? t('storeys.lastOne') : undefined}>
              <span className="flex flex-col text-[12px] text-foreground">
                {t('storeys.inModel')}
                {someIn && <span className="text-[11px] text-muted-foreground">{t('storeys.someIn')}</span>}
              </span>
              <Switch
                on={allIn}
                label={t('storeys.inModel')}
                onChange={(next) => {
                  const modelledNext = withStoreys(modelled, storeys, selected, next);
                  if (modelledNext !== undefined) onChange(modelledNext);
                }}
              />
            </div>
            <label className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{t('storeys.ownHeight')}</span>
              <span className="w-28">
                <NumberInput
                  value={sharedHeight(selected, heights.values) ?? ''}
                  placeholder={selected.length > 1 && sharedHeight(selected, heights.values) === null ? t('storeys.mixed') : String(roomHeight)}
                  onChange={(next) => setHeights(Math.max(MIN_STOREY_HEIGHT_M, next))}
                  unit="m"
                  min={MIN_STOREY_HEIGHT_M}
                  max={ownHeightMax}
                  maxReason={limits ? t('storeys.limit.height', { height: eaves }) : undefined}
                  step={0.1}
                />
              </span>
            </label>
            {selected.some((storey) => heights.values[storey] !== undefined) && (
              <button type="button" onClick={() => setHeights(null)} className="cursor-pointer self-end text-[11px] font-medium text-primary hover:underline">
                {t('storeys.useRoomHeight')}
              </button>
            )}
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
                  className={`${TEXT_INPUT} w-20 text-right`}
                />
              </label>
            )}
          </div>
        )}

        {missing.length > 0 && (
          <p className="text-[11px] leading-snug text-destructive">
            {t('storeys.dwellingsMissing', { storeys: missing.map((storey) => storey - 1).join(', ') })}
          </p>
        )}
        <div className="flex justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <span>{t('storeys.floorArea')}</span>
          <span className="font-semibold tabular-nums text-foreground">
            {on.size} × {format(floorAreaPerStorey, 0)} m²{atticArea > 0 && ` + ${format(atticArea, 0)} m²`} = {format(on.size * floorAreaPerStorey + atticArea, 0)} m²
          </span>
        </div>
        </>}
    </div>
  );
}
