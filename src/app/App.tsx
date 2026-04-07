import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { Box } from '@mui/material';
import { useState, useMemo } from 'react';
import { BuildingConfigurator } from './components/BuildingConfigurator';
import { adaptBuemFeature, extractFeaturesFromConfig, parseLoadProfileCsv } from './lib/buemAdapter';
import type { BuildingState } from './lib/buemAdapter';
import demoConfig from '../assets/data/demo_config.json';
import demoLoadProfileCsv from '../assets/data/demo_load_profile.csv?raw';

const theme = createTheme({
  palette: {
    primary:    { main: '#2f5d8a' },
    text:       { primary: '#1f2933', secondary: '#717182' },
    divider:    'rgba(0,0,0,0.1)',
    background: { default: '#f5f6f7', paper: '#ffffff' },
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
  },
});

// ─── Fake map canvas (dark GIS-style background) ──────────────────────────────

function MapCanvas({ onBuildingClick }: { onBuildingClick: () => void }) {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Street grid pattern */}
      <defs>
        <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
          <rect width="72" height="72" fill="#232c3b" />
          <rect x="4" y="4" width="64" height="64" fill="#1d2633" rx="2" />
        </pattern>
        <pattern id="smallgrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="none" />
          <line x1="24" y1="0" x2="24" y2="24" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
          <line x1="0" y1="24" x2="24" y2="24" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="#1d2633" />
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#smallgrid)" />

      {/* Major roads */}
      <line x1="0" y1="38%" x2="100%" y2="38%" stroke="#28344a" strokeWidth="16" />
      <line x1="0" y1="72%" x2="100%" y2="72%" stroke="#28344a" strokeWidth="10" />
      <line x1="28%" y1="0" x2="28%" y2="100%" stroke="#28344a" strokeWidth="10" />
      <line x1="62%" y1="0" x2="62%" y2="100%" stroke="#28344a" strokeWidth="16" />

      {/* Road centre markings */}
      <line x1="0" y1="38%" x2="100%" y2="38%" stroke="rgba(255,220,60,0.12)" strokeWidth="1" strokeDasharray="18 12" />
      <line x1="62%" y1="0" x2="62%" y2="100%" stroke="rgba(255,220,60,0.12)" strokeWidth="1" strokeDasharray="18 12" />

      {/* Building footprints — random blocks */}
      {[
        [4,  4,  18, 28], [4,  36, 20, 18], [4,  58, 16, 14],
        [26, 4,  30, 14], [26, 22, 28, 14], [26, 40, 18, 10],
        [4,  76, 20, 20], [26, 56, 24, 10], [26, 70, 30, 20],
        [65, 4,  28, 22], [65, 30, 20, 6 ], [65, 40, 26, 18],
        [65, 62, 30, 12], [65, 76, 28, 18],
        [36, 76, 20, 20],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={`${x}%`} y={`${y}%`} width={`${w / 2.5}%`} height={`${h / 2.5}%`}
          fill="#263040" stroke="#30404f" strokeWidth="0.8" rx="1.5"
        />
      ))}

      {/* Highlighted building (the one being configured) - now clickable */}
      <g 
        onClick={onBuildingClick} 
        style={{ cursor: 'pointer' }}
      >
        <rect x="66%" y="30%" width="7.5%" height="7%" fill="#2f5d8a" opacity="0.4" stroke="#2f5d8a" strokeWidth="1.5" rx="2" />
        <rect x="66%" y="30%" width="7.5%" height="7%" fill="none" stroke="#5a8fc0" strokeWidth="1" strokeDasharray="4 3" rx="2" />
        {/* Click indicator */}
        <text x="69.75%" y="33.5%" textAnchor="middle" fontSize="8" fill="#ffffff" opacity="0.8" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          Building 3
        </text>
        <text x="69.75%" y="35%" textAnchor="middle" fontSize="6" fill="#5a8fc0" opacity="0.9" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          Click to configure
        </text>
      </g>

      {/* Green area / park */}
      <rect x="4%" y="4%" width="18%" height="28%" fill="#1e3526" opacity="0.5" rx="3" />
      <text x="13%" y="18%" textAnchor="middle" fontSize="9" fill="#3a6645" opacity="0.7" style={{ userSelect: 'none' }}>PARK</text>

      {/* Water body */}
      <ellipse cx="13%" cy="84%" rx="7%" ry="5%" fill="#1a2e4a" opacity="0.6" />

      {/* Scale + attribution */}
      <g transform="translate(16, 16)">
        <rect width="80" height="18" rx="4" fill="rgba(0,0,0,0.5)" />
        <line x1="8" y1="12" x2="72" y2="12" stroke="white" strokeWidth="1.2" />
        <line x1="8" y1="8"  x2="8"  y2="16" stroke="white" strokeWidth="1.2" />
        <line x1="72" y1="8" x2="72" y2="16" stroke="white" strokeWidth="1.2" />
        <text x="40" y="9" textAnchor="middle" fontSize="7.5" fill="white" style={{ userSelect: 'none' }}>200 m</text>
      </g>

      {/* App label */}
      <text x="50%" y="97%" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.2)" style={{ userSelect: 'none' }}>
        EnerPlanET · Building Energy Modelling Platform
      </text>
    </svg>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [showConfigurator, setShowConfigurator] = useState(false);

  // Extract the first building feature from the EnerPlanET demo config once on mount.
  // The demo CSV is used as fallback timeseries until a real model response is available.
  const demoBuilding = useMemo<BuildingState | undefined>(() => {
    try {
      const features = extractFeaturesFromConfig(demoConfig);
      if (features.length === 0) return undefined;
      const state = adaptBuemFeature(features[0]);
      const fallbackTimeseries = state.timeseries ?? parseLoadProfileCsv(demoLoadProfileCsv);
      return { ...state, timeseries: fallbackTimeseries };
    } catch {
      return undefined;
    }
  }, []);

  return (
    <>
    <ThemeProvider theme={theme}>
      {/* Map canvas */}
      <Box sx={{
        width:    '100vw',
        height:   '100vh',
        bgcolor:  '#1d2633',
        position: 'relative',
        overflow: 'auto',
      }}>
        <MapCanvas onBuildingClick={() => setShowConfigurator(true)} />

        {/* Floating configurator panel — top-right, 16 px inset */}
        {showConfigurator && (
          <Box sx={{
            position: 'absolute',
            top:      16,
            right:    16,
            zIndex:   10,
          }}>
            <BuildingConfigurator onClose={() => setShowConfigurator(false)} buildingData={demoBuilding} />
          </Box>
        )}
      </Box>
    </ThemeProvider>
    <Analytics />
    </>
  );
}