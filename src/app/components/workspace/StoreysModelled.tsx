// The building's storeys: how many, how tall, and a table of them and the
// attic, each in or out of the model with its own height and dwellings. A
// row picked here or in the 3D model is highlighted in both. At least one
// storey stays in.
// They are numbered from 1 here and in what is stored; the UI names them
// from 0, the ground floor, as the countries the tool serves count floors.

import { cn } from '@/lib/utils';
import { RotateCcw } from '@/app/components/icons';
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

const HEAD = 'px-1.5 pb-1 text-left text-[10px] font-medium text-muted-foreground';
const SELECTED_ROW = 'bg-amber-50 dark:bg-amber-500/10';

/** A row's name: picks the row, which the 3D model highlights. */
function RowName({ label, name, selected, disabled, onClick, tip }: {
  label: string; name: string; selected: boolean; disabled?: boolean; onClick: () => void; tip?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        aria-label={name}
        onClick={onClick}
        className={cn('cursor-pointer rounded px-1 text-[12px] font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed', selected && 'ring-2 ring-amber-400')}
      >
        {label}
      </button>
      {tip && <InfoTip tip={tip} />}
    </span>
  );
}

/** `modelled` null means every storey; `onChange` gets null back when all are in again. */
export function StoreysModelled({
  storeys, modelled, selected, onSelect, floorAreaPerStorey, dwellings, disabled, onChange,
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
  /** The rows picked, here or in the model: highlighted in both. */
  selected: readonly number[];
  onSelect: (selected: number[]) => void;
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
  const missing = dwellings ? missingDwellings(modelled, dwellings.values) : [];
  const limits = modelHeight !== undefined ? heightLimits(modelHeight, storeys, roomHeight, heights.values) : null;
  const eaves = modelHeight !== undefined ? format(modelHeight, 1) : '';
  const totalHeight = storeyHeightList(storeys, roomHeight, heights.values).reduce((a, b) => a + b, 0);
  const tooTall = storeysTooTall(storeys, roomHeight, heights.values, modelHeight);
  /** A storey's own height; null gives it the room height again. */
  const setHeight = (storey: number, height: number | null) => {
    const next: Record<number, number> = { ...heights.values };
    if (height && height > 0) next[storey] = height;
    else delete next[storey];
    heights.onChange(next);
  };
  const setDwellings = (storey: number, count: number | null) => {
    if (!dwellings) return;
    const next: Record<number, number> = { ...dwellings.values };
    if (count && count >= 1) next[storey] = count;
    else delete next[storey];
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
        <table className="w-full table-fixed border-collapse text-[12px]" aria-label={t('storeys.title')}>
          <colgroup>
            <col />
            <col className="w-[20%]" />
            <col className="w-[34%]" />
            {dwellings && <col className="w-[24%]" />}
          </colgroup>
          <thead>
            <tr>
              <th className={HEAD}>{t('storeys.table.storey')}</th>
              <th className={HEAD}>{t('storeys.inModel')}</th>
              <th className={HEAD}>{t('storeys.table.height')}<span className="block font-normal">m</span></th>
              {dwellings && <th className={HEAD}>{t('storeys.table.dwellings')}</th>}
            </tr>
          </thead>
          <tbody>
            {all.map((storey) => {
              const isIn = on.has(storey);
              const lastIn = isIn && withStoreys(modelled, storeys, [storey], false) === undefined;
              const own = heights.values[storey];
              const name = t('storeys.select.one', { number: storey - 1 });
              return (
                <tr key={storey} className={cn('border-t border-border', selected.includes(storey) && SELECTED_ROW)}>
                  <td className="px-1.5 py-1">
                    <RowName label={String(storey - 1)} name={name} selected={selected.includes(storey)} disabled={disabled}
                      onClick={() => onSelect(pickWithAttic(selected, storey, false, atticBand))} />
                  </td>
                  <td className="px-1 py-1" title={lastIn ? t('storeys.lastOne') : undefined}>
                    <Switch
                      on={isIn}
                      label={`${name}: ${t('storeys.inModel')}`}
                      disabled={disabled || lastIn}
                      onChange={(next) => {
                        const modelledNext = withStoreys(modelled, storeys, [storey], next);
                        if (modelledNext !== undefined) onChange(modelledNext);
                      }}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <span className="flex items-center gap-1">
                      <NumberInput
                        label={`${name}: ${t('storeys.table.height')}`}
                        hideLabel
                        value={own ?? ''}
                        placeholder={String(roomHeight)}
                        onChange={(next) => setHeight(storey, Math.max(MIN_STOREY_HEIGHT_M, next))}
                        unit=""
                        min={MIN_STOREY_HEIGHT_M}
                        max={limits?.maxStoreyHeight(storey)}
                        maxReason={limits ? t('storeys.limit.height', { height: eaves }) : undefined}
                        step={0.1}
                      />
                      {own !== undefined && (
                        <button type="button" onClick={() => setHeight(storey, null)} aria-label={`${name}: ${t('storeys.useRoomHeight')}`}
                          title={t('storeys.useRoomHeight')} className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <RotateCcw className="size-3" />
                        </button>
                      )}
                    </span>
                  </td>
                  {dwellings && (
                    <td className="px-1 py-1">
                      <DecimalInput
                        integer min={1}
                        value={dwellings.values[storey] ?? null}
                        aria-label={`${name}: ${t('storeys.table.dwellings')}`}
                        onChange={(count) => setDwellings(storey, count)}
                        className={`${TEXT_INPUT} w-full text-right`}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {attic && (
              <tr className={cn('border-t border-border', atticSelected && SELECTED_ROW)}>
                <td className="px-1.5 py-1">
                  <RowName label={t('storeys.attic.label')} name={t('storeys.attic.label')} selected={atticSelected} disabled={disabled}
                    onClick={() => onSelect(pickWithAttic(selected, atticBand, false, atticBand))} tip={t('storeys.attic.hint')} />
                </td>
                <td className="px-1 py-1">
                  <Switch on={attic.modelled} label={`${t('storeys.attic.label')}: ${t('storeys.inModel')}`} disabled={disabled} onChange={attic.onModelledChange} />
                </td>
                <td />
                {dwellings && (
                  <td className="px-1 py-1">
                    {attic.onDwellingsChange && (
                      <DecimalInput
                        integer min={1}
                        value={attic.dwellings ?? null}
                        aria-label={`${t('storeys.attic.label')}: ${t('storeys.table.dwellings')}`}
                        onChange={(count) => attic.onDwellingsChange?.(count && count >= 1 ? count : null)}
                        className={`${TEXT_INPUT} w-full text-right`}
                      />
                    )}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>

        {attic?.modelled && (
          <div className="flex flex-col gap-1">
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
            {attic.measuredArea !== undefined && attic.measuredArea > 0 && attic.floorArea !== attic.measuredArea && (
              <button
                type="button"
                onClick={() => attic.onFloorAreaChange(attic.measuredArea ?? null)}
                className="cursor-pointer self-end text-[11px] font-medium text-primary hover:underline"
              >
                {t('storeys.attic.useMeasured', { area: format(attic.measuredArea, 1) })}
              </button>
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
