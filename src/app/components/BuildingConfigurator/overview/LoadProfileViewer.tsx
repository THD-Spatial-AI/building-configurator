import { useRef, type ElementType } from 'react';
import { Box, Typography } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { BoltOutlined } from '@mui/icons-material';
import { Download, Upload, Zap, Flame, Droplets, Layers3 } from 'lucide-react';
import { T, SegmentedControl } from '../shared/ui';
import {
  formatEnergyValue,
  type EnergyTotals,
  formatTickLabel,
  type EnergyType,
  type LoadDataPoint,
  type Resolution,
  type WindowMode,
} from '../../../lib/loadProfile';
import { useLoadProfileState } from './useLoadProfileState';

interface LoadProfileViewerProps {
  buildingId?: string;
  onTotalsChange?: (totals: EnergyTotals) => void;
  /** Pre-seeds the hourly dataset from model output. Replaces any user-uploaded data. */
  initialTimeseries?: LoadDataPoint[];
  /** Controls UI complexity. Basic hides expert controls; defaults to basic. */
  mode?: 'basic' | 'expert';
}

export function LoadProfileViewer({ buildingId = 'Building 3', onTotalsChange, initialTimeseries, mode = 'basic' }: LoadProfileViewerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
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
    uploadError,
    visibleRangeLabel,
    windowMode,
  } = useLoadProfileState({ buildingId, initialTimeseries, mode, onTotalsChange });

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

  // Colours and labels for the vertical energy type tab strip.
  const ENERGY_META: Record<EnergyType, { label: string; Icon: ElementType }> = {
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
            {buildingId} · {sourceCaption}
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
                {stepLabel}
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
            {visibleRangeLabel}
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
                domain={[0, 'auto']}
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