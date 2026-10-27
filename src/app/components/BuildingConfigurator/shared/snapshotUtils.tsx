// Utilities for comparing current building state against the default estimate
// and classifying the result as 'default' or 'modified'.

import React from 'react';
import { cn } from '@/lib/utils';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import {
  DEFAULT_ELEMENTS,
  DEFAULT_GENERAL,
  DEFAULT_TOTAL_AREA,
  DEFAULT_AVG_U_VALUE,
  computeVolume,
} from './buildingDefaults';
import { BUILDING_TYPE_OPTIONS, COUNTRY_OPTIONS } from './buildingOptions';
import { meanStoreyHeight, storeyHeightList } from '@/app/lib/storeys';
import { formatNumber, useT, type Language, type MessageValues } from '@/app/i18n';

export type SnapshotStatus = 'default' | 'modified';

/** Returns a Tailwind class string for the given snapshot status. */
export function getSnapshotStatusClassName(status: SnapshotStatus): string {
  return status === 'modified'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-border bg-muted text-muted-foreground';
}

/** Returns true when two floats are equal within `epsilon`. */
export function isCloseTo(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}

/**
 * Returns 'modified' if any property of `element` differs from its baseline.
 * When `baselineElement` is provided it is used directly; otherwise falls back
 * to the static DEFAULT_ELEMENTS lookup (used when no building has been loaded).
 */
export function getElementStatus(
  element: BuildingElement,
  baselineElement?: BuildingElement,
): SnapshotStatus {
  const def = baselineElement ?? DEFAULT_ELEMENTS[element.id];

  if (!def) return 'modified';

  const matches = isCloseTo(element.area, def.area)
    && isCloseTo(element.uValue, def.uValue)
    && isCloseTo(element.tilt, def.tilt)
    && isCloseTo(element.azimuth, def.azimuth)
    && (
      (element.gValue === null && def.gValue === null)
      || (element.gValue !== null && def.gValue !== null && isCloseTo(element.gValue, def.gValue))
    );

  return matches ? 'default' : 'modified';
}

/** Small pill badge showing whether a value matches or diverges from the estimate. */
export function SnapshotStatusBadge({ status }: { status: SnapshotStatus }) {
  const t = useT();
  return (
    <span className={cn(
      'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize',
      getSnapshotStatusClassName(status),
    )}>
      {status === 'modified' ? t('snapshot.status.modified') : t('snapshot.status.default')}
    </span>
  );
}

export interface SnapshotRow {
  label: string;
  /** Translation key for `label`. */
  labelKey: string;
  /** Formatted display string shown when not editing. */
  value: string;
  /** Translation of `value`, where it holds words. */
  valueMessage?: { key: string; values: MessageValues };
  status: SnapshotStatus;
  /** When set, the row is inline-editable. Key maps to the `general` state object. */
  editKey?: string;
  /**
   * Controls the edit widget rendered for this row:
   * - 'text'   -> free-text input
   * - 'number' -> numeric input; saved as Number(draft)
   * - 'select' -> dropdown; requires `options`
   */
  editType?: 'text' | 'number' | 'select';
  /** Option list for 'select' rows. */
  options?: Array<{ value: string; label: string }>;
  /** Raw (unformatted) value used as the initial input value when editing starts. */
  rawValue?: string | number;
}

export interface SnapshotBaseline {
  general: typeof DEFAULT_GENERAL;
  elements: Record<string, BuildingElement>;
  totalArea: number;
  elementCount: number;
}

/**
 * Builds the rows for the building info table, flagging each value against the
 * baseline. When `baseline` is omitted the static defaults are used as the
 * reference point (no building data loaded yet).
 */
export function buildSnapshotRows(
  general: typeof DEFAULT_GENERAL,
  elements: Record<string, BuildingElement>,
  totalArea: number,
  language: Language,
  baseline?: SnapshotBaseline,
): SnapshotRow[] {
  const baseGeneral      = baseline?.general      ?? DEFAULT_GENERAL;
  const baseTotalArea    = baseline?.totalArea    ?? DEFAULT_TOTAL_AREA;
  const baseElementCount = baseline?.elementCount ?? Object.keys(DEFAULT_ELEMENTS).length;
  // With storeys left out the table describes what BuEM receives: the modelled
  // storeys, and each surface for its share inside them.
  const modelled = general.storeysModelled;
  const modelledStoreys = modelled?.length ?? general.storeys;
  // The room height BuEM receives: the mean of the modelled storeys' own heights.
  const ownHeights = Object.values(general.storeyHeights ?? {}).some((h) => h > 0);
  const roomHeight = meanStoreyHeight(storeyHeightList(general.storeys, general.roomHeight, general.storeyHeights), modelled ?? null)
    || general.roomHeight;
  const sent = modelled
    ? Object.values(elements).filter((el) => (el.modelledShare ?? 1) > 0)
    : Object.values(elements);
  const envelopeArea = modelled ? sent.reduce((sum, el) => sum + el.area * (el.modelledShare ?? 1), 0) : totalArea;

  return [
    {
      label: 'Type',
      labelKey: 'snapshot.row.type',
      value: general.buildingType,
      status: general.buildingType === baseGeneral.buildingType ? 'default' : 'modified',
      editKey: 'buildingType',
      editType: 'select',
      options: BUILDING_TYPE_OPTIONS,
      rawValue: general.buildingType,
    },
    {
      label: 'Construction year',
      labelKey: 'snapshot.row.constructionYear',
      value: String(general.constructionYear),
      status: general.constructionYear === baseGeneral.constructionYear ? 'default' : 'modified',
      editKey: 'constructionYear',
      editType: 'number',
      rawValue: general.constructionYear,
    },
    {
      label: 'Country',
      labelKey: 'snapshot.row.country',
      value: general.country,
      status: general.country === baseGeneral.country ? 'default' : 'modified',
      editKey: 'country',
      editType: 'select',
      options: COUNTRY_OPTIONS,
      rawValue: general.country,
    },
    {
      label: 'Floor area (per storey)',
      labelKey: 'snapshot.row.floorAreaPerStorey',
      value: `${formatNumber(language, general.floorArea, 1)} m²`,
      // Read only: the footprint comes from the 3D model, whose surfaces cannot be redrawn here.
      status: isCloseTo(general.floorArea, baseGeneral.floorArea) ? 'default' : 'modified',
    },
    {
      label: 'Storeys',
      labelKey: 'snapshot.row.storeys',
      value: `${general.storeys}`,
      ...(modelled ? { valueMessage: { key: 'snapshot.storeysModelled', values: { modelled: modelled.length, total: general.storeys } } } : {}),
      status: general.storeys === baseGeneral.storeys && !modelled ? 'default' : 'modified',
    },
    {
      label: 'Room height',
      labelKey: 'snapshot.row.roomHeight',
      value: `${formatNumber(language, roomHeight, 1)} m`,
      status: isCloseTo(general.roomHeight, baseGeneral.roomHeight) && !ownHeights ? 'default' : 'modified',
    },
    {
      label: 'Volume',
      labelKey: 'snapshot.row.volume',
      value: `${formatNumber(language, computeVolume(general.floorArea, modelledStoreys, roomHeight), 0)} m³`,
      status: isCloseTo(general.floorArea, baseGeneral.floorArea)
        && general.storeys === baseGeneral.storeys
        && !modelled
        && isCloseTo(general.roomHeight, baseGeneral.roomHeight)
        && !ownHeights
        ? 'default'
        : 'modified',
    },
    {
      label: 'Envelope',
      labelKey: 'snapshot.row.envelope',
      value: `${formatNumber(language, envelopeArea, 1)} m²  ·  ${sent.length} surfaces`,
      valueMessage: {
        key: 'snapshot.envelopeValue',
        values: { area: formatNumber(language, envelopeArea, 1), count: sent.length },
      },
      status: isCloseTo(envelopeArea, baseTotalArea)
        && sent.length === baseElementCount
        ? 'default'
        : 'modified',
    },
  ];
}

/** Returns the snapshot status for the overall thermal efficiency metric. */
export function getThermalEfficiencyStatus(avgUValue: number): SnapshotStatus {
  return isCloseTo(avgUValue, DEFAULT_AVG_U_VALUE) ? 'default' : 'modified';
}
