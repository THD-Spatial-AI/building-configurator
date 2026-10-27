// The Building tab's sections as steps: energy grade, storeys and occupancy,
// heating and comfort, and in Expert the thermal and simulation settings.

import type { ReactNode } from 'react';
import { isBuildingTypeSupported } from '@/app/lib/heatDemand';
import { ToggleSwitch } from '@/app/components/BuildingConfigurator/shared/ui';
import { SectionCard } from '@/app/components/BuildingConfigurator/shared/SectionCard';
import type { Step, StepStatus } from '@/app/components/BuildingConfigurator/shared/StepPanel';
import { TOPICS, type Topic } from '@/app/config/topics';
import { missingDwellings } from '@/app/lib/storeys';
import {
  BUILDING_TYPE_LABELS,
  buildingTypeName,
  hasDwellingsPerStorey,
  isServiceBuildingType,
} from '@/app/components/BuildingConfigurator/shared/buildingOptions';
import { EquipmentSection, OccupancySection, OutputsSection } from './householdSections';
import { ComfortSection } from './comfortSection';
import { InsulationSection, insulationSummary, type InsulationProps } from './insulationSection';
import { useFormatNumber, useT, type Translate } from '@/app/i18n';

// Energy grade is not one of these: it is built from InsulationProps (see useBuildingSteps).
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

const EXPERT_SECTIONS: SectionKey[] = ['outputs', 'equipment', 'solver'];

const SECTION_LABELS: Record<SectionKey, (t: Translate) => string> = {
  occupancy:   (t) => t('editor.section.occupancy'),
  comfort:     (t) => t('editor.section.comfort'),
  outputs:     (t) => t('editor.section.outputs'),
  equipment:   (t) => t('editor.section.equipment'),
  solver:      (t) => t('editor.section.solver'),
};

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

// ─── Steps ────────────────────────────────────────────────────────────────────

/** An error once every level's grade failed; attention where TABULA has no levels for the building. */
export function energyGradeStatus(insulation: InsulationProps): StepStatus {
  const perM2 = insulation.classes?.perM2;
  if (perM2 && Object.values(perM2).length > 0 && Object.values(perM2).every((value) => value === null)) return 'error';
  return insulation.levels.length === 0 ? 'attention' : 'complete';
}

/** Incomplete while a modelled storey of a building counted per storey has no dwellings. */
export function storeysStatus(general: Record<string, any>): StepStatus {
  if (!hasDwellingsPerStorey(general.buildingType)) return 'complete';
  return missingDwellings(general.storeysModelled, general.storeyDwellings ?? {}).length > 0 ? 'incomplete' : 'complete';
}

interface BuildingStepsProps {
  general: Record<string, any>;
  setGen: (key: string, value: any) => void;
  mode: 'basic' | 'expert';
  /** The energy grade's model; without it there is no energy grade step. */
  insulation?: InsulationProps;
  /** Switches to Expert; in Basic the last step then says what Expert adds. */
  onShowExpert?: () => void;
  /** The storeys modelled, shown at the top of the storeys and occupancy step. */
  storeys?: ReactNode;
  /** Called when the storeys and occupancy step is left, to clear the storey selection. */
  onStoreysClosed?: () => void;
}

/** The building parameters as steps for a StepPanel, each one section card shown open. */
export function useBuildingSteps({
  general, setGen, mode, insulation, onShowExpert, storeys, onStoreysClosed,
}: BuildingStepsProps): Step[] {
  const t = useT();
  const format = useFormatNumber();
  const card = (key: SectionKey) => (
    <SectionCard key={key} topic={SECTION_TOPICS[key]} title={SECTION_LABELS[key](t)} info={t(`help.${key}`)} dashed={EXPERT_SECTIONS.includes(key)}>
      <div className="flex flex-col gap-3 p-3">
        {key === 'occupancy' && storeys && <div className="border-b border-border pb-3">{storeys}</div>}
        <SectionBody id={key} general={general} setGen={setGen} mode={mode} />
      </div>
    </SectionCard>
  );
  const expertPointer = mode === 'basic' && onShowExpert && (
    <button
      type="button"
      onClick={onShowExpert}
      className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed border-muted-foreground/40 px-3 py-2.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted"
    >
      <span><b className="text-foreground">{t('editor.expertMore.title')}</b> · {t('editor.expertMore.detail')}</span>
      <span className="shrink-0 font-semibold text-primary">{t('view.mode.expert')}</span>
    </button>
  );
  const service = isServiceBuildingType(general.buildingType);

  const steps: Step[] = [];
  if (insulation) {
    steps.push({
      key: 'grade',
      label: t('editor.insulationTitle'),
      topic: TOPICS.building,
      status: energyGradeStatus(insulation),
      content: (
        <SectionCard
          topic={TOPICS.building}
          title={t('editor.insulationTitle')}
          info={t('help.insulation')}
          action={<span className="text-[11px] font-normal">{insulationSummary(t, format, insulation, mode)}</span>}
        >
          <div className="flex flex-col gap-3 p-3">
            {insulation.levels.length === 0 && <IgnisStatusSection general={general} />}
            <InsulationSection {...insulation} general={general} setGen={setGen} mode={mode} />
          </div>
        </SectionCard>
      ),
    });
  }
  steps.push({
    key: 'occupancy',
    label: SECTION_LABELS.occupancy(t),
    topic: SECTION_TOPICS.occupancy,
    status: storeysStatus(general),
    content: card('occupancy'),
    onLeave: onStoreysClosed,
  });
  steps.push({
    key: 'comfort',
    label: SECTION_LABELS.comfort(t),
    topic: SECTION_TOPICS.comfort,
    status: 'complete',
    content: <>{card('comfort')}{expertPointer}</>,
  });
  if (mode === 'expert') {
    steps.push({
      key: 'expert',
      label: t('editor.expertMore.title'),
      topic: TOPICS.building,
      status: 'complete',
      content: (
        <div className="flex flex-col gap-3">
          {EXPERT_SECTIONS.filter((key) => !service || key !== 'equipment').map(card)}
        </div>
      ),
    });
  }
  return steps;
}
