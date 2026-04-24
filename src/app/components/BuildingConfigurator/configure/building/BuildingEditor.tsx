// Building-level configuration panel for the Configure view.
// Shown when the user selects "Building" in the panel selector (not a surface).
// Edits the same `general` state as GeneralConfig in the Overview view.

import { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import {
  SelectInput, NumberInput, FieldLabel,
  ToggleSwitch, FieldRow, ScrollHintContainer,
} from '@/app/components/BuildingConfigurator/shared/ui';
import { cn } from '@/lib/utils';
import {
  BUILDING_TYPE_OPTIONS,
  CONSTRUCTION_PERIOD_OPTIONS,
  COUNTRY_OPTIONS,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';

type SectionKey = 'identity' | 'conditions' | 'ventilation' | 'loads' | 'thermal' | 'solver';

// ─── Attached-neighbours visual picker ────────────────────────────────────────

type NeighbourCode = 'B_Alone' | 'B_N1' | 'B_N2';

const NEIGHBOUR_DEFS: Array<{ value: NeighbourCode; label: string; subtitle: string }> = [
  { value: 'B_Alone', label: 'Detached',      subtitle: 'No shared walls' },
  { value: 'B_N1',    label: 'Semi-detached', subtitle: 'One shared wall' },
  { value: 'B_N2',    label: 'Terraced',      subtitle: 'Two shared walls' },
];

/** Front-elevation SVG for each neighbour configuration.
 *  Subject building is drawn in the brand primary; neighbours in neutral gray. */
function NeighbourSvg({ type, active }: { type: NeighbourCode; active: boolean }) {
  const subject  = active ? '#2f5d8a' : '#64748b';
  const subjectR = active ? 'rgba(47,93,138,0.82)' : 'rgba(100,116,139,0.8)';
  const neigh    = '#e2e8f0';
  const neighR   = '#cbd5e1';
  const ground   = '#cbd5e1';

  return (
    <svg viewBox="0 0 90 52" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
      {/* Ground line */}
      <line x1="0" y1="47" x2="90" y2="47" stroke={ground} strokeWidth="1.5" />

      {type === 'B_Alone' && (
        /* Single house centred, open space either side */
        <>
          <rect x="25" y="27" width="40" height="20" fill={subject} />
          <polygon points="25,27 45,12 65,27" fill={subjectR} />
          {/* Small window */}
          <rect x="36" y="33" width="8" height="7" fill="white" opacity="0.25" rx="1" />
        </>
      )}

      {type === 'B_N1' && (
        /* Subject on the left, one neighbour sharing the right wall */
        <>
          {/* Neighbour (right) — drawn first so subject wall overlaps shared edge */}
          <rect x="46" y="29" width="30" height="18" fill={neigh} />
          <polygon points="46,29 61,17 76,29" fill={neighR} />
          <rect x="54" y="34" width="7" height="6" fill="white" opacity="0.3" rx="1" />
          {/* Subject (left) */}
          <rect x="10" y="27" width="36" height="20" fill={subject} />
          <polygon points="10,27 28,12 46,27" fill={subjectR} />
          <rect x="19" y="33" width="8" height="7" fill="white" opacity="0.25" rx="1" />
          {/* Shared wall seam */}
          <line x1="46" y1="27" x2="46" y2="47" stroke="white" strokeWidth="1" strokeOpacity="0.35" />
        </>
      )}

      {type === 'B_N2' && (
        /* Neighbours on both sides, subject in the middle */
        <>
          {/* Left neighbour */}
          <rect x="4" y="29" width="24" height="18" fill={neigh} />
          <polygon points="4,29 16,19 28,29" fill={neighR} />
          {/* Right neighbour */}
          <rect x="60" y="29" width="24" height="18" fill={neigh} />
          <polygon points="60,29 72,19 84,29" fill={neighR} />
          {/* Subject (centre) */}
          <rect x="28" y="27" width="32" height="20" fill={subject} />
          <polygon points="28,27 44,12 60,27" fill={subjectR} />
          <rect x="37" y="33" width="8" height="7" fill="white" opacity="0.25" rx="1" />
          {/* Shared wall seams */}
          <line x1="28" y1="27" x2="28" y2="47" stroke="white" strokeWidth="1" strokeOpacity="0.35" />
          <line x1="60" y1="27" x2="60" y2="47" stroke="white" strokeWidth="1" strokeOpacity="0.35" />
        </>
      )}
    </svg>
  );
}

/** Three-card visual picker for the attached-neighbours TABULA code. */
function NeighbourPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel tip="Whether the building shares walls with adjacent buildings. Affects transmission heat loss via the shared wall correction factor.">
        Attached neighbours
      </FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {NEIGHBOUR_DEFS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex cursor-pointer flex-col rounded-lg border p-2 text-center transition-all',
                active
                  ? 'border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80',
              )}
            >
              <NeighbourSvg type={opt.value} active={active} />
              <p className={cn(
                'mt-1.5 text-[10px] font-semibold leading-tight',
                active ? 'text-primary' : 'text-slate-700',
              )}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{opt.subtitle}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Conditioning state options with full-form labels and contextual hints.
 *  The `hint` explains the energy-model impact of each choice. */
const COND_OPTIONS: Array<{ value: string; label: string; hint: string }> = [
  {
    value: '-',
    label: 'Not applicable',
    hint:  'This space does not exist — no heat loss is applied to the adjacent surface.',
  },
  {
    value: 'N',
    label: 'Not conditioned',
    hint:  'Unheated and uncooled — the adjacent ceiling or floor is a heat-loss boundary.',
  },
  {
    value: 'P',
    label: 'Partly conditioned',
    hint:  'Intermittently heated — a reduced heat-loss factor is applied to the adjacent surface.',
  },
  {
    value: 'C',
    label: 'Conditioned',
    hint:  'Fully heated and cooled — the adjacent ceiling or floor is not a heat-loss boundary.',
  },
  {
    value: 'NI',
    label: 'Not insulated',
    hint:  'Uninsulated space — full heat loss is applied; no insulation credit given.',
  },
  {
    value: 'PI',
    label: 'Partly insulated',
    hint:  'Some insulation is present — partial reduction in heat loss through the adjacent surface.',
  },
];

/**
 * Custom listbox for condition codes.
 * The trigger matches the native cfg-select appearance.
 * The dropdown uses position:fixed with getBoundingClientRect so it escapes
 * the overflow:hidden accordion wrapper without clipping.
 * Each option reveals its hint text via a CSS max-height transition on hover.
 */
function CondSelect({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Close on outside click (checks both trigger and dropdown panel).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen((v) => !v);
  };

  const selectedOpt = COND_OPTIONS.find((o) => o.value === value);

  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center gap-1">
          <span className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>
        </div>
      )}

      {/* Trigger — visually identical to cfg-select */}
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-[var(--input-background)] px-3 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <span className="truncate text-[11px] text-foreground">
          {selectedOpt?.label ?? value}
        </span>
        <ChevronDown className={cn(
          'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
          open && 'rotate-180',
        )} />
      </button>

      {/* Dropdown panel — fixed position escapes overflow:hidden accordion ancestors */}
      {open && dropRect && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: dropRect.top, left: dropRect.left, width: dropRect.width, zIndex: 200 }}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {COND_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  'group w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 transition-colors hover:bg-slate-50',
                  isSelected && 'bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-[11px]',
                    isSelected ? 'font-semibold text-primary' : 'font-medium text-slate-700',
                  )}>
                    {opt.label}
                  </span>
                  {isSelected && <Check className="size-3 shrink-0 text-primary" />}
                </div>
                {/* Hint slides in on hover via max-height CSS transition */}
                <p className="max-h-0 overflow-hidden text-[10px] leading-snug text-slate-400 transition-all duration-150 group-hover:mt-0.5 group-hover:max-h-10">
                  {opt.hint}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FOOTPRINT_OPTIONS = [
  { value: 'Simple',   label: 'Simple' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Complex',  label: 'Complex' },
];

const ROOF_OPTIONS = [
  { value: 'no',  label: 'Simple' },
  { value: 'yes', label: 'Complex' },
];

const MASS_CLASSES = [
  { value: 'VeryLight', label: 'Very Light — steel/timber frame' },
  { value: 'Light',     label: 'Light — lightweight construction' },
  { value: 'Medium',    label: 'Medium — mixed construction' },
  { value: 'Heavy',     label: 'Heavy — concrete / masonry' },
  { value: 'VeryHeavy', label: 'Very Heavy — thick solid walls' },
];

const MASS_DEFAULTS: Record<string, number> = {
  VeryLight: 50, Light: 80, Medium: 110, Heavy: 165, VeryHeavy: 260,
};

// ─── Section components ───────────────────────────────────────────────────────

/** Building identity fields — synced with the overview snapshot panel. */
function IdentitySection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  const volume = (general.floorArea * general.roomHeight).toFixed(0);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <FieldLabel tip="Human-readable name for this building. Included in exported files.">
          Building name
        </FieldLabel>
        <input
          type="text"
          value={general.buildingName ?? ''}
          onChange={(e) => setGen('buildingName', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="e.g. 3434 · Single-family House"
          className="cfg-input w-full"
        />
      </div>
      <SelectInput
        label="Building type"
        value={general.buildingType}
        onChange={(v) => setGen('buildingType', v)}
        options={BUILDING_TYPE_OPTIONS}
        tip="TABULA building category. Affects default U-values and reference energy demand patterns."
      />
      <FieldRow>
        <SelectInput
          label="Country"
          value={general.country}
          onChange={(v) => setGen('country', v)}
          options={COUNTRY_OPTIONS}
          tip="Country used to select TABULA reference data and COSMO weather station."
        />
        <SelectInput
          label="Construction period"
          value={general.constructionPeriod}
          onChange={(v) => setGen('constructionPeriod', v)}
          options={CONSTRUCTION_PERIOD_OPTIONS}
          tip="Construction era determines default U-values via TABULA lookup. Edit to override."
        />
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel tip="Conditioned floor area of the building (all storeys combined).">
            Floor area
          </FieldLabel>
          <NumberInput
            value={general.floorArea}
            onChange={(v) => setGen('floorArea', Math.max(1, v))}
            unit="m²" min={1} max={50000} step={1}
          />
        </div>
        <div>
          <FieldLabel tip="Number of above-ground storeys.">
            Storeys
          </FieldLabel>
          <NumberInput
            value={general.storeys}
            onChange={(v) => setGen('storeys', Math.max(1, Math.round(v)))}
            unit="" min={1} max={50} step={1}
          />
        </div>
      </FieldRow>
      <div>
        <FieldLabel tip="Clear internal height per storey. Used to compute the heated air volume.">
          Room height
        </FieldLabel>
        <NumberInput
          value={general.roomHeight}
          onChange={(v) => setGen('roomHeight', Math.max(1.5, v))}
          unit="m" min={1.5} max={10} step={0.1}
        />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-1">
        <span className="text-[11px] text-muted-foreground">Heated volume</span>
        <span className="text-xs font-semibold text-foreground">
          {volume} <span className="text-[10px] font-normal text-muted-foreground">m³</span>
        </span>
      </div>
    </div>
  );
}

function ConditionsSection({ general, setGen, mode }: { general: Record<string, any>; setGen: (k: string, v: any) => void; mode: string }) {
  return (
    <div className="flex flex-col gap-3">
      <NeighbourPicker
        value={general.Code_AttachedNeighbours}
        onChange={(v) => setGen('Code_AttachedNeighbours', v)}
      />
      <FieldRow>
        <CondSelect
          label="Attic condition"
          value={general.Code_AtticCond}
          onChange={(v) => setGen('Code_AtticCond', v)}
        />
        <CondSelect
          label="Cellar condition"
          value={general.Code_CellarCond}
          onChange={(v) => setGen('Code_CellarCond', v)}
        />
      </FieldRow>
      {mode === 'expert' && (
        <FieldRow>
          <SelectInput
            label="Footprint complexity"
            value={general.Code_ComplexFootprint}
            onChange={(v) => setGen('Code_ComplexFootprint', v)}
            options={FOOTPRINT_OPTIONS}
            tip="Geometric complexity of the building's floor plan. Affects envelope area correction."
          />
          <SelectInput
            label="Complex roof"
            value={general.Code_ComplexRoof}
            onChange={(v) => setGen('Code_ComplexRoof', v)}
            options={ROOF_OPTIONS}
            tip="Whether the roof has a complex shape. Affects roof area correction."
          />
        </FieldRow>
      )}
    </div>
  );
}

function VentilationSection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  const total = (general.n_air_infiltration + general.n_air_use).toFixed(2);
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        <div>
          <FieldLabel tip="Uncontrolled air changes per hour through gaps in the building envelope.">
            Air infiltration rate
          </FieldLabel>
          <NumberInput value={general.n_air_infiltration} onChange={(v) => setGen('n_air_infiltration', Math.max(0, v))} unit="h⁻¹" min={0} max={5} step={0.05} />
        </div>
        <div>
          <FieldLabel tip="Controlled ventilation air change rate from occupant activity and mechanical systems.">
            Ventilation use rate
          </FieldLabel>
          <NumberInput value={general.n_air_use} onChange={(v) => setGen('n_air_use', Math.max(0, v))} unit="h⁻¹" min={0} max={5} step={0.05} />
        </div>
      </FieldRow>
      <div className="flex items-center justify-between border-t border-border/60 pt-1">
        <span className="text-[11px] text-muted-foreground">Total ACH</span>
        <span className="text-xs font-semibold text-foreground">{total} <span className="text-[10px] font-normal text-muted-foreground">h⁻¹</span></span>
      </div>
    </div>
  );
}

function InternalLoadsSection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  const annualGains = (general.phi_int * general.floorArea * 8760 / 1000).toFixed(0);
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        <div>
          <FieldLabel tip="Mean heat gains from occupants, lighting and appliances per unit floor area.">
            Internal gains φ_int
          </FieldLabel>
          <NumberInput value={general.phi_int} onChange={(v) => setGen('phi_int', Math.max(0, v))} unit="W/m²" min={0} max={30} step={0.1} />
        </div>
        <div>
          <FieldLabel tip="Annual domestic hot water energy demand per unit floor area.">
            DHW demand q_w
          </FieldLabel>
          <NumberInput value={general.q_w_nd} onChange={(v) => setGen('q_w_nd', Math.max(0, v))} unit="kWh/m²a" min={0} max={100} step={0.5} />
        </div>
      </FieldRow>
      <div className="flex items-center justify-between border-t border-border/60 pt-1">
        <span className="text-[11px] text-muted-foreground">Annual internal gains</span>
        <span className="text-xs font-semibold text-foreground">{annualGains} <span className="text-[10px] font-normal text-muted-foreground">kWh/a</span></span>
      </div>
    </div>
  );
}

function ThermalMassSection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  const totalMass = (general.c_m * general.floorArea / 1000).toFixed(1);
  return (
    <div className="flex flex-col gap-3">
      <FieldRow>
        <SelectInput
          label="Mass class"
          value={general.massClass}
          onChange={(v) => { setGen('massClass', v); setGen('c_m', MASS_DEFAULTS[v] ?? general.c_m); }}
          options={MASS_CLASSES}
        />
        <div>
          <FieldLabel tip="Effective thermal capacity per unit floor area. Auto-set from mass class but editable.">
            Thermal capacity c_m
          </FieldLabel>
          <NumberInput value={general.c_m} onChange={(v) => setGen('c_m', Math.max(10, v))} unit="kJ/m²K" min={10} max={500} step={5} />
        </div>
      </FieldRow>
      <div className="flex items-center justify-between border-t border-border/60 pt-1">
        <span className="text-[11px] text-muted-foreground">Total thermal mass</span>
        <span className="text-xs font-semibold text-foreground">{totalMass} <span className="text-[10px] font-normal text-muted-foreground">MJ/K</span></span>
      </div>
    </div>
  );
}

function SolverSection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ToggleSwitch
        checked={general.use_milp}
        onChange={(v) => setGen('use_milp', v)}
        label="Use MILP optimiser"
        tip="Mixed-integer linear programming for optimal dispatch. Slower but globally optimal."
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
            ? 'MILP active — dispatch schedule globally optimised. Expect 2–5× longer computation.'
            : 'Using rule-based dispatch (fast heuristic). Enable MILP for optimal results.'}
        </p>
      </div>
    </div>
  );
}

// ─── Section metadata ─────────────────────────────────────────────────────────

/** Colour dot for each section — mirrors the element-dot pattern used in surfaces. */
const SECTION_COLORS: Record<SectionKey, string> = {
  identity:    '#2f5d8a',
  conditions:  '#64748b',
  ventilation: '#0891b2',
  loads:       '#d97706',
  thermal:     '#dc2626',
  solver:      '#7c3aed',
};

const SECTION_LABELS: Record<SectionKey, string> = {
  identity:    'Basic info',
  conditions:  'Site & Surroundings',
  ventilation: 'Air & Ventilation',
  loads:       'Appliances & Occupancy',
  thermal:     'Heat Storage Capacity',
  solver:      'Calculation Method',
};

/** One-line value summary shown on the grid card and chip. */
function sectionSummary(key: SectionKey, general: Record<string, any>): string {
  switch (key) {
    case 'identity':    return `${general.buildingType} · ${general.floorArea} m²`;
    case 'conditions': {
      const map: Record<string, string> = { B_Alone: 'Detached', B_N1: 'Semi-detached', B_N2: 'Terraced' };
      return map[general.Code_AttachedNeighbours] ?? general.Code_AttachedNeighbours;
    }
    case 'ventilation': return `ACH ${(general.n_air_infiltration + general.n_air_use).toFixed(2)} h⁻¹`;
    case 'loads':       return `φ_int ${general.phi_int} W/m²`;
    case 'thermal':     return general.massClass ?? '—';
    case 'solver':      return general.use_milp ? 'MILP' : 'Rule-based';
  }
}

/** Renders the content body for a given section key. */
function SectionBody({
  id, general, setGen, mode,
}: {
  id: SectionKey;
  general: Record<string, any>;
  setGen: (k: string, v: any) => void;
  mode: string;
}) {
  switch (id) {
    case 'identity':    return <IdentitySection    general={general} setGen={setGen} />;
    case 'conditions':  return <ConditionsSection  general={general} setGen={setGen} mode={mode} />;
    case 'ventilation': return <VentilationSection general={general} setGen={setGen} />;
    case 'loads':       return <InternalLoadsSection general={general} setGen={setGen} />;
    case 'thermal':     return <ThermalMassSection general={general} setGen={setGen} />;
    case 'solver':      return <SolverSection      general={general} setGen={setGen} />;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BuildingEditorProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  mode: 'basic' | 'expert';
}

/**
 * Building-level parameter editor shown when "Building" is selected in the panel.
 *
 * Layout mirrors the surface ElementList pattern:
 *  - No section active -> 2-column grid of summary cards.
 *  - Section active -> inactive sections collapse to compact chips at the top;
 *    the active section fills the remaining height with a scrollable body.
 */
export function BuildingEditor({ general, setGen, mode }: BuildingEditorProps) {
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  const ALL_SECTIONS: SectionKey[] = ['identity', 'conditions'];
  const EXPERT_SECTIONS: SectionKey[] = ['ventilation', 'loads', 'thermal', 'solver'];
  const visibleSections = mode === 'expert'
    ? [...ALL_SECTIONS, ...EXPERT_SECTIONS]
    : ALL_SECTIONS;

  const toggle = (id: SectionKey) =>
    setActiveSection((prev) => (prev === id ? null : id));

  // ── Shared header ────────────────────────────────────────────────────────────
  const header = (
    <div className="flex shrink-0 items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Building2 className="size-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{general.buildingName || 'Building'}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {general.buildingType} · {general.constructionPeriod} · {general.floorArea} m²
        </p>
      </div>
    </div>
  );

  // ── Active section: chips row + expanded card ─────────────────────────────────
  if (activeSection) {
    const chips = visibleSections.filter((k) => k !== activeSection);
    const dotColor = SECTION_COLORS[activeSection];

    return (
      <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
        {header}

        {/* Inactive sections as compact chips */}
        <div className="shrink-0 flex flex-wrap gap-1.5">
          {chips.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SECTION_COLORS[key] }} />
              {SECTION_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Expanded section — fills remaining height */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Card header — click to collapse */}
          <button
            type="button"
            onClick={() => toggle(activeSection)}
            className="flex w-full shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">
                {SECTION_LABELS[activeSection]}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {sectionSummary(activeSection, general)}
              </p>
            </div>
            <ChevronDown className="size-3.5 rotate-180 text-muted-foreground transition-transform duration-300 ease-out" />
          </button>

          {/* Scrollable content */}
          <ScrollHintContainer className="p-4">
            <SectionBody id={activeSection} general={general} setGen={setGen} mode={mode} />
          </ScrollHintContainer>
        </div>
      </div>
    );
  }

  // ── No section active: 2-column grid of summary cards ────────────────────────
  return (
    <ScrollHintContainer className="flex flex-col gap-3 p-4">
      {header}

      <div className="grid grid-cols-2 gap-1.5">
        {visibleSections.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className="flex flex-col items-start rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-slate-50"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SECTION_COLORS[key] }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">
                  {SECTION_LABELS[key]}
                </p>
              </div>
              <ChevronDown className="size-3 shrink-0 text-slate-400" />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{sectionSummary(key, general)}</p>
          </button>
        ))}
      </div>
    </ScrollHintContainer>
  );
}
