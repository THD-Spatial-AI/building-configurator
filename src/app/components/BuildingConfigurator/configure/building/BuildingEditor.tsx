// Building-level parameters panel of the 3D view; Expert shows more groups.

import { useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { isBuildingTypeSupported } from '@/app/lib/heatDemand';
import {
  SelectInput, NumberInput, FieldLabel,
  ToggleSwitch, FieldRow, ScrollHintContainer,
} from '@/app/components/BuildingConfigurator/shared/ui';
import {
  BUILDING_TYPE_LABELS,
  MIN_CONSTRUCTION_YEAR,
  OUTPUT_PROFILES,
  buildingTypeName,
  buildingTypeOptions,
  countryOptions,
  isServiceBuildingType,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import { EquipmentSection, OccupancySection, OutputsSection } from './householdSections';
import { ComfortSection, comfortSummary } from './comfortSection';
import { InsulationSection, insulationSummary, type InsulationProps } from './insulationSection';
import { computeTotalFloorArea, computeVolume } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';
import { useFormatNumber, useT, type FormatNumber, type Translate } from '@/app/i18n';

// Insulation and windows is not part of this click-to-expand card system: it
// renders inline, always visible. See BuildingEditor's `inlineSections`.
type SectionKey = 'identity' | 'occupancy' | 'comfort' | 'outputs' | 'equipment' | 'solver';

// ─── Section components ───────────────────────────────────────────────────────

/** Building identity fields — synced with the overview snapshot panel. */
function IdentitySection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  const t = useT();
  const format = useFormatNumber();
  const volume = format(computeVolume(general.floorArea, general.storeys, general.roomHeight), 0);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <FieldLabel tip={t('editor.identity.name.tip')}>
          {t('editor.identity.name.label')}
        </FieldLabel>
        <input
          type="text"
          value={general.buildingName ?? ''}
          onChange={(e) => setGen('buildingName', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder={t('editor.identity.name.placeholder')}
          className="cfg-input w-full"
        />
      </div>
      <SelectInput
        label={t('editor.identity.type.label')}
        value={general.buildingType}
        onChange={(v) => setGen('buildingType', v)}
        options={buildingTypeOptions(t)}
        tip={t('editor.identity.type.tip')}
      />
      <FieldRow>
        <SelectInput
          label={t('editor.identity.country.label')}
          value={general.country}
          onChange={(v) => setGen('country', v)}
          options={countryOptions(t)}
          tip={t('editor.identity.country.tip')}
        />
        <NumberInput
          label={t('editor.identity.year.label')}
          value={general.constructionYear}
          onChange={(v) => setGen('constructionYear', Math.round(v))}
          unit="" min={MIN_CONSTRUCTION_YEAR} max={new Date().getFullYear()} step={1}
          tip={t('editor.identity.year.tip')}
        />
      </FieldRow>
      <FieldRow>
        <div>
          <FieldLabel tip={t('editor.identity.floorArea.tip')}>
            {t('editor.identity.floorArea.label')}
          </FieldLabel>
          <NumberInput
            value={general.floorArea}
            onChange={(v) => setGen('floorArea', Math.max(1, v))}
            unit="m²" min={1} max={50000} step={1}
          />
        </div>
        <div>
          <FieldLabel tip={t('editor.identity.storeys.tip')}>
            {t('editor.identity.storeys.label')}
          </FieldLabel>
          <NumberInput
            value={general.storeys}
            onChange={(v) => setGen('storeys', Math.max(1, Math.round(v)))}
            unit="" min={1} max={50} step={1}
          />
        </div>
      </FieldRow>
      <div>
        <FieldLabel tip={t('editor.identity.roomHeight.tip')}>
          {t('editor.identity.roomHeight.label')}
        </FieldLabel>
        <NumberInput
          value={general.roomHeight}
          onChange={(v) => setGen('roomHeight', Math.max(1.5, v))}
          unit="m" min={1.5} max={10} step={0.1}
        />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-1">
        <span className="text-[11px] text-muted-foreground">{t('editor.identity.volume')}</span>
        <span className="text-xs font-semibold text-foreground">
          {volume} <span className="text-[10px] font-normal text-muted-foreground">m³</span>
        </span>
      </div>
    </div>
  );
}

function SolverSection({ general, setGen }: { general: Record<string, any>; setGen: (k: string, v: any) => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <ToggleSwitch
        checked={general.use_milp}
        onChange={(v) => setGen('use_milp', v)}
        label={t('editor.solver.useMilp.label')}
        tip={t('editor.solver.useMilp.tip')}
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
            ? t('editor.solver.milpNote')
            : t('editor.solver.sparseNote')}
        </p>
      </div>
    </div>
  );
}

// ─── HDCP status section (shown when ignis state is null) ─────────────────────

function IgnisStatusSection({ general }: { general: Record<string, any> }) {
  const t = useT();
  const country = general.country as string | undefined;
  const type    = general.buildingType as string | undefined;

  if (!country) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t('editor.ignis.noCountryBefore')} <strong>{t('editor.ignis.basicInfo')}</strong> {t('editor.ignis.noCountryAfter')}
      </p>
    );
  }

  if (type && !isBuildingTypeSupported(type)) {
    const supported = ['SFH', 'MFH', 'TH', 'AB'].map((code) => buildingTypeName(t, BUILDING_TYPE_LABELS[code])).join(', ');
    return (
      <p className="text-[11px] text-muted-foreground">
        {t('editor.ignis.unsupportedBefore')} <strong>{buildingTypeName(t, type)}</strong> {t('editor.ignis.unsupportedAfter', { types: supported })}
      </p>
    );
  }

  return (
    <p className="text-[11px] text-muted-foreground">
      {t('editor.ignis.noData')}
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

const SECTION_LABELS: Record<SectionKey, (t: Translate) => string> = {
  identity:    (t) => t('editor.section.identity'),
  occupancy:   (t) => t('editor.section.occupancy'),
  comfort:     (t) => t('editor.section.comfort'),
  outputs:     (t) => t('editor.section.outputs'),
  equipment:   (t) => t('editor.section.equipment'),
  solver:      (t) => t('editor.section.solver'),
};

/** One-line value summary shown on the grid card and chip. */
function sectionSummary(t: Translate, format: FormatNumber, key: SectionKey, general: Record<string, any>): string {
  switch (key) {
    case 'identity':    return `${buildingTypeName(t, general.buildingType)} · ${format(computeTotalFloorArea(general.floorArea, general.storeys), 0)} m²`;
    case 'occupancy':   return occupancySummary(t, format, general);
    case 'comfort':     return comfortSummary(t, format, general);
    case 'outputs':     return t('editor.summary.outputs', {
      on: OUTPUT_PROFILES.filter(({ key }) => general.outputs[key] !== 'none').length,
      total: OUTPUT_PROFILES.length,
    });
    case 'equipment': {
      const overrides = Object.keys(general.equipment).length;
      return overrides > 0 ? t('editor.summary.equipmentSet', { overrides }) : t('editor.summary.equipmentDefault');
    }
    case 'solver':      return general.use_milp ? t('editor.summary.solverMilp') : t('editor.summary.solverSparse');
  }
}

function occupancySummary(t: Translate, format: FormatNumber, general: Record<string, any>): string {
  if (isServiceBuildingType(general.buildingType)) {
    return general.capacity ? t('editor.summary.occupants', { capacity: format(general.capacity) }) : t('editor.summary.capacityFromArea');
  }
  const units = general.residential_units;
  const dwellings = units ? t('editor.summary.dwellings', { count: units }) : t('editor.summary.dwellingsNotSet');
  return general.num_persons ? t('editor.summary.perDwelling', { dwellings, persons: format(general.num_persons) }) : dwellings;
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
  const t = useT();
  const format = useFormatNumber();
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
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Building2 className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground">{general.buildingName || t('editor.header.fallbackName')}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {buildingTypeName(t, general.buildingType)} ·{general.constructionYear} · {format(computeTotalFloorArea(general.floorArea, general.storeys), 0)} m²
        </p>
      </div>
    </div>
  );

  // ── Insulation and windows — always visible, no click needed ──
  const inlineSections = insulation && (
    <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: '#ea580c' }} />
          {t('editor.insulationTitle')}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{insulationSummary(t, format, insulation)}</p>
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
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SECTION_COLORS[key] }} />
              {SECTION_LABELS[key](t)}
            </button>
          ))}
        </div>

        {/* Expanded section */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {/* Card header — click to collapse */}
          <button
            type="button"
            onClick={() => toggle(activeSection)}
            className="flex w-full shrink-0 items-center gap-2 border-b border-border bg-muted/80 px-3 py-2.5 text-left transition-colors hover:bg-muted/80"
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground">
                {SECTION_LABELS[activeSection](t)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {sectionSummary(t, format, activeSection, general)}
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
            className="flex flex-col items-start rounded-lg border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-muted"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SECTION_COLORS[key] }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-foreground">
                  {SECTION_LABELS[key](t)}
                </p>
              </div>
              <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{sectionSummary(t, format, key, general)}</p>
          </button>
        ))}
      </div>
    </ScrollHintContainer>
  );
}
