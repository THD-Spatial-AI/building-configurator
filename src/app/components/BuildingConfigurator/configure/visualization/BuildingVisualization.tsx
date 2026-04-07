// 3D isometric building preview for the Configure view.
// Walls, windows and doors still select by face group, while pitched roof
// surfaces select the specific roof element so multi-slope roofs can be edited
// directly from the preview. Hover state is managed locally.

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
  /** Expert thermal fields — sourced from TABULA via hdcp node */
  dInsulation?: number;        // Insulation thickness (m)
  bTransmission?: number;      // Heat loss correction factor for adjacent unheated space (0–1)
  measureType?: string;        // TABULA Code_MeasureType value
  measureTypeOptions?: string[]; // Valid options from _val_data column
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
  /** Used for exact roof-surface selection when a roof has multiple slopes. */
  elementId?: string;
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

const SELECTED_FILL: Record<string, string> = {
  floor:       '#4ade80',
  wallFront:   '#60a5fa',
  wallSide:    '#3b82f6',
  roof:        '#f59e0b',
  door:        '#fb7185',
  windowFront: '#22d3ee',
  windowSide:  '#06b6d4',
};

function getSurfacePaint(fillKey: keyof typeof FILL, selected: boolean, hovered: boolean) {
  if (selected) {
    return {
      fill: SELECTED_FILL[fillKey],
      stroke: '#0f3fb8',
      strokeWidth: 3.4,
      filter: 'url(#surfaceSelectedGlow)',
    };
  }

  if (hovered) {
    return {
      fill: FILL_HOVER[fillKey],
      stroke: '#2563eb',
      strokeWidth: 2.1,
      filter: 'url(#surfaceHoverGlow)',
    };
  }

  return {
    fill: FILL[fillKey],
    stroke: '#6f8798',
    strokeWidth: 1.1,
    filter: undefined,
  };
}

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

const FACE_ANGLES: Record<string, number> = {
  north_wall: 0,
  northeast_wall: 45,
  east_wall: 90,
  southeast_wall: 135,
  south_wall: 180,
  southwest_wall: 225,
  west_wall: 270,
  northwest_wall: 315,
};

function circularAngleDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function oppositeFace(faceId: string): string {
  const angle = FACE_ANGLES[faceId];
  if (angle === undefined) return faceId;
  const oppositeAngle = (angle + 180) % 360;
  return Object.entries(FACE_ANGLES).find(([, value]) => value === oppositeAngle)?.[0] ?? faceId;
}

export function roofFaceFromElement(el: Pick<BuildingElement, 'tilt' | 'azimuth'>): string {
  return el.tilt <= 10 ? 'roof' : faceFromAzimuth(el.azimuth);
}

/** Maps any building element to its FaceGroup for viz ↔ list synchronisation. */
export function elementToGroup(el: BuildingElement): FaceGroup {
  if (el.type === 'roof')  return { type: 'roof',  face: roofFaceFromElement(el), elementId: el.id };
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
  if (a === null || b === null || a.type !== b.type || a.face !== b.face) return false;
  if (a.type === 'roof' && (a.elementId || b.elementId)) return a.elementId === b.elementId;
  return true;
}

// ─── Isometric roof shape renderer ───────────────────────────────────────────

/** Visual roof categories used for 3D preview rendering. */
type RoofType = 'flat' | 'shed' | 'gable' | 'hip' | 'pyramid' | 'mansard';

/**
 * Infers the visual roof shape from the current roof elements.
 * Uses the same count+tilt heuristic as RoofTypeGallery — kept local
 * to avoid a circular import (RoofTypeGallery imports BuildingElement from here).
 */
function inferRoofShape(roofs: BuildingElement[]): RoofType {
  if (roofs.length === 0) return 'flat';
  if (roofs.length === 1) return roofs[0].tilt <= 5 ? 'flat' : 'shed';
  if (roofs.length === 2) return 'gable';
  if (roofs.length === 4) {
    const avg = roofs.reduce((s, e) => s + e.tilt, 0) / 4;
    return avg > 40 ? 'pyramid' : 'hip';
  }
  if (roofs.length >= 5) return 'mansard';
  return 'flat';
}

/**
 * Box wall-top corners (isometric SVG coordinates):
 *   A = [58, 116]  front-left (SW)
 *   B = [298, 116] front-right (SE)
 *   C = [385, 66]  back-right (NE)
 *   D = [145, 66]  back-left (NW)
 *
 * ROOF_H = 42 px above wall-top (= subtract 42 from y in SVG).
 * Derived ridge / apex points carry the _up suffix.
 */
const ROOF_H = 42;

// Ridge midpoints (between opposite wall-top edges, then elevated)
const midE_up = '341.5,49';  // midpoint(B,C) + H
const midW_up = '101.5,49';  // midpoint(A,D) + H
const apex_up = '221.5,49';  // center of all four + H
const hipL    = '161.5,49';  // 25 % along E-W + 50 % depth + H
const hipR    = '281.5,49';  // 75 % along E-W + 50 % depth + H

// Shed: back edge (north) fully elevated
const shedDu = '145,24';
const shedCu = '385,24';

// Mansard upper ring: H=32, 20 % plan inset from each corner
const mansFL = '123,74';
const mansFR = '268,74';
const mansBL = '176,44';
const mansBR = '320,44';
const A_up = '58,74';
const B_up = '298,74';
const C_up = '385,24';
const D_up = '145,24';
const midS_up = '178,74';
const midN_up = '265,24';

type RoofSlot = 'front' | 'side' | 'back' | 'left' | 'top';

interface RoofSurfacePolygon {
  key: string;
  points: string;
  fill: string;
  group?: FaceGroup;
}

interface RoofPolygonsResult {
  polygons: RoofSurfacePolygon[];
  ridge?: { x1: number; y1: number; x2: number; y2: number };
}

function slotFill(slot: RoofSlot, active: boolean): string {
  if (slot === 'front') return active ? '#f59e0b' : '#c0b090';
  if (slot === 'side') return active ? '#d97706' : '#a89878';
  if (slot === 'back') return active ? '#b45309' : '#b0a080';
  if (slot === 'left') return active ? '#c2410c' : '#a39379';
  return active ? '#fbbf24' : '#cfc0a4';
}

function chooseNearestRoofSlot(face: string, slotFaces: Record<Exclude<RoofSlot, 'top'>, string>): Exclude<RoofSlot, 'top'> {
  const faceAngle = FACE_ANGLES[face] ?? 180;
  return (Object.entries(slotFaces) as Array<[Exclude<RoofSlot, 'top'>, string]>).reduce((best, [slot, slotFace]) => {
    const distance = circularAngleDistance(faceAngle, FACE_ANGLES[slotFace] ?? 180);
    if (distance < best.distance) return { slot, distance };
    return best;
  }, { slot: 'front' as Exclude<RoofSlot, 'top'>, distance: Number.POSITIVE_INFINITY }).slot;
}

function dominantRoofAxis(slotAreas: Partial<Record<Exclude<RoofSlot, 'top'>, number>>): 'front-back' | 'side-left' {
  const frontBack = (slotAreas.front ?? 0) + (slotAreas.back ?? 0);
  const sideLeft = (slotAreas.side ?? 0) + (slotAreas.left ?? 0);
  return sideLeft > frontBack ? 'side-left' : 'front-back';
}

function buildRoofPolygons(
  shape: RoofType,
  roofs: BuildingElement[],
  slotFaces: Record<Exclude<RoofSlot, 'top'>, string>,
): RoofPolygonsResult {
  const slotElements: Partial<Record<RoofSlot, BuildingElement>> = {};
  const slotAreas: Partial<Record<Exclude<RoofSlot, 'top'>, number>> = {};

  for (const roof of roofs) {
    const group = elementToGroup(roof);
    if (group.face === 'roof') {
      slotElements.top = roof;
      continue;
    }

    const slot = chooseNearestRoofSlot(group.face, slotFaces);
    slotAreas[slot] = (slotAreas[slot] ?? 0) + roof.area;
    if (!slotElements[slot] || roof.area > slotElements[slot]!.area) {
      slotElements[slot] = roof;
    }
  }

  const polygon = (key: string, points: string, slot: RoofSlot): RoofSurfacePolygon => {
    const roof = slotElements[slot];
    return {
      key,
      points,
      fill: slotFill(slot, false),
      group: roof ? elementToGroup(roof) : undefined,
    };
  };

  if (shape === 'flat') {
    return { polygons: [{ ...polygon('flat', '58,116 298,116 385,66 145,66', 'top') }] };
  }

  if (shape === 'shed') {
    const roof = roofs[0];
    const slot = roof ? (roofFaceFromElement(roof) === 'roof' ? 'top' : chooseNearestRoofSlot(roofFaceFromElement(roof), slotFaces)) : 'front';
    const pointsBySlot: Record<Exclude<RoofSlot, 'top'>, string> = {
      front: '58,116 298,116 385,24 145,24',
      back: '58,74 298,74 385,66 145,66',
      side: '58,74 298,116 385,66 145,24',
      left: '58,116 298,74 385,24 145,66',
    };

    return {
      polygons: [
        {
          ...polygon('shed', pointsBySlot[slot === 'top' ? 'front' : slot], slot === 'top' ? 'top' : slot),
          group: roof ? elementToGroup(roof) : undefined,
        },
      ],
    };
  }

  if (shape === 'gable') {
    const axis = dominantRoofAxis(slotAreas);
    if (axis === 'side-left') {
      return {
        polygons: [
          { ...polygon('gable-left-end', `58,116 298,116 ${midS_up}`, 'front'), group: undefined, fill: slotFill('front', false) },
          { ...polygon('gable-west', `58,116 145,66 ${midN_up} ${midS_up}`, 'left') },
          { ...polygon('gable-east', `298,116 385,66 ${midN_up} ${midS_up}`, 'side') },
          { ...polygon('gable-back-end', `145,66 385,66 ${midN_up}`, 'back'), group: undefined, fill: slotFill('back', false) },
        ],
        ridge: { x1: 178, y1: 74, x2: 265, y2: 24 },
      };
    }

    return {
      polygons: [
        { ...polygon('gable-west-end', `58,116 145,66 ${midW_up}`, 'left'), group: undefined, fill: slotFill('left', false) },
        { ...polygon('gable-back', `145,66 385,66 ${midE_up} ${midW_up}`, 'back') },
        { ...polygon('gable-front', `58,116 298,116 ${midE_up} ${midW_up}`, 'front') },
        { ...polygon('gable-east-end', `298,116 385,66 ${midE_up}`, 'side'), group: undefined, fill: slotFill('side', false) },
      ],
      ridge: { x1: 101.5, y1: 49, x2: 341.5, y2: 49 },
    };
  }

  if (shape === 'hip') {
    return {
      polygons: [
        polygon('hip-back', `${'145,66'} ${'385,66'} ${hipR} ${hipL}`, 'back'),
        polygon('hip-left', `${'58,116'} ${'145,66'} ${hipL}`, 'left'),
        polygon('hip-front', `${'58,116'} ${'298,116'} ${hipR} ${hipL}`, 'front'),
        polygon('hip-side', `${'298,116'} ${'385,66'} ${hipR}`, 'side'),
      ],
      ridge: { x1: 161.5, y1: 49, x2: 281.5, y2: 49 },
    };
  }

  if (shape === 'pyramid') {
    return {
      polygons: [
        polygon('pyr-back', `${'145,66'} ${'385,66'} ${apex_up}`, 'back'),
        polygon('pyr-left', `${'58,116'} ${'145,66'} ${apex_up}`, 'left'),
        polygon('pyr-front', `${'58,116'} ${'298,116'} ${apex_up}`, 'front'),
        polygon('pyr-side', `${'298,116'} ${'385,66'} ${apex_up}`, 'side'),
      ],
    };
  }

  return {
    polygons: [
      polygon('mansard-back', `${'145,66'} ${'385,66'} ${mansBR} ${mansBL}`, 'back'),
      polygon('mansard-left', `${'58,116'} ${'145,66'} ${mansBL} ${mansFL}`, 'left'),
      polygon('mansard-top', `${mansFL} ${mansFR} ${mansBR} ${mansBL}`, 'top'),
      polygon('mansard-front', `${'58,116'} ${'298,116'} ${mansFR} ${mansFL}`, 'front'),
      polygon('mansard-side', `${'298,116'} ${'385,66'} ${mansBR} ${mansFR}`, 'side'),
    ],
  };
}

/** Renders the roof above the isometric building box in the detected shape. */
function Roof3D({
  shape,
  roofs,
  selectedGroup,
  hoveredGroup,
  slotFaces,
  onClick,
  onEnter,
  onLeave,
}: {
  shape: RoofType;
  roofs: BuildingElement[];
  selectedGroup: FaceGroup | null;
  hoveredGroup: FaceGroup | null;
  slotFaces: Record<Exclude<RoofSlot, 'top'>, string>;
  onClick: (group: FaceGroup) => void;
  onEnter: (group: FaceGroup) => void;
  onLeave: () => void;
}) {
  const { polygons, ridge } = buildRoofPolygons(shape, roofs, slotFaces);

  return (
    <>
      {polygons.map(({ key, points, fill, group }) => {
        const isSelected = group ? groupsMatch(selectedGroup, group) : false;
        const isHovered = group ? groupsMatch(hoveredGroup, group) : false;
        const stroke = isSelected ? '#2f5d8a' : '#7090a8';
        const strokeWidth = isSelected ? 2.5 : 0.7;
        const finalFill = group
          ? slotFill(
              group.face === 'roof'
                ? 'top'
                : (chooseNearestRoofSlot(group.face, slotFaces) as RoofSlot),
              isSelected || isHovered,
            )
          : fill;

        return (
          <polygon
            key={key}
            points={points}
            fill={finalFill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            filter={isSelected ? 'url(#surfaceSelectedGlow)' : isHovered ? 'url(#surfaceHoverGlow)' : undefined}
            style={{ cursor: group ? 'pointer' : 'default', transition: 'fill 0.13s ease, stroke-width 0.13s ease' }}
            onClick={group ? () => onClick(group) : undefined}
            onMouseEnter={group ? () => onEnter(group) : undefined}
            onMouseLeave={group ? onLeave : undefined}
          />
        );
      })}
      {ridge && (
        <line
          x1={ridge.x1}
          y1={ridge.y1}
          x2={ridge.x2}
          y2={ridge.y2}
          stroke="#607888"
          strokeWidth={0.8}
          opacity={0.75}
        />
      )}
    </>
  );
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
  const roofElements = useMemo(() => Object.values(elements).filter((e) => e.type === 'roof'), [elements]);

  // Infer roof shape from current roof elements so the 3D preview matches the applied type.
  const roofShape = useMemo((): RoofType => {
    return inferRoofShape(roofElements);
  }, [roofElements]);

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
  const roofSlotFaces = useMemo(() => ({
    front: view.frontWallId,
    side: view.sideWallId,
    back: oppositeFace(view.frontWallId),
    left: oppositeFace(view.sideWallId),
  }), [view]);

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
      if (group.type === 'roof') {
        if (group.elementId) return el.id === group.elementId;
        return roofFaceFromElement(el) === group.face;
      }
      if (group.type === 'floor') return true;
      return faceFromAzimuth(el.azimuth) === group.face;
    }).length;
  };

  // Status badge text for the selected group
  const badgeText = (group: FaceGroup): string => {
    const visibleFaces = new Set([view.frontWallId, view.sideWallId, 'roof', 'floor']);
    const isHidden = !visibleFaces.has(group.face);
    const suffix = isHidden ? ' · rotate to view' : '';

    if (group.type === 'roof') {
      const roof = group.elementId ? elements[group.elementId] : null;
      if (roof) {
        const roofDir = roofFaceFromElement(roof) === 'roof' ? 'Top' : compassLabel(roof.azimuth);
        return `${roof.label} · ${roofDir}${suffix}`;
      }
      return group.face === 'roof' ? `Roof${suffix}` : `${wallFaceLabel(group.face)} Roof${suffix}`;
    }
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
    const paint      = getSurfacePaint(fillKey, isSelected, isHovered);
    const lx         = variant === 'front' ? 178 : 342;
    const ly         = variant === 'front' ? 133 : 178;

    return (
      <g key={wall.id}>
        <polygon
          points={pointsToString(wall.quad)}
          fill={paint.fill}
          stroke={paint.stroke}
          strokeWidth={paint.strokeWidth}
          filter={paint.filter}
          style={{ cursor: 'pointer', transition: 'fill 0.13s ease, stroke-width 0.13s ease' }}
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
    const paint = getSurfacePaint(fillKey, isSelected, isHovered);

    return (
      <polygon
        key={`${faceId}-${openingType}`}
        points={pointsToString(points)}
        fill={paint.fill}
        stroke={paint.stroke}
        strokeWidth={paint.strokeWidth}
        filter={paint.filter}
        style={{ cursor: 'pointer', transition: 'fill 0.13s ease, stroke-width 0.13s ease' }}
        onClick={() => onSelectGroup(group)}
        onMouseEnter={() => setHoveredGroup(group)}
        onMouseLeave={() => setHoveredGroup(null)}
      />
    );
  };

  const isFloorSelected = groupsMatch(selectedGroup, { type: 'floor', face: 'floor' });
  const isFloorHovered  = groupsMatch(hoveredGroup,  { type: 'floor', face: 'floor' });
  return (
    <div className="relative h-full min-h-0 w-full rounded-lg overflow-hidden border border-border bg-slate-100/70">
      {/* Instruction chip — top-centre */}
      <div className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2">
        <div className="flex items-center gap-1.5 rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 shadow-sm backdrop-blur-sm">
          <span className="whitespace-nowrap text-[10px] font-medium text-slate-500">
            Click a surface to select · arrows to rotate view
          </span>
        </div>
      </div>
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
          <filter id="surfaceSelectedGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#2563eb" floodOpacity="0.45" />
          </filter>
          <filter id="surfaceHoverGlow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#60a5fa" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Sky background */}
        <rect x={-30} y={-20} width={520} height={380} fill="url(#skyGrad)" />

        {/* Ground shadow */}
        <ellipse cx={222} cy={310} rx={200} ry={13} fill="rgba(0,0,0,0.08)" />

        {/* Hidden back faces — drawn first so visible walls fully occlude them */}
        <polygon points={pointsToString(HIDDEN_BACK_WALL_QUAD)} fill="#64748b" fillOpacity={0.28} stroke="#64748b" strokeOpacity={0.25} strokeWidth={0.7} />
        <polygon points={pointsToString(HIDDEN_LEFT_WALL_QUAD)} fill="#64748b" fillOpacity={0.18} stroke="#64748b" strokeOpacity={0.18} strokeWidth={0.7} />

        <g>
          {/* Ground floor */}
          {(() => {
            const paint = getSurfacePaint('floor', isFloorSelected, isFloorHovered);
            return (
          <polygon
            points={SVG_ELEMENTS[0].points}
            fill={paint.fill}
            stroke={paint.stroke}
            strokeWidth={paint.strokeWidth}
            filter={paint.filter}
            style={{ cursor: 'pointer', transition: 'fill 0.13s ease, stroke-width 0.13s ease' }}
            onClick={() => onSelectGroup({ type: 'floor', face: 'floor' })}
            onMouseEnter={() => setHoveredGroup({ type: 'floor', face: 'floor' })}
            onMouseLeave={() => setHoveredGroup(null)}
          />
            );
          })()}

          {/* Visible walls */}
          {renderWall(wallDefs.front, 'front')}
          {renderWall(wallDefs.side,  'side')}

          {/* Roof — shape matches the detected roof type */}
          <Roof3D
            shape={roofShape}
            roofs={roofElements}
            selectedGroup={selectedGroup}
            hoveredGroup={hoveredGroup}
            slotFaces={roofSlotFaces}
            onClick={onSelectGroup}
            onEnter={setHoveredGroup}
            onLeave={() => setHoveredGroup(null)}
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

        {/* Roof label — float above ridge for pitched shapes */}
        <text
          x={222}
          y={roofShape === 'flat' || roofShape === 'shed' ? 91 : 43}
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

        {/* Compass rose with front-face indicator */}
        {(() => {
          const frontAzimuth = FACE_ANGLES[view.frontWallId] ?? 0;
          const frontRad = (frontAzimuth * Math.PI) / 180;
          // Tip of the front-face arrow just outside the compass circle
          const arrowR = 28;
          const arrowTipX  =  Math.sin(frontRad) * arrowR;
          const arrowTipY  = -Math.cos(frontRad) * arrowR;
          // Two base points of the small arrowhead (perpendicular, inside the circle)
          const baseR = 20;
          const bx = Math.sin(frontRad) * baseR;
          const by = -Math.cos(frontRad) * baseR;
          const perpX = -Math.cos(frontRad) * 4;
          const perpY = -Math.sin(frontRad) * 4;
          const frontShort = compassLabel(frontAzimuth).split(' ').map(w => w[0]).join(''); // "S", "SE", etc.
          return (
            <g transform="translate(422, 44)">
              {/* Front-face arrow outside the circle */}
              <polygon
                points={`${arrowTipX},${arrowTipY} ${bx + perpX},${by + perpY} ${bx - perpX},${by - perpY}`}
                fill="#2563eb"
                opacity={0.85}
              />
              <circle cx={0} cy={0} r={22} fill="rgba(255,255,255,0.9)" stroke="#c0ccd8" strokeWidth={1.2} />
              <polygon points="0,-18 -3.5,-7 3.5,-7" fill="#c53030" />
              <polygon points="0,18 -3.5,7 3.5,7" fill="#8090a4" />
              <line x1={-16} y1={0} x2={16} y2={0} stroke="#8090a4" strokeWidth={1.5} strokeLinecap="round" />
              <text x={0}   y={-24} textAnchor="middle" fontSize="9" fill="#c53030" fontWeight="bold" style={{ userSelect: 'none' }}>N</text>
              <text x={0}   y={33}  textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>S</text>
              <text x={27}  y={4}   textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>E</text>
              <text x={-27} y={4}   textAnchor="middle" fontSize="9" fill="#6b7a88" style={{ userSelect: 'none' }}>W</text>
              {/* "Front: XX" label below compass */}
              <rect x={-22} y={38} width={44} height={13} rx={3} fill="rgba(37,99,235,0.12)" />
              <text x={0} y={48} textAnchor="middle" fontSize="8" fill="#2563eb" fontWeight="700" style={{ userSelect: 'none' }}>
                Front: {frontShort}
              </text>
            </g>
          );
        })()}


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
