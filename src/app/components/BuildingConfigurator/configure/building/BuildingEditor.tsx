// Building-level parameters panel of the 3D view; Expert shows more groups.

import { useState } from 'react';
import { ChevronDown } from '@/app/components/icons';
import { isBuildingTypeSupported } from '@/app/lib/heatDemand';
import {
  SelectInput, NumberInput, FieldLabel,
  ToggleSwitch, FieldRow,
} from '@/app/components/BuildingConfigurator/shared/ui';
import { SectionCard } from '@/app/components/BuildingConfigurator/shared/SectionCard';
import { TOPICS, type Topic } from '@/app/config/topics';
import { cn } from '@/lib/utils';
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

// Insulation and windows is not one of these: it stays open (see BuildingEditor).
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

/** Each section's topic: the building's own data in slate, heating in its carrier's colour, appliances in electricity's. */
const SECTION_TOPICS: Record<SectionKey, Topic> = {
  identity:    TOPICS.building,
  occupancy:   TOPICS.building,
  comfort:     TOPICS.heat,
  outputs:     TOPICS.building,
  equipment:   TOPICS.electricity,
  solver:      TOPICS.building,
};

const BASIC_SECTIONS: SectionKey[] = ['identity', 'occupancy', 'comfort'];
const EXPERT_SECTIONS: SectionKey[] = ['outputs', 'equipment', 'solver'];

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
 * Building-level parameter editor of the Building tab: one card per section
 * in its topic's colour, each showing a summary until it is opened. Expert
 * sections are dashed. Insulation and windows stays open: the refurbishment
 * state is the first thing most users change.
 */
export function BuildingEditor({
  general, setGen, mode,
  insulation,
  hideIdentity = false,
}: BuildingEditorProps) {
  const t = useT();
  const format = useFormatNumber();
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  const service = isServiceBuildingType(general.buildingType);
  const visibleSections = (mode === 'expert' ? [...BASIC_SECTIONS, ...EXPERT_SECTIONS] : BASIC_SECTIONS)
    .filter((key) => (!hideIdentity || key !== 'identity') && (!service || key !== 'equipment'));

  return (
    <div className="flex flex-col gap-3">
      {insulation && (
        <SectionCard
          topic={TOPICS.envelope}
          title={t('editor.insulationTitle')}
          action={<span className="text-[11px] font-normal">{insulationSummary(t, format, insulation)}</span>}
        >
          <div className="flex flex-col gap-3 p-3">
            {insulation.levels.length === 0 && <IgnisStatusSection general={general} />}
            <InsulationSection {...insulation} general={general} setGen={setGen} mode={mode} />
          </div>
        </SectionCard>
      )}

      {visibleSections.map((key) => {
        const open = openSection === key;
        return (
          <SectionCard
            key={key}
            topic={SECTION_TOPICS[key]}
            title={SECTION_LABELS[key](t)}
            dashed={EXPERT_SECTIONS.includes(key)}
            action={(
              <button
                type="button"
                aria-expanded={open}
                aria-label={SECTION_LABELS[key](t)}
                onClick={() => setOpenSection(open ? null : key)}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-card/60"
              >
                <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
              </button>
            )}
          >
            {open ? (
              <div className="p-3">
                <SectionBody id={key} general={general} setGen={setGen} mode={mode} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenSection(key)}
                className="w-full cursor-pointer px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted"
              >
                {sectionSummary(t, format, key, general)}
              </button>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
