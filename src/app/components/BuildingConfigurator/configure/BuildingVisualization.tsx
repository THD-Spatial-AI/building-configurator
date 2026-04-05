// 3D isometric building preview for the Configure view.
// Surfaces operate at group level — clicking selects a FaceGroup (type + face),
// not an individual element. Hover state is managed locally.

import { useMemo, useState } from 'react'; // useState kept for hoveredGroup
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type BuildingElementSource = 'city' | 'default' | 'custom';

export interface BuildingElement {
  id: string;
  label: string;
  type: 'wall' | 'window' | 'roof' | 'floor' | 'door';
  area: number;
  uValue: number;
  gValue: number | null;
  tilt: number;
  azimuth: number;
  source?: BuildingElementSource;
  customMode?: boolean;
}

export interface SvgElementDef {
  id: string;
  points: string;
  label: string;
  labelPos: [number, number];
  type: BuildingElement['type'];
}

/** A group selection: one surface type on one face of the building. */
export interface FaceGroup {
  type: BuildingElement['type'];
  /** One of: 'south_wall' | 'north_wall' | 'east_wall' | 'west_wall' | 'roof' | 'floor' */
  face: string;
}

export const SVG_ELEMENTS: SvgElementDef[] = [
  { id: 'floor', points: '58,296 298,296 385,246 145,246', label: 'Ground Floor', labelPos: [222, 261], type: 'floor' },
  { id: 'roof',  points: '58,116 298,116 385,66 145,66',   label: 'Roof',         labelPos: [222, 88],  type: 'roof'  },
];

type Point = [number, number];
type Quad  = [Point, Point, Point, Point];

interface ViewConfig {
  frontWallId: string;
  sideWallId:  string;
}

const FRONT_WALL_QUAD: Quad       = [[58, 116], [298, 116], [298, 296], [58, 296]];
const SIDE_WALL_QUAD: Quad        = [[298, 116], [385, 66],  [385, 246], [298, 296]];
// Static geometry for the two always-hidden faces — used only to close the box visually.
const HIDDEN_LEFT_WALL_QUAD: Quad = [[58, 116],  [145, 66],  [145, 246], [58, 296]];
const HIDDEN_BACK_WALL_QUAD: Quad = [[145, 66],  [385, 66],  [385, 246], [145, 246]];

/**
 * 8-view rotation cycle. Intermediate directions (NE/SE/SW/NW) are included so
 * that diagonal walls, windows and doors are accessible in the preview.
 * Views with no elements for either face are skipped at runtime.
 */
export const VIEW_ORDER: ViewConfig[] = [
  { frontWallId: 'south_wall',     sideWallId: 'east_wall'      },
  { frontWallId: 'southeast_wall', sideWallId: 'south_wall'     },
  { frontWallId: 'east_wall',      sideWallId: 'north_wall'     },
  { frontWallId: 'northeast_wall', sideWallId: 'east_wall'      },
  { frontWallId: 'north_wall',     sideWallId: 'west_wall'      },
  { frontWallId: 'northwest_wall', sideWallId: 'north_wall'     },
  { frontWallId: 'west_wall',      sideWallId: 'south_wall'     },
  { frontWallId: 'southwest_wall', sideWallId: 'west_wall'      },
];

const FILL: Record<string, string> = {
  floor:       '#608c4c',
  wallFront:   '#b8cedf',
  wallSide:    '#8aaac0',
  roof:        '#c0b090',
  door:        '#8a5a38',
  windowFront: '#90cce8',
  windowSide:  '#78b8d8',
};

const FILL_HOVER: Record<string, string> = {
  floor:       '#486e38',
  wallFront:   '#8aaac4',
  wallSide:    '#6090aa',
  roof:        '#a09070',
  door:        '#6a3818',
  windowFront: '#50a8d0',
  windowSide:  '#3c98c0',
};

// Structural edge lines [x1, y1, x2, y2]
const EDGES: [number, number, number, number][] = [
  [58,296, 298,296], [58,116, 298,116], [58,116, 58,296],
  [298,116, 298,296], [298,296, 385,246], [298,116, 385,66],
  [385,66, 385,246], [58,116, 145,66], [145,66, 385,66],
  [145,66, 145,246], [145,246, 385,246],
];

// Fixed UV positions for the one representative opening per face
const WINDOW_UV = { u0: 0.3, u1: 0.7, v0: 0.18, v1: 0.52 };
const DOOR_UV   = { u0: 0.38, u1: 0.62, v0: 0.6, v1: 0.97 };

function pointsToString(points: Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

function quadPoint([topLeft, topRight, bottomRight, bottomLeft]: Quad, u: number, v: number): Point {
  const topX    = topLeft[0]    + (topRight[0]    - topLeft[0])    * u;
  const topY    = topLeft[1]    + (topRight[1]    - topLeft[1])    * u;
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

/** Maps a wall azimuth (degrees) to one of 8 canonical face id strings (45° buckets). */
export function faceFromAzimuth(azimuth: number): string {
  const faces = [
    'north_wall', 'northeast_wall', 'east_wall', 'southeast_wall',
    'south_wall', 'southwest_wall', 'west_wall', 'northwest_wall',
  ];
  const normalized = ((azimuth % 360) + 360) % 360;
  return faces[Math.round(normalized / 45) % 8];
}

/** Maps any building element to its FaceGroup for viz ↔ list synchronisation. */
export function elementToGroup(el: BuildingElement): FaceGroup {
  if (el.type === 'roof')  return { type: 'roof',  face: 'roof'  };
  if (el.type === 'floor') return { type: 'floor', face: 'floor' };
  return { type: el.type, face: faceFromAzimuth(el.azimuth) };
}

/** Ensures all elements carry explicit source and edit-mode metadata. */
export function normalizeElementRecord(
  elements: Record<string, BuildingElement>,
  fallbackSource: BuildingElementSource,
): Record<string, BuildingElement> {
  return Object.fromEntries(
    Object.entries(elements).map(([id, el]) => [
      id,
      {
        ...el,
        source: el.source ?? fallbackSource,
        customMode: el.customMode ?? (el.source === 'custom'),
      },
    ]),
  );
}

/** Source-derived elements are read-only until promoted into custom mode. */
export function isElementEditable(el: BuildingElement): boolean {
  return el.source === 'custom' || !!el.customMode;
}

/** Returns true when the element is either custom-created or custom-overridden. */
export function isUserDefinedElement(el: BuildingElement): boolean {
  return el.source === 'custom' || !!el.customMode;
}

const FACE_LABELS: Record<string, string> = {
  north_wall:     'North',      northeast_wall: 'North East',
  east_wall:      'East',       southeast_wall: 'South East',
  south_wall:     'South',      southwest_wall: 'South West',
  west_wall:      'West',       northwest_wall: 'North West',
};

/** Human-readable label for a face id string. */
function wallFaceLabel(faceId: string): string {
  return FACE_LABELS[faceId] ?? faceId.replace('_wall', '').replace(/^\w/, (c) => c.toUpperCase());
}

/** Human-readable compass direction from a raw azimuth value. */
function compassLabel(azimuth: number): string {
  const labels = [
    'North', 'North East', 'East', 'South East',
    'South', 'South West', 'West', 'North West',
  ];
  const normalized = ((azimuth % 360) + 360) % 360;
  return labels[Math.round(normalized / 45) % 8];
}

/** True when two FaceGroup values refer to the same surface group. */
function groupsMatch(a: FaceGroup | null, b: FaceGroup | null): boolean {
  return a !== null && b !== null && a.type === b.type && a.face === b.face;
}

interface Props {
  elements: Record<string, BuildingElement>;
  selectedGroup: FaceGroup | null;
  onSelectGroup: (group: FaceGroup) => void;
  /** Controlled view rotation index (0–7). */
  viewIndex: number;
  onViewChange: (index: number) => void;
}

/** Isometric 3D preview of a building. Clicking any surface selects a FaceGroup. */
export function BuildingVisualization({ elements, selectedGroup, onSelectGroup, viewIndex, onViewChange }: Props) {
  const [hoveredGroup, setHoveredGroup] = useState<FaceGroup | null>(null);

  // Restrict to views that have at least one element on the front or side face.
  const availableViewIndices = useMemo(() => {
    const allEls = Object.values(elements);
    // Use azimuth-based face mapping for all types — element IDs are not reliable face identifiers.
    const faceHasAny = (faceId: string) =>
      allEls.some((el) =>
        (el.type === 'wall' || el.type === 'window' || el.type === 'door') &&
        faceFromAzimuth(el.azimuth) === faceId,
      );
    const indices = VIEW_ORDER
      .map((v, i) => (faceHasAny(v.frontWallId) || faceHasAny(v.sideWallId) ? i : -1))
      .filter((i) => i !== -1);
    return indices.length > 0 ? indices : [0];
  }, [elements]);

  // Clamp viewIndex to an available view (guards against stale index after element changes).
  const safeViewIndex = availableViewIndices.includes(viewIndex)
    ? viewIndex
    : (availableViewIndices[0] ?? 0);
  const view = VIEW_ORDER[safeViewIndex];

  // Wall label: prefer the element's own azimuth; fall back to the face id.
  const wallDefs = useMemo(() => {
    const wallLabel = (id: string) => {
      const az = elements[id]?.azimuth;
      return az !== undefined ? `${compassLabel(az)} Wall` : `${wallFaceLabel(id)} Wall`;
    };
    return {
      front: { id: view.frontWallId, quad: FRONT_WALL_QUAD, label: wallLabel(view.frontWallId) },
      side:  { id: view.sideWallId,  quad: SIDE_WALL_QUAD,  label: wallLabel(view.sideWallId)  },
    };
  }, [elements, view]);

  // Whether a given face has any elements of the given opening type
  const faceHasOpening = useMemo(() => {
    const openings = Object.values(elements).filter(
      (el) => el.type === 'window' || el.type === 'door',
    );
    return (faceId: string, type: 'window' | 'door') =>
      openings.some((el) => el.type === type && faceFromAzimuth(el.azimuth) === faceId);
  }, [elements]);

  // Count of elements matching a FaceGroup (used in the status badge)
  const groupCount = (group: FaceGroup): number => {
    return Object.values(elements).filter((el) => {
      if (el.type !== group.type) return false;
      if (group.type === 'roof')  return true;
      if (group.type === 'floor') return true;
      return faceFromAzimuth(el.azimuth) === group.face;
    }).length;
  };

  // Status badge text for the selected group
  const badgeText = (group: FaceGroup): string => {
    const visibleFaces = new Set([view.frontWallId, view.sideWallId, 'roof', 'floor']);
    const isHidden = !visibleFaces.has(group.face);
    const suffix = isHidden ? ' · rotate to view' : '';

    if (group.type === 'roof')  return 'Roof';
    if (group.type === 'floor') return 'Ground Floor';

    const dir = wallFaceLabel(group.face);
    if (group.type === 'wall')   return `${dir} Wall${suffix}`;
    if (group.type === 'window') return `${dir} Windows · ${groupCount(group)}${suffix}`;
    if (group.type === 'door')   return `${dir} Doors · ${groupCount(group)}${suffix}`;
    return group.face;
  };

  // Render one visible wall polygon + its label
  const renderWall = (wall: { id: string; quad: Quad; label: string }, variant: 'front' | 'side') => {
    const group: FaceGroup = { type: 'wall', face: wall.id };
    const isSelected = groupsMatch(selectedGroup, group);
    const isHovered  = groupsMatch(hoveredGroup, group);
    const fillKey    = variant === 'front' ? 'wallFront' : 'wallSide';
    const lx         = variant === 'front' ? 178 : 342;
    const ly         = variant === 'front' ? 133 : 178;

    return (
      <g key={wall.id}>
        <polygon
          points={pointsToString(wall.quad)}
          fill={isHovered ? FILL_HOVER[fillKey] : FILL[fillKey]}
          stroke={isSelected ? '#2f5d8a' : '#7090a8'}
          strokeWidth={isSelected ? 2.5 : 0.7}
          style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
          onClick={() => onSelectGroup(group)}
          onMouseEnter={() => setHoveredGroup(group)}
          onMouseLeave={() => setHoveredGroup(null)}
        />
        {variant === 'front' && (
          <text
            x={lx} y={ly}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="#1e3a52"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="2.5"
            paintOrder="stroke"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {wall.label}
          </text>
        )}
      </g>
    );
  };

  // Render a single representative opening on a face (window or door)
  const renderRepresentativeOpening = (
    faceId: string,
    openingType: 'window' | 'door',
    quad: Quad,
    variant: 'front' | 'side',
  ) => {
    if (!faceHasOpening(faceId, openingType)) return null;

    const group: FaceGroup = { type: openingType, face: faceId };
    const isSelected = groupsMatch(selectedGroup, group);
    const isHovered  = groupsMatch(hoveredGroup, group);
    const uv         = openingType === 'window' ? WINDOW_UV : DOOR_UV;
    const points     = quadRect(quad, uv.u0, uv.v0, uv.u1, uv.v1);

    const fillKey = openingType === 'door'
      ? 'door'
      : variant === 'front' ? 'windowFront' : 'windowSide';

    return (
      <polygon
        key={`${faceId}-${openingType}`}
        points={pointsToString(points)}
        fill={isHovered ? FILL_HOVER[fillKey] : FILL[fillKey]}
        stroke={isSelected ? '#2f5d8a' : 'rgba(64,86,108,0.6)'}
        strokeWidth={isSelected ? 2.2 : 0.8}
        style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
        onClick={() => onSelectGroup(group)}
        onMouseEnter={() => setHoveredGroup(group)}
        onMouseLeave={() => setHoveredGroup(null)}
      />
    );
  };

  const isFloorSelected = groupsMatch(selectedGroup, { type: 'floor', face: 'floor' });
  const isFloorHovered  = groupsMatch(hoveredGroup,  { type: 'floor', face: 'floor' });
  const isRoofSelected  = groupsMatch(selectedGroup, { type: 'roof',  face: 'roof'  });
  const isRoofHovered   = groupsMatch(hoveredGroup,  { type: 'roof',  face: 'roof'  });

  return (
    <div className="relative h-full min-h-0 w-full rounded-lg overflow-hidden border border-border bg-slate-100/70">
      {/* Rotate left — floats on the left edge, vertically centred */}
      <button
        type="button"
        onClick={() => {
          const pos = availableViewIndices.indexOf(safeViewIndex);
          onViewChange(availableViewIndices[(pos + availableViewIndices.length - 1) % availableViewIndices.length]);
        }}
        title="Rotate left"
        className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
      </button>
      {/* Rotate right — floats on the right edge, vertically centred */}
      <button
        type="button"
        onClick={() => {
          const pos = availableViewIndices.indexOf(safeViewIndex);
          onViewChange(availableViewIndices[(pos + 1) % availableViewIndices.length]);
        }}
        title="Rotate right"
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex size-8 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="size-4" />
      </button>

      <svg viewBox="-30 -20 520 380" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', inset: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8e8f4" />
            <stop offset="100%" stopColor="#ecf2f8" />
          </linearGradient>
        </defs>

        {/* Sky background */}
        <rect x={-30} y={-20} width={520} height={380} fill="url(#skyGrad)" />

        {/* Ground shadow */}
        <ellipse cx={222} cy={310} rx={200} ry={13} fill="rgba(0,0,0,0.08)" />

        {/* Hidden back faces — drawn first so visible walls fully occlude them */}
        <polygon points={pointsToString(HIDDEN_BACK_WALL_QUAD)} fill="#6a8292" stroke="#5a7282" strokeWidth={0.7} />
        <polygon points={pointsToString(HIDDEN_LEFT_WALL_QUAD)} fill="#7a92a4" stroke="#6a8292" strokeWidth={0.7} />

        <g>
          {/* Ground floor */}
          <polygon
            points={SVG_ELEMENTS[0].points}
            fill={isFloorHovered ? FILL_HOVER.floor : FILL.floor}
            stroke={isFloorSelected ? '#2f5d8a' : '#7090a8'}
            strokeWidth={isFloorSelected ? 2.5 : 0.7}
            style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
            onClick={() => onSelectGroup({ type: 'floor', face: 'floor' })}
            onMouseEnter={() => setHoveredGroup({ type: 'floor', face: 'floor' })}
            onMouseLeave={() => setHoveredGroup(null)}
          />

          {/* Visible walls */}
          {renderWall(wallDefs.front, 'front')}
          {renderWall(wallDefs.side,  'side')}

          {/* Roof */}
          <polygon
            points={SVG_ELEMENTS[1].points}
            fill={isRoofHovered ? FILL_HOVER.roof : FILL.roof}
            stroke={isRoofSelected ? '#2f5d8a' : '#7090a8'}
            strokeWidth={isRoofSelected ? 2.5 : 0.7}
            style={{ cursor: 'pointer', transition: 'fill 0.13s ease' }}
            onClick={() => onSelectGroup({ type: 'roof', face: 'roof' })}
            onMouseEnter={() => setHoveredGroup({ type: 'roof', face: 'roof' })}
            onMouseLeave={() => setHoveredGroup(null)}
          />

          {/* Representative openings: one window + one door per visible face */}
          {renderRepresentativeOpening(view.frontWallId, 'window', FRONT_WALL_QUAD, 'front')}
          {renderRepresentativeOpening(view.frontWallId, 'door',   FRONT_WALL_QUAD, 'front')}
          {renderRepresentativeOpening(view.sideWallId,  'window', SIDE_WALL_QUAD,  'side')}
          {renderRepresentativeOpening(view.sideWallId,  'door',   SIDE_WALL_QUAD,  'side')}
        </g>

        {/* Structural edges */}
        {EDGES.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5c7888" strokeWidth={0.7} opacity={0.55} />
        ))}

        <text
          x={222} y={91}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#3d2e10"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2.5"
          paintOrder="stroke"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          Roof
        </text>

        {/* Selected group status badge — below ground shadow */}
        {selectedGroup && (() => {
          const text = badgeText(selectedGroup);
          return (
            <g>
              <rect x={8} y={330} width={220} height={22} rx={5} fill="rgba(18,32,52,0.78)" />
              <text x={118} y={345} textAnchor="middle" fontSize="10" fill="white" style={{ userSelect: 'none' }}>
                ✎  {text}
              </text>
            </g>
          );
        })()}

        {/* Hover tooltip — only shown when nothing is selected, below ground shadow */}
        {!selectedGroup && hoveredGroup && (() => {
          const text = badgeText(hoveredGroup);
          return (
            <g>
              <rect x={8} y={330} width={250} height={22} rx={5} fill="rgba(18,32,52,0.72)" />
              <text x={133} y={345} textAnchor="middle" fontSize="10" fill="white" style={{ userSelect: 'none' }}>
                {text} · click to configure
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
          <text x={0}   y={-24} textAnchor="middle" fontSize="9" fill="#c53030" fontWeight="bold" style={{ userSelect: 'none' }}>N</text>
          <text x={0}   y={33}  textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>S</text>
          <text x={27}  y={4}   textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>E</text>
          <text x={-27} y={4}   textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>W</text>
        </g>

        {/* Scale bar */}
        <g transform="translate(8, 12)">
          <line x1={0}  y1={8} x2={60} y2={8}  stroke="#8090a4" strokeWidth={1.5} />
          <line x1={0}  y1={4} x2={0}  y2={12} stroke="#8090a4" strokeWidth={1.5} />
          <line x1={60} y1={4} x2={60} y2={12} stroke="#8090a4" strokeWidth={1.5} />
          <text x={30} y={6} textAnchor="middle" fontSize="8" fill="#6b7a88" style={{ userSelect: 'none' }}>12 m</text>
        </g>
      </svg>
    </div>
  );
}
