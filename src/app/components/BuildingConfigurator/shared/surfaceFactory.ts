// Builds a new surface element (id, label, seeded properties) when the user
// adds a custom wall/window/door/roof/floor from the configurator.

import type { BuildingElement } from '../configure/model/buildingElements';
import { isElementEditable } from '../configure/model/buildingElements';
import type { RoofConfig } from '../configure/model/roof';

const SURFACE_DEFAULTS: Record<BuildingElement['type'], Omit<BuildingElement, 'id' | 'label'>> = {
  wall:   { type: 'wall',   area: 12, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180, source: 'custom', customMode: true },
  window: { type: 'window', area: 2.4, uValue: 1.3,  gValue: 0.6,  tilt: 90, azimuth: 180, source: 'custom', customMode: true },
  door:   { type: 'door',   area: 2.1, uValue: 1.8,  gValue: null, tilt: 90, azimuth: 180, source: 'custom', customMode: true },
  roof:   { type: 'roof',   area: 18, uValue: 0.18, gValue: null, tilt: 35, azimuth: 180, source: 'custom', customMode: true },
  floor:  { type: 'floor',  area: 18, uValue: 0.30, gValue: null, tilt: 0,  azimuth: 0,   source: 'custom', customMode: true },
};

function surfaceTypeLabel(type: BuildingElement['type']): string {
  if (type === 'roof') return 'Roof';
  if (type === 'floor') return 'Floor';
  if (type === 'door') return 'Door';
  if (type === 'window') return 'Window';
  return 'Wall';
}

function buildSurfaceLabel(type: BuildingElement['type'], elements: Record<string, BuildingElement>): string {
  const next = Object.values(elements).filter((el) => el.type === type).length + 1;
  return `Custom ${surfaceTypeLabel(type)} ${next}`;
}

function buildSurfaceId(type: BuildingElement['type'], elements: Record<string, BuildingElement>): string {
  const base = `custom_${type}`;
  let idx = 1;
  while (elements[`${base}_${idx}`]) idx += 1;
  return `${base}_${idx}`;
}

/** Creates a new surface of the given type, seeded from an existing editable surface of the same type when one exists. */
export function buildNewSurface(type: BuildingElement['type'], elements: Record<string, BuildingElement>): BuildingElement {
  const seed = Object.values(elements).find((el) => el.type === type && isElementEditable(el))
    ?? Object.values(elements).find((el) => el.type === type)
    ?? null;

  return {
    id: buildSurfaceId(type, elements),
    label: buildSurfaceLabel(type, elements),
    ...(seed
      ? {
          type,
          area: seed.area,
          uValue: seed.uValue,
          gValue: seed.gValue,
          tilt: seed.tilt,
          azimuth: seed.azimuth,
          source: 'custom' as const,
          customMode: true,
        }
      : SURFACE_DEFAULTS[type]),
  };
}

/** Type guard for the legacy roof-config shape found in some imported JSON files. */
export function isRoofConfig(value: unknown): value is RoofConfig {
  return !!value
    && typeof value === 'object'
    && 'type' in value
    && 'surfaces' in value
    && Array.isArray((value as RoofConfig).surfaces)
    && 'from3DData' in value;
}
