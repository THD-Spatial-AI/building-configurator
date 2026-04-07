// Left column of the Overview view: building identity, energy hero, key metrics.
// Building parameters are shown as a compact always-visible table.
// Technologies have moved to the right column (after Envelope Composition).

import React, { useState, useRef } from 'react';
import { ScrollHintContainer } from '../shared/ui';
import { AlertTriangle, Zap, Flame, Droplets, Gauge, Pencil, Check, X } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import type { EnergyTotals } from './LoadProfileViewer';
import { SnapshotRow, SnapshotStatusBadge } from '../shared/snapshotUtils';
import { yearToConstructionPeriod } from '../shared/buildingOptions';

interface PvSummary {
  installed: boolean;
  surfaceCount: number;
  totalCapacityKw: number;
}

export interface BuildingSnapshotAsideProps {
  energyTotals: EnergyTotals;
  snapshotRows: SnapshotRow[];
  thermalRating: { label: string; color: string; bg: string };
  avgUValue: number;
  installedTechIds: string[];
  pvSummary: PvSummary;
  onUpdateParam: (key: string, value: string | number) => void;
  onToggleTech?: (id: string, installed: boolean) => void;
  /** Opens the matching technology flow in the Configure workspace. */
  onOpenTech?: (id: 'solar_pv' | 'battery' | 'heat_pump' | 'ev_charger') => void;
  mode: 'basic' | 'expert';
}

const ENERGY_ITEMS = [
  { key: 'heating',     label: 'Heating',     Icon: Flame,    iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', valueColor: 'text-orange-300'  },
  { key: 'electricity', label: 'Electricity', Icon: Zap,      iconBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400', valueColor: 'text-yellow-300'  },
  { key: 'hotwater',    label: 'Hot Water',   Icon: Droplets, iconBg: 'bg-blue-500/20',   iconColor: 'text-blue-400',   valueColor: 'text-blue-300'    },
] as const;

/** Left panel of the overview: energy hero numbers + building parameters table. */
export function BuildingSnapshotAside({
  energyTotals,
  snapshotRows,
  thermalRating,
  avgUValue,
  onUpdateParam,
  mode,
}: BuildingSnapshotAsideProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft,      setDraft]      = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = (row: SnapshotRow) => {
    if (!row.editKey) return;
    setEditingKey(row.editKey);
    setDraft(row.editType === 'year-to-period' ? '' : String(row.rawValue ?? row.value));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveEditing = (row: SnapshotRow) => {
    if (!row.editKey || editingKey !== row.editKey) return;
    let value: string | number;
    if (row.editType === 'number') {
      const n = Number(draft);
      if (!Number.isFinite(n)) return;
      value = n;
    } else if (row.editType === 'year-to-period') {
      const year = parseInt(draft, 10);
      if (!Number.isFinite(year) || year < 1800 || year > new Date().getFullYear()) return;
      value = yearToConstructionPeriod(year);
    } else {
      value = draft.trim();
      if (!value) return;
    }
    onUpdateParam(row.editKey, value);
    setEditingKey(null);
  };

  const cancelEditing = () => setEditingKey(null);

  const CARD = 'overflow-hidden rounded-xl border border-border/60 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]';

  return (
    <ScrollHintContainer className="flex flex-col gap-3 border-r border-border/80 bg-slate-100 p-4">
    <aside className="flex flex-col gap-3">

      {/* ── Data quality notice ── */}
      <div className="shrink-0 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-700">
            Building parameters are estimated from public records. Review and adjust them below to improve accuracy.
          </p>
        </div>
      </div>

      {/* ── Energy hero + thermal efficiency ── */}
      <div className="shrink-0 overflow-hidden rounded-xl border border-slate-700/60 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]">
        <div className="bg-slate-800 px-5 py-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Annual energy demand
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

            {/* Thermal efficiency row */}
            <div className="border-t border-slate-700/60 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md bg-slate-600/50">
                  <Gauge className="size-4 text-slate-300" />
                </div>
                <span className="text-sm text-slate-300">Thermal efficiency</span>
              </div>
              <div className="text-right">
                <span className="text-base font-bold leading-none" style={{ color: thermalRating.color }}>
                  {thermalRating.label}
                </span>
                {mode === 'expert' && (
                  <span className="ml-1.5 text-[11px] text-slate-500">{avgUValue.toFixed(2)} W/m²K</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Building parameters — always-visible compact table ── */}
      <div className={cn(CARD, 'shrink-0')}>
        <div className="px-4 py-2.5 border-b border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em]">
            Building parameters
          </p>
        </div>
        <table className="w-full text-[11px] bg-white">
          <colgroup>
            <col className="w-[38%]" />
            <col />
            <col className="w-[72px]" />
            <col className="w-7" />
          </colgroup>
          <tbody>
            {snapshotRows.map((row) => {
              const isEditing = editingKey === row.editKey && !!row.editKey;
              return (
                <tr
                  key={row.label}
                  className="group border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  onKeyDown={isEditing ? (e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); saveEditing(row); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
                  } : undefined}
                >
                  <td className="px-4 py-2 text-slate-500">{row.label}</td>

                  {isEditing ? (
                    <td colSpan={3} className="px-4 py-1.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.editType === 'select' ? (
                          <select
                            ref={inputRef as unknown as React.Ref<HTMLSelectElement>}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="flex-1 max-w-[180px] rounded border border-blue-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 outline-none ring-1 ring-blue-200 focus:ring-blue-400"
                          >
                            {row.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : row.editType === 'year-to-period' ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <input
                              ref={inputRef}
                              type="number"
                              min={1800}
                              max={new Date().getFullYear()}
                              placeholder="e.g. 1985"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              className="w-24 rounded border border-blue-300 bg-white px-2 py-0.5 text-right text-[11px] font-medium text-slate-700 outline-none ring-1 ring-blue-200 focus:ring-blue-400"
                            />
                            {draft && Number.isFinite(parseInt(draft, 10)) && (
                              <span className="text-[10px] text-slate-400">
                                → {yearToConstructionPeriod(parseInt(draft, 10))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            ref={inputRef}
                            type={row.editType === 'number' ? 'number' : 'text'}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="w-28 rounded border border-blue-300 bg-white px-2 py-0.5 text-right text-[11px] font-medium text-slate-700 outline-none ring-1 ring-blue-200 focus:ring-blue-400"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => saveEditing(row)}
                          className="flex size-5 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer [&_svg]:size-3 shrink-0"
                        >
                          <Check />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="flex size-5 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer [&_svg]:size-3 shrink-0"
                        >
                          <X />
                        </button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">
                        {row.value}
                      </td>
                      <td className="px-1 py-2 text-center">
                        <SnapshotStatusBadge status={row.status} />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        {row.editKey ? (
                          <button
                            type="button"
                            onClick={() => startEditing(row)}
                            className="invisible group-hover:visible inline-flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 cursor-pointer [&_svg]:size-3 transition-colors"
                          >
                            <Pencil />
                          </button>
                        ) : null}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


    </aside>
    </ScrollHintContainer>
  );
}
