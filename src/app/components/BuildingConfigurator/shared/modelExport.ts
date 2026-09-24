// The model as tables: one row per surface, and the building's own parameters
// as name/value pairs. The BuEM GeoJSON export carries the same model for a
// machine; these are for reading in a spreadsheet or joining in QGIS.
//
// Load profiles are not here: the chart downloads those as their own CSVs.

import { strToU8, zipSync } from 'fflate';
import type { BuildingElement } from '../configure/model/buildingElements';
import { compassDir } from './pvSuitability';
import { computeTotalFloorArea, computeVolume, type PvConfig } from './buildingDefaults';

/** RFC 4180: a field carrying a comma, quote or newline is quoted, and its own
 *  quotes are doubled. A renamed surface is free text, so this is not optional. */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\n');
}

const SURFACE_HEADER = [
  'surface_id', 'label', 'type', 'face', 'area_m2', 'u_value_w_m2k', 'g_value',
  'tilt_deg', 'azimuth_deg', 'source', 'pv_installed', 'pv_capacity_kwp',
];

/** One row per envelope surface, with its PV array where it carries one. */
export function surfacesCsv(
  elements: Record<string, BuildingElement>,
  surfacePvConfigs: Record<string, PvConfig>,
): string {
  const rows = Object.values(elements)
    .sort((a, b) => a.type.localeCompare(b.type) || b.area - a.area)
    .map((el) => {
      const pv = surfacePvConfigs[el.id];
      return [
        // compassDir reads a horizontal surface's -1 azimuth as "flat" rather
        // than as a bearing.
        el.id, el.label, el.type, compassDir(el.azimuth),
        el.area.toFixed(2), el.uValue.toFixed(3), el.gValue ?? '',
        el.tilt.toFixed(1), el.azimuth.toFixed(1), el.source ?? '',
        pv?.installed ? 'yes' : 'no',
        pv?.installed ? pv.system_capacity.toFixed(2) : '',
      ];
    });
  return toCsv([SURFACE_HEADER, ...rows]);
}

/** The building's own parameters, as name/value/unit rows. */
export function buildingCsv(
  general: Record<string, any>,
  extras: { totalEnvelopeArea: number; avgUValue: number; heatDemandKwhM2a?: number | null },
): string {
  const storeys = general.storeys ?? 1;
  const rows: (string | number)[][] = [
    ['parameter', 'value', 'unit'],
    ['building_name', general.buildingName ?? '', ''],
    ['building_type', general.buildingType ?? '', ''],
    ['construction_year', general.constructionYear ?? '', ''],
    ['country', general.country ?? '', ''],
    ['floor_area_per_storey', (general.floorArea ?? 0).toFixed(2), 'm2'],
    ['storeys', storeys, ''],
    ['floor_area_total', computeTotalFloorArea(general.floorArea ?? 0, storeys).toFixed(2), 'm2'],
    ['room_height', (general.roomHeight ?? 0).toFixed(2), 'm'],
    ['volume', computeVolume(general.floorArea ?? 0, storeys, general.roomHeight ?? 0).toFixed(1), 'm3'],
    ['infiltration_air_change', (general.n_air_infiltration ?? 0).toFixed(2), '1/h'],
    ['use_air_change', (general.n_air_use ?? 0).toFixed(2), '1/h'],
    ['thermal_mass_class', general.massClass ?? '', ''],
    ['thermal_capacity', general.c_m ?? '', 'Wh/m2K'],
    ['attached_neighbours', general.Code_AttachedNeighbours ?? '', ''],
    ['calculation_method', general.use_milp ? 'MILP' : 'rule-based', ''],
    ['envelope_area', extras.totalEnvelopeArea.toFixed(2), 'm2'],
    ['envelope_avg_u_value', extras.avgUValue.toFixed(3), 'W/m2K'],
  ];
  if (extras.heatDemandKwhM2a != null) {
    rows.push(['annual_heat_demand', extras.heatDemandKwhM2a.toFixed(1), 'kWh/(m2.a)']);
  }
  return toCsv(rows);
}

/** Both tables in one archive, so an export is a single file. */
export function modelTablesZip(
  elements: Record<string, BuildingElement>,
  surfacePvConfigs: Record<string, PvConfig>,
  general: Record<string, any>,
  extras: { totalEnvelopeArea: number; avgUValue: number; heatDemandKwhM2a?: number | null },
): Uint8Array {
  return zipSync({
    'building.csv': strToU8(buildingCsv(general, extras)),
    'surfaces.csv': strToU8(surfacesCsv(elements, surfacePvConfigs)),
  });
}
