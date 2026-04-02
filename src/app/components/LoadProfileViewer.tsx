import React, { useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { BoltOutlined, LocalFireDepartmentOutlined, WaterDropOutlined } from '@mui/icons-material';
import { Download, Upload } from 'lucide-react';
import { T, SegmentedControl } from './ui';

// ─── Static Data Model ────────────────────────────────────────────────────────

type EnergyType = 'electricity' | 'heating' | 'hotwater' | 'combined';
type Resolution = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface LoadDataPoint {
  timestamp: string;
  electricity: number;
  heating: number;
  hotwater: number;
}

type DatasetByResolution = Record<Resolution, LoadDataPoint[]>;

const RESOLUTIONS: Resolution[] = ['hourly', 'daily', 'weekly', 'monthly'];
const BASE_UTC_DATE = Date.UTC(2026, 0, 5, 0, 0, 0);

function clampNumber(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Number(value.toFixed(2)));
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
    input.datetime ?? input.timestamp ?? input.time ?? input.date,
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

  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
  const timestampIndex = headers.findIndex((header) => ['datetime', 'timestamp', 'time', 'date'].includes(header));
  const electricityIndex = headers.findIndex((header) => ['electricity', 'power', 'el'].includes(header));
  const heatingIndex = headers.findIndex((header) => ['heating', 'heat'].includes(header));
  const hotwaterIndex = headers.findIndex((header) => ['hotwater', 'hot_water', 'hot water', 'dhw'].includes(header));

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

interface LoadProfileViewerProps {
  buildingId?: string;
}

export function LoadProfileViewer({ buildingId = 'Building 3' }: LoadProfileViewerProps) {
  const [energyType, setEnergyType] = useState<EnergyType>('electricity');
  const [resolution, setResolution] = useState<Resolution>('daily');
  const [dataset, setDataset] = useState<DatasetByResolution>(() => createDefaultDataset());
  const [sourceLabel, setSourceLabel] = useState('No profile loaded');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const data = dataset[resolution];
  const hasData = data.length > 0;

  const energyOptions = [
    { value: 'electricity', label: 'Electricity' },
    { value: 'heating', label: 'Heating' },
    { value: 'hotwater', label: 'Hot Water' },
    { value: 'combined', label: 'Combined' },
  ];

  const resolutionOptions = [
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const getUnit = () => {
    switch (resolution) {
      case 'hourly': return 'kW';
      case 'daily': return 'kWh/day';
      case 'weekly': return 'kWh/week';
      case 'monthly': return 'kWh/month';
    }
  };

  const calculateTotal = (key: 'electricity' | 'heating' | 'hotwater') => {
    if (!hasData) return '—';
    return data.reduce((sum, d) => sum + d[key], 0).toFixed(0);
  };

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

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      bgcolor: T.card,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header with tabs and resolution selector */}
      <Box sx={{
        px: 1.5,
        pt: 1.5,
        pb: 1,
        borderBottom: `1px solid ${T.border}`,
      }}>
        {/* Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{
            width: 24,
            height: 24,
            bgcolor: '#10b981',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            '& svg': { fontSize: '14px !important', color: '#ffffff' },
          }}>
            <BoltOutlined />
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: T.foreground, flex: 1 }}>
            Load Profile Viewer
          </Typography>
          <Typography sx={{ fontSize: 10, color: T.mutedFg, flexShrink: 0 }}>
            {buildingId}
          </Typography>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.card,
              color: T.foreground,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <Upload size={13} />
            Import data
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 10px',
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.card,
              color: hasData ? T.foreground : T.mutedFg,
              cursor: hasData ? 'pointer' : 'not-allowed',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              opacity: hasData ? 1 : 0.6,
            }}
          >
            <Download size={13} />
            Download data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <Box sx={{ flexShrink: 0 }}>
            <SegmentedControl
              options={resolutionOptions}
              value={resolution}
              onChange={(v) => setResolution(v as Resolution)}
            />
          </Box>
        </Box>

        {/* Energy type selector */}
        <SegmentedControl
          fullWidth
          options={energyOptions}
          value={energyType}
          onChange={(v) => setEnergyType(v as EnergyType)}
        />

        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontSize: 10, color: T.mutedFg }}>
            Source: {sourceLabel}
          </Typography>
          <Typography sx={{ fontSize: 10, color: T.mutedFg }}>
            {hasData ? 'Accepted formats: JSON or CSV with ISO 8601 datetime' : 'Waiting for uploaded or backend profile data'}
          </Typography>
        </Box>

        {uploadError && (
          <Box sx={{ mt: 1, border: '1px solid #fecaca', bgcolor: '#fef2f2', borderRadius: '8px', px: 1, py: 0.75 }}>
            <Typography sx={{ fontSize: 10, color: '#b91c1c' }}>
              {uploadError}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Compact stats row */}
      <Box sx={{
        px: 1.5,
        py: 1,
        bgcolor: T.inputBg,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        gap: 1,
      }}>
        {/* Electricity */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: 0.5,
          bgcolor: T.card,
          border: `1px solid ${energyType === 'electricity' || energyType === 'combined' ? '#3b82f6' : T.border}`,
          borderRadius: '6px',
        }}>
          <BoltOutlined sx={{ fontSize: '14px !important', color: '#3b82f6' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.2 }}>
              Electricity
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.foreground, lineHeight: 1.2 }}>
              {calculateTotal('electricity')} <Typography component="span" sx={{ fontSize: 9, fontWeight: 400, color: T.mutedFg }}>{getUnit()}</Typography>
            </Typography>
          </Box>
        </Box>

        {/* Heating */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: 0.5,
          bgcolor: T.card,
          border: `1px solid ${energyType === 'heating' || energyType === 'combined' ? '#ef4444' : T.border}`,
          borderRadius: '6px',
        }}>
          <LocalFireDepartmentOutlined sx={{ fontSize: '14px !important', color: '#ef4444' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.2 }}>
              Heating
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.foreground, lineHeight: 1.2 }}>
              {calculateTotal('heating')} <Typography component="span" sx={{ fontSize: 9, fontWeight: 400, color: T.mutedFg }}>{getUnit()}</Typography>
            </Typography>
          </Box>
        </Box>

        {/* Hot Water */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: 0.5,
          bgcolor: T.card,
          border: `1px solid ${energyType === 'hotwater' || energyType === 'combined' ? '#f59e0b' : T.border}`,
          borderRadius: '6px',
        }}>
          <WaterDropOutlined sx={{ fontSize: '14px !important', color: '#f59e0b' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, color: T.mutedFg, lineHeight: 1.2 }}>
              Hot Water
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.foreground, lineHeight: 1.2 }}>
              {calculateTotal('hotwater')} <Typography component="span" sx={{ fontSize: 9, fontWeight: 400, color: T.mutedFg }}>{getUnit()}</Typography>
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Compact Chart */}
      <Box sx={{
        minHeight: 0,
        flex: 1,
        p: 1,
        pt: 0.5,
      }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => formatTickLabel(String(value), resolution)}
                tick={{ fontSize: 10, fill: T.mutedFg }}
                stroke={T.border}
              />
              <YAxis
                tick={{ fontSize: 10, fill: T.mutedFg }}
                stroke={T.border}
                width={35}
              />
              <ChartTooltip
                labelFormatter={(value) => `Datetime: ${String(value)}`}
                contentStyle={{
                  backgroundColor: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: '6px',
                  fontSize: 11,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 9 }}
                iconType="line"
                iconSize={8}
              />

              {(energyType === 'electricity' || energyType === 'combined') && (
                <Line
                  type="monotone"
                  dataKey="electricity"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Electricity"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}

              {(energyType === 'heating' || energyType === 'combined') && (
                <Line
                  type="monotone"
                  dataKey="heating"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Heating"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}

              {(energyType === 'hotwater' || energyType === 'combined') && (
                <Line
                  type="monotone"
                  dataKey="hotwater"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Hot Water"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px dashed ${T.border}`,
              borderRadius: '10px',
              bgcolor: T.inputBg,
              px: 3,
              textAlign: 'center',
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: T.foreground, mb: 0.75 }}>
                Load profile not available yet
              </Typography>
              <Typography sx={{ fontSize: 11, color: T.mutedFg, maxWidth: 420, lineHeight: 1.6 }}>
                Import a load profile file or wait for the backend response to populate this viewer. Once data is available, the chart and totals will appear here.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}