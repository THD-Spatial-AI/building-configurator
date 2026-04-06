import React from 'react';
import { Zap, Flame, Droplets } from 'lucide-react';
import {
  NumberInput, SelectInput, FieldRow, FieldLabel,
  ConfigSection, ToggleSwitch, InlineStepper, InfoTip,
} from '@/app/components/BuildingConfigurator/shared/ui';

import {
  BUILDING_TYPE_OPTIONS,
  CONSTRUCTION_PERIOD_OPTIONS,
  COUNTRY_OPTIONS,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';

// ─── Options ──────────────────────────────────────────────────────────────────

// Map shared options to the { value, label } shape expected by SelectInput in this view.
const BUILDING_TYPES    = BUILDING_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const CONSTRUCTION_PERIODS = CONSTRUCTION_PERIOD_OPTIONS;
const COUNTRIES         = COUNTRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

const MASS_CLASSES = [
  { value: 'VeryLight', label: 'Very Light — steel/timber frame'   },
  { value: 'Light',     label: 'Light — lightweight construction'  },
  { value: 'Medium',    label: 'Medium — mixed construction'       },
  { value: 'Heavy',     label: 'Heavy — concrete / masonry'        },
  { value: 'VeryHeavy', label: 'Very Heavy — thick solid walls'    },
];

const MASS_DEFAULTS: Record<string, number> = {
  VeryLight: 50, Light: 80, Medium: 110, Heavy: 165, VeryHeavy: 260,
};

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-px bg-border my-2" />;
}

// ─── Read-only label + value row ──────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GeneralConfigProps {
  mode: 'basic' | 'expert';
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
}

export function GeneralConfig({ mode, general, setGen, expanded, toggle }: GeneralConfigProps) {
  const floorArea  = general.floorArea  as number;
  const roomHeight = general.roomHeight as number;
  const storeys    = general.storeys    as number;
  const volume     = floorArea * roomHeight;

  return (
    <div className="flex flex-col gap-2">

      {/* ── Energy Demand Profile ── */}
      <ConfigSection title="Energy Demand Profile" expanded={expanded.demand} onToggle={() => toggle('demand')}>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {([
            { key: 'electricityDemand',  label: 'Electricity',   icon: <Zap     className="size-3.5 text-yellow-500 shrink-0" />, tip: undefined },
            { key: 'spaceHeatingDemand', label: 'Space heating', icon: <Flame   className="size-3.5 text-orange-500 shrink-0" />, tip: undefined },
            { key: 'dhwDemand',          label: 'DHW',           icon: <Droplets className="size-3.5 text-blue-500 shrink-0" />,  tip: 'Annual domestic hot water energy demand.' },
          ] as const).map(({ key, label, icon, tip }) => (
            <div key={key} className="rounded-lg border border-slate-200/90 bg-slate-50/60 p-2.5">
              <div className="mb-2 flex items-center gap-1.5">
                {icon}
                <span className="text-[11px] font-medium text-muted-foreground truncate">{label}</span>
                {tip && <InfoTip tip={tip} />}
              </div>
              <NumberInput
                value={general[key]}
                onChange={(v) => setGen(key, Math.max(0, v))}
                unit="kWh/year"
                step={100}
                min={0}
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      {/* ── Identity ── */}
      <ConfigSection title="Identity" expanded={expanded.identity} onToggle={() => toggle('identity')}>
        <div className="grid gap-3 lg:grid-cols-2">
          <SelectInput
            label="Building type"
            value={general.buildingType}
            onChange={(v) => setGen('buildingType', v)}
            options={BUILDING_TYPES}
          />
          <SelectInput
            label="Construction period"
            value={general.constructionPeriod}
            onChange={(v) => setGen('constructionPeriod', v)}
            options={CONSTRUCTION_PERIODS}
          />
          <div className="lg:col-span-2">
            <SelectInput
              label="Country / climate region"
              value={general.country}
              onChange={(v) => setGen('country', v)}
              options={COUNTRIES}
            />
          </div>
        </div>
      </ConfigSection>

      {/* ── Metrics ── */}
      <ConfigSection title="Metrics" expanded={expanded.metrics} onToggle={() => toggle('metrics')}>
        <div className="flex flex-col gap-3">
          <FieldRow>
            <NumberInput
              label="Floor area"
              value={floorArea}
              onChange={(v) => setGen('floorArea', Math.max(1, v))}
              unit="m²" min={1} step={0.5}
            />
            <NumberInput
              label="Room height"
              value={roomHeight}
              onChange={(v) => setGen('roomHeight', Math.max(1.8, v))}
              unit="m" min={1.8} max={8} step={0.1}
            />
          </FieldRow>

          <InlineStepper
            label="Storeys above ground"
            value={storeys}
            min={1}
            onDecrement={() => setGen('storeys', storeys - 1)}
            onIncrement={() => setGen('storeys', storeys + 1)}
          />

          <Divider />

          <InfoRow label="Volume (approx.)">
            <span className="text-xs font-semibold text-foreground">
              {volume.toFixed(0)}{' '}
              <span className="text-[10px] text-muted-foreground font-normal">m³</span>
            </span>
          </InfoRow>
          <InfoRow label="Per storey area">
            <span className="text-xs font-semibold text-foreground">
              {(floorArea / Math.max(1, storeys)).toFixed(1)}{' '}
              <span className="text-[10px] text-muted-foreground font-normal">m²</span>
            </span>
          </InfoRow>
        </div>
      </ConfigSection>

      {/* ── Expert-only sections ── */}
      {mode === 'expert' && (
        <>
          {/* Ventilation */}
          <ConfigSection title="Ventilation" expanded={expanded.ventilation} onToggle={() => toggle('ventilation')}>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                <FieldLabel tip="Air changes per hour due to uncontrolled infiltration through the building envelope.">
                  Air infiltration rate
                </FieldLabel>
                <NumberInput
                  value={general.n_air_infiltration}
                  onChange={(v) => setGen('n_air_infiltration', Math.max(0, v))}
                  unit="h⁻¹" min={0} max={5} step={0.05}
                />
                </div>
                <div>
                <FieldLabel tip="Controlled ventilation air change rate due to occupant activity and mechanical systems.">
                  Ventilation use rate
                </FieldLabel>
                <NumberInput
                  value={general.n_air_use}
                  onChange={(v) => setGen('n_air_use', Math.max(0, v))}
                  unit="h⁻¹" min={0} max={5} step={0.05}
                />
                </div>
              </div>
              <Divider />
              <InfoRow label="Total ACH">
                <span className="text-xs font-semibold text-foreground">
                  {(general.n_air_infiltration + general.n_air_use).toFixed(2)}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">h⁻¹</span>
                </span>
              </InfoRow>
            </div>
          </ConfigSection>

          {/* Internal loads */}
          <ConfigSection title="Internal Loads" expanded={expanded.internal} onToggle={() => toggle('internal')}>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                <FieldLabel tip="Mean internal heat gains from occupants, lighting and appliances per unit floor area.">
                  Internal gains φ_int
                </FieldLabel>
                <NumberInput
                  value={general.phi_int}
                  onChange={(v) => setGen('phi_int', Math.max(0, v))}
                  unit="W/m²" min={0} max={30} step={0.1}
                />
                </div>
                <div>
                <FieldLabel tip="Annual hot water energy demand per unit floor area (net energy needed).">
                  DHW demand q_w
                </FieldLabel>
                <NumberInput
                  value={general.q_w_nd}
                  onChange={(v) => setGen('q_w_nd', Math.max(0, v))}
                  unit="kWh/m²a" min={0} max={100} step={0.5}
                />
                </div>
              </div>
              <Divider />
              <InfoRow label="Annual internal gains">
                <span className="text-xs font-semibold text-foreground">
                  {(general.phi_int * floorArea * 8760 / 1000).toFixed(0)}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">kWh/a</span>
                </span>
              </InfoRow>
            </div>
          </ConfigSection>

          {/* Thermal mass */}
          <ConfigSection title="Thermal Mass" expanded={expanded.thermal} onToggle={() => toggle('thermal')}>
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <SelectInput
                  label="Mass class"
                  value={general.massClass}
                  onChange={(v) => {
                    setGen('massClass', v);
                    setGen('c_m', MASS_DEFAULTS[v] ?? general.c_m);
                  }}
                  options={MASS_CLASSES}
                />
                <div>
                  <FieldLabel tip="Effective thermal capacity of the building per unit floor area. Auto-set from mass class but editable.">
                    Thermal capacity c_m
                  </FieldLabel>
                  <NumberInput
                    value={general.c_m}
                    onChange={(v) => setGen('c_m', Math.max(10, v))}
                    unit="kJ/m²K" min={10} max={500} step={5}
                  />
                </div>
              </div>
              <Divider />
              <InfoRow label="Total thermal mass">
                <span className="text-xs font-semibold text-foreground">
                  {(general.c_m * floorArea / 1000).toFixed(1)}{' '}
                  <span className="text-[10px] text-muted-foreground font-normal">MJ/K</span>
                </span>
              </InfoRow>
            </div>
          </ConfigSection>

          {/* Solver */}
          <ConfigSection title="Solver" expanded={expanded.solver} onToggle={() => toggle('solver')}>
            <div className="flex flex-col gap-3">
              <ToggleSwitch
                checked={general.use_milp}
                onChange={(v) => setGen('use_milp', v)}
                label="Use MILP optimiser"
                tip="Mixed-integer linear programming for optimal dispatch scheduling. Slower but globally optimal."
              />
              <div
                className="rounded-[6px] px-3 py-2 transition-all duration-200"
                style={{
                  backgroundColor: general.use_milp ? 'rgba(47,93,138,0.05)' : undefined,
                  border: `1px solid ${general.use_milp ? 'rgba(47,93,138,0.25)' : 'var(--color-border)'}`,
                }}
              >
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {general.use_milp
                    ? 'MILP is active — dispatch schedule will be globally optimised. Expect 2–5× longer computation.'
                    : 'Using rule-based dispatch (fast heuristic). Enable MILP for optimal results.'}
                </p>
              </div>
            </div>
          </ConfigSection>
        </>
      )}
    </div>
  );
}
