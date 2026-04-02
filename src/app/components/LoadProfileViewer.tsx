import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { BoltOutlined, LocalFireDepartmentOutlined, WaterDropOutlined } from '@mui/icons-material';
import { T, SegmentedControl } from './ui';

// ─── Mock Data Generation ─────────────────────────────────────────────────────

type EnergyType = 'electricity' | 'heating' | 'hotwater' | 'combined';
type Resolution = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface LoadDataPoint {
  timestamp: string;
  electricity: number;
  heating: number;
  hotwater: number;
}

function generateMockData(resolution: Resolution): LoadDataPoint[] {
  const data: LoadDataPoint[] = [];
  let count = 0;
  let labelFormat = '';

  switch (resolution) {
    case 'hourly':
      count = 24;
      for (let i = 0; i < count; i++) {
        data.push({
          timestamp: `${i}:00`,
          electricity: 15 + Math.random() * 25 + (i >= 6 && i <= 22 ? 20 : 0),
          heating: 30 + Math.random() * 20 + (i >= 18 || i <= 6 ? 15 : -10),
          hotwater: 5 + Math.random() * 8 + (i >= 6 && i <= 9 ? 10 : 0) + (i >= 18 && i <= 21 ? 8 : 0),
        });
      }
      break;
    case 'daily':
      count = 7;
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (let i = 0; i < count; i++) {
        const isWeekend = i >= 5;
        data.push({
          timestamp: days[i],
          electricity: 250 + Math.random() * 100 + (isWeekend ? -50 : 0),
          heating: 600 + Math.random() * 150 + (isWeekend ? 100 : -50),
          hotwater: 80 + Math.random() * 30,
        });
      }
      break;
    case 'weekly':
      count = 4;
      for (let i = 0; i < count; i++) {
        data.push({
          timestamp: `Week ${i + 1}`,
          electricity: 1800 + Math.random() * 400,
          heating: 4200 + Math.random() * 800,
          hotwater: 550 + Math.random() * 150,
        });
      }
      break;
    case 'monthly':
      count = 12;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 0; i < count; i++) {
        const isWinter = i <= 2 || i >= 10;
        const isSummer = i >= 5 && i <= 8;
        data.push({
          timestamp: months[i],
          electricity: 7500 + Math.random() * 2000 + (isSummer ? 500 : 0),
          heating: isWinter ? 18000 + Math.random() * 5000 : 3000 + Math.random() * 2000,
          hotwater: 2200 + Math.random() * 500,
        });
      }
      break;
  }

  return data;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LoadProfileViewerProps {
  buildingId?: string;
}

export function LoadProfileViewer({ buildingId = 'Building 3' }: LoadProfileViewerProps) {
  const [energyType, setEnergyType] = useState<EnergyType>('electricity');
  const [resolution, setResolution] = useState<Resolution>('daily');

  const data = generateMockData(resolution);

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
    return data.reduce((sum, d) => sum + d[key], 0).toFixed(0);
  };

  return (
    <Box sx={{
      width: 1020,
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
      bgcolor: T.card,
      overflow: 'hidden',
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
        height: 150,
        p: 1,
        pt: 0.5,
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 10, fill: T.mutedFg }}
              stroke={T.border}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: T.mutedFg }}
              stroke={T.border}
              width={35}
            />
            <ChartTooltip 
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
      </Box>
    </Box>
  );
}