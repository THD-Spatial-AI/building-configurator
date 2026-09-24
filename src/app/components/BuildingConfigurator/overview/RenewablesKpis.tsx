// Headline renewable figures for the overview, in the units people quote them
// in. The arithmetic lives in renewableKpis.ts.

import React from 'react';
import { BatteryCharging, Sun, SquareStack } from 'lucide-react';
import { renewableKpis } from '../shared/renewableKpis';
import type { BuildingElement } from '../configure/model/buildingElements';
import type { BatteryConfig, PvConfig } from '../shared/buildingDefaults';

interface RenewablesKpisProps {
  pvSurfaces: { element: BuildingElement; pv: PvConfig }[];
  elements: Record<string, BuildingElement>;
  battery: BatteryConfig;
}

function Tile({ Icon, label, value, unit, detail, note }: {
  Icon: typeof Sun;
  label: string;
  value: string;
  unit: string;
  detail: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-slate-400" />
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 leading-none">
        <span className="text-xl font-semibold text-slate-800">{value}</span>
        <span className="ml-1 text-[10px] text-slate-400">{unit}</span>
      </p>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">{detail}</p>
      {note && <p className="text-[10px] leading-snug text-slate-400">{note}</p>}
    </div>
  );
}

export function RenewablesKpis({ pvSurfaces, elements, battery }: RenewablesKpisProps) {
  const kpis = renewableKpis(pvSurfaces, elements, battery);

  if (!kpis.installed) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3">
        <p className="text-[11px] leading-snug text-muted-foreground">
          No renewable technology installed. Add solar PV to a surface, or enable the
          battery, in the Technology tab.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile
        Icon={Sun}
        label="Solar PV"
        value={kpis.pvCapacityKwp.toFixed(1)}
        unit="kWp"
        detail={kpis.pvSurfaceCount > 0
          ? `on ${kpis.pvSurfaceCount} surface${kpis.pvSurfaceCount > 1 ? 's' : ''}`
          : 'none installed'}
      />
      <Tile
        Icon={BatteryCharging}
        label="Battery"
        value={String(kpis.batteryStorageKwh)}
        unit="kWh"
        detail={battery.installed ? `${kpis.batteryPowerKw} kW power` : 'none installed'}
      />
      <Tile
        Icon={SquareStack}
        label="Roof with PV"
        value={kpis.roofSharePercent.toFixed(0)}
        unit="%"
        detail={kpis.roofArea > 0
          ? `${kpis.roofAreaWithPv.toFixed(0)} of ${kpis.roofArea.toFixed(0)} m²`
          : 'no roof surfaces'}
        note={kpis.nonRoofCapacityKwp > 0
          ? `+${kpis.nonRoofCapacityKwp.toFixed(1)} kWp off the roof`
          : undefined}
      />
    </div>
  );
}
