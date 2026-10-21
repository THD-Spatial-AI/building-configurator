// Left column of the Overview view: the annual energy hero.
// Building parameters and envelope now live in the right column's merged details card.

import React from 'react';
import { AlertTriangle, Zap, Flame, Snowflake, Gauge, Droplets, CookingPot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnergySource, EnergyTotals } from '../../../lib/loadProfile';
import { SourceTag, EnergyComparisonNote, ScrollHintContainer } from '../shared/ui';
import { useT } from '@/app/i18n';

export interface BuildingSnapshotAsideProps {
  energyTotals: EnergyTotals;
  /** `labelKey`, where given, translates `label`. */
  thermalRating: { label: string; labelKey?: string; color: string; bg: string };
  avgUValue: number;
  mode: 'basic' | 'expert';
  /** Drops the scroll container, for a parent that scrolls already. */
  embedded?: boolean;
  /** The estimated-parameters notice, which points at the configurator dialog. */
  showEstimateNotice?: boolean;
  /** The thermal efficiency row. Off where no defensible rating method applies. */
  showThermalRating?: boolean;
}

const ENERGY_ITEMS = [
  { key: 'heating',     labelKey: 'snapshot.energy.heating',     Icon: Flame,     iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', valueColor: 'text-orange-300' },
  { key: 'electricity', labelKey: 'snapshot.energy.electricity', Icon: Zap,       iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', valueColor: 'text-yellow-300' },
  { key: 'hotwater',    labelKey: 'snapshot.energy.cooling',     Icon: Snowflake, iconBg: 'bg-blue-500/20',   iconColor: 'text-blue-400',   valueColor: 'text-blue-300'   },
  { key: 'dhw',         labelKey: 'snapshot.energy.hotWater',   Icon: Droplets,  iconBg: 'bg-sky-500/20',    iconColor: 'text-sky-400',   valueColor: 'text-sky-300'     },
  { key: 'kitchen',     labelKey: 'snapshot.energy.kitchen', Icon: CookingPot, iconBg: 'bg-rose-500/20', iconColor: 'text-rose-400', valueColor: 'text-rose-300'   },
] as const;

/** Left panel of the overview: the annual energy figures. */
export function BuildingSnapshotAside({
  energyTotals,
  thermalRating,
  avgUValue,
  mode,
  embedded = false,
  showEstimateNotice = true,
  showThermalRating = true,
}: BuildingSnapshotAsideProps) {
  const t = useT();
  const content = (
    <aside className="flex flex-col gap-3">

      {/* ── Data quality notice ── */}
      {showEstimateNotice && (
      <div className="shrink-0 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-700">
            {t('snapshot.estimateNotice')}
          </p>
        </div>
      </div>
      )}

      {/* ── Energy hero + thermal efficiency ── */}
      <div className="shrink-0 overflow-hidden rounded-xl border border-slate-700/60 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]">
        <div className="bg-slate-800 px-5 py-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-300">
            {t('snapshot.annualDemand')}
          </p>

          {/* Total — heating + cooling + electricity + hot water; kitchen (gas) is a
              separate fuel channel and deliberately not folded in, same as BuEM itself. */}
          <div className="mb-4 flex items-baseline justify-between border-b border-slate-700/60 pb-4">
            <span className="text-sm font-medium text-slate-300">{t('snapshot.totalDemand')}</span>
            <span>
              <span className={cn('text-3xl font-extrabold leading-none', energyTotals.total === '—' ? 'text-slate-500' : 'text-white')}>
                {energyTotals.total ?? '—'}
              </span>
              <span className="ml-1.5 text-xs text-slate-500">{energyTotals.unit}</span>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {ENERGY_ITEMS.map(({ key, labelKey, Icon, iconBg, iconColor, valueColor }) => {
              const value = energyTotals[key] ?? '—';
              const unit = energyTotals[`${key}Unit` as keyof EnergyTotals] as string | undefined ?? energyTotals.unit;
              const source = energyTotals[`${key}Source` as keyof EnergyTotals] as EnergySource | undefined;
              const deltaPercent = energyTotals[`${key}DeltaPercent` as keyof EnergyTotals] as number | null | undefined;
              const referenceKwh = energyTotals[`${key}BaselineKwh` as keyof EnergyTotals] as string | undefined;
              const referenceKey = energyTotals[`${key}ComparisonLabel` as keyof EnergyTotals] as string | undefined;
              const referenceLabel = referenceKey ? t(referenceKey) : undefined;
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('flex size-7 items-center justify-center rounded-md', iconBg)}>
                      <Icon className={cn('size-4', iconColor)} />
                    </div>
                    <span className="text-sm text-slate-300">{t(labelKey)}</span>
                    <SourceTag source={source} />
                  </div>
                  <div className="text-right">
                    <div>
                      {key === 'heating' && energyTotals.heatingPerM2 && (
                        <span className="mr-1.5 text-[11px] text-slate-500">({energyTotals.heatingPerM2} kWh/m²·a)</span>
                      )}
                      <span className={cn('text-xl font-bold leading-none', value === '—' ? 'text-slate-500' : valueColor)}>
                        {value}
                      </span>
                      <span className="ml-1.5 text-[11px] text-slate-500">{unit}</span>
                    </div>
                    <EnergyComparisonNote deltaPercent={deltaPercent} referenceKwh={referenceKwh} referenceLabel={referenceLabel} />
                  </div>
                </div>
              );
            })}

            {/* Thermal efficiency row */}
            {showThermalRating && (
            <div className="border-t border-slate-700/60 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-slate-600/50">
                  <Gauge className="size-4 text-slate-300" />
                </div>
                <span className="text-sm text-slate-300">{t('snapshot.thermalEfficiency')}</span>
              </div>
              <div className="text-right">
                <span className="text-base font-bold leading-none" style={{ color: thermalRating.color }}>
                  {thermalRating.labelKey ? t(thermalRating.labelKey) : thermalRating.label}
                </span>
                {mode === 'expert' && (
                  <span className="ml-1.5 text-[11px] text-slate-500">{avgUValue.toFixed(2)} W/m²K</span>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>


    </aside>
  );

  if (embedded) return content;
  return (
    <ScrollHintContainer className="flex flex-col gap-3 border-r border-border/80 bg-slate-100 p-4">
      {content}
    </ScrollHintContainer>
  );
}
