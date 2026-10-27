// The panel right of the model: the whole building in two tabs. Building holds
// its performance, its data and its parameters; Technologies the host's
// technology cards. Single surfaces live in the surface panel, not here.

import React, { useEffect, useState } from 'react';
import { Pencil, Check } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { TOPICS } from '@/app/config/topics';
import { SectionCard } from '../shared/SectionCard';
import { StepPanel, type Step } from '../shared/StepPanel';
import { SnapshotRow, SnapshotStatusBadge } from '../shared/snapshotUtils';
import { NumberInput, SelectInput } from '../shared/ui';
import { MIN_CONSTRUCTION_YEAR, buildingTypeName, buildingTypeOptions, countryName, countryOptions } from '../shared/buildingOptions';
import { useFormatNumber, useT, type Translate } from '@/app/i18n';
import { heightLimits, tallerThanModel } from '@/app/lib/storeys';

// Unit suffix shown for each 'number' editType row — keyed by editKey.
const ROW_UNITS: Record<string, string> = {
  floorArea:  'm²',
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

/** A residential building's dwellings and occupants per dwelling; null where BuEM's default applies. */
export interface BuildingOccupancy {
  dwellings: number | null;
  persons: number | null;
}

export interface BuildingDetailsCardProps {
  snapshotRows: SnapshotRow[];
  /** The 3D model's height to the eaves, in metres; it bounds the storeys and room height. */
  modelHeight?: number;
  /** Shown as tiles beside the building data; absent for a service building. */
  occupancy?: BuildingOccupancy;
  /** Commits a single field's new value (key maps to the `general` state object). */
  onEditField?: (key: string, value: string | number) => void;
  /** Top of the Building tab, e.g. the load profile and annual demand. */
  overviewSlot?: React.ReactNode;
  /** The steps after the building data, e.g. the building parameters from useBuildingSteps. */
  steps?: Step[];
  /** Opens this step when it changes, as when storeys are picked in the model. */
  requestStep?: string;
  /** Adds a Technologies tab, e.g. the host's technology cards. */
  technologySlot?: React.ReactNode;
  /** The open tab, for a caller that acts on it. Absent: the card keeps its own. */
  activeTab?: DetailsTab;
  onTabChange?: (tab: DetailsTab) => void;
}

/** One figure of the building, marked where it differs from the loaded building. */
function Tile({ label, value, modified }: { label: string; value: string; modified?: boolean }) {
  const t = useT();
  return (
    <div className="min-w-0 rounded-md bg-muted px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span className="truncate">{label}</span>
        {modified && <span className="size-1.5 shrink-0 rounded-full bg-primary" title={t('snapshot.status.modified')} />}
      </div>
      <b className="block truncate text-[13px] text-foreground">{value}</b>
    </div>
  );
}

/** The building data at a glance: type, country and year, then its main figures as tiles. */
function BuildingTiles({ rows, occupancy, modelHeight }: { rows: SnapshotRow[]; occupancy?: BuildingOccupancy; modelHeight?: number }) {
  const t = useT();
  const format = useFormatNumber();
  const row = (key: string) => rows.find((r) => r.labelKey === `snapshot.row.${key}`);
  const tile = (key: string) => {
    const r = row(key);
    return r && <Tile key={key} label={t(r.labelKey)} value={rowValue(r, t)} modified={r.status === 'modified'} />;
  };
  const type = row('type');
  const country = row('country');
  const year = row('constructionYear');
  const envelope = row('envelope');
  const byDefault = t('snapshot.tile.statisticalDefault');
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate text-foreground">
          {[type && rowValue(type, t), country && countryName(t, country.value)].filter(Boolean).join(' · ')}
        </span>
        {year && <b className="shrink-0 text-foreground">{t('snapshot.builtIn', { year: rowValue(year, t) })}</b>}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {tile('storeys')}
        {tile('roomHeight')}
        {tile('floorAreaPerStorey')}
        {occupancy && (
          <>
            <Tile label={t('household.dwellings.label')} value={String(occupancy.dwellings ?? 1)} />
            <Tile label={t('household.persons.label')} value={occupancy.persons === null ? byDefault : String(occupancy.persons)} />
          </>
        )}
        {tile('volume')}
      </div>
      {envelope && (
        <span className="text-[11px] text-muted-foreground">
          {t(envelope.labelKey)}: {rowValue(envelope, t)}
          {modelHeight !== undefined && ` · ${t('snapshot.eavesHeight', { value: format(modelHeight, 1) })}`}
        </span>
      )}
    </div>
  );
}

/** The storey count and room height in the rows, and whether together they are taller than the 3D model. */
function heightConflict(rows: SnapshotRow[], modelHeight?: number): { storeys: number; roomHeight: number; conflict: boolean } {
  const storeys = Number(rows.find((r) => r.editKey === 'storeys')?.rawValue);
  const roomHeight = Number(rows.find((r) => r.editKey === 'roomHeight')?.rawValue);
  return { storeys, roomHeight, conflict: modelHeight !== undefined && tallerThanModel(modelHeight, storeys, roomHeight) };
}

/** A storey count and room height taller than the 3D model, as loaded or as edited. */
function HeightConflict({ rows, modelHeight }: { rows: SnapshotRow[]; modelHeight?: number }) {
  const t = useT();
  const format = useFormatNumber();
  const { storeys, roomHeight, conflict } = heightConflict(rows, modelHeight);
  if (modelHeight === undefined || !conflict) return null;
  return (
    <p className="mx-3 mb-3 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      {t('snapshot.heightConflict', { storeys, room: format(roomHeight, 1), height: format(modelHeight, 1) })}
    </p>
  );
}

/** The building data: tiles to read, a table to edit while its pencil is on. */
function BuildingTable({ rows, occupancy, modelHeight, onEditField }: {
  rows: SnapshotRow[];
  occupancy?: BuildingOccupancy;
  modelHeight?: number;
  onEditField?: BuildingDetailsCardProps['onEditField'];
}) {
  const t = useT();
  // Off by default, so a stray click on the table never changes the building's data.
  const [isEditing, setIsEditing] = useState(false);
  const storeys = Number(rows.find((r) => r.editKey === 'storeys')?.rawValue) || 1;
  const limits = modelHeight !== undefined ? heightLimits(modelHeight, storeys) : null;
  /** The most a field takes: the year now, and for storeys and room height what fits the model. */
  const maxFor = (key: string): number | undefined => {
    if (key === 'constructionYear') return new Date().getFullYear();
    if (key === 'storeys') return limits?.maxStoreys;
    if (key === 'roomHeight') return limits?.maxRoomHeight;
    return undefined;
  };
  return (
    <SectionCard
      topic={TOPICS.building}
      title={t('panel.section.identity')}
      info={t('help.building')}
      emphasised
      action={onEditField && (
        <button
          type="button"
          onClick={() => setIsEditing((v) => !v)}
          title={isEditing ? t('panel.doneEditing') : t('panel.editParameters')}
          className={cn(
            'flex h-6 cursor-pointer items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors',
            isEditing ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'border-current/30 bg-card text-foreground hover:bg-muted',
          )}
        >
          {isEditing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          {isEditing ? t('panel.doneEditing') : t('panel.edit')}
        </button>
      )}
    >
      {!isEditing ? <BuildingTiles rows={rows} occupancy={occupancy} modelHeight={modelHeight} /> : (
        <table className="w-full text-sm bg-card">
          <colgroup>
            <col className="w-[42%]" />
            <col />
            <col className="w-20" />
          </colgroup>
          <tbody>
            {rows.map((row) => {
              const editable = onEditField && row.editKey && row.editType;
              return (
                <tr key={row.label} className="border-t border-border">
                  <td className="px-4 py-2.5 text-muted-foreground">{t(row.labelKey)}</td>
                  <td className="px-4 py-2 text-right font-medium text-foreground">
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
                          min={row.editKey === 'storeys' ? 1 : row.editKey === 'constructionYear' ? MIN_CONSTRUCTION_YEAR : 0}
                          max={maxFor(row.editKey!)}
                          step={row.editKey === 'storeys' ? 1 : row.editKey === 'roomHeight' ? 0.1 : 1}
                        integer={row.editKey === 'storeys' || row.editKey === 'constructionYear'}
                        />
                      )
                    ) : rowValue(row, t)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <SnapshotStatusBadge status={row.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <HeightConflict rows={rows} modelHeight={modelHeight} />
    </SectionCard>
  );
}

/** The building in two tabs: Building, and Technologies where the caller has them. */
export function BuildingDetailsCard({
  snapshotRows,
  modelHeight,
  occupancy,
  onEditField,
  overviewSlot,
  steps = [],
  requestStep,
  technologySlot,
  activeTab: controlledTab,
  onTabChange,
}: BuildingDetailsCardProps) {
  const t = useT();
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
      status: heightConflict(snapshotRows, modelHeight).conflict ? 'attention' : 'complete',
      content: <BuildingTable rows={snapshotRows} occupancy={occupancy} modelHeight={modelHeight} onEditField={onEditField} />,
    },
    ...steps,
  ];

  return (
    <div className={cn(CARD, 'shrink-0')}>
      <div className="border-b border-border px-4 py-3">
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
          <StepPanel steps={allSteps} active={step} onActive={setStep} />
        </div>
      )}
    </div>
  );
}
