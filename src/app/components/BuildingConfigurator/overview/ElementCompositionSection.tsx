// Accordion table of building envelope surfaces with inline editing.
// Used in the Overview panel's right column.

import React, { useState, useRef } from 'react';
import { ChevronDown, Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ELEMENT_DOTS } from '../shared/ui';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import { isElementEditable, isUserDefinedElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { RoofConfig } from '@/app/components/BuildingConfigurator/configure/model/roof';
import {
  ElementGroupKey,
  ELEMENT_GROUP_LABELS,
  getGroupedElements,
  getRoofGroupInfo,
} from '../shared/elementListUtils';
import {
  SnapshotStatus,
  SnapshotStatusBadge,
  getElementStatus,
} from '../shared/snapshotUtils';
import { StepperNumberInput } from '../shared/StepperInput';
import { scheduleScrollIntoView } from '../shared/scrollUtils';

export interface ElementCompositionSectionProps {
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<BuildingElement>) => void;
  onEnableCustomMode: (id: string) => void;
  roofConfig: RoofConfig;
  /** Switches to Configure view with the given element pre-selected. */
  onSwitchToConfigure: (elementId: string) => void;
}

type EditingDraft = { area: string; uValue: string; gValue: string; tilt: string; azimuth: string };

/** Validates and clamps draft field values before committing an element edit. */
function clampSurfacePatch(
  element: BuildingElement,
  draft: EditingDraft,
): Partial<BuildingElement> | null {
  const area    = Number(draft.area);
  const uValue  = Number(draft.uValue);
  const tilt    = Number(draft.tilt);
  const azimuth = Number(draft.azimuth);

  if ([area, uValue, tilt, azimuth].some(Number.isNaN)) return null;

  const patch: Partial<BuildingElement> = {
    area:    Math.max(0.1, area),
    uValue:  Math.max(0.01, uValue),
    tilt:    Math.min(90, Math.max(0, tilt)),
    azimuth: ((azimuth % 360) + 360) % 360,
  };

  if (element.gValue !== null) {
    const gValue = Number(draft.gValue);
    if (Number.isNaN(gValue)) return null;
    patch.gValue = Math.min(1, Math.max(0, gValue));
  }

  return patch;
}

const EMPTY_DRAFT: EditingDraft = { area: '', uValue: '', gValue: '', tilt: '', azimuth: '' };

/** Maps an azimuth angle (0–360°) to the nearest 8-point compass direction. */
function azimuthToDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % 8];
}

/** Accordion of element groups with expandable tables and per-row inline editing. */
export function ElementCompositionSection({
  elements,
  selectedId,
  onSelect,
  onUpdate,
  onEnableCustomMode,
  roofConfig,
  onSwitchToConfigure,
}: ElementCompositionSectionProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    wall: false, roof: false, floor: false, window: false, door: false,
  });
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<EditingDraft>(EMPTY_DRAFT);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const grouped    = getGroupedElements(elements);
  const roofInfo   = getRoofGroupInfo(roofConfig);
  const types      = (Object.keys(grouped) as ElementGroupKey[]).filter((t) => grouped[t].length > 0);
  const activeType = types.find((t) => expandedGroups[t]) ?? null;

  const toggleGroup = (type: string) => {
    const willExpand = !expandedGroups[type];
    setExpandedGroups((prev) => {
      const allClosed = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
      return { ...allClosed, [type]: !prev[type] };
    });
    if (willExpand) {
      requestAnimationFrame(() => scheduleScrollIntoView(cardRefs.current[type]));
    }
  };

  const startEditing = (el: BuildingElement) => {
    if (!isElementEditable(el)) return;
    setEditingId(el.id);
    setEditingDraft({
      area:    el.area.toFixed(1),
      uValue:  el.uValue.toFixed(2),
      gValue:  el.gValue !== null ? el.gValue.toFixed(2) : '',
      tilt:    String(Math.round(el.tilt)),
      azimuth: String(Math.round(el.azimuth)),
    });
  };

  const cancelEditing = () => { setEditingId(null); setEditingDraft(EMPTY_DRAFT); };

  const saveEditing = (el: BuildingElement) => {
    const patch = clampSurfacePatch(el, editingDraft);
    if (!patch) return;
    onUpdate(el.id, patch);
    cancelEditing();
  };

  const renderHeader = (type: ElementGroupKey, compact: boolean) => {
    const items         = grouped[type];
    const isExpanded    = expandedGroups[type] ?? false;
    const totalArea     = items.reduce((sum, el) => sum + el.area, 0);
    const displayCount  = items.length;
    // For roof, append the shape description after the area; for others just show area.
    const areaStr       = `${totalArea.toFixed(1)} m²`;
    const description   = type === 'roof' && roofInfo.description
      ? `${areaStr} · ${roofInfo.description}`
      : areaStr;
    const modifiedCount = items.filter((el) => getElementStatus(el) === 'modified').length;
    const groupStatus: SnapshotStatus = modifiedCount > 0 ? 'modified' : 'default';

    return (
      <button
        type="button"
        onClick={() => toggleGroup(type)}
        className={cn(
          'flex w-full flex-col px-3 text-left transition-colors hover:bg-slate-50',
          compact ? 'py-2.5' : 'py-3',
        )}
      >
        {/* Top row: label left, badge + chevron right */}
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-700 leading-tight">
            {ELEMENT_GROUP_LABELS[type]}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {!compact && <SnapshotStatusBadge status={groupStatus} />}
            <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-300', isExpanded && 'rotate-180')} />
          </div>
        </div>

        {/* Description row: full width, no crowding */}
        {!compact && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {displayCount} surface{displayCount !== 1 ? 's' : ''} · {description}
            {modifiedCount > 0 ? ` · ${modifiedCount} modified` : ''}
          </p>
        )}
      </button>
    );
  };

  const renderTable = (type: ElementGroupKey) => {
    const items          = grouped[type];
    const isExpanded     = expandedGroups[type] ?? false;
    const editingInGroup = editingId !== null && items.some((el) => el.id === editingId);

    return (
      <div
        className="overflow-hidden"
        style={{
          maxHeight: isExpanded ? '500px' : '0px',
          transition: 'max-height 300ms ease-in-out',
        }}
      >
        <div>
          {editingInGroup && (
            <div className="flex items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] text-amber-700">
                Quick edits only — for detailed properties use Configure mode.
              </p>
              <button
                type="button"
                onClick={() => { cancelEditing(); onSwitchToConfigure(editingId!); }}
                className="shrink-0 text-[11px] font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 cursor-pointer"
              >
                Switch →
              </button>
            </div>
          )}
          <div className="border-t border-slate-200 bg-white/80 px-3 py-3">
            <table className="w-full table-fixed border-collapse text-left bg-white">
              <thead className="text-[10px] uppercase tracking-[0.05em] text-slate-400">
                <tr className="border-b border-slate-200/80">
                  <th className="px-2 py-1.5 font-semibold">Surface</th>
                  <th className="w-24 border-l border-slate-100 px-2 py-1.5 font-semibold">Status</th>
                  <th className="w-20 border-l border-slate-100 px-2 py-1.5 font-semibold">Area</th>
                  <th className="w-[72px] border-l border-slate-100 px-2 py-1.5 font-semibold">U</th>
                  <th className="w-[72px] border-l border-slate-100 px-2 py-1.5 font-semibold">g</th>
                  <th className="w-20 border-l border-slate-100 px-2 py-1.5 font-semibold">Tilt</th>
                  <th className="w-24 border-l border-slate-100 px-2 py-1.5 font-semibold">Azimuth</th>
                  <th className="w-16 border-l border-slate-100 px-2 py-1.5 font-semibold text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="text-[11px] divide-y divide-slate-100">
                {items.map((el) => renderRow(el))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRow = (el: BuildingElement) => {
    const isEditing    = editingId === el.id;
    const active       = selectedId === el.id || isEditing;
    const elementStatus = getElementStatus(el);
    const editable     = isElementEditable(el);
    const userDefined  = isUserDefinedElement(el);

    const patchField = (key: keyof EditingDraft) => (value: string) =>
      setEditingDraft((prev) => ({ ...prev, [key]: value }));

    return (
      <tr
        key={el.id}
        onKeyDown={isEditing ? (e) => {
          if (e.key === 'Enter')  { e.preventDefault(); saveEditing(el); }
          if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
        } : undefined}
        className="transition-colors hover:bg-slate-50"
      >
        <td className="px-2 py-2.5 font-medium text-foreground">
          <div className="flex items-center gap-2">
            <span className="truncate">{el.label}</span>
            {userDefined && (
              <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                User
              </span>
            )}
          </div>
        </td>
        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
          <SnapshotStatusBadge status={elementStatus} />
        </td>
        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
          {isEditing
            ? <StepperNumberInput value={editingDraft.area}    onChange={patchField('area')}    step={0.1} min={0.1} />
            : el.area.toFixed(1)}
        </td>
        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
          {isEditing
            ? <StepperNumberInput value={editingDraft.uValue}  onChange={patchField('uValue')}  step={0.01} min={0.01} />
            : el.uValue.toFixed(2)}
        </td>
        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
          {el.gValue === null
            ? '—'
            : isEditing
              ? <StepperNumberInput value={editingDraft.gValue} onChange={patchField('gValue')} step={0.01} min={0} max={1} />
              : el.gValue.toFixed(2)}
        </td>
        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
          {isEditing
            ? <StepperNumberInput value={editingDraft.tilt}    onChange={patchField('tilt')}    step={1} min={0} max={90} />
            : `${Math.round(el.tilt)}°`}
        </td>
        <td className="border-l border-slate-100 px-2 py-2.5 text-muted-foreground">
          {isEditing
            ? <StepperNumberInput value={editingDraft.azimuth} onChange={patchField('azimuth')} step={1} min={0} max={360} />
            : `${Math.round(el.azimuth)}° (${azimuthToDirection(el.azimuth)})`}
        </td>
        <td className="border-l border-slate-100 px-2 py-2.5 text-right">
          {isEditing ? (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => saveEditing(el)}
                className="inline-flex size-6 items-center justify-center rounded-[4px] border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100"
                aria-label={`Save ${el.label}`}
              >
                <Check className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex size-6 items-center justify-center rounded-[4px] border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100"
                aria-label={`Cancel editing ${el.label}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            editable ? (
              <button
                type="button"
                onClick={() => startEditing(el)}
                className="inline-flex size-6 items-center justify-center rounded-[4px] border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100"
                aria-label={`Edit ${el.label}`}
              >
                <Pencil className="size-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { onEnableCustomMode(el.id); onSwitchToConfigure(el.id); }}
                className="inline-flex rounded-[4px] border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                aria-label={`Enable custom mode for ${el.label}`}
              >
                Custom
              </button>
            )
          )}
        </td>
      </tr>
    );
  };

  const getCardClass = () =>
    'overflow-hidden rounded-lg border border-white bg-white shadow-[0_1px_3px_rgba(15,23,42,0.07),0_4px_16px_rgba(15,23,42,0.08)]';

  if (activeType) {
    const chipTypes = types.filter((t) => t !== activeType);
    return (
      <div className="flex flex-col gap-3">
        {/* Inactive groups as a compact chip row */}
        {chipTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chipTypes.map((type) => {
              const items       = grouped[type];
              const hasModified = items.some((el) => getElementStatus(el) === 'modified');
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleGroup(type)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                >
                  {hasModified && <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  {ELEMENT_GROUP_LABELS[type]}
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">
                    {items.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Expanded group at full width */}
        <div ref={(el) => { cardRefs.current[activeType] = el; }} className={getCardClass()}>
          {renderHeader(activeType, false)}
          {renderTable(activeType)}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 xl:grid-cols-3">
      {types.map((type) => (
        <div key={type} ref={(el) => { cardRefs.current[type] = el; }} className={getCardClass()}>
          {renderHeader(type, false)}
          {renderTable(type)}
        </div>
      ))}
    </div>
  );
}
