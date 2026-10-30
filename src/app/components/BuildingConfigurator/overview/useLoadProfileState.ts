import { useEffect, useState } from 'react';

import {
  createDefaultDataset,
  formatEnergyValue,
  getDerivedData,
  mergeUploadedData,
  parseCsv,
  pickUpdatedRows,
  type DatasetByResolution,
  type EnergyTotals,
  type EnergyType,
  type LoadDataPoint,
  type Resolution,
} from '../../../lib/loadProfile';
import type { Message } from '../../../i18n';
import type { ConfiguratorMode } from '@/app/lib/configuratorMode';

interface UseLoadProfileStateArgs {
  initialTimeseries?: LoadDataPoint[];
  mode?: ConfiguratorMode;
  /** Fixes the resolution, for a caller that offers no resolution choice. */
  initialResolution?: Resolution;
  onTotalsChange?: (totals: EnergyTotals) => void;
  /** Fired whenever the user uploads a file — the uploaded rows become ground truth for the annual totals elsewhere in the app. */
  onGroundTruthChange?: (rows: LoadDataPoint[] | null, label: string | null) => void;
}

/** Owns viewer-specific state while delegating parsing and aggregation to pure helpers. */
export function useLoadProfileState({
  initialTimeseries,
  mode = 'simple',
  initialResolution,
  onTotalsChange,
  onGroundTruthChange,
}: UseLoadProfileStateArgs) {
  const [energyType, setEnergyType] = useState<EnergyType>(mode === 'simple' ? 'combined' : 'electricity');
  const [resolution, setResolution] = useState<Resolution>(
    initialResolution ?? (mode === 'simple' ? 'monthly' : 'daily'),
  );
  const [dataset, setDataset] = useState<DatasetByResolution>(() => {
    if (initialTimeseries && initialTimeseries.length > 0) {
      return { ...createDefaultDataset(), hourly: initialTimeseries };
    }
    return createDefaultDataset();
  });
  const [sourceLabel, setSourceLabel] = useState<Message>(() => (
    initialTimeseries && initialTimeseries.length > 0 ? { key: 'profile.source.buem' } : { key: 'profile.source.none' }
  ));
  const [uploadError, setUploadError] = useState<Message | null>(null);

  useEffect(() => {
    if (mode !== 'simple' || initialResolution) return;
    setResolution('monthly');
    setEnergyType('combined');
  }, [mode, initialResolution]);

  useEffect(() => {
    if (!initialTimeseries || initialTimeseries.length === 0) return;
    setDataset({ ...createDefaultDataset(), hourly: initialTimeseries });
    setSourceLabel({ key: 'profile.source.buem' });
    setUploadError(null);
  }, [initialTimeseries]);

  const derivedData = getDerivedData(dataset, resolution);
  const data = derivedData.rows;
  const hasData = data.length > 0;

  const unit = resolution === 'hourly'
    ? 'kW'
    : resolution === 'daily'
      ? 'kWh/day'
      : resolution === 'weekly'
        ? 'kWh/week'
        : 'kWh/month';

  /** Where the profile came from, and the resolution it was aggregated from when that differs. */
  const sourceCaption = {
    source: sourceLabel,
    aggregatedFrom: derivedData.isDerived && derivedData.sourceResolution && derivedData.sourceResolution !== resolution
      ? derivedData.sourceResolution
      : null,
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
        setSourceLabel({ key: 'profile.source.file', values: { name: file.name } });
        onGroundTruthChange?.(pickUpdatedRows(dataset, nextDataset), file.name);
      } catch (error) {
        setUploadError(error instanceof Error
          ? { key: 'profile.error.parse', values: { reason: error.message } }
          : { key: 'profile.error.unreadable' });
      }
    };
    reader.readAsText(file);
  };

  return {
    data,
    derivedData,
    energyType,
    handleFileUpload,
    hasData,
    resolution,
    setEnergyType,
    setResolution,
    sourceCaption,
    unit,
    uploadError,
  };
}
