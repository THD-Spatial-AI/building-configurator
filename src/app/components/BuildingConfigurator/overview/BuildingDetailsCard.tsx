// The panel right of the model: the whole building in two tabs. Building holds
// its performance, its data and its parameters; Technologies the host's
// technology cards. Single surfaces live in the surface panel, not here.

import React, { useState } from 'react';
import { Pencil, Check } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { TOPICS } from '@/app/config/topics';
import { SnapshotRow, SnapshotStatusBadge } from '../shared/snapshotUtils';
import { NumberInput, SelectInput } from '../shared/ui';
import { MIN_CONSTRUCTION_YEAR, buildingTypeName, buildingTypeOptions, countryOptions } from '../shared/buildingOptions';
import { useT, type Translate } from '@/app/i18n';

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

const CARD = 'overflow-hidden rounded-xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]';

export type DetailsTab = 'building' | 'technology';

export interface BuildingDetailsCardProps {
  snapshotRows: SnapshotRow[];
  /** Commits a single field's new value (key maps to the `general` state object). */
  onEditField?: (key: string, value: string | number) => void;
  /** Top of the Building tab, e.g. the load profile and annual demand. */
  overviewSlot?: React.ReactNode;
  /** Under the building data table, e.g. the BuEM building parameters. */
  parametersSlot?: React.ReactNode;
  /** Adds a Technologies tab, e.g. the host's technology cards. */
  technologySlot?: React.ReactNode;
  /** The open tab, for a caller that acts on it. Absent: the card keeps its own. */
  activeTab?: DetailsTab;
  onTabChange?: (tab: DetailsTab) => void;
}

/** The building data table, editable only while its pencil is on. */
function BuildingTable({ rows, onEditField }: { rows: SnapshotRow[]; onEditField?: BuildingDetailsCardProps['onEditField'] }) {
  const t = useT();
  // Off by default, so a stray click on the table never changes the building's data.
  const [isEditing, setIsEditing] = useState(false);
  const { Icon, tile } = TOPICS.building;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          <span className={cn('flex size-5 items-center justify-center rounded', tile)}><Icon className="size-3.5" /></span>
          {t('panel.section.identity')}
        </h3>
        {onEditField && (
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            title={isEditing ? t('panel.doneEditing') : t('panel.editParameters')}
            className={cn(
              'flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
              isEditing ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted hover:text-muted-foreground',
            )}
          >
            {isEditing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          </button>
        )}
      </div>
      <table className="w-full text-sm bg-card">
        <colgroup>
          <col className="w-[42%]" />
          <col />
          <col className="w-20" />
        </colgroup>
        <tbody>
          {rows.map((row) => {
            const editable = isEditing && onEditField && row.editKey && row.editType;
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
                        onChange={(v) => onEditField!(row.editKey!, v)}
                        unit={ROW_UNITS[row.editKey!] ?? ''}
                        min={row.editKey === 'storeys' ? 1 : row.editKey === 'constructionYear' ? MIN_CONSTRUCTION_YEAR : 0}
                        max={row.editKey === 'constructionYear' ? new Date().getFullYear() : undefined}
                        step={row.editKey === 'storeys' ? 1 : row.editKey === 'roomHeight' ? 0.1 : 1}
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
    </div>
  );
}

/** The building in two tabs: Building, and Technologies where the caller has them. */
export function BuildingDetailsCard({
  snapshotRows,
  onEditField,
  overviewSlot,
  parametersSlot,
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

  return (
    <div className={cn(CARD, 'shrink-0')}>
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'cursor-pointer whitespace-nowrap border-b-2 pb-0.5 text-[13px] transition-colors',
              activeTab === tab
                ? 'border-primary font-bold text-foreground'
                : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'building' ? t('panel.tab.building') : t('panel.title.technology')}
          </button>
        ))}
      </div>

      {activeTab === 'technology' ? (
        <div className="p-4">{technologySlot}</div>
      ) : (
        <>
          {overviewSlot && <div className="p-4 pb-1">{overviewSlot}</div>}
          <BuildingTable rows={snapshotRows} onEditField={onEditField} />
          {parametersSlot}
        </>
      )}
    </div>
  );
}
