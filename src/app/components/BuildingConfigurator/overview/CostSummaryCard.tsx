// What the installed technologies cost, per technology and in total.
// Figures come straight from each technology's cost parameters — see
// technologyCosts.ts for what is and is not included.

import React from 'react';
import { Euro } from 'lucide-react';
import { technologyCosts, formatEuro } from '../shared/technologyCosts';
import type { BatteryConfig, PvConfig } from '../shared/buildingDefaults';
import type { BuildingElement } from '../configure/model/buildingElements';

interface CostSummaryCardProps {
  pvSurfaces: { element: BuildingElement; pv: PvConfig }[];
  battery: BatteryConfig;
}

export function CostSummaryCard({ pvSurfaces, battery }: CostSummaryCardProps) {
  const { items, capexTotal, omAnnualTotal } = technologyCosts(pvSurfaces, battery);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-slate-200">
          <Euro className="size-3.5 text-slate-600" />
        </div>
        <p className="text-[13px] font-bold text-slate-800">Technology cost</p>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-4 text-[11px] leading-snug text-muted-foreground">
          No technology installed. Add solar PV to a surface or enable the battery to see its cost here.
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-4 pt-3 pb-1 text-left font-semibold">Technology</th>
                <th className="px-2 pt-3 pb-1 text-right font-semibold">Up front</th>
                <th className="px-4 pt-3 pb-1 text-right font-semibold">Per year</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    <p className="text-[12px] font-medium text-slate-700">{item.label}</p>
                    <p className="text-[10px] text-slate-400">{item.basis}</p>
                  </td>
                  <td className="px-2 py-2.5 text-right text-[12px] font-semibold text-slate-700">
                    {item.capex > 0 ? formatEuro(item.capex) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[12px] font-semibold text-slate-700">
                    {formatEuro(item.omAnnual)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700">Total</td>
                <td className="px-2 py-2.5 text-right text-[12px] font-bold text-slate-800">
                  {capexTotal > 0 ? formatEuro(capexTotal) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-[12px] font-bold text-slate-800">
                  {formatEuro(omAnnualTotal)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="px-4 pb-3 pt-2 text-[10px] leading-snug text-slate-400">
            Capital and fixed maintenance only. Energy prices are not modelled, so this is not a bill.
          </p>
        </>
      )}
    </div>
  );
}
