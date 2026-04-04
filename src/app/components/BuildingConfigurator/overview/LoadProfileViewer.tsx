import React, { useRef, useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { BoltOutlined } from '@mui/icons-material';
import { Download, Upload, Zap, Flame, Droplets, Layers3 } from 'lucide-react';
import { T, SegmentedControl } from '../shared/ui';

// ─── Static Data Model ────────────────────────────────────────────────────────

type EnergyType = 'electricity' | 'heating' | 'hotwater' | 'combined';
type Resolution = 'hourly' | 'daily' | 'weekly' | 'monthly';
type WindowMode = 'stepped' | 'free';

export interface LoadDataPoint {
  timestamp: string;
  electricity: number;
  heating: number;
  hotwater: number;
}

type DatasetByResolution = Record<Resolution, LoadDataPoint[]>;
type DerivedDataState = {
  rows: LoadDataPoint[];
  sourceResolution: Resolution | null;
  isDerived: boolean;
};
type BrushRange = {
  startIndex: number;
  endIndex: number;
};

const RESOLUTIONS: Resolution[] = ['hourly', 'daily', 'weekly', 'monthly'];
const RESOLUTION_ORDER: Resolution[] = ['hourly', 'daily', 'weekly', 'monthly'];
const DEFAULT_WINDOW_BY_RESOLUTION: Record<Resolution, number> = {
  hourly: 24,
  daily: 365,
  weekly: 52,
  monthly: 12,
};
const BASE_UTC_DATE = Date.UTC(2026, 0, 5, 0, 0, 0);
const TIMESTAMP_HEADERS = ['datetime', 'timestamp', 'time', 'date', 'timesteps', 'zeit'];
const ELECTRICITY_HEADERS = ['electricity', 'power', 'el'];
const HEATING_HEADERS = ['heating', 'heat'];
const HOTWATER_HEADERS = ['hotwater', 'hot_water', 'hot water', 'dhw'];

function clampNumber(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}

function formatEnergyValue(value: number, maximumFractionDigits = 4) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '0';

  const absValue = Math.abs(value);

  if (absValue === 0) return '0';
  if (absValue >= 100) return value.toFixed(0);
  if (absValue >= 10) return value.toFixed(1);
  if (absValue >= 1) return value.toFixed(2);
  if (absValue >= 0.1) return value.toFixed(Math.min(maximumFractionDigits, 3));
  if (absValue >= 0.01) return value.toFixed(Math.min(maximumFractionDigits, 4));
  return value.toFixed(Math.min(maximumFractionDigits, 6));
}

function toIsoString(date: Date) {
  return date.toISOString().replace('.000Z', 'Z');
}

function offsetIsoDate(baseUtc: number, amount: number, unit: 'hour' | 'day' | 'week' | 'month') {
  const date = new Date(baseUtc);

  if (unit === 'hour') date.setUTCHours(date.getUTCHours() + amount);
  if (unit === 'day') date.setUTCDate(date.getUTCDate() + amount);
  if (unit === 'week') date.setUTCDate(date.getUTCDate() + amount * 7);
  if (unit === 'month') date.setUTCMonth(date.getUTCMonth() + amount);

  return toIsoString(date);
}

function resolutionUnit(resolution: Resolution): 'hour' | 'day' | 'week' | 'month' {
  if (resolution === 'hourly') return 'hour';
  if (resolution === 'daily') return 'day';
  if (resolution === 'weekly') return 'week';
  return 'month';
}

function normalizeDatetime(value: unknown, fallback: string, resolution: Resolution, index: number) {
  if (typeof value !== 'string' || value.trim() === '') return fallback;

  const trimmed = value.trim();

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [hours, minutes, seconds = '00'] = trimmed.split(':');
    const date = new Date(BASE_UTC_DATE);
    date.setUTCHours(Number(hours), Number(minutes), Number(seconds), 0);
    if (resolution !== 'hourly') {
      const offsetUnit = resolutionUnit(resolution);
      if (offsetUnit === 'day') date.setUTCDate(date.getUTCDate() + index);
      if (offsetUnit === 'week') date.setUTCDate(date.getUTCDate() + index * 7);
      if (offsetUnit === 'month') date.setUTCMonth(date.getUTCMonth() + index);
    }
    return toIsoString(date);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }

  return toIsoString(parsed);
}

function formatTickLabel(timestamp: string, resolution: Resolution) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  if (resolution === 'hourly') {
    return date.toISOString().slice(11, 16);
  }

  if (resolution === 'daily' || resolution === 'weekly') {
    return date.toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 7);
}

function toUtcDateKey(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toISOString().slice(0, 10);
}

function getDistinctDateKeys(data: LoadDataPoint[]) {
  return Array.from(new Set(data.map((point) => toUtcDateKey(point.timestamp))));
}

function rangeEquals(left: BrushRange, right: BrushRange) {
  return left.startIndex === right.startIndex && left.endIndex === right.endIndex;
}

function buildWindowRange(total: number, startIndex: number, windowSize: number): BrushRange {
  if (total <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const effectiveWindow = Math.max(1, Math.min(windowSize, total));
  const safeStart = Math.max(0, Math.min(startIndex, total - effectiveWindow));

  return {
    startIndex: safeStart,
    endIndex: safeStart + effectiveWindow - 1,
  };
}

function clampBrushRange(total: number, startIndex: number, endIndex: number): BrushRange {
  if (total <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const safeStart = Math.max(0, Math.min(startIndex, total - 1));
  const safeEnd = Math.max(safeStart, Math.min(endIndex, total - 1));

  return { startIndex: safeStart, endIndex: safeEnd };
}

function findDateRange(data: LoadDataPoint[], dateKey: string): BrushRange | null {
  const startIndex = data.findIndex((point) => toUtcDateKey(point.timestamp) === dateKey);

  if (startIndex === -1) {
    return null;
  }

  let endIndex = startIndex;

  while (endIndex + 1 < data.length && toUtcDateKey(data[endIndex + 1].timestamp) === dateKey) {
    endIndex += 1;
  }

  return { startIndex, endIndex };
}

function getVisibleRangeLabel(data: LoadDataPoint[], range: BrushRange, resolution: Resolution) {
  if (data.length === 0) return '';

  const safeRange = clampBrushRange(data.length, range.startIndex, range.endIndex);
  const start = data[safeRange.startIndex];
  const end = data[safeRange.endIndex];

  if (!start || !end) return '';

  const count = safeRange.endIndex - safeRange.startIndex + 1;

  if (resolution === 'hourly') {
    return `${toUtcDateKey(start.timestamp)} · ${count} hours`;
  }

  const unitLabel = resolution === 'daily' ? 'days' : resolution === 'weekly' ? 'weeks' : 'months';
  return `${formatTickLabel(start.timestamp, resolution)} to ${formatTickLabel(end.timestamp, resolution)} · ${count} ${unitLabel}`;
}

function startOfUtcBucket(timestamp: string, resolution: Exclude<Resolution, 'hourly'>) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const bucket = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
  ));

  if (resolution === 'weekly') {
    const day = bucket.getUTCDay();
    const offsetToMonday = day === 0 ? -6 : 1 - day;
    bucket.setUTCDate(bucket.getUTCDate() + offsetToMonday);
  }

  if (resolution === 'monthly') {
    bucket.setUTCDate(1);
  }

  return toIsoString(bucket);
}

function aggregateSeries(data: LoadDataPoint[], resolution: Exclude<Resolution, 'hourly'>): LoadDataPoint[] {
  const buckets = new Map<string, LoadDataPoint>();

  data
    .slice()
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .forEach((point) => {
      const bucketTimestamp = startOfUtcBucket(point.timestamp, resolution);
      const existing = buckets.get(bucketTimestamp);

      if (existing) {
        existing.electricity = clampNumber(existing.electricity + point.electricity);
        existing.heating = clampNumber(existing.heating + point.heating);
        existing.hotwater = clampNumber(existing.hotwater + point.hotwater);
        return;
      }

      buckets.set(bucketTimestamp, {
        timestamp: bucketTimestamp,
        electricity: clampNumber(point.electricity),
        heating: clampNumber(point.heating),
        hotwater: clampNumber(point.hotwater),
      });
    });

  return Array.from(buckets.values());
}

function getDerivedData(dataset: DatasetByResolution, resolution: Resolution): DerivedDataState {
  const directRows = dataset[resolution];

  if (directRows.length > 0) {
    return { rows: directRows, sourceResolution: resolution, isDerived: false };
  }

  if (resolution === 'hourly') {
    return { rows: [], sourceResolution: null, isDerived: false };
  }

  const targetIndex = RESOLUTION_ORDER.indexOf(resolution);

  for (let index = 0; index < targetIndex; index += 1) {
    const sourceResolution = RESOLUTION_ORDER[index];
    const sourceRows = dataset[sourceResolution];

    if (sourceRows.length === 0) continue;

    return {
      rows: aggregateSeries(sourceRows, resolution),
      sourceResolution,
      isDerived: true,
    };
  }

  return { rows: [], sourceResolution: null, isDerived: false };
}

function createDefaultDataset(): DatasetByResolution {
  const hourly: LoadDataPoint[] = [];
  const daily: LoadDataPoint[] = [];
  const weekly: LoadDataPoint[] = [];
  const monthly: LoadDataPoint[] = [];

  return { hourly, daily, weekly, monthly };
}

function normalizePoint(input: any, index: number, resolution: Resolution = 'hourly'): LoadDataPoint | null {
  if (!input || typeof input !== 'object') return null;

  const fallback = offsetIsoDate(BASE_UTC_DATE, index, 'hour');
  const pointResolution = (input.resolution as Resolution | undefined) ?? resolution;
  const timestamp = normalizeDatetime(
    input.datetime ?? input.timestamp ?? input.time ?? input.date ?? input.timesteps ?? input.Zeit,
    fallback,
    pointResolution,
    index,
  );
  const electricity = Number(input.electricity ?? input.power ?? input.el ?? 0);
  const heating = Number(input.heating ?? input.heat ?? 0);
  const hotwater = Number(input.hotwater ?? input.hotWater ?? input.dhw ?? 0);

  if ([electricity, heating, hotwater].some((value) => Number.isNaN(value))) {
    return null;
  }

  return {
    timestamp,
    electricity: clampNumber(electricity),
    heating: clampNumber(heating),
    hotwater: clampNumber(hotwater),
  };
}

function normalizeSeries(input: unknown, resolution: Resolution = 'hourly'): LoadDataPoint[] {
  if (!Array.isArray(input)) {
    throw new Error('Expected an array of load profile rows.');
  }

  const rows = input
    .map((entry, index) => normalizePoint(entry, index, resolution))
    .filter((entry): entry is LoadDataPoint => entry !== null);

  if (rows.length === 0) {
    throw new Error('The file did not contain any valid load profile rows.');
  }

  return rows;
}

function parseCsv(text: string, resolution: Resolution): LoadDataPoint[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV files need a header row and at least one data row.');
  }

  const headers = lines[0]
    .split(',')
    .map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase());
  const timestampIndex = headers.findIndex((header) => TIMESTAMP_HEADERS.includes(header));
  const electricityIndex = headers.findIndex((header) => ELECTRICITY_HEADERS.includes(header));
  const heatingIndex = headers.findIndex((header) => HEATING_HEADERS.includes(header));
  const hotwaterIndex = headers.findIndex((header) => HOTWATER_HEADERS.includes(header));

  if (timestampIndex === -1) {
    throw new Error('CSV files must include a timestamp column.');
  }

  const rows = lines.slice(1).map((line, index) => {
    const cols = line.split(',').map((value) => value.trim());
    return normalizePoint({
      datetime: cols[timestampIndex],
      electricity: electricityIndex >= 0 ? cols[electricityIndex] : 0,
      heating: heatingIndex >= 0 ? cols[heatingIndex] : 0,
      hotwater: hotwaterIndex >= 0 ? cols[hotwaterIndex] : 0,
    }, index, resolution);
  }).filter((entry): entry is LoadDataPoint => entry !== null);

  if (rows.length === 0) {
    throw new Error('The CSV file did not contain any valid load profile rows.');
  }

  return rows;
}

function toCsv(data: LoadDataPoint[], resolution: Resolution) {
  const header = 'datetime,electricity,heating,hotwater';
  const rows = data.map((row, index) => [
    normalizeDatetime(row.timestamp, offsetIsoDate(BASE_UTC_DATE, index, resolutionUnit(resolution)), resolution, index),
    row.electricity,
    row.heating,
    row.hotwater,
  ].join(','));

  return [header, ...rows].join('\n');
}

function mergeUploadedData(
  previous: DatasetByResolution,
  uploaded: unknown,
  resolution: Resolution,
): DatasetByResolution {
  if (Array.isArray(uploaded)) {
    return { ...previous, [resolution]: normalizeSeries(uploaded, resolution) };
  }

  if (!uploaded || typeof uploaded !== 'object') {
    throw new Error('Unsupported JSON format.');
  }

  const record = uploaded as Record<string, unknown>;

  if (Array.isArray(record.data)) {
    const targetResolution = RESOLUTIONS.includes(record.resolution as Resolution)
      ? record.resolution as Resolution
      : resolution;
    return { ...previous, [targetResolution]: normalizeSeries(record.data, targetResolution) };
  }

  let hasAtLeastOneSeries = false;
  const next = { ...previous };

  RESOLUTIONS.forEach((key) => {
    if (Array.isArray(record[key])) {
      next[key] = normalizeSeries(record[key], key);
      hasAtLeastOneSeries = true;
    }
  });

  if (!hasAtLeastOneSeries) {
    throw new Error('JSON files must contain either a data array or one or more resolution arrays.');
  }

  return next;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface EnergyTotals {
  electricity: string;
  heating: string;
  hotwater: string;
  unit: string;
}

interface LoadProfileViewerProps {
  buildingId?: string;
  onTotalsChange?: (totals: EnergyTotals) => void;
  /** Pre-seeds the hourly dataset from model output. Replaces any user-uploaded data. */
  initialTimeseries?: LoadDataPoint[];
  /** Controls UI complexity. Basic hides expert controls; defaults to basic. */
  mode?: 'basic' | 'expert';
}

export function LoadProfileViewer({ buildingId = 'Building 3', onTotalsChange, initialTimeseries, mode = 'basic' }: LoadProfileViewerProps) {
  const [energyType, setEnergyType] = useState<EnergyType>(mode === 'basic' ? 'combined' : 'electricity');
  const [resolution, setResolution] = useState<Resolution>(mode === 'basic' ? 'monthly' : 'daily');
  const [windowMode, setWindowMode] = useState<WindowMode>(mode === 'basic' ? 'free' : 'stepped');
  const [dataset, setDataset] = useState<DatasetByResolution>(() => {
    if (initialTimeseries && initialTimeseries.length > 0) {
      return { ...createDefaultDataset(), hourly: initialTimeseries };
    }
    return createDefaultDataset();
  });
  const [sourceLabel, setSourceLabel] = useState(() =>
    initialTimeseries && initialTimeseries.length > 0 ? 'BUEM model output' : 'No profile loaded',
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [brushRange, setBrushRange] = useState<BrushRange>({ startIndex: 0, endIndex: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset to simplified defaults whenever basic mode is (re-)applied.
  useEffect(() => {
    if (mode !== 'basic') return;
    setResolution('monthly');
    setWindowMode('free');
    setEnergyType('combined');
  }, [mode]);

  const derivedData = getDerivedData(dataset, resolution);
  const data = derivedData.rows;
  const hasData = data.length > 0;
  const defaultWindowSize = DEFAULT_WINDOW_BY_RESOLUTION[resolution];
  const availableHourlyDates = resolution === 'hourly' ? getDistinctDateKeys(data) : [];
  const showBrush = data.length > 1;
  const dataSignature = hasData
    ? `${resolution}-${derivedData.sourceResolution ?? 'none'}-${data.length}-${data[0].timestamp}-${data[data.length - 1].timestamp}`
    : `${resolution}-empty`;

  // Shorter labels that communicate "what time period each data point covers"
  const resolutionOptions = [
    ...(mode === 'expert' ? [{ value: 'hourly', label: 'Hour' }] : []),
    { value: 'daily',   label: 'Day'   },
    { value: 'weekly',  label: 'Week'  },
    { value: 'monthly', label: 'Month' },
  ];
  const windowModeOptions = [
    { value: 'stepped', label: 'Stepped' },
    { value: 'free', label: 'Free Range' },
  ];

  const getUnit = () => {
    switch (resolution) {
      case 'hourly': return 'kW';
      case 'daily': return 'kWh/day';
      case 'weekly': return 'kWh/week';
      case 'monthly': return 'kWh/month';
    }
  };

  const getSourceCaption = () => {
    if (!derivedData.isDerived || !derivedData.sourceResolution || derivedData.sourceResolution === resolution) {
      return sourceLabel;
    }

    return `${sourceLabel} · ${resolution} view aggregated from ${derivedData.sourceResolution}`;
  };

  const getStepLabel = () => {
    if (resolution === 'hourly') return '24-hour day';
    if (resolution === 'daily') return '365-day window';
    if (resolution === 'weekly') return '52-week window';
    return '12-month window';
  };

  const updateBrushRange = (nextRange: BrushRange) => {
    setBrushRange((previous) => (rangeEquals(previous, nextRange) ? previous : nextRange));
  };

  const fitAllData = () => {
    if (!hasData) return;

    setWindowMode('free');
    updateBrushRange(buildWindowRange(data.length, 0, data.length));
  };

  const shiftSteppedWindow = (direction: -1 | 1) => {
    if (!hasData || windowMode !== 'stepped') return;

    if (resolution === 'hourly') {
      const currentIndex = availableHourlyDates.indexOf(selectedDate);
      const fallbackIndex = availableHourlyDates.length - 1;
      const baseIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
      const nextIndex = Math.max(0, Math.min(baseIndex + direction, availableHourlyDates.length - 1));
      const nextDate = availableHourlyDates[nextIndex];
      if (nextDate) setSelectedDate(nextDate);
      return;
    }

    updateBrushRange(buildWindowRange(data.length, brushRange.startIndex + direction * defaultWindowSize, defaultWindowSize));
  };

  const handleBrushChange = (next: { startIndex?: number; endIndex?: number }) => {
    if (!hasData) return;

    const nextStart = next.startIndex ?? brushRange.startIndex;
    const nextEnd = next.endIndex ?? brushRange.endIndex;

    if (windowMode === 'free') {
      updateBrushRange(clampBrushRange(data.length, nextStart, nextEnd));
      return;
    }

    if (resolution === 'hourly') {
      const dateAtStart = data[Math.max(0, Math.min(nextStart, data.length - 1))];
      if (dateAtStart) setSelectedDate(toUtcDateKey(dateAtStart.timestamp));
      return;
    }

    updateBrushRange(buildWindowRange(data.length, nextStart, defaultWindowSize));
  };

  const calculateTotal = (key: 'electricity' | 'heating' | 'hotwater') => {
    if (!hasData) return '—';
    return formatEnergyValue(data.reduce((sum, d) => sum + d[key], 0), 6);
  };

  // Report totals up whenever data or resolution changes.
  useEffect(() => {
    if (!onTotalsChange) return;
    onTotalsChange({
      electricity: calculateTotal('electricity'),
      heating:     calculateTotal('heating'),
      hotwater:    calculateTotal('hotwater'),
      unit:        getUnit() ?? 'kWh',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, resolution]);

  useEffect(() => {
    if (!hasData) {
      updateBrushRange({ startIndex: 0, endIndex: 0 });
      if (selectedDate !== '') setSelectedDate('');
      return;
    }

    if (resolution === 'hourly') {
      const fallbackDate = availableHourlyDates[availableHourlyDates.length - 1] ?? '';
      const nextDate = availableHourlyDates.includes(selectedDate) ? selectedDate : fallbackDate;

      if (nextDate !== selectedDate) {
        setSelectedDate(nextDate);
      }

      if (windowMode === 'free') {
        updateBrushRange(buildWindowRange(data.length, 0, data.length));
        return;
      }

      const nextRange = nextDate
        ? findDateRange(data, nextDate) ?? buildWindowRange(data.length, Math.max(0, data.length - defaultWindowSize), defaultWindowSize)
        : buildWindowRange(data.length, Math.max(0, data.length - defaultWindowSize), defaultWindowSize);

      updateBrushRange(nextRange);
      return;
    }

    if (windowMode === 'free') {
      updateBrushRange(buildWindowRange(data.length, 0, data.length));
      return;
    }

    updateBrushRange(buildWindowRange(data.length, Math.max(0, data.length - defaultWindowSize), defaultWindowSize));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature, resolution, windowMode]);

  useEffect(() => {
    if (!hasData || resolution !== 'hourly' || windowMode !== 'stepped' || selectedDate === '') return;

    const nextRange = findDateRange(data, selectedDate);
    if (nextRange) updateBrushRange(nextRange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, dataSignature, resolution, windowMode]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const text = String(loadEvent.target?.result ?? '');
        const nextDataset = file.name.toLowerCase().endsWith('.csv')
          ? { ...dataset, [resolution]: parseCsv(text, resolution) }
          : mergeUploadedData(dataset, JSON.parse(text), resolution);

        setDataset(nextDataset);
        setSourceLabel(file.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not parse load profile file.';
        setUploadError(message);
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!hasData) return;
    const blob = new Blob([toCsv(data, resolution)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${buildingId.toLowerCase().replace(/\s+/g, '-')}-load-profile-${resolution}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Colours and labels for the vertical energy type tab strip.
  const ENERGY_META: Record<EnergyType, { label: string; Icon: React.ElementType }> = {
    electricity: { label: 'Electricity', Icon: Zap },
    heating:     { label: 'Heating', Icon: Flame },
    hotwater:    { label: 'Hot Water', Icon: Droplets },
    combined:    { label: 'Combined', Icon: Layers3 },
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'white', borderRadius: 10, overflow: 'hidden',
      border: '1px solid rgba(226,232,240,0.7)',
      boxShadow: '0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.08)',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Box sx={{
          width: 22, height: 22, bgcolor: '#10b981', borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          '& svg': { fontSize: '13px !important', color: '#ffffff' },
        }}>
          <BoltOutlined />
        </Box>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: T.foreground, lineHeight: 1.2 }}>
            Energy Usage
          </Typography>
          <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.2 }}>
            {buildingId} · {getSourceCaption()}
          </Typography>
        </div>
        {/* Resolution — labelled as the time period each point covers */}
        <SegmentedControl options={resolutionOptions} value={resolution} onChange={(v) => setResolution(v as Resolution)} />
        {/* Graph-data import / export — expert mode only */}
        {mode === 'expert' && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 26, padding: '0 9px', borderRadius: 5,
                border: `1px solid ${T.border}`, background: 'transparent',
                color: T.foreground, cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}
            >
              <Upload size={12} /> Upload load profile
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!hasData}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 26, padding: '0 9px', borderRadius: 5,
                border: `1px solid ${T.border}`, background: 'transparent',
                color: hasData ? T.foreground : T.mutedFg,
                cursor: hasData ? 'pointer' : 'not-allowed',
                fontSize: 11, fontWeight: 600, flexShrink: 0, opacity: hasData ? 1 : 0.5,
              }}
            >
              <Download size={12} /> Download load profile
            </button>
            <input ref={fileInputRef} type="file" accept=".json,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
          </>
        )}
      </div>

      {hasData && mode === 'expert' && (
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <SegmentedControl options={windowModeOptions} value={windowMode} onChange={(value) => setWindowMode(value as WindowMode)} />
          {windowMode === 'stepped' && resolution === 'hourly' && availableHourlyDates.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => shiftSteppedWindow(-1)}
                disabled={availableHourlyDates.indexOf(selectedDate) <= 0}
                style={{
                  height: 28, padding: '0 10px', borderRadius: 5,
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: availableHourlyDates.indexOf(selectedDate) <= 0 ? T.mutedFg : T.foreground,
                  cursor: availableHourlyDates.indexOf(selectedDate) <= 0 ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600,
                }}
              >
                Prev Day
              </button>
              <input
                type="date"
                value={selectedDate}
                min={availableHourlyDates[0]}
                max={availableHourlyDates[availableHourlyDates.length - 1]}
                onChange={(event) => setSelectedDate(event.target.value)}
                style={{
                  height: 28, padding: '0 10px', borderRadius: 5,
                  border: `1px solid ${T.border}`, background: 'white', color: T.foreground, fontSize: 11,
                }}
              />
              <button
                type="button"
                onClick={() => shiftSteppedWindow(1)}
                disabled={availableHourlyDates.indexOf(selectedDate) === -1 || availableHourlyDates.indexOf(selectedDate) >= availableHourlyDates.length - 1}
                style={{
                  height: 28, padding: '0 10px', borderRadius: 5,
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: availableHourlyDates.indexOf(selectedDate) >= availableHourlyDates.length - 1 ? T.mutedFg : T.foreground,
                  cursor: availableHourlyDates.indexOf(selectedDate) >= availableHourlyDates.length - 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600,
                }}
              >
                Next Day
              </button>
            </>
          )}
          {windowMode === 'stepped' && resolution !== 'hourly' && (
            <>
              <button
                type="button"
                onClick={() => shiftSteppedWindow(-1)}
                disabled={brushRange.startIndex <= 0}
                style={{
                  height: 28, padding: '0 10px', borderRadius: 5,
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: brushRange.startIndex <= 0 ? T.mutedFg : T.foreground,
                  cursor: brushRange.startIndex <= 0 ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600,
                }}
              >
                Prev
              </button>
              <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.2 }}>
                {getStepLabel()}
              </Typography>
              <button
                type="button"
                onClick={() => shiftSteppedWindow(1)}
                disabled={brushRange.endIndex >= data.length - 1}
                style={{
                  height: 28, padding: '0 10px', borderRadius: 5,
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: brushRange.endIndex >= data.length - 1 ? T.mutedFg : T.foreground,
                  cursor: brushRange.endIndex >= data.length - 1 ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600,
                }}
              >
                Next
              </button>
            </>
          )}
          <button
            type="button"
            onClick={fitAllData}
            style={{
              height: 28, padding: '0 10px', borderRadius: 5,
              border: `1px solid ${T.border}`, background: 'transparent', color: T.foreground,
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}
          >
            Show All
          </button>
          <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.2 }}>
            {getVisibleRangeLabel(data, brushRange, resolution)}
          </Typography>
          {windowMode === 'free' && (
            <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.2 }}>
              Free range removes fixed steps. Switch to hourly for the finest time selection.
            </Typography>
          )}
        </div>
      )}

      {uploadError && (
        <div style={{ margin: '6px 14px 0', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 6, padding: '4px 8px', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 10, color: '#b91c1c' }}>{uploadError}</Typography>
        </div>
      )}

      {hasData && showBrush && mode === 'expert' && (
        <div style={{ padding: '6px 14px 0', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.3 }}>
            Drag the handles below the chart to zoom. In stepped mode the window snaps to the active resolution; free range removes that constraint.
          </Typography>
        </div>
      )}

      {/* ── Chart ── */}
      <div style={{ flex: 1, minHeight: 0, padding: '8px 12px 4px' }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart key={`${resolution}-${derivedData.sourceResolution ?? 'none'}-${data.length}`} data={data} margin={{ top: 4, right: 4, left: -12, bottom: showBrush && mode === 'expert' ? 18 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(v) => formatTickLabel(String(v), resolution)}
                tick={{ fontSize: 10, fill: T.mutedFg }}
                stroke={T.border}
                minTickGap={resolution === 'hourly' ? 24 : 16}
              />
              <YAxis
                tickFormatter={(value) => formatEnergyValue(Number(value), 4)}
                tick={{ fontSize: 10, fill: T.mutedFg }}
                stroke={T.border}
                width={52}
                domain={["auto", "auto"]}
                allowDataOverflow
              />
              <ChartTooltip
                labelFormatter={(v) => `Time: ${String(v)}`}
                formatter={(value) => formatEnergyValue(Number(value), 6)}
                contentStyle={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 9 }} iconType="line" iconSize={8} />
              {(energyType === 'electricity' || energyType === 'combined') && (
                <Line type="monotone" dataKey="electricity" stroke="#3b82f6" strokeWidth={2} name="Electricity" dot={false} activeDot={{ r: 4 }} />
              )}
              {(energyType === 'heating' || energyType === 'combined') && (
                <Line type="monotone" dataKey="heating" stroke="#ef4444" strokeWidth={2} name="Heating" dot={false} activeDot={{ r: 4 }} />
              )}
              {(energyType === 'hotwater' || energyType === 'combined') && (
                <Line type="monotone" dataKey="hotwater" stroke="#f59e0b" strokeWidth={2} name="Hot Water" dot={false} activeDot={{ r: 4 }} />
              )}
              {showBrush && mode === 'expert' && (
                <Brush
                  dataKey="timestamp"
                  height={20}
                  stroke={T.border}
                  travellerWidth={10}
                  startIndex={brushRange.startIndex}
                  endIndex={brushRange.endIndex}
                  onChange={handleBrushChange}
                  tickFormatter={(value) => formatTickLabel(String(value), resolution)}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${T.border}`, borderRadius: 6, background: T.inputBg, padding: '0 24px', textAlign: 'center' }}>
            <div>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: T.foreground, mb: 0.5 }}>No usage data loaded</Typography>
              <Typography sx={{ fontSize: 11, color: T.mutedFg, lineHeight: 1.6 }}>
                Use "Import Data" to load an energy profile, or connect to the backend.
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* ── Energy type selector — bottom pill strip ── */}
      <div style={{ padding: '6px 12px 10px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 4, flexShrink: 0 }}>
        {(Object.keys(ENERGY_META) as EnergyType[]).map((type) => {
          const { label, Icon } = ENERGY_META[type];
          const active = energyType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setEnergyType(type)}
              style={{
                flex: 1, padding: '5px 6px', borderRadius: 6,
                border: `1px solid ${active ? 'rgba(100,116,139,0.45)' : 'rgba(226,232,240,0.9)'}`,
                background: active ? 'rgba(241,245,249,0.95)' : 'rgba(248,250,252,0.7)',
                color: active ? T.foreground : T.mutedFg,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              aria-pressed={active}
            >
              <Icon size={13} strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}