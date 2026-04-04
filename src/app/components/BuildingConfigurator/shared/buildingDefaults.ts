// Default seed data for the building configurator.
// These values are placeholders until real building data is loaded from the API.

import type { BuildingElement } from '../configure/BuildingVisualization';

// TODO: 
export const DEFAULT_ELEMENTS: Record<string, BuildingElement> = {
  south_wall:     { id: 'south_wall',     label: 'South Wall',     type: 'wall',   area: 56.0, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180 },
  east_wall:      { id: 'east_wall',      label: 'East Wall',      type: 'wall',   area: 37.8, uValue: 0.24, gValue: null, tilt: 90, azimuth: 90  },
  north_wall:     { id: 'north_wall',     label: 'North Wall',     type: 'wall',   area: 56.0, uValue: 0.24, gValue: null, tilt: 90, azimuth: 0   },
  west_wall:      { id: 'west_wall',      label: 'West Wall',      type: 'wall',   area: 37.8, uValue: 0.24, gValue: null, tilt: 90, azimuth: 270 },
  roof:           { id: 'roof',           label: 'Roof',           type: 'roof',   area: 98.0, uValue: 0.18, gValue: null, tilt: 35, azimuth: 180 },
  floor:          { id: 'floor',          label: 'Ground Floor',   type: 'floor',  area: 90.0, uValue: 0.30, gValue: null, tilt: 0,  azimuth: 0   },
  south_window_1: { id: 'south_window_1', label: 'South Window 1', type: 'window', area: 4.5,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 180 },
  south_window_2: { id: 'south_window_2', label: 'South Window 2', type: 'window', area: 4.5,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 180 },
  east_window:    { id: 'east_window',    label: 'East Window',    type: 'window', area: 3.0,  uValue: 1.30, gValue: 0.60, tilt: 90, azimuth: 90  },
  door:           { id: 'door',           label: 'Front Door',     type: 'door',   area: 2.1,  uValue: 1.80, gValue: null, tilt: 90, azimuth: 180 },
};

// TODO: These defaults are purely illustrative and should be replaced with real building data from the API.
export const DEFAULT_GENERAL = {
  buildingType:       'Multi-family House',
  constructionPeriod: 'Post-2010',
  country:            'DE',
  floorArea:          363.4,
  roomHeight:         2.7,
  storeys:            4,
  n_air_infiltration: 0.4,
  n_air_use:          0.4,
  phi_int:            3.0,
  q_w_nd:             12.5,
  massClass:          'Medium',
  c_m:                110,
  use_milp:           false,
  electricityDemand:  4000,
  spaceHeatingDemand: 15000,
  dhwDemand:          2500,
};

export const DEFAULT_TOTAL_AREA = Object.values(DEFAULT_ELEMENTS).reduce(
  (sum, el) => sum + el.area,
  0,
);

export const DEFAULT_AVG_U_VALUE = DEFAULT_TOTAL_AREA > 0
  ? Object.values(DEFAULT_ELEMENTS).reduce((sum, el) => sum + el.uValue * el.area, 0) / DEFAULT_TOTAL_AREA
  : 0;
