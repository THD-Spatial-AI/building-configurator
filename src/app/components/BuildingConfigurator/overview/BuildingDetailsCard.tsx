// The panel right of the model: the whole building in two tabs. Building holds
// its performance, its data and its parameters; Technologies the host's
// technology cards. Single surfaces live in the surface panel, not here.

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TOPICS } from '@/app/config/topics';
import { SectionCard } from '../shared/SectionCard';
import { StepPanel, type Step, type StepFact } from '../shared/StepPanel';
import { SnapshotRow, SnapshotStatusBadge } from '../shared/snapshotUtils';
import { NumberInput, SelectInput } from '../shared/ui';
import { MIN_CONSTRUCTION_YEAR, buildingTypeName, buildingTypeOptions, countryName, countryOptions } from '../shared/buildingOptions';
import { useFormatNumber, useT, type FormatNumber, type Translate } from '@/app/i18n';

// Unit suffix shown for each 'number' editType row — keyed by editKey.
const ROW_UNITS: Record<string, string> = {
  storeys:    '',
  roomHeight: 'm',
  constructionYear: '',
};

/** A row's select options, translated where the row is one the UI labels. */
function rowOptions(row: SnapshotRow, t: Translate) {
  if (row.editKey === 'buildingType') return buildingTypeOptions(t);
  if (row.editKey === 'country') return countryOptions(t);
  return row.options ?? [];
}

/** A row's display value, translated where it holds words. */
function rowValue(row: SnapshotRow, t: Translate): string {
  if (row.valueMessage) return t(row.valueMessage.key, row.valueMessage.values);
  if (row.editKey === 'buildingType') return buildingTypeName(t, row.value);
  return row.value;
}

// overflow-clip, not overflow-hidden: it is no scroll container, so the
// Technologies tab's total can stick to the panel's scroller.
const CARD = 'overflow-clip rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]';

export type DetailsTab = 'building' | 'technology';

export interface BuildingDetailsCardProps {
  snapshotRows: SnapshotRow[];
  /** The 3D model's height to the eaves, in metres, shown with the envelope. */
  modelHeight?: number;
  /** Commits a single field's new value (key maps to the `general` state object). */
  onEditField?: (key: string, value: string | number) => void;
  /** Top of the Building tab, e.g. the load profile and annual demand. */
  overviewSlot?: React.ReactNode;
  /** The steps after the building data, e.g. the building parameters from useBuildingSteps. */
  steps?: Step[];
  /** Opens this step with its fields shown when it changes, as when storeys are picked in the model. */
  requestStep?: string;
  /** Adds a Technologies tab, e.g. the host's technology cards. */
  technologySlot?: React.ReactNode;
  /** The open tab, for a caller that acts on it. Absent: the card keeps its own. */
  activeTab?: DetailsTab;
  onTabChange?: (tab: DetailsTab) => void;
}

/** The building data as a table to edit; the step's summary card is its read-only view. */
function BuildingTable({ rows, onEditField }: {
  rows: SnapshotRow[];
  onEditField?: BuildingDetailsCardProps['onEditField'];
}) {
  const t = useT();
  const maxFor = (key: string): number | undefined => (key === 'constructionYear' ? new Date().getFullYear() : undefined);
  return (
    <SectionCard
      topic={TOPICS.building}
      title={t('panel.section.identity')}
      info={t('help.building')}
      emphasised
    >
      <table className="w-full text-sm bg-card">
        {/* The value column takes the room the labels and badges leave, so the longest type and country names fit. */}
        <colgroup>
          <col className="w-[30%]" />
          <col />
          <col className="w-[88px]" />
        </colgroup>
        <tbody>
          {rows.map((row) => {
            const editable = onEditField && row.editKey && row.editType;
            return (
              <tr key={row.label} className="border-t border-border">
                <td className="py-2.5 pl-4 pr-2 text-[13px] leading-tight text-muted-foreground">{t(row.labelKey)}</td>
                <td className="px-2 py-2 text-right font-medium text-foreground">
                  {editable ? (
                    row.editType === 'select' ? (
                      <SelectInput
                        value={String(row.rawValue ?? '')}
                        onChange={(v) => onEditField!(row.editKey!, v)}
                        options={rowOptions(row, t)}
                      />
                    ) : (
                      <NumberInput
                        value={row.rawValue ?? 0}
                        onChange={(v) => {
                          const max = maxFor(row.editKey!);
                          onEditField!(row.editKey!, max === undefined ? v : Math.min(v, max));
                        }}
                        unit={ROW_UNITS[row.editKey!] ?? ''}
                        min={row.editKey === 'constructionYear' ? MIN_CONSTRUCTION_YEAR : 0}
                        max={maxFor(row.editKey!)}
                        step={1}
                        integer={row.editKey === 'constructionYear'}
                      />
                    )
                  ) : rowValue(row, t)}
                </td>
                <td className="py-2 pl-1 pr-3 text-center">
                  <SnapshotStatusBadge status={row.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </SectionCard>
  );
}

/** The facts the building data step shows while it is not being edited. */
function dataSummary(t: Translate, format: FormatNumber, rows: SnapshotRow[], modelHeight?: number): StepFact[] {
  const fact = (key: string, value: (row: SnapshotRow) => string) => {
    const row = rows.find((r) => r.labelKey === `snapshot.row.${key}`);
    return row ? [{ label: t(row.labelKey), value: value(row) }] : [];
  };
  return [
    ...fact('type', (row) => rowValue(row, t)),
    ...fact('country', (row) => countryName(t, row.value)),
    ...fact('constructionYear', (row) => rowValue(row, t)),
    ...fact('floorAreaPerStorey', (row) => rowValue(row, t)),
    ...fact('storeys', (row) => rowValue(row, t)),
    ...fact('roomHeight', (row) => rowValue(row, t)),
    ...fact('volume', (row) => rowValue(row, t)),
    ...(modelHeight !== undefined ? [{ label: t('steps.summary.eaves'), value: `${format(modelHeight, 1)} m` }] : []),
  ];
}

/** The building in two tabs: Building, and Technologies where the caller has them. */
export function BuildingDetailsCard({
  snapshotRows,
  modelHeight,
  onEditField,
  overviewSlot,
  steps = [],
  requestStep,
  technologySlot,
  activeTab: controlledTab,
  onTabChange,
}: BuildingDetailsCardProps) {
  const t = useT();
  const format = useFormatNumber();
  const [ownTab, setOwnTab] = useState<DetailsTab>('building');
  const activeTab = technologySlot ? controlledTab ?? ownTab : 'building';
  const setActiveTab = (tab: DetailsTab) => {
    setOwnTab(tab);
    onTabChange?.(tab);
  };
  const tabs: DetailsTab[] = technologySlot ? ['building', 'technology'] : ['building'];
  const [step, setStep] = useState('data');
  useEffect(() => { if (requestStep) setStep(requestStep); }, [requestStep]);
  const allSteps: Step[] = [
    {
      key: 'data',
      label: t('panel.section.identity'),
      topic: TOPICS.building,
      status: 'complete',
      summary: dataSummary(t, format, snapshotRows, modelHeight),
      // A loaded building brings its data, so the step opens on its summary.
      startSummarised: true,
      content: <BuildingTable rows={snapshotRows} onEditField={onEditField} />,
    },
    ...steps,
  ];

  return (
    <div className={cn(CARD, 'shrink-0')}>
      {/* Sticky so the tabs stay in reach while either tab scrolls; its fixed height is where the step bar sticks beneath it. */}
      <div className="sticky top-0 z-20 flex h-[60px] items-center border-b border-border bg-card px-4">
        <div role="tablist" className="inline-flex h-9 items-center rounded-md bg-muted p-1 text-muted-foreground">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            data-tour={tab === 'technology' ? 'technologies' : undefined}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'cursor-pointer whitespace-nowrap rounded-sm px-3 py-1 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
            )}
          >
            {tab === 'building' ? t('panel.tab.building') : t('panel.title.technology')}
          </button>
        ))}
        </div>
      </div>

      {activeTab === 'technology' ? (
        <div className="p-4">{technologySlot}</div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {overviewSlot}
          <StepPanel steps={allSteps} active={step} onActive={setStep} stickyTop="top-[60px]" openFields={requestStep} />
        </div>
      )}
    </div>
  );
}
