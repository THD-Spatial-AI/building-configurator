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

describe('buildSnapshotRows with storeys of their own height', () => {
  const tall = { ...general, storeyHeights: { 3: 4 } };

  it('gives the mean room height and the volume of the modelled storeys at their heights', () => {
    const whole = buildSnapshotRows(tall, {}, 0, 'en');
    expect(row(whole, 'snapshot.row.roomHeight').value).toBe('3.0 m');
    expect(row(whole, 'snapshot.row.roomHeight').status).toBe('modified');
    expect(row(whole, 'snapshot.row.volume').value).toBe('900 m³');
    const lower = buildSnapshotRows({ ...tall, storeysModelled: [1, 2] }, {}, 0, 'en');
    expect(row(lower, 'snapshot.row.roomHeight').value).toBe('2.5 m');
    expect(row(lower, 'snapshot.row.volume').value).toBe('500 m³');
  });

  it('leaves the storeys and room height to Storeys and occupancy, not the data editor', () => {
    const rows = buildSnapshotRows(general, {}, 0, 'en');
    expect(row(rows, 'snapshot.row.storeys').editKey).toBeUndefined();
    expect(row(rows, 'snapshot.row.roomHeight').editKey).toBeUndefined();
  });
});
