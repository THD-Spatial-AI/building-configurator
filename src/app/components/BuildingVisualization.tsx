import React, { useMemo, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';

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

export const SVG_ELEMENTS: SvgElementDef[] = [
  { id: 'floor', points: '58,296 298,296 385,246 145,246', label: 'Ground Floor', labelPos: [222, 261], type: 'floor' },
  { id: 'roof', points: '58,116 298,116 385,66 145,66', label: 'Roof', labelPos: [222, 88], type: 'roof' },
];

type Point = [number, number];
type Quad = [Point, Point, Point, Point];

interface ViewConfig {
  frontWallId: string;
  sideWallId: string;
  hiddenLeftWallId: string;
  hiddenBackWallId: string;
}

interface OpeningShape {
  id: string;
  label: string;
  type: 'window' | 'door';
  points: string;
  labelPos: Point;
  visible: boolean;
}

const FRONT_WALL_QUAD: Quad = [[58, 116], [298, 116], [298, 296], [58, 296]];
const SIDE_WALL_QUAD: Quad = [[298, 116], [385, 66], [385, 246], [298, 296]];
const HIDDEN_LEFT_WALL_QUAD: Quad = [[58, 116], [145, 66], [145, 246], [58, 296]];
const HIDDEN_BACK_WALL_QUAD: Quad = [[145, 66], [385, 66], [385, 246], [145, 246]];

const VIEW_ORDER: ViewConfig[] = [
  { frontWallId: 'south_wall', sideWallId: 'east_wall', hiddenLeftWallId: 'west_wall', hiddenBackWallId: 'north_wall' },
  { frontWallId: 'east_wall', sideWallId: 'north_wall', hiddenLeftWallId: 'south_wall', hiddenBackWallId: 'west_wall' },
  { frontWallId: 'north_wall', sideWallId: 'west_wall', hiddenLeftWallId: 'east_wall', hiddenBackWallId: 'south_wall' },
  { frontWallId: 'west_wall', sideWallId: 'south_wall', hiddenLeftWallId: 'north_wall', hiddenBackWallId: 'east_wall' },
];

const FILL: Record<string, string> = {
  floor:          '#608c4c',
  wallFront:      '#c8d9e8',
  wallSide:       '#a8bece',
  roof:           '#c0b090',
  door:           '#8a5a38',
  windowFront:    'rgba(128,208,240,0.62)',
  windowSide:     'rgba(128,208,240,0.56)',
};

const FILL_HOVER: Record<string, string> = {
  floor:          '#486e38',
  wallFront:      '#9ab8d2',
  wallSide:       '#7898b2',
  roof:           '#a09070',
  door:           '#6a3818',
  windowFront:    'rgba(60,168,220,0.82)',
  windowSide:     'rgba(60,168,220,0.76)',
};

// Edge lines [x1,y1,x2,y2]
const EDGES: [number, number, number, number][] = [
  [58,296, 298,296], [58,116, 298,116], [58,116, 58,296],
  [298,116, 298,296], [298,296, 385,246], [298,116, 385,66],
  [385,66, 385,246], [58,116, 145,66], [145,66, 385,66],
  [145,66, 145,246], [145,246, 385,246],
];

function pointsToString(points: Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

function quadPoint([topLeft, topRight, bottomRight, bottomLeft]: Quad, u: number, v: number): Point {
  const topX = topLeft[0] + (topRight[0] - topLeft[0]) * u;
  const topY = topLeft[1] + (topRight[1] - topLeft[1]) * u;
  const bottomX = bottomLeft[0] + (bottomRight[0] - bottomLeft[0]) * u;
  const bottomY = bottomLeft[1] + (bottomRight[1] - bottomLeft[1]) * u;

  return [topX + (bottomX - topX) * v, topY + (bottomY - topY) * v];
}

function quadRect(quad: Quad, u0: number, v0: number, u1: number, v1: number): Point[] {
  return [
    quadPoint(quad, u0, v0),
    quadPoint(quad, u1, v0),
    quadPoint(quad, u1, v1),
    quadPoint(quad, u0, v1),
  ];
}

function faceFromAzimuth(azimuth: number) {
  const normalized = ((azimuth % 360) + 360) % 360;
  if (normalized < 45 || normalized >= 315) return 'north_wall';
  if (normalized < 135) return 'east_wall';
  if (normalized < 225) return 'south_wall';
  return 'west_wall';
}

function centers(count: number) {
  return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1));
}

function openingRects(count: number, type: 'window' | 'door', face: 'front' | 'side') {
  if (count === 0) return [];

  if (type === 'door') {
    const width = face === 'front' ? 0.16 : 0.18;
    return centers(count).map((center) => ({ u0: center - width / 2, u1: center + width / 2, v0: 0.58, v1: 0.98 }));
  }

  const columns = Math.min(face === 'front' ? 3 : 2, count);
  const rows = Math.ceil(count / columns);
  const columnCenters = centers(columns);
  const rowTops = rows === 1 ? [0.24] : [0.18, 0.5];
  const height = rows === 1 ? 0.34 : 0.24;
  const width = face === 'front' ? 0.18 : 0.2;

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const center = columnCenters[column];
    const top = rowTops[Math.min(row, rowTops.length - 1)];
    return { u0: center - width / 2, u1: center + width / 2, v0: top, v1: top + height };
  });
}

function openingShapesForFace(
  openings: BuildingElement[],
  quad: Quad,
  face: 'front' | 'side',
): OpeningShape[] {
  const doors = openings.filter((element) => element.type === 'door');
  const windows = openings.filter((element) => element.type === 'window');

  const doorRects = openingRects(doors.length, 'door', face);
  const windowRects = openingRects(windows.length, 'window', face);

  return [
    ...doors.map((element, index) => {
      const rect = doorRects[index];
      const points = quadRect(quad, rect.u0, rect.v0, rect.u1, rect.v1);
      return {
        id: element.id,
        label: element.label,
        type: 'door' as const,
        points: pointsToString(points),
        labelPos: quadPoint(quad, (rect.u0 + rect.u1) / 2, rect.v0 + 0.62 * (rect.v1 - rect.v0)),
        visible: true,
      };
    }),
    ...windows.map((element, index) => {
      const rect = windowRects[index];
      const points = quadRect(quad, rect.u0, rect.v0, rect.u1, rect.v1);
      return {
        id: element.id,
        label: element.label,
        type: 'window' as const,
        points: pointsToString(points),
        labelPos: quadPoint(quad, (rect.u0 + rect.u1) / 2, (rect.v0 + rect.v1) / 2),
        visible: true,
      };
    }),
  ];
}

function iconButton(disabled = false) {
  return `flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors ${disabled ? 'opacity-50' : 'hover:bg-muted hover:text-foreground'}`;
}

interface Props {
  elements: Record<string, BuildingElement>;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function BuildingVisualization({ elements, selectedId, hoveredId, onSelect, onHover }: Props) {
  const [viewIndex, setViewIndex] = useState(0);
  const view = VIEW_ORDER[viewIndex];

  const wallDefs = useMemo(() => ({
    front: { id: view.frontWallId, quad: FRONT_WALL_QUAD, label: elements[view.frontWallId]?.label ?? 'Front Wall' },
    side: { id: view.sideWallId, quad: SIDE_WALL_QUAD, label: elements[view.sideWallId]?.label ?? 'Side Wall' },
    hiddenLeft: { id: view.hiddenLeftWallId, quad: HIDDEN_LEFT_WALL_QUAD, label: elements[view.hiddenLeftWallId]?.label ?? 'Hidden Wall' },
    hiddenBack: { id: view.hiddenBackWallId, quad: HIDDEN_BACK_WALL_QUAD, label: elements[view.hiddenBackWallId]?.label ?? 'Hidden Wall' },
  }), [elements, view]);

  const openingsByWall = useMemo(() => {
    const allOpenings = Object.values(elements).filter((element) => element.type === 'window' || element.type === 'door');
    return {
      front: openingShapesForFace(allOpenings.filter((element) => faceFromAzimuth(element.azimuth) === view.frontWallId), FRONT_WALL_QUAD, 'front'),
      side: openingShapesForFace(allOpenings.filter((element) => faceFromAzimuth(element.azimuth) === view.sideWallId), SIDE_WALL_QUAD, 'side'),
      hidden: allOpenings.filter((element) => {
        const face = faceFromAzimuth(element.azimuth);
        return face === view.hiddenLeftWallId || face === view.hiddenBackWallId;
      }),
    };
  }, [elements, view]);

  const visibleIds = new Set<string>([
    'roof',
    'floor',
    wallDefs.front.id,
    wallDefs.side.id,
    ...openingsByWall.front.map((opening) => opening.id),
    ...openingsByWall.side.map((opening) => opening.id),
  ]);

  const selectedSurface = selectedId ? elements[selectedId] ?? null : null;
  const hoveredSurface = hoveredId ? elements[hoveredId] ?? null : null;

  const selectedHiddenWall = selectedId === wallDefs.hiddenLeft.id || selectedId === wallDefs.hiddenBack.id
    ? (selectedId === wallDefs.hiddenLeft.id ? wallDefs.hiddenLeft : wallDefs.hiddenBack)
    : null;

  const selectedHiddenOpening = selectedId
    ? openingsByWall.hidden.find((element) => element.id === selectedId) ?? null
    : null;
  const hoveredHiddenWall = hoveredId === wallDefs.hiddenLeft.id || hoveredId === wallDefs.hiddenBack.id
    ? (hoveredId === wallDefs.hiddenLeft.id ? wallDefs.hiddenLeft : wallDefs.hiddenBack)
    : null;
  const hoveredHiddenOpening = hoveredId
    ? openingsByWall.hidden.find((element) => element.id === hoveredId) ?? null
    : null;

  const renderWall = (wall: { id: string; quad: Quad; label: string }, variant: 'front' | 'side') => {
    const isSelected = selectedId === wall.id;
    const isHovered = hoveredId === wall.id;
    return (
      <g key={wall.id}>
        <polygon
          points={pointsToString(wall.quad)}
          fill={isHovered ? FILL_HOVER[variant === 'front' ? 'wallFront' : 'wallSide'] : FILL[variant === 'front' ? 'wallFront' : 'wallSide']}
          stroke={isSelected ? '#2f5d8a' : '#7090a8'}
          strokeWidth={isSelected ? 2.5 : 0.7}
          style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
          onClick={() => onSelect(wall.id)}
          onMouseEnter={() => onHover(wall.id)}
          onMouseLeave={() => onHover(null)}
        />
        <text
          x={variant === 'front' ? 178 : 352}
          y={variant === 'front' ? 208 : 178}
          textAnchor="middle"
          fontSize="11"
          fill="rgba(70,100,130,0.65)"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {wall.label}
        </text>
      </g>
    );
  };

  const renderOpening = (opening: OpeningShape, variant: 'front' | 'side') => {
    const isSelected = selectedId === opening.id;
    const isHovered = hoveredId === opening.id;
    const fillKey = opening.type === 'door'
      ? 'door'
      : variant === 'front' ? 'windowFront' : 'windowSide';

    return (
      <g key={opening.id}>
        <polygon
          points={opening.points}
          fill={isHovered ? FILL_HOVER[fillKey] : FILL[fillKey]}
          stroke={isSelected ? '#2f5d8a' : 'rgba(64,86,108,0.6)'}
          strokeWidth={isSelected ? 2.2 : 0.8}
          style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
          onClick={() => onSelect(opening.id)}
          onMouseEnter={() => onHover(opening.id)}
          onMouseLeave={() => onHover(null)}
        />
      </g>
    );
  };

  return (
    <div className="relative h-full min-h-0 w-full rounded-xl overflow-hidden border border-border bg-slate-100/70">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setViewIndex((current) => (current + VIEW_ORDER.length - 1) % VIEW_ORDER.length)}
          className={iconButton()}
          title="Rotate left"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Rotate
        </span>
        <button
          type="button"
          onClick={() => setViewIndex((current) => (current + 1) % VIEW_ORDER.length)}
          className={iconButton()}
          title="Rotate right"
        >
          <RotateCw className="size-3.5" />
        </button>
      </div>
      <svg viewBox="-30 -20 520 380" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', inset: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8e8f4" />
            <stop offset="100%" stopColor="#ecf2f8" />
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect x={-30} y={-20} width={520} height={380} fill="url(#skyGrad)" />

        {/* Ground shadow */}
        <ellipse cx={222} cy={310} rx={200} ry={13} fill="rgba(0,0,0,0.08)" />

        {[selectedHiddenWall || hoveredHiddenWall, selectedHiddenOpening || hoveredHiddenOpening].filter(Boolean).map((hiddenItem, index) => {
          if (!hiddenItem) return null;
          const quad = 'quad' in hiddenItem
            ? hiddenItem.quad
            : faceFromAzimuth(elements[hiddenItem.id]?.azimuth ?? 0) === view.hiddenLeftWallId
              ? HIDDEN_LEFT_WALL_QUAD
              : HIDDEN_BACK_WALL_QUAD;
          const label = 'label' in hiddenItem ? hiddenItem.label : elements[hiddenItem.id]?.label ?? hiddenItem.id;
          const labelPos = 'labelPos' in hiddenItem ? hiddenItem.labelPos : quadPoint(quad, 0.5, 0.45);
          const isSelected = selectedId === hiddenItem.id;
          return (
            <g key={`${hiddenItem.id}-${index}`} style={{ pointerEvents: 'none' }}>
              <polygon
                points={pointsToString(quad)}
                fill={isSelected ? 'rgba(47,93,138,0.18)' : 'rgba(47,93,138,0.10)'}
                stroke="#2f5d8a"
                strokeWidth={isSelected ? 2 : 1.4}
                strokeDasharray={isSelected ? '8 5' : '5 4'}
                opacity={0.95}
              />
              <text
                x={labelPos[0]}
                y={labelPos[1]}
                textAnchor="middle"
                fontSize="10"
                fill="#1f4d75"
                style={{ userSelect: 'none' }}
              >
                {label}
              </text>
            </g>
          );
        })}

        <g>
          <polygon
            points={SVG_ELEMENTS[0].points}
            fill={hoveredId === 'floor' ? FILL_HOVER.floor : FILL.floor}
            stroke={selectedId === 'floor' ? '#2f5d8a' : '#7090a8'}
            strokeWidth={selectedId === 'floor' ? 2.5 : 0.7}
            style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
            onClick={() => onSelect('floor')}
            onMouseEnter={() => onHover('floor')}
            onMouseLeave={() => onHover(null)}
          />
          {renderWall(wallDefs.front, 'front')}
          {renderWall(wallDefs.side, 'side')}
          <polygon
            points={SVG_ELEMENTS[1].points}
            fill={hoveredId === 'roof' ? FILL_HOVER.roof : FILL.roof}
            stroke={selectedId === 'roof' ? '#2f5d8a' : '#7090a8'}
            strokeWidth={selectedId === 'roof' ? 2.5 : 0.7}
            style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
            onClick={() => onSelect('roof')}
            onMouseEnter={() => onHover('roof')}
            onMouseLeave={() => onHover(null)}
          />
          {openingsByWall.front.map((opening) => renderOpening(opening, 'front'))}
          {openingsByWall.side.map((opening) => renderOpening(opening, 'side'))}
        </g>

        {/* Structural edges */}
        {EDGES.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5c7888" strokeWidth={0.7} opacity={0.55} />
        ))}

        <text x={222} y={86} textAnchor="middle" fontSize="10" fill="rgba(90,75,45,0.7)" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          Roof
        </text>

        {/* Selected label badge */}
        {selectedSurface && (() => {
          const isHiddenSurface = !visibleIds.has(selectedSurface.id);
          return (
            <g>
              <rect x={8} y={291} width={220} height={22} rx={5} fill="rgba(18,32,52,0.78)" />
              <text x={118} y={306} textAnchor="middle" fontSize="10" fill="white" style={{ userSelect: 'none' }}>
                ✎  {selectedSurface.label}{isHiddenSurface ? ' · rotate to view' : ''}
              </text>
            </g>
          );
        })()}

        {/* Hover tooltip */}
        {!selectedId && hoveredSurface && (() => {
          const isHiddenSurface = !visibleIds.has(hoveredSurface.id);
          return (
            <g>
              <rect x={8} y={291} width={250} height={22} rx={5} fill="rgba(18,32,52,0.72)" />
              <text x={133} y={306} textAnchor="middle" fontSize="10" fill="white" style={{ userSelect: 'none' }}>
                {hoveredSurface.label} · {isHiddenSurface ? 'rotate to view' : 'click to configure'}
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