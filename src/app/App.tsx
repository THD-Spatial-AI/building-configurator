import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { Box } from '@mui/material';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BuildingConfigurator } from './components/BuildingConfigurator';
import { SessionPanel } from './components/SessionPanel';
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
          <rect width="72" height="72" fill="#c8d4dc" />
          <rect x="4" y="4" width="64" height="64" fill="#dce5ea" rx="2" />
        </pattern>
        <pattern id="smallgrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="none" />
          <line x1="24" y1="0" x2="24" y2="24" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
          <line x1="0" y1="24" x2="24" y2="24" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="#dce5ea" />
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#smallgrid)" />

      {/* Major roads */}
      <line x1="0" y1="38%" x2="100%" y2="38%" stroke="#b8c8d4" strokeWidth="16" />
      <line x1="0" y1="72%" x2="100%" y2="72%" stroke="#b8c8d4" strokeWidth="10" />
      <line x1="28%" y1="0" x2="28%" y2="100%" stroke="#b8c8d4" strokeWidth="10" />
      <line x1="62%" y1="0" x2="62%" y2="100%" stroke="#b8c8d4" strokeWidth="16" />

      {/* Road centre markings */}
      <line x1="0" y1="38%" x2="100%" y2="38%" stroke="rgba(255,220,60,0.5)" strokeWidth="1" strokeDasharray="18 12" />
      <line x1="62%" y1="0" x2="62%" y2="100%" stroke="rgba(255,220,60,0.5)" strokeWidth="1" strokeDasharray="18 12" />

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
          fill="#b0bec8" stroke="#98aab8" strokeWidth="0.8" rx="1.5"
        />
      ))}

      {/* Highlighted building (the one being configured) - clickable */}
      <g
        onClick={onBuildingClick}
        style={{ cursor: 'pointer' }}
      >
        {/* Animated dashed border to draw attention */}
        <rect x="65.6%" y="28.5%" width="8.3%" height="9.5%" fill="none" stroke="#2f5d8a" strokeWidth="1.5" strokeDasharray="5 3" rx="4" opacity="0.6">
          <animate attributeName="stroke-dashoffset" from="0" to="16" dur="1.2s" repeatCount="indefinite" />
        </rect>
        {/* Building fill */}
        <rect x="66%" y="29%" width="7.5%" height="8.5%" fill="#2f5d8a" stroke="#7ab0e0" strokeWidth="1" rx="3" />
        <text x="69.75%" y="33%" textAnchor="middle" fontSize="12.5" fill="#ffffff" fontWeight="700" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          Building 3
        </text>
        <text x="69.75%" y="35.8%" textAnchor="middle" fontSize="10" fill="#a8d0f0" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          ↑ click to configure
        </text>
      </g>

      {/* Green area / park */}
      <rect x="4%" y="4%" width="18%" height="28%" fill="#b8d4b8" opacity="0.7" rx="3" />
      <text x="13%" y="18%" textAnchor="middle" fontSize="9" fill="#4a7a50" opacity="0.9" style={{ userSelect: 'none' }}>PARK</text>

      {/* Water body */}
      <ellipse cx="13%" cy="84%" rx="7%" ry="5%" fill="#a8c4d8" opacity="0.8" />

      {/* Scale bar */}
      <g transform="translate(16, 16)">
        <rect width="80" height="18" rx="4" fill="rgba(255,255,255,0.7)" />
        <line x1="8" y1="12" x2="72" y2="12" stroke="#445566" strokeWidth="1.2" />
        <line x1="8" y1="8"  x2="8"  y2="16" stroke="#445566" strokeWidth="1.2" />
        <line x1="72" y1="8" x2="72" y2="16" stroke="#445566" strokeWidth="1.2" />
        <text x="40" y="9" textAnchor="middle" fontSize="7.5" fill="#445566" style={{ userSelect: 'none' }}>200 m</text>
      </g>

      {/* App label */}
      <text x="50%" y="97%" textAnchor="middle" fontSize="11" fill="rgba(0,0,0,0.25)" style={{ userSelect: 'none' }}>
        EnerPlanET · Building Energy Modelling Platform
      </text>
    </svg>
  );
}

// ─── Zoom tip banner ──────────────────────────────────────────────────────────

// Kbd renders a single key label in a subtle "keycap" style.
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display:       'inline-block',
      padding:       '0 5px',
      marginLeft:    2,
      marginRight:   2,
      background:    'rgba(255,255,255,0.12)',
      border:        '1px solid rgba(255,255,255,0.2)',
      borderRadius:  '4px',
      color:         'rgba(255,255,255,0.8)',
      fontWeight:    600,
      fontSize:      '10.5px',
      lineHeight:    '16px',
      letterSpacing: '0.02em',
    }}>
      {children}
    </span>
  );
}

function ZoomTip() {
  // Track browser zoom so we can apply an inverse scale, keeping the tip a fixed visual size.
  const baseRatio = useRef(window.devicePixelRatio);
  const [inverseScale, setInverseScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const raw = baseRatio.current / window.devicePixelRatio;
      setInverseScale(Math.max(0.5, Math.min(2.5, raw)));
    };
    window.addEventListener('resize', update);
    // matchMedia reliably detects zoom changes (resize alone misses many browsers)
    let mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onMqChange = () => {
      update();
      mq.removeEventListener('change', onMqChange);
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener('change', onMqChange);
    };
    mq.addEventListener('change', onMqChange);
    return () => {
      window.removeEventListener('resize', update);
      mq.removeEventListener('change', onMqChange);
    };
  }, []);

  return (
    <Box sx={{
      position:      'fixed',
      bottom:        12,
      left:          12,
      zIndex:        9999,
      pointerEvents: 'none',
    }}>
      <Box sx={{
        px:              2.5,
        py:              0.75,
        bgcolor:         'rgba(0,0,0,0.45)',
        borderRadius:    '8px',
        color:           'rgba(255,255,255,0.5)',
        fontSize:        '11px',
        lineHeight:      '1.6',
        userSelect:      'none',
        textAlign:       'left',
        transform:       `scale(${inverseScale})`,
        transformOrigin: 'bottom left',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
          Tip: if the page feels too small or too large, adjust the zoom level in your browser.
        </span>
        <br />
        Hold <Kbd>Ctrl</Kbd> and press <Kbd>+</Kbd> to zoom in &nbsp;·&nbsp; <Kbd>Ctrl</Kbd> <Kbd>−</Kbd> to zoom out &nbsp;·&nbsp; <Kbd>Ctrl</Kbd> <Kbd>0</Kbd> to reset
        &nbsp;&nbsp;|&nbsp;&nbsp;
        or hold <Kbd>Ctrl</Kbd> and scroll the mouse wheel up / down
      </Box>
    </Box>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [taskIndex,     setTaskIndex]     = useState(0);
  const [taskCollapsed, setTaskCollapsed] = useState(false);

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
    <ZoomTip />
    <ThemeProvider theme={theme}>
      {/* Map canvas */}
      <Box sx={{
        width:    '100vw',
        height:   '100vh',
        bgcolor:  '#dce5ea',
        position: 'relative',
        overflow: 'auto',
      }}>
        <MapCanvas onBuildingClick={() => setShowConfigurator(true)} />

        {/* Floating configurator panel — right padding keeps it clear of the session panel */}
        {showConfigurator && (
          <Box sx={{
            position:  'absolute',
            inset:     0,
            display:   'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex:    10,
            p:         2,
            // 352px = w-80 panel (320) + w-8 tab (32); 40px when only the tab is visible
            pr:        taskCollapsed ? '40px' : '360px',
            transition: 'padding-right 300ms ease-in-out',
          }}>
            <BuildingConfigurator onClose={() => setShowConfigurator(false)} buildingData={demoBuilding} />
          </Box>
        )}
      </Box>
    </ThemeProvider>
    <SessionPanel
      taskIndex={taskIndex}
      collapsed={taskCollapsed}
      onToggleCollapsed={() => setTaskCollapsed((c) => !c)}
      onNextTask={() => setTaskIndex((i) => i + 1)}
      onPrevTask={() => setTaskIndex((i) => Math.max(0, i - 1))}
      view={showConfigurator ? 'Configure' : 'Map'}
    />
    <Analytics />
    </>
  );
}