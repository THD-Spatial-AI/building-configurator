// Which storeys of the building are in the model: one chip per storey from
// the ground up, at least one kept. Floor area and envelope follow them.

import { cn } from '@/lib/utils';
import { TOPICS } from '@/app/config/topics';
import { useFormatNumber, useT } from '../../i18n';

/** `modelled` null means every storey; `onChange` gets null back when all are on again. */
export function StoreysModelled({ storeys, modelled, floorAreaPerStorey, disabled, onChange }: {
  storeys: number;
  modelled: number[] | null;
  floorAreaPerStorey: number;
  /** No geometry to cut the envelope with. */
  disabled?: boolean;
  onChange: (modelled: number[] | null) => void;
}) {
  const t = useT();
  const format = useFormatNumber();
  const all = Array.from({ length: storeys }, (_, i) => i + 1);
  const on = new Set(modelled ?? all);
  const toggle = (storey: number) => {
    const next = all.filter((s) => (s === storey ? !on.has(s) : on.has(s)));
    if (next.length === 0) return;
    onChange(next.length === storeys ? null : next);
  };
  const { Icon, tile } = TOPICS.building;
  return (
    <div className="flex flex-col gap-2 px-4 pb-2 pt-3">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
        <span className={cn('flex size-5 items-center justify-center rounded', tile)}><Icon className="size-3.5" /></span>
        {t('storeys.title')}
      </h3>
      <p className="text-[11px] leading-snug text-muted-foreground">{t(disabled ? 'storeys.noGeometry' : 'storeys.hint')}</p>
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
      <div className="flex justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <span>{t('storeys.floorArea')}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {on.size} × {format(floorAreaPerStorey, 0)} m² = {format(on.size * floorAreaPerStorey, 0)} m²
        </span>
      </div>
    </div>
  );
}
