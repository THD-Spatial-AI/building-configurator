// Building-level parameters panel of the 3D view; Expert shows more groups.

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from '@/app/components/icons';
import { isBuildingTypeSupported } from '@/app/lib/heatDemand';
import { ToggleSwitch } from '@/app/components/BuildingConfigurator/shared/ui';
import { SectionCard } from '@/app/components/BuildingConfigurator/shared/SectionCard';
import { TOPICS, type Topic } from '@/app/config/topics';
import { cn } from '@/lib/utils';
import {
  BUILDING_TYPE_LABELS,
  OUTPUT_PROFILES,
  buildingTypeName,
  isServiceBuildingType,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import { EquipmentSection, OccupancySection, OutputsSection } from './householdSections';
import { ComfortSection, comfortSummary } from './comfortSection';
import { InsulationSection, insulationSummary, type InsulationProps } from './insulationSection';
import { useFormatNumber, useT, type FormatNumber, type Translate } from '@/app/i18n';

// Insulation and windows is not one of these: it stays open (see BuildingEditor).
type SectionKey = 'occupancy' | 'comfort' | 'outputs' | 'equipment' | 'solver';

// ─── Section components ───────────────────────────────────────────────────────

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
  occupancy:   TOPICS.building,
  comfort:     TOPICS.heat,
  outputs:     TOPICS.building,
  equipment:   TOPICS.electricity,
  solver:      TOPICS.building,
};

const BASIC_SECTIONS: SectionKey[] = ['occupancy', 'comfort'];
const EXPERT_SECTIONS: SectionKey[] = ['outputs', 'equipment', 'solver'];

const SECTION_LABELS: Record<SectionKey, (t: Translate) => string> = {
  occupancy:   (t) => t('editor.section.occupancy'),
  comfort:     (t) => t('editor.section.comfort'),
  outputs:     (t) => t('editor.section.outputs'),
  equipment:   (t) => t('editor.section.equipment'),
  solver:      (t) => t('editor.section.solver'),
};

/** One-line value summary shown on the grid card and chip. */
function sectionSummary(t: Translate, format: FormatNumber, key: SectionKey, general: Record<string, any>): string {
  switch (key) {
    case 'occupancy':   return [storeysSummary(t, general), occupancySummary(t, format, general)].filter(Boolean).join(' · ');
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

/** How many storeys the building has and how many are modelled; nothing for a single storey. */
function storeysSummary(t: Translate, general: Record<string, any>): string {
  if (general.storeys <= 1) return '';
  return general.storeysModelled
    ? t('editor.summary.storeysModelled', { modelled: general.storeysModelled.length, total: general.storeys })
    : t('editor.summary.storeys', { count: general.storeys });
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
  /** Switches to Expert; in Basic a card then says what Expert adds. */
  onShowExpert?: () => void;
  /** The storeys modelled, shown at the top of the storeys and occupancy section. */
  storeys?: ReactNode;
  /** Opens the storeys and occupancy section, as when storeys are selected in the model. */
  showStoreys?: boolean;
  /** Called when the storeys and occupancy section closes, to clear the storey selection. */
  onStoreysClosed?: () => void;
}

/**
 * Building-level parameter editor of the Building tab: one card per section
 * in its topic's colour, each showing a summary until it is opened. Expert
 * sections are dashed. Energy grade stays open: the refurbishment state is
 * the first thing most users change. Storeys sit with occupancy, as a building
 * divides into storeys and storeys into dwellings.
 */
export function BuildingEditor({
  general, setGen, mode,
  insulation, onShowExpert, storeys, showStoreys = false, onStoreysClosed,
}: BuildingEditorProps) {
  const t = useT();
  const format = useFormatNumber();
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  useEffect(() => { if (showStoreys) setOpenSection('occupancy'); }, [showStoreys]);
  /** Opens one section, or none; leaving storeys and occupancy, by closing it or opening another, says so. */
  const openOnly = (key: SectionKey | null) => {
    if (openSection === 'occupancy' && key !== 'occupancy') onStoreysClosed?.();
    setOpenSection(key);
  };

  const service = isServiceBuildingType(general.buildingType);
  const visibleSections = (mode === 'expert' ? [...BASIC_SECTIONS, ...EXPERT_SECTIONS] : BASIC_SECTIONS)
    .filter((key) => !service || key !== 'equipment');

  return (
    <div className="flex flex-col gap-3">
      {insulation && (
        <SectionCard
          topic={TOPICS.envelope}
          title={t('editor.insulationTitle')}
          info={t('help.insulation')}
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
            info={t(`help.${key}`)}
            dashed={EXPERT_SECTIONS.includes(key)}
            onToggle={() => openOnly(open ? null : key)}
            action={(
              <button
                type="button"
                aria-expanded={open}
                aria-label={SECTION_LABELS[key](t)}
                onClick={() => openOnly(open ? null : key)}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-card/60"
              >
                <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
              </button>
            )}
          >
            {open ? (
              <div className="flex flex-col gap-3 p-3">
                {key === 'occupancy' && storeys && <div className="border-b border-border pb-3">{storeys}</div>}
                <SectionBody id={key} general={general} setGen={setGen} mode={mode} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openOnly(key)}
                className="w-full cursor-pointer px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted"
              >
                {sectionSummary(t, format, key, general)}
              </button>
            )}
          </SectionCard>
        );
      })}

      {mode === 'basic' && onShowExpert && (
        <button
          type="button"
          onClick={onShowExpert}
          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-muted-foreground/40 px-3 py-2.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted"
        >
          <span><b className="text-foreground">{t('editor.expertMore.title')}</b> · {t('editor.expertMore.detail')}</span>
          <span className="shrink-0 font-semibold text-primary">{t('view.mode.expert')}</span>
        </button>
      )}
    </div>
  );
}
