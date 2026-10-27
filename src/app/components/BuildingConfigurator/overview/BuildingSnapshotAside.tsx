// Top of the Building tab: the annual demand as one bar in its carriers'
// colours, with each carrier's figure beneath. Cooking gas is a separate fuel
// and PV is generation, so neither is part of the bar.

import { cn } from '@/lib/utils';
import { TOPICS, type Topic } from '@/app/config/topics';
import { formatTotal, type EnergySource, type EnergyTotals } from '../../../lib/loadProfile';
import { InfoTip, SourceTag, EnergyComparisonNote } from '../shared/ui';
import { hwbClass } from '../../../lib/energyClass';
import { useFormatNumber, useT, type Translate } from '@/app/i18n';

export interface BuildingSnapshotAsideProps {
  energyTotals: EnergyTotals;
  /** Annual PV generation in kWh; the PV row shows only when it is a number. */
  pvAnnualKwh?: number | null;
  /** BuEM's space heating per A_ref, kWh/(m²·a); with it the card shows the indicative class. */
  heatingPerM2?: number | null;
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

/** One carrier in the legend: a box framed in its bar colour, with its name and figure in that colour and its comparison. */
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
    <div className={cn('flex min-w-0 flex-col rounded-md border bg-card px-2.5 py-1.5', topic.border)}>
      <div className={cn('flex items-center gap-1 text-[11px] font-semibold', topic.icon)}>
        <span className="truncate">{label}</span>
        <SourceTag source={source} />
      </div>
      <div>
        <span className={cn('text-[15px] font-bold tabular-nums', value === '—' ? 'text-muted-foreground' : topic.icon)}>
          {formatTotal(value, format)}
        </span>
        {unit && <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {note}
    </div>
  );
}

/** The indicative class of the building's BuEM heating demand, with what it is and is not. */
function HeatingClass({ kwhPerM2 }: { kwhPerM2: number }) {
  const t = useT();
  const format = useFormatNumber();
  const energyClass = hwbClass(kwhPerM2);
  return (
    <div className="flex items-center gap-2.5 border-t border-border pt-2.5">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold', energyClass.badge)}>
        {energyClass.label}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
          {t('snapshot.heatingClass.label')}
          <InfoTip tip={t('snapshot.heatingClass.tip')} />
        </span>
        <span className="text-[11px] text-muted-foreground">{t('insulation.classes.perM2', { value: format(kwhPerM2, 0) })}</span>
      </div>
    </div>
  );
}

/** The building's annual demand by carrier, and its PV generation where there is any. */
export function BuildingSnapshotAside({ energyTotals, pvAnnualKwh = null, heatingPerM2 = null }: BuildingSnapshotAsideProps) {
  const t = useT();
  const format = useFormatNumber();
  const total = DEMAND_ITEMS.reduce((sum, { key }) => sum + amount(energyTotals[key]), 0);

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 flex items-center gap-1 text-[13px] font-semibold text-foreground">{t('snapshot.annualDemand')}<InfoTip tip={t('help.demand')} /></h3>
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

      <div className="grid grid-cols-2 gap-2">
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
      {typeof heatingPerM2 === 'number' && heatingPerM2 > 0 && <HeatingClass kwhPerM2={heatingPerM2} />}
      {energyTotals.heatingPerM2 && (
        <span className="text-[11px] text-muted-foreground">
          {t('snapshot.heatingPerM2', { value: formatTotal(energyTotals.heatingPerM2, format) })}
        </span>
      )}
    </section>
  );
}
