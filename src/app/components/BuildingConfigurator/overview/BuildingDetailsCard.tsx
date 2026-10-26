// Right column's merged card: Building Parameters table, or Building Envelope
// group cards — one card, one header tab switch, no separate section below.

import React, { useState } from 'react';
import { Pencil, Check } from '@/app/components/icons';
import { cn } from '@/lib/utils';
import { SnapshotRow, SnapshotStatusBadge } from '../shared/snapshotUtils';
import { NumberInput, SelectInput } from '../shared/ui';
import { MIN_CONSTRUCTION_YEAR, buildingTypeName, buildingTypeOptions, countryOptions } from '../shared/buildingOptions';
import { ElementCompositionSection } from './ElementCompositionSection';
import { useT, type Translate } from '@/app/i18n';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { RoofConfig } from '@/app/components/BuildingConfigurator/configure/model/roof';

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

export type DetailsTab = 'overview' | 'parameters' | 'envelope' | 'technology';

export interface BuildingDetailsCardProps {
  snapshotRows: SnapshotRow[];
  /** Commits a single field's new value (key maps to the `general` state object). */
  onEditField?: (key: string, value: string | number) => void;
  elements: Record<string, BuildingElement>;
  baselineElements?: Record<string, BuildingElement>;
  roofConfig: RoofConfig;
  /** Lets a group expand to its surfaces; picking one calls this. */
  onSelectSurface?: (id: string) => void;
  /** Rendered under the envelope group cards, e.g. the 3D envelope + surface editor. */
  envelopeSlot?: React.ReactNode;
  /** Adds an Energy overview tab, e.g. the demand summary and renewable figures. */
  overviewSlot?: React.ReactNode;
  /** Rendered under the parameters table, e.g. the advanced BuEM settings. */
  parametersSlot?: React.ReactNode | ((openEnvelope: () => void) => React.ReactNode);
  /** Adds a Technologies tab, e.g. the host's technology cards. */
  technologySlot?: React.ReactNode;
  /** The open tab, for a caller that acts on it. Absent: the card keeps its own. */
  activeTab?: DetailsTab;
  onTabChange?: (tab: DetailsTab) => void;
}

/** Building parameters table, or building envelope cards — one merged card. */
export function BuildingDetailsCard({
  snapshotRows,
  onEditField,
  elements,
  baselineElements,
  roofConfig,
  onSelectSurface,
  envelopeSlot,
  overviewSlot,
  parametersSlot,
  technologySlot,
  activeTab: controlledTab,
  onTabChange,
}: BuildingDetailsCardProps) {
  // Off by default — edits only ever apply while explicitly toggled on, so a stray
  // click on the table never changes the building's data.
  const t = useT();
  const [isEditing, setIsEditing] = useState(false);
  // Whichever tab carries the most for this caller opens first: the energy
  // overview where there is one, otherwise the envelope where it carries the 3D
  // model. The others are one click away either way.
  const [ownTab, setOwnTab] = useState<DetailsTab>(
    overviewSlot ? 'overview' : envelopeSlot ? 'envelope' : 'parameters',
  );
  const activeTab = controlledTab ?? ownTab;
  const setActiveTab = (tab: DetailsTab) => {
    setOwnTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className={cn(CARD, 'shrink-0')}>
      {/* Wraps the tabs under the title when the panel is too narrow for both on one line. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 border-b border-border">
        <p className="whitespace-nowrap text-[13px] font-bold text-foreground">
          {activeTab === 'overview' ? t('panel.title.overview')
            : activeTab === 'envelope' ? t('panel.title.envelope')
            : activeTab === 'technology' ? t('panel.title.technology')
            : t('panel.title.parameters')}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {/* Plain menu-bar tabs — not a filled segmented-control pill, just
              two labelled buttons with an underline on the active one.
              Parameters is the default/first option, Envelope the second. */}
          <div className="flex items-center gap-4">
            {([
              ...(overviewSlot ? ['overview' as const] : []),
              'parameters' as const,
              'envelope' as const,
              ...(technologySlot ? ['technology' as const] : []),
            ]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'cursor-pointer whitespace-nowrap border-b-2 pb-0.5 text-xs transition-colors',
                  activeTab === tab
                    ? 'border-primary font-semibold text-foreground'
                    : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'overview' ? t('panel.tab.overview')
                  : tab === 'parameters' ? t('panel.tab.parameters')
                  : tab === 'envelope' ? t('panel.tab.envelope')
                  : t('panel.title.technology')}
              </button>
            ))}
          </div>
          {activeTab === 'parameters' && onEditField && (
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
      </div>

      {activeTab === 'overview' ? (
        <div className="p-4">{overviewSlot}</div>
      ) : activeTab === 'technology' ? (
        <div className="p-4">{technologySlot}</div>
      ) : activeTab === 'parameters' ? (
        <>
        <table className="w-full text-sm bg-card">
          <colgroup>
            <col className="w-[42%]" />
            <col />
            <col className="w-20" />
          </colgroup>
          <tbody>
            {snapshotRows.map((row) => {
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
        {typeof parametersSlot === 'function' ? parametersSlot(() => setActiveTab('envelope')) : parametersSlot}
        </>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <ElementCompositionSection
            elements={elements}
            baselineElements={baselineElements}
            roofConfig={roofConfig}
            onSelectSurface={onSelectSurface}
          />
          {envelopeSlot}
        </div>
      )}
    </div>
  );
}
