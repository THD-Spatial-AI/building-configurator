import { useEffect, useState } from 'react';

import {
  buildWindowRange,
  clampBrushRange,
  createDefaultDataset,
  DEFAULT_WINDOW_BY_RESOLUTION,
  findDateRange,
  formatEnergyValue,
  getDerivedData,
  getDistinctDateKeys,
  getVisibleRangeLabel,
  mergeUploadedData,
  parseCsv,
  rangeEquals,
  toProfileZip,
  toUtcDateKey,
  type BrushRange,
  type DatasetByResolution,
  type EnergyTotals,
  type EnergyType,
  type LoadDataPoint,
  type Resolution,
  type WindowMode,
} from '../../../lib/loadProfile';

interface UseLoadProfileStateArgs {
  buildingId: string;
  initialTimeseries?: LoadDataPoint[];
  mode?: 'basic' | 'expert';
  onTotalsChange?: (totals: EnergyTotals) => void;
}

/** Owns viewer-specific state while delegating parsing and aggregation to pure helpers. */
export function useLoadProfileState({
  buildingId,
  initialTimeseries,
  mode = 'basic',
  onTotalsChange,
}: UseLoadProfileStateArgs) {
  const [energyType, setEnergyType] = useState<EnergyType>(mode === 'basic' ? 'combined' : 'electricity');
  const [resolution, setResolution] = useState<Resolution>(mode === 'basic' ? 'monthly' : 'daily');
  const [windowMode, setWindowMode] = useState<WindowMode>(mode === 'basic' ? 'free' : 'stepped');
  const [dataset, setDataset] = useState<DatasetByResolution>(() => {
    if (initialTimeseries && initialTimeseries.length > 0) {
      return { ...createDefaultDataset(), hourly: initialTimeseries };
    }
    return createDefaultDataset();
  });
  const [sourceLabel, setSourceLabel] = useState(() => (
    initialTimeseries && initialTimeseries.length > 0 ? 'BUEM model output' : 'No profile loaded'
  ));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [brushRange, setBrushRange] = useState<BrushRange>({ startIndex: 0, endIndex: 0 });

  useEffect(() => {
    if (mode !== 'basic') return;
    setResolution('monthly');
    setWindowMode('free');
    setEnergyType('combined');
  }, [mode]);

  useEffect(() => {
    if (!initialTimeseries || initialTimeseries.length === 0) return;
    setDataset({ ...createDefaultDataset(), hourly: initialTimeseries });
    setSourceLabel('BUEM model output');
    setUploadError(null);
  }, [initialTimeseries]);

  const derivedData = getDerivedData(dataset, resolution);
  const data = derivedData.rows;
  const hasData = data.length > 0;
  const defaultWindowSize = DEFAULT_WINDOW_BY_RESOLUTION[resolution];
  const availableHourlyDates = resolution === 'hourly' ? getDistinctDateKeys(data) : [];
  const showBrush = data.length > 1;
  const dataSignature = hasData
    ? `${resolution}-${derivedData.sourceResolution ?? 'none'}-${data.length}-${data[0].timestamp}-${data[data.length - 1].timestamp}`
    : `${resolution}-empty`;

  const unit = resolution === 'hourly'
    ? 'kW'
    : resolution === 'daily'
      ? 'kWh/day'
      : resolution === 'weekly'
        ? 'kWh/week'
        : 'kWh/month';

  const sourceCaption = !derivedData.isDerived || !derivedData.sourceResolution || derivedData.sourceResolution === resolution
    ? sourceLabel
    : `${sourceLabel} · ${resolution} view aggregated from ${derivedData.sourceResolution}`;

  const stepLabel = resolution === 'hourly'
    ? '24-hour day'
    : resolution === 'daily'
      ? '365-day window'
      : resolution === 'weekly'
        ? '52-week window'
        : '12-month window';

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
    return formatEnergyValue(data.reduce((sum, point) => sum + point[key], 0), 6);
  };

  useEffect(() => {
    if (!onTotalsChange) return;
    onTotalsChange({
      electricity: calculateTotal('electricity'),
      heating: calculateTotal('heating'),
      hotwater: calculateTotal('hotwater'),
      unit,
    });
  }, [dataset, onTotalsChange, resolution, unit]);

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
  }, [availableHourlyDates, data, dataSignature, defaultWindowSize, hasData, resolution, selectedDate, windowMode]);

  useEffect(() => {
    if (!hasData || resolution !== 'hourly' || windowMode !== 'stepped' || selectedDate === '') return;

    const nextRange = findDateRange(data, selectedDate);
    if (nextRange) updateBrushRange(nextRange);
  }, [data, dataSignature, hasData, resolution, selectedDate, windowMode]);

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
    const blob = new Blob([toProfileZip(data, resolution)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${buildingId.toLowerCase().replace(/\s+/g, '-')}-load-profiles-${resolution}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return {
    availableHourlyDates,
    brushRange,
    data,
    derivedData,
    energyType,
    fitAllData,
    handleBrushChange,
    handleDownload,
    handleFileUpload,
    hasData,
    resolution,
    selectedDate,
    setEnergyType,
    setResolution,
    setSelectedDate,
    setWindowMode,
    shiftSteppedWindow,
    showBrush,
    sourceCaption,
    stepLabel,
    unit,
    uploadError,
    visibleRangeLabel: getVisibleRangeLabel(data, brushRange, resolution),
    windowMode,
  };
}