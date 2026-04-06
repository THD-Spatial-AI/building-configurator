// PV system configuration panel for the Configure view.
// Shown when "PV System" is selected in the Technologies section.
// Tilt and azimuth are inferred from the best roof surface on first install
// and remain editable. Expert mode exposes efficiency and economic parameters.

import { useState } from 'react';
import { Sun } from 'lucide-react';
import {
  ConfigSection, NumberInput, FieldLabel, ToggleSwitch, FieldRow,
} from '@/app/components/BuildingConfigurator/shared/ui';
import { cn } from '@/lib/utils';
import type { PvConfig } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compass direction string from an azimuth value in degrees. */
function compassDir(az: number): string {
  const dirs: Array<[number, string]> = [
    [22.5, 'N'], [67.5, 'NE'], [112.5, 'E'], [157.5, 'SE'],
    [202.5, 'S'], [247.5, 'SW'], [292.5, 'W'], [337.5, 'NW'],
  ];
  return dirs.find(([limit]) => az < limit)?.[1] ?? 'N';
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function OrientationSection({ pv, update, roofInferred }: {
  pv: PvConfig;
  update: (patch: Partial<PvConfig>) => void;
  roofInferred: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {roofInferred && (
        <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700 leading-snug">
          Tilt and azimuth were inferred from the largest south-facing roof surface. Edit below to override.
        </p>
      )}
      <FieldRow>
        <div>
          <FieldLabel tip="Panel tilt from horizontal. 0° = flat, 90° = vertical.">
            Tilt
          </FieldLabel>
          <NumberInput
            value={pv.tilt}
            onChange={(v) => update({ tilt: Math.max(0, Math.min(90, v)) })}
            unit="°"
            min={0} max={90} step={1}
          />
        </div>
        <div>
          <FieldLabel tip="Panel compass azimuth. 0° = North, 90° = East, 180° = South.">
            Azimuth
          </FieldLabel>
          <div className="flex items-center gap-1.5">
            <div className="flex-1">
              <NumberInput
                value={pv.azimuth}
                onChange={(v) => update({ azimuth: ((Math.round(v) % 360) + 360) % 360 })}
                unit="°"
                min={0} max={359} step={5}
              />
            </div>
            <span className="shrink-0 min-w-[26px] text-center rounded bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-600">
              {compassDir(pv.azimuth)}
            </span>
          </div>
        </div>
      </FieldRow>
    </div>
  );
}

function SizingSection({ pv, update }: {
  pv: PvConfig;
  update: (patch: Partial<PvConfig>) => void;
}) {
  // Rule of thumb: ~6.5 m² of roof area per kWp for typical silicon panels
  const estimatedArea = (pv.system_capacity * 6.5).toFixed(1);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <FieldLabel tip="Nameplate DC rated capacity of the full system.">
          System capacity
        </FieldLabel>
        <NumberInput
          value={pv.system_capacity}
          onChange={(v) => update({
            system_capacity: Math.max(0, v),
            cont_energy_cap_max: Math.max(v, pv.cont_energy_cap_max),
          })}
          unit="kWp"
          min={0} max={2000} step={0.5}
        />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-1">
        <span className="text-[11px] text-muted-foreground">Estimated roof area needed</span>
        <span className="text-xs font-semibold text-foreground">
          {estimatedArea} <span className="text-[10px] font-normal text-muted-foreground">m²</span>
        </span>
      </div>
    </div>
  );
}

function EfficiencySection({ pv, update }: {
  pv: PvConfig;
  update: (patch: Partial<PvConfig>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        <div>
          <FieldLabel tip="Combined panel and wiring efficiency (0–1). Typical crystalline silicon: 0.15–0.22.">
            Panel efficiency
          </FieldLabel>
          <NumberInput
            value={pv.cont_energy_eff}
            onChange={(v) => update({ cont_energy_eff: Math.max(0, Math.min(1, v)) })}
            unit="–" min={0} max={1} step={0.01}
          />
        </div>
        <div>
          <FieldLabel tip="DC-to-AC conversion efficiency of the inverter (0–1). Typical: 0.95–0.99.">
            Inverter efficiency
          </FieldLabel>
          <NumberInput
            value={pv.inv_eff}
            onChange={(v) => update({ inv_eff: Math.max(0, Math.min(1, v)) })}
            unit="–" min={0} max={1} step={0.01}
          />
        </div>
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel tip="Ratio of DC array capacity to AC inverter rating. Typical: 1.1–1.3.">
            DC/AC ratio
          </FieldLabel>
          <NumberInput
            value={pv.dc_ac_ratio}
            onChange={(v) => update({ dc_ac_ratio: Math.max(0.5, v) })}
            unit="–" min={0.5} max={2} step={0.05}
          />
        </div>
        <div>
          <FieldLabel tip="Aggregate derating factor for dust soiling, temperature, wiring and mismatch.">
            System losses
          </FieldLabel>
          <NumberInput
            value={+(pv.losses * 100).toFixed(1)}
            onChange={(v) => update({ losses: v / 100 })}
            unit="%" min={0} max={50} step={0.5}
          />
        </div>
      </FieldRow>
    </div>
  );
}

function EconomicsSection({ pv, update }: {
  pv: PvConfig;
  update: (patch: Partial<PvConfig>) => void;
}) {
  const totalCapex = Math.round(pv.system_capacity * pv.cost_energy_cap);
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        <div>
          <FieldLabel tip="Capital expenditure per kWp of installed capacity.">
            CapEx
          </FieldLabel>
          <NumberInput
            value={pv.cost_energy_cap}
            onChange={(v) => update({ cost_energy_cap: Math.max(0, v) })}
            unit="€/kWp" min={0} max={5000} step={25}
          />
        </div>
        <div>
          <FieldLabel tip="Annual operation and maintenance cost per kWp installed.">
            Annual O&M
          </FieldLabel>
          <NumberInput
            value={pv.cost_om_annual}
            onChange={(v) => update({ cost_om_annual: Math.max(0, v) })}
            unit="€/kWp/a" min={0} max={200} step={1}
          />
        </div>
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel tip="Expected useful lifetime of the system.">
            Lifetime
          </FieldLabel>
          <NumberInput
            value={pv.cont_lifetime}
            onChange={(v) => update({ cont_lifetime: Math.max(1, Math.round(v)) })}
            unit="years" min={1} max={50} step={1}
          />
        </div>
        <div>
          <FieldLabel tip="Annual discount rate used in net-present-value calculations.">
            Interest rate
          </FieldLabel>
          <NumberInput
            value={+(pv.cost_interest_rate * 100).toFixed(2)}
            onChange={(v) => update({ cost_interest_rate: v / 100 })}
            unit="%" min={0} max={20} step={0.25}
          />
        </div>
      </FieldRow>
      <div className="flex items-center justify-between border-t border-border/60 pt-1">
        <span className="text-[11px] text-muted-foreground">Total system CapEx</span>
        <span className="text-xs font-semibold text-foreground">
          €{totalCapex.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PvEditorProps {
  pvConfig: PvConfig;
  onUpdate: (patch: Partial<PvConfig>) => void;
  mode: 'basic' | 'expert';
  /** True when tilt/azimuth were auto-inferred from the roof geometry this session. */
  roofInferred: boolean;
}

/** PV system parameter editor — shown when the PV entry is selected in the panel. */
export function PvEditor({ pvConfig, onUpdate, mode, roofInferred }: PvEditorProps) {
  const [expanded, setExpanded] = useState({
    orientation: true,
    sizing:      true,
    efficiency:  false,
    economics:   false,
  });

  const toggle = (id: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">

      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-yellow-50">
          <Sun className="size-5 text-yellow-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-800">PV System</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {pvConfig.system_capacity} kWp · {pvConfig.tilt}° tilt · {compassDir(pvConfig.azimuth)} ({pvConfig.azimuth}°)
          </p>
        </div>
        {/* Installed toggle in the header */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-slate-600">Installed</span>
          <ToggleSwitch
            checked={pvConfig.installed}
            onChange={(v) => onUpdate({ installed: v })}
          />
        </div>
      </div>

      {/* Not-installed hint */}
      {!pvConfig.installed && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] text-slate-500 leading-snug">
            Toggle <strong>Installed</strong> to include this PV system in the energy model.
          </p>
        </div>
      )}

      {/* Parameter sections — dimmed while not installed */}
      <div className={cn('flex flex-col gap-2', !pvConfig.installed && 'pointer-events-none opacity-40')}>

        <ConfigSection title="Orientation" expanded={expanded.orientation} onToggle={() => toggle('orientation')}>
          <OrientationSection
            pv={pvConfig}
            update={onUpdate}
            roofInferred={roofInferred && pvConfig.installed}
          />
        </ConfigSection>

        <ConfigSection title="System Size" expanded={expanded.sizing} onToggle={() => toggle('sizing')}>
          <SizingSection pv={pvConfig} update={onUpdate} />
        </ConfigSection>

        {mode === 'expert' && (
          <>
            <ConfigSection title="Efficiency" expanded={expanded.efficiency} onToggle={() => toggle('efficiency')}>
              <EfficiencySection pv={pvConfig} update={onUpdate} />
            </ConfigSection>

            <ConfigSection title="Economics" expanded={expanded.economics} onToggle={() => toggle('economics')}>
              <EconomicsSection pv={pvConfig} update={onUpdate} />
            </ConfigSection>
          </>
        )}
      </div>
    </div>
  );
}
