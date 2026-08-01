// Preliminary energy demand card shown under the 3D preview in the configure
// workspace — live heating/electricity/hot water + thermal efficiency figures.

import React from 'react';
import { Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeatingDeltaBadge } from '../shared/ui';
import { ENERGY_ITEMS } from '../shared/energyTotals';
import type { EnergyTotals } from '../../../lib/loadProfile';

export interface EnergyDemandCardProps {
  displayEnergyTotals: EnergyTotals;
  thermalRating: { label: string; color: string };
  avgUValue: number;
}

export function EnergyDemandCard({ displayEnergyTotals, thermalRating, avgUValue }: EnergyDemandCardProps) {
  return (
    <div className="shrink-0 p-3">
      <div className="overflow-hidden rounded-xl border border-slate-700/60 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]">
        <div className="bg-slate-800 px-4 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Preliminary energy demand
          </p>
          <div className="flex flex-col gap-3">
            {ENERGY_ITEMS.map(({ key, label, Icon, iconBg, iconColor, valueColor }) => {
              const value = displayEnergyTotals[key as keyof EnergyTotals];
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', iconBg)}>
                      <Icon className={cn('size-3.5', iconColor)} />
                    </div>
                    <span className="text-xs text-slate-300">{label}</span>
                  </div>
                  <div className="text-right">
                    <div>
                      <span className={cn('text-lg font-bold leading-none', value === '—' ? 'text-slate-500' : valueColor)}>
                        {value}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-500">{displayEnergyTotals.unit}</span>
                      {key === 'heating' && (
                        <HeatingDeltaBadge deltaPercent={displayEnergyTotals.heatingDeltaPercent} />
                      )}
                    </div>
                    {key === 'heating' && displayEnergyTotals.heatingPerM2 && (
                      <p className="text-[10px] text-slate-500">{displayEnergyTotals.heatingPerM2} kWh/m²·a</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thermal efficiency — separated by subtle rule */}
            <div className="flex items-center justify-between border-t border-slate-700/60 pt-3">
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-600/50">
                  <Gauge className="size-3.5 text-slate-300" />
                </div>
                <span className="text-xs text-slate-300">Thermal efficiency</span>
              </div>
              <div className="text-right">
                <span className="text-base font-bold leading-none" style={{ color: thermalRating.color }}>
                  {thermalRating.label}
                </span>
                <span className="ml-1 text-[10px] text-slate-500">{avgUValue.toFixed(2)} W/m²K</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[9px] text-slate-600">
            Will update live as surface properties change
          </p>
        </div>
      </div>
    </div>
  );
}
