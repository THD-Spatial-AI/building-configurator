// Top of the Building tab: the annual demand as one bar in its carriers'
// colours, with each carrier's figure beneath. Cooking gas is a separate fuel
// and PV is generation, so neither is part of the bar.

import { cn } from '@/lib/utils';
import { TOPICS, type Topic } from '@/app/config/topics';
import { formatTotal, type EnergySource, type EnergyTotals } from '../../../lib/loadProfile';
import { SourceTag, EnergyComparisonNote } from '../shared/ui';
import { useFormatNumber, useT, type Translate } from '@/app/i18n';

export interface BuildingSnapshotAsideProps {
  energyTotals: EnergyTotals;
  /** Annual PV generation in kWh; the PV row shows only when it is a number. */
  pvAnnualKwh?: number | null;
}

const DEMAND_ITEMS: { key: 'heating' | 'electricity' | 'hotwater' | 'dhw'; labelKey: string; topic: Topic }[] = [
  { key: 'heating',     labelKey: 'snapshot.energy.heating',     topic: TOPICS.heat },
  { key: 'electricity', labelKey: 'snapshot.energy.electricity', topic: TOPICS.electricity },
  { key: 'hotwater',    labelKey: 'snapshot.energy.cooling',     topic: TOPICS.cooling },
  { key: 'dhw',         labelKey: 'snapshot.energy.hotWater',    topic: TOPICS.hotWater },
];

/** The message for each annual unit the totals carry; any other unit shows as given. */
const ENERGY_UNIT_KEYS: Record<string, string> = {
  'kWh/year': 'snapshot.unit.kWhPerYear',
  'kWh_gas/year': 'snapshot.unit.kWhGasPerYear',
};

function energyUnit(t: Translate, unit: string | undefined): string | undefined {
  return unit && ENERGY_UNIT_KEYS[unit] ? t(ENERGY_UNIT_KEYS[unit]) : unit;
}

const amount = (text: string | undefined) => {
  const value = Number(text);
  return text && Number.isFinite(value) && value > 0 ? value : 0;
};

/** One carrier in the legend: swatch, name, figure, and how it compares. */
function LegendItem({ topic, label, value, unit, source, note }: {
  topic: Topic;
  label: string;
  value: string;
  unit?: string;
  source?: EnergySource;
  note?: React.ReactNode;
}) {
  const format = useFormatNumber();
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={cn('size-2.5 shrink-0 rounded-sm', topic.bar)} aria-hidden />
        <topic.Icon className={cn('size-3.5 shrink-0', topic.icon)} aria-hidden />
        <span className="truncate">{label}</span>
        <SourceTag source={source} />
      </div>
      <div className="pl-4">
        <span className={cn('text-[15px] font-bold tabular-nums', value === '—' ? 'text-muted-foreground' : 'text-foreground')}>
          {formatTotal(value, format)}
        </span>
        {unit && <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {note && <div className="pl-4">{note}</div>}
    </div>
  );
}

/** The building's annual demand by carrier, and its PV generation where there is any. */
export function BuildingSnapshotAside({ energyTotals, pvAnnualKwh = null }: BuildingSnapshotAsideProps) {
  const t = useT();
  const format = useFormatNumber();
  const total = DEMAND_ITEMS.reduce((sum, { key }) => sum + amount(energyTotals[key]), 0);

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[13px] font-semibold text-foreground">{t('snapshot.annualDemand')}</h3>
        <span>
          <span className={cn('text-[22px] font-bold tabular-nums', energyTotals.total === '—' ? 'text-muted-foreground' : 'text-foreground')}>
            {formatTotal(energyTotals.total ?? '—', format)}
          </span>
          <span className="ml-1 text-[11px] text-muted-foreground">{energyUnit(t, energyTotals.unit)}</span>
        </span>
      </div>

      {total > 0 && (
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={t('snapshot.annualDemand')}>
          {DEMAND_ITEMS.map(({ key, topic }) => {
            const share = amount(energyTotals[key]) / total;
            return share > 0 ? <div key={key} className={topic.bar} style={{ width: `${share * 100}%` }} /> : null;
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {DEMAND_ITEMS.map(({ key, labelKey, topic }) => {
          const referenceKey = energyTotals[`${key}ComparisonLabel` as keyof EnergyTotals] as string | undefined;
          return (
            <LegendItem
              key={key}
              topic={topic}
              label={t(labelKey)}
              value={energyTotals[key] ?? '—'}
              unit={energyUnit(t, (energyTotals[`${key}Unit` as keyof EnergyTotals] as string | undefined) ?? energyTotals.unit)}
              source={energyTotals[`${key}Source` as keyof EnergyTotals] as EnergySource | undefined}
              note={(
                <EnergyComparisonNote
                  deltaPercent={energyTotals[`${key}DeltaPercent` as keyof EnergyTotals] as number | null | undefined}
                  referenceKwh={energyTotals[`${key}BaselineKwh` as keyof EnergyTotals] as string | undefined}
                  referenceLabel={referenceKey ? t(referenceKey) : undefined}
                />
              )}
            />
          );
        })}
        <LegendItem
          topic={TOPICS.cooking}
          label={t('snapshot.energy.kitchen')}
          value={energyTotals.kitchen ?? '—'}
          unit={energyUnit(t, energyTotals.kitchenUnit ?? energyTotals.unit)}
        />
        {typeof pvAnnualKwh === 'number' && (
          <LegendItem
            topic={TOPICS.pv}
            label={t('snapshot.pvGeneration')}
            value={String(Math.round(pvAnnualKwh))}
            unit={t('snapshot.unit.kWhPerYear')}
          />
        )}
      </div>
      {energyTotals.heatingPerM2 && (
        <span className="text-[11px] text-muted-foreground">
          {t('snapshot.heatingPerM2', { value: formatTotal(energyTotals.heatingPerM2, format) })}
        </span>
      )}
    </section>
  );
}
