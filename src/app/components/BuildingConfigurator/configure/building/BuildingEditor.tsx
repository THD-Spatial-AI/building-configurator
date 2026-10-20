// Building-level parameters panel of the 3D view; Expert shows more groups.

import { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { isBuildingTypeSupported } from '@/app/lib/heatDemand';
import {
  SelectInput, NumberInput, FieldLabel,
  ToggleSwitch, FieldRow, ScrollHintContainer,
} from '@/app/components/BuildingConfigurator/shared/ui';
import {
  BUILDING_TYPE_OPTIONS,
  COUNTRY_OPTIONS,
  MIN_CONSTRUCTION_YEAR,
  OUTPUT_PROFILES,
  isServiceBuildingType,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import { EquipmentSection, OccupancySection, OutputsSection } from './householdSections';
import { ComfortSection, comfortSummary } from './comfortSection';
import { InsulationSection, insulationSummary, type InsulationProps } from './insulationSection';
import { computeTotalFloorArea, computeVolume } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';

// Insulation and windows is not part of this click-to-expand card system: it
// renders inline, always visible. See BuildingEditor's `inlineSections`.
type SectionKey = 'identity' | 'occupancy' | 'comfort' | 'outputs' | 'equipment' | 'solver';

// ─── Section components ───────────────────────────────────────────────────────

/** Building identity fields — synced with the overview snapshot panel. */
function IdentitySection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  const volume = computeVolume(general.floorArea, general.storeys, general.roomHeight).toFixed(0);
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
        <NumberInput
          label="Construction year"
          value={general.constructionYear}
          onChange={(v) => setGen('constructionYear', Math.round(v))}
          unit="" min={MIN_CONSTRUCTION_YEAR} max={new Date().getFullYear()} step={1}
          tip="Year the building was built. ignis maps it to a TABULA construction-period band for the default U-value lookup."
        />
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel tip="Footprint area of a single storey — total conditioned floor area is this × storeys.">
            Floor area (per storey)
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

function SolverSection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ToggleSwitch
        checked={general.use_milp}
        onChange={(v) => setGen('use_milp', v)}
        label="Use MILP solver"
        tip="Solve the thermal model as a mixed-integer linear programme instead of BuEM's default sparse solver. Slower, but handles inequality constraints exactly."
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
            ? 'MILP solver: inequality constraints handled exactly. Runs take longer.'
            : "BuEM's default sparse solver. Fast."}
        </p>
      </div>
    </div>
  );
}

// ─── HDCP status section (shown when ignis state is null) ─────────────────────

function IgnisStatusSection({ general }: { general: Record<string, any> }) {
  const country = general.country as string | undefined;
  const type    = general.buildingType as string | undefined;

  if (!country) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Set a country in <strong>Basic Info</strong> to enable heat demand calculation.
      </p>
    );
  }

  if (type && !isBuildingTypeSupported(type)) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Building type <strong>{type}</strong> is not in the TABULA database.
        Supported types: Single-family House, Multi-family House, Terraced House, Apartment Block.
      </p>
    );
  }

  return (
    <p className="text-[11px] text-muted-foreground">
      No TABULA data found for this building: the TABULA service holds no variant for it
      or could not be reached.
    </p>
  );
}

// ─── Section metadata ─────────────────────────────────────────────────────────

/** Colour dot for each section — mirrors the element-dot pattern used in surfaces. */
const SECTION_COLORS: Record<SectionKey, string> = {
  identity:    '#2f5d8a',
  occupancy:   '#16a34a',
  comfort:     '#dc2626',
  outputs:     '#ca8a04',
  equipment:   '#db2777',
  solver:      '#7c3aed',
};

const SECTION_LABELS: Record<SectionKey, string> = {
  identity:    'Basic info',
  occupancy:   'Occupancy',
  comfort:     'Heating and comfort',
  outputs:     'Results to compute',
  equipment:   'Appliances',
  solver:      'Calculation Method',
};

/** One-line value summary shown on the grid card and chip. */
function sectionSummary(key: SectionKey, general: Record<string, any>): string {
  switch (key) {
    case 'identity':    return `${general.buildingType} · ${computeTotalFloorArea(general.floorArea, general.storeys).toFixed(0)} m²`;
    case 'occupancy':   return occupancySummary(general);
    case 'comfort':     return comfortSummary(general);
    case 'outputs':     return `${OUTPUT_PROFILES.filter(({ key }) => general.outputs[key] !== 'none').length} of ${OUTPUT_PROFILES.length} profiles`;
    case 'equipment': {
      const overrides = Object.keys(general.equipment).length;
      return overrides > 0 ? `${overrides} set by hand` : 'Defaults';
    }
    case 'solver':      return general.use_milp ? 'MILP' : 'Sparse';
  }
}

function occupancySummary(general: Record<string, any>): string {
  if (isServiceBuildingType(general.buildingType)) {
    return general.capacity ? `${general.capacity} occupants` : 'Capacity from floor area';
  }
  const units = general.residential_units;
  const dwellings = units ? `${units} dwelling${units === 1 ? '' : 's'}` : 'Dwellings not set';
  return general.num_persons ? `${dwellings} · ${general.num_persons} per dwelling` : dwellings;
}

/** Renders the content body for a given section key. */
function SectionBody({
  id, general, setGen, mode,
}: {
  id: SectionKey;
  general: Record<string, any>;
  setGen: (k: string, v: any) => void;
  mode: 'basic' | 'expert';
}) {
  switch (id) {
    case 'identity':    return <IdentitySection    general={general} setGen={setGen} />;
    case 'occupancy':   return <OccupancySection   general={general} setGen={setGen} />;
    case 'comfort':     return <ComfortSection     general={general} setGen={setGen} mode={mode} />;
    case 'outputs':     return <OutputsSection     general={general} setGen={setGen} />;
    case 'equipment':   return <EquipmentSection   general={general} setGen={setGen} />;
    case 'solver':      return <SolverSection      general={general} setGen={setGen} />;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BuildingEditorProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  mode: 'basic' | 'expert';
  /** The Insulation and windows group's model; without it the group is not shown. */
  insulation?: InsulationProps;
  /** Hides the Basic Info tab — used when the caller already renders those fields elsewhere (the snapshot table's inline edit). */
  hideIdentity?: boolean;
}

/**
 * Building-level parameter editor shown when "Building" is selected in the panel.
 *
 * Layout mirrors the surface ElementList pattern:
 *  - No section active -> 2-column grid of summary cards.
 *  - Section active -> inactive sections collapse to compact chips at the top;
 *    the active section fills the remaining height with a scrollable body.
 *
 * Insulation and windows sits outside that click-to-expand system, pinned
 * inline under the header: the refurbishment state is the first thing most
 * users change.
 */
export function BuildingEditor({
  general, setGen, mode,
  insulation,
  hideIdentity = false,
}: BuildingEditorProps) {
  const [openSection, setActiveSection] = useState<SectionKey | null>(null);

  const ALL_SECTIONS: SectionKey[] = ['identity', 'occupancy', 'comfort', 'outputs'];
  const EXPERT_SECTIONS: SectionKey[] = ['equipment', 'solver'];
  const service = isServiceBuildingType(general.buildingType);
  const visibleSections = (mode === 'expert'
    ? [...ALL_SECTIONS, ...EXPERT_SECTIONS]
    : ALL_SECTIONS
  ).filter((key) => (!hideIdentity || key !== 'identity') && (!service || key !== 'equipment'));

  // A building type change can hide the open section (appliances on a service building).
  const activeSection = openSection && visibleSections.includes(openSection) ? openSection : null;

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
          {general.buildingType} · {general.constructionYear} · {computeTotalFloorArea(general.floorArea, general.storeys).toFixed(0)} m²
        </p>
      </div>
    </div>
  );

  // ── Insulation and windows — always visible, no click needed ──
  const inlineSections = insulation && (
    <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-700">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: '#ea580c' }} />
          Insulation and windows
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{insulationSummary(insulation)}</p>
      </div>
      {insulation.levels.length === 0 && <IgnisStatusSection general={general} />}
      <InsulationSection {...insulation} general={general} setGen={setGen} mode={mode} />
    </div>
  );

  // ── Active section: chips row + expanded card ─────────────────────────────────
  if (activeSection) {
    const chips = visibleSections.filter((k) => k !== activeSection);
    const dotColor = SECTION_COLORS[activeSection];

    return (
      <ScrollHintContainer className="flex flex-col gap-3 p-4">
        {header}
        {inlineSections}

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

        {/* Expanded section */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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

          <div className="p-4">
            <SectionBody id={activeSection} general={general} setGen={setGen} mode={mode} />
          </div>
        </div>
      </ScrollHintContainer>
    );
  }

  // ── No section active: header + inline sections + grid of summary cards ──────
  return (
    <ScrollHintContainer className="flex flex-col gap-3 p-4">
      {header}
      {inlineSections}

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
