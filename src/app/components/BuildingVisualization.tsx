import React from 'react';

export interface BuildingElement {
  id: string;
  label: string;
  type: 'wall' | 'window' | 'roof' | 'floor' | 'door';
  area: number;
  uValue: number;
  gValue: number | null;
  tilt: number;
  azimuth: number;
}

export interface SvgElementDef {
  id: string;
  points: string;
  label: string;
  labelPos: [number, number];
  type: BuildingElement['type'];
}

// Cabinet-projection building — draw order = back-to-front
export const SVG_ELEMENTS: SvgElementDef[] = [
  // Ground plane (floor)
  { id: 'floor',          points: '58,296 298,296 385,246 145,246', label: 'Ground Floor',   labelPos: [222, 261], type: 'floor'  },
  // South (front) wall
  { id: 'south_wall',     points: '58,296 298,296 298,116 58,116',  label: 'South Wall',     labelPos: [178, 208], type: 'wall'   },
  // East (right) wall
  { id: 'east_wall',      points: '298,296 385,246 385,66 298,116', label: 'East Wall',      labelPos: [352, 178], type: 'wall'   },
  // Flat roof
  { id: 'roof',           points: '58,116 298,116 385,66 145,66',   label: 'Roof',           labelPos: [222, 88],  type: 'roof'   },
  // Door on south wall
  { id: 'door',           points: '162,230 216,230 216,296 162,296', label: 'Door',          labelPos: [189, 268], type: 'door'   },
  // South window 1
  { id: 'south_window_1', points: '84,146 158,146 158,228 84,228',  label: 'SW·1',           labelPos: [121, 187], type: 'window' },
  // South window 2
  { id: 'south_window_2', points: '186,146 262,146 262,228 186,228',label: 'SW·2',           labelPos: [224, 187], type: 'window' },
  // East window (parallelogram in isometric)
  { id: 'east_window',    points: '314,150 362,122 362,214 314,242',label: 'EW',             labelPos: [340, 182], type: 'window' },
];

// Base fill colours
const FILL: Record<string, string> = {
  floor:          '#608c4c',
  south_wall:     '#c8d9e8',
  east_wall:      '#a8bece',
  roof:           '#c0b090',
  door:           '#8a5a38',
  south_window_1: 'rgba(128,208,240,0.62)',
  south_window_2: 'rgba(128,208,240,0.62)',
  east_window:    'rgba(128,208,240,0.56)',
};

const FILL_HOVER: Record<string, string> = {
  floor:          '#486e38',
  south_wall:     '#9ab8d2',
  east_wall:      '#7898b2',
  roof:           '#a09070',
  door:           '#6a3818',
  south_window_1: 'rgba(60,168,220,0.82)',
  south_window_2: 'rgba(60,168,220,0.82)',
  east_window:    'rgba(60,168,220,0.76)',
};

// Edge lines [x1,y1,x2,y2]
const EDGES: [number, number, number, number][] = [
  [58,296, 298,296], [58,116, 298,116], [58,116, 58,296],
  [298,116, 298,296], [298,296, 385,246], [298,116, 385,66],
  [385,66, 385,246], [58,116, 145,66], [145,66, 385,66],
  [145,66, 145,246], [145,246, 385,246],
];

interface Props {
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function BuildingVisualization({ elements, selectedId, hoveredId, onSelect, onHover }: Props) {
  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-border">
      <svg viewBox="0 0 455 320" width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8e8f4" />
            <stop offset="100%" stopColor="#ecf2f8" />
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect width={455} height={320} fill="url(#skyGrad)" />

        {/* Ground shadow */}
        <ellipse cx={222} cy={310} rx={200} ry={13} fill="rgba(0,0,0,0.08)" />

        {/* Building surfaces */}
        {SVG_ELEMENTS.map((el) => {
          const isSelected = selectedId === el.id;
          const isHovered = hoveredId === el.id;
          const fill = isHovered ? FILL_HOVER[el.id] : FILL[el.id];

          return (
            <g key={el.id}>
              <polygon
                points={el.points}
                fill={fill}
                stroke={isSelected ? '#2f5d8a' : '#7090a8'}
                strokeWidth={isSelected ? 2.5 : 0.7}
                style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
                onClick={() => onSelect(el.id)}
                onMouseEnter={() => onHover(el.id)}
                onMouseLeave={() => onHover(null)}
              />
              {isSelected && (
                <polygon
                  points={el.points}
                  fill="rgba(47,93,138,0.16)"
                  stroke="none"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
          );
        })}

        {/* Structural edges */}
        {EDGES.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5c7888" strokeWidth={0.7} opacity={0.55} />
        ))}

        {/* Surface labels */}
        <text x={178} y={208} textAnchor="middle" fontSize="11" fill="rgba(70,100,130,0.65)" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          South Wall
        </text>
        <text x={222} y={86} textAnchor="middle" fontSize="10" fill="rgba(90,75,45,0.7)" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          Roof
        </text>

        {/* Window / door labels */}
        {['south_window_1', 'south_window_2', 'east_window', 'door'].map((id) => {
          const el = SVG_ELEMENTS.find((e) => e.id === id)!;
          return (
            <text
              key={id}
              x={el.labelPos[0]}
              y={el.labelPos[1]}
              textAnchor="middle"
              fontSize="8.5"
              fill="rgba(25,55,90,0.72)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {el.label}
            </text>
          );
        })}

        {/* Selected label badge */}
        {selectedId && (() => {
          const el = SVG_ELEMENTS.find((e) => e.id === selectedId);
          if (!el) return null;
          return (
            <g>
              <rect x={8} y={291} width={180} height={22} rx={5} fill="rgba(18,32,52,0.78)" />
              <text x={98} y={306} textAnchor="middle" fontSize="10" fill="white" style={{ userSelect: 'none' }}>
                ✎  {el.label}
              </text>
            </g>
          );
        })()}

        {/* Hover tooltip */}
        {!selectedId && hoveredId && (() => {
          const el = SVG_ELEMENTS.find((e) => e.id === hoveredId);
          if (!el) return null;
          return (
            <g>
              <rect x={8} y={291} width={190} height={22} rx={5} fill="rgba(18,32,52,0.72)" />
              <text x={103} y={306} textAnchor="middle" fontSize="10" fill="white" style={{ userSelect: 'none' }}>
                {el.label} · click to configure
              </text>
            </g>
          );
        })()}

        {/* Compass rose */}
        <g transform="translate(422, 44)">
          <circle cx={0} cy={0} r={22} fill="rgba(255,255,255,0.9)" stroke="#c0ccd8" strokeWidth={1.2} />
          <polygon points="0,-18 -3.5,-7 3.5,-7" fill="#c53030" />
          <polygon points="0,18 -3.5,7 3.5,7" fill="#8090a4" />
          <line x1={-16} y1={0} x2={16} y2={0} stroke="#8090a4" strokeWidth={1.5} strokeLinecap="round" />
          <text x={0} y={-24} textAnchor="middle" fontSize="9" fill="#c53030" fontWeight="bold" style={{ userSelect: 'none' }}>N</text>
          <text x={0} y={33} textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>S</text>
          <text x={27} y={4} textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>E</text>
          <text x={-27} y={4} textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>W</text>
        </g>

        {/* Scale bar */}
        <g transform="translate(8, 12)">
          <line x1={0} y1={8} x2={60} y2={8} stroke="#8090a4" strokeWidth={1.5} />
          <line x1={0} y1={4} x2={0} y2={12} stroke="#8090a4" strokeWidth={1.5} />
          <line x1={60} y1={4} x2={60} y2={12} stroke="#8090a4" strokeWidth={1.5} />
          <text x={30} y={6} textAnchor="middle" fontSize="8" fill="#6b7a88" style={{ userSelect: 'none' }}>12 m</text>
        </g>
      </svg>
    </div>
  );
}