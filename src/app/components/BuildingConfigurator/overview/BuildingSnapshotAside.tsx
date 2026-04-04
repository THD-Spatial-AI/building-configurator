// Left column of the Overview view: building identity, energy hero, key metrics.

import React, { useState } from 'react';
import { AlertTriangle, Zap, Flame, Droplets, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnergyTotals } from './LoadProfileViewer';
import { SnapshotStatus, SnapshotStatusBadge } from '../shared/snapshotUtils';
import { TechnologiesSection } from './TechnologiesSection';

export interface BuildingSnapshotAsideProps {
  mode: 'basic' | 'expert';
  energyTotals: EnergyTotals;
  snapshotRows: Array<{ label: string; value: string; status: SnapshotStatus }>;
  thermalRating: { label: string; color: string; bg: string };
  avgUValue: number;
  thermalEfficiencyStatus: SnapshotStatus;
}

const ENERGY_ITEMS = [
  { key: 'heating',     label: 'Heating',     Icon: Flame,    iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', valueColor: 'text-orange-300'  },
  { key: 'electricity', label: 'Electricity', Icon: Zap,      iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', valueColor: 'text-yellow-300'  },
  { key: 'hotwater',    label: 'Hot Water',   Icon: Droplets, iconBg: 'bg-blue-500/20',   iconColor: 'text-blue-400',   valueColor: 'text-blue-300'    },
] as const;

/** Left panel of the overview: building identity, energy hero numbers, parameters, technologies. */
export function BuildingSnapshotAside({
  mode,
  energyTotals,
  snapshotRows,
  thermalRating,
  avgUValue,
  thermalEfficiencyStatus,
}: BuildingSnapshotAsideProps) {
  const [paramsOpen, setParamsOpen] = useState(false);

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-border/80 bg-slate-100">

      {/* ── Building identity ── */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-white px-5 py-4">
        <div>
          <p className="text-base font-semibold text-foreground">Building 3</p>
          <p className="text-xs text-slate-500">Multi-Family House · 48.1351° N, 11.5820° E</p>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {mode}
        </span>
      </div>

      {/* ── Energy hero ── */}
      <div className="bg-slate-800 px-5 py-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Daily Energy Demand
        </p>
        <div className="flex flex-col gap-3">
          {ENERGY_ITEMS.map(({ key, label, Icon, iconBg, iconColor, valueColor }) => {
            const value = energyTotals[key];
            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn('flex size-7 items-center justify-center rounded-md', iconBg)}>
                    <Icon className={cn('size-4', iconColor)} />
                  </div>
                  <span className="text-sm text-slate-300">{label}</span>
                </div>
                <div className="text-right">
                  <span className={cn('text-xl font-bold leading-none', value === '—' ? 'text-slate-500' : valueColor)}>
                    {value}
                  </span>
                  <span className="ml-1.5 text-[11px] text-slate-500">{energyTotals.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Thermal efficiency ── */}
      <div className="flex items-center justify-between border-b border-border/60 bg-white px-5 py-3.5">
        <span className="text-sm text-slate-600">Thermal efficiency</span>
        <div className="flex items-center gap-2">
          {mode === 'expert' && (
            <span className="text-xs text-slate-400">{avgUValue.toFixed(2)} W/m²K</span>
          )}
          <span
            className="rounded-md px-2.5 py-1 text-xs font-semibold"
            style={{ color: thermalRating.color, background: thermalRating.bg }}
          >
            {thermalRating.label}
          </span>
          <SnapshotStatusBadge status={thermalEfficiencyStatus} />
        </div>
      </div>

      {/* ── Building parameters (collapsible) ── */}
      <div className="border-b border-border/60 bg-white">
        <button
          type="button"
          onClick={() => setParamsOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left"
        >
          <span className="text-sm font-medium text-slate-600">Building parameters</span>
          <ChevronDown className={cn(
            'size-4 text-slate-400 transition-transform duration-150',
            paramsOpen && 'rotate-180',
          )} />
        </button>
        {paramsOpen && (
          <table className="w-full text-[11px]">
            <tbody className="divide-y divide-slate-100">
              {snapshotRows.map(({ label, value, status }) => (
                <tr key={label}>
                  <td className="px-5 py-1.5 text-slate-400">{label}</td>
                  <td className="px-5 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium text-foreground">{value}</span>
                      <SnapshotStatusBadge status={status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Technologies ── */}
      <div className="flex-1 px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          Technologies
        </p>
        <TechnologiesSection />
      </div>

      {/* ── Data quality notice (demoted to footer) ── */}
      <div className="border-t border-amber-200 bg-amber-50 px-5 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-700">
            Values based on public data estimates - if you have more accurate data, please configure to improve accuracy.
          </p>
        </div>
      </div>

    </aside>
  );
}
