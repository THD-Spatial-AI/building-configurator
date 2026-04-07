// Overview technology cards. Card body opens the relevant configure flow.
// Building-level technologies keep a small install toggle in the footer.

import React from 'react';
import { Battery, ChevronRight, Plug, Sun, Thermometer } from 'lucide-react';

import { cn } from '../../../../lib/utils';

type TechnologyId = 'solar_pv' | 'battery' | 'heat_pump' | 'ev_charger';

interface PvSummary {
  installed: boolean;
  surfaceCount: number;
  totalCapacityKw: number;
}

interface Technology {
  id: TechnologyId;
  label: string;
  Icon: React.ElementType;
  installed: boolean;
  summary: string;
  detail: string;
  togglable: boolean;
}

const BUILDING_TECHNOLOGIES: Array<Pick<Technology, 'id' | 'label' | 'Icon'>> = [
  { id: 'battery',    label: 'Battery',    Icon: Battery },
  { id: 'heat_pump',  label: 'Heat Pump',  Icon: Thermometer },
  { id: 'ev_charger', label: 'EV Charger', Icon: Plug },
];

function buildTechList(installedIds: string[], pvSummary: PvSummary): Technology[] {
  const buildingTechs = BUILDING_TECHNOLOGIES.map((tech) => {
    const installed = installedIds.includes(tech.id);
    return {
      ...tech,
      installed,
      summary: installed ? 'Installed' : 'Not installed',
      detail: installed ? 'Open configuration' : 'Enable or review in configure',
      togglable: true,
    } satisfies Technology;
  });

  const pvTech: Technology = pvSummary.installed
    ? {
        id: 'solar_pv',
        label: 'Solar PV',
        Icon: Sun,
        installed: true,
        summary: `${pvSummary.totalCapacityKw.toFixed(1)} kWp`,
        detail: `${pvSummary.surfaceCount} ${pvSummary.surfaceCount === 1 ? 'surface' : 'surfaces'} configured`,
        togglable: false,
      }
    : {
        id: 'solar_pv',
        label: 'Solar PV',
        Icon: Sun,
        installed: false,
        summary: 'Not installed',
        detail: 'Configure per surface',
        togglable: false,
      };

  return [pvTech, ...buildingTechs];
}

interface TechnologiesSectionProps {
  installedTechIds?: string[];
  pvSummary: PvSummary;
  onToggle?: (id: string, installed: boolean) => void;
  onOpen?: (id: TechnologyId) => void;
}

/** Grid of overview cards for installed and configurable technologies. */
export function TechnologiesSection({
  installedTechIds = [],
  pvSummary,
  onToggle,
  onOpen,
}: TechnologiesSectionProps) {
  const techs = buildTechList(installedTechIds, pvSummary);

  return (
    <div className="grid grid-cols-4 gap-2">
      {techs.map(({ id, label, Icon, installed, summary, detail, togglable }) => (
        <div
          key={id}
          className={cn(
            'overflow-hidden rounded-lg border transition-colors',
            installed
              ? 'border-slate-300 bg-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.10),0_4px_12px_rgba(15,23,42,0.12)]'
              : 'border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.07)]',
          )}
        >
          <button
            type="button"
            onClick={() => onOpen?.(id)}
            className={cn(
              'flex w-full items-start gap-2 px-3 py-3 text-left transition-colors',
              installed ? 'hover:bg-white/5' : 'hover:bg-slate-50',
            )}
          >
            <div className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md',
              installed ? 'bg-white/15' : 'bg-slate-100',
            )}>
              <Icon className={cn('size-4', installed ? 'text-white' : 'text-slate-500')} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-[11px] font-semibold leading-tight', installed ? 'text-white' : 'text-foreground')}>
                  {label}
                </p>
                <ChevronRight className={cn('mt-0.5 size-3 shrink-0', installed ? 'text-slate-300' : 'text-slate-400')} />
              </div>
              <p className={cn('mt-1 text-[13px] font-bold leading-tight', installed ? 'text-white' : 'text-slate-700')}>
                {summary}
              </p>
              <p className={cn('mt-0.5 text-[10px] leading-tight', installed ? 'text-slate-300' : 'text-slate-400')}>
                {detail}
              </p>
            </div>
          </button>

          <div className={cn(
            'flex items-center justify-between border-t px-3 py-2',
            installed ? 'border-white/10 bg-black/10' : 'border-slate-100 bg-slate-50/70',
          )}>
            <span className={cn('text-[10px] font-semibold uppercase tracking-[0.08em]', installed ? 'text-slate-300' : 'text-slate-400')}>
              {togglable ? 'Status' : 'Scope'}
            </span>

            {togglable ? (
              <button
                type="button"
                onClick={() => onToggle?.(id, !installed)}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                  installed
                    ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100',
                )}
              >
                {installed ? 'Installed' : 'Enable'}
              </button>
            ) : (
              <span className={cn('text-[10px] font-semibold', installed ? 'text-slate-200' : 'text-slate-500')}>
                Per surface
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
