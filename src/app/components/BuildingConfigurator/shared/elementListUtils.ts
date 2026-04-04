// Utilities for grouping and describing building envelope elements.
// Used by both ElementList (configure sidebar) and ElementCompositionSection (overview).

import type { BuildingElement } from '../configure/BuildingVisualization';
import type { RoofConfig } from '../configure/RoofConfigurator';

export type ElementGroupKey = 'wall' | 'window' | 'door' | 'roof' | 'floor';

export const ELEMENT_GROUP_LABELS: Record<ElementGroupKey, string> = {
  wall:   'Walls',
  window: 'Windows',
  door:   'Doors',
  roof:   'Roof',
  floor:  'Floor',
};

/** Partitions the elements record into buckets by type. */
export function getGroupedElements(
  elements: Record<string, BuildingElement>,
): Record<ElementGroupKey, BuildingElement[]> {
  return {
    wall:   Object.values(elements).filter((el) => el.type === 'wall'),
    window: Object.values(elements).filter((el) => el.type === 'window'),
    door:   Object.values(elements).filter((el) => el.type === 'door'),
    roof:   Object.values(elements).filter((el) => el.type === 'roof'),
    floor:  Object.values(elements).filter((el) => el.type === 'floor'),
  };
}

/**
 * Returns a short shape description for the roof configuration.
 * Does NOT include a surface count — callers should use the actual element count instead.
 */
export function getRoofGroupInfo(roofConfig: RoofConfig): { description: string } {
  const descriptions: Record<string, string> = {
    flat:         'low-slope',
    'mono-pitch': 'single slope',
    gabled:       'S + N',
    hipped:       'S/N/E/W',
    'v-shape':    'inward slopes',
    'saw-tooth':  'S-facing',
    custom:       'custom',
  };

  return {
    description: descriptions[roofConfig.type] ?? roofConfig.type,
  };
}
