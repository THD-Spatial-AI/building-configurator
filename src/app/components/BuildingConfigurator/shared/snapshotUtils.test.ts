import { describe, expect, it } from 'vitest';
import { buildSnapshotRows } from './snapshotUtils';
import { DEFAULT_GENERAL } from './buildingDefaults';
import type { BuildingElement } from '../configure/model/buildingElements';

const surface = (id: string, area: number, modelledShare?: number): BuildingElement => ({
  id, label: id, type: 'wall', area, uValue: 0.3, gValue: null, tilt: 90, azimuth: 180,
  ...(modelledShare === undefined ? {} : { modelledShare }),
});

const general = { ...DEFAULT_GENERAL, floorArea: 100, storeys: 3, roomHeight: 2.5 };
const row = (rows: ReturnType<typeof buildSnapshotRows>, key: string) => rows.find((r) => r.labelKey === key)!;

describe('buildSnapshotRows', () => {
  it('keeps the footprint out of the data editor, as it comes from the 3D model', () => {
    expect(row(buildSnapshotRows(general, {}, 0, 'en'), 'snapshot.row.floorAreaPerStorey').editKey).toBeUndefined();
  });
});

describe('buildSnapshotRows with storeys left out', () => {
  const elements = { a: surface('a', 30, 2 / 3), b: surface('b', 50, 0), c: surface('c', 10, 1) };
  const rows = buildSnapshotRows({ ...general, storeysModelled: [1, 2] }, elements, 90, 'en');

  it('says how many of the storeys are modelled', () => {
    expect(row(rows, 'snapshot.row.storeys').valueMessage).toEqual({ key: 'snapshot.storeysModelled', values: { modelled: 2, total: 3 } });
    expect(row(rows, 'snapshot.row.storeys').status).toBe('modified');
  });

  it('gives the volume and envelope of the modelled storeys only', () => {
    expect(row(rows, 'snapshot.row.volume').value).toBe('500 m³');
    expect(row(rows, 'snapshot.row.envelope').valueMessage?.values).toEqual({ area: '30.0', count: 2 });
  });

  it('describes the whole building while every storey is modelled', () => {
    const whole = buildSnapshotRows(general, elements, 90, 'en');
    expect(row(whole, 'snapshot.row.storeys').value).toBe('3');
    expect(row(whole, 'snapshot.row.volume').value).toBe('750 m³');
    expect(row(whole, 'snapshot.row.envelope').valueMessage?.values).toEqual({ area: '90.0', count: 3 });
  });
});
