import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildingDetailsCard } from './BuildingDetailsCard';
import { buildSnapshotRows } from '../shared/snapshotUtils';
import { DEFAULT_GENERAL } from '../shared/buildingDefaults';

const rows = buildSnapshotRows({ ...DEFAULT_GENERAL, storeys: 3, storeysModelled: [1, 2] }, {}, 0, 'en');

describe('BuildingDetailsCard building data', () => {
  it('shows the building as tiles, the storeys as modelled', () => {
    const html = renderToStaticMarkup(<BuildingDetailsCard snapshotRows={rows} />);
    expect(html).toContain('2 of 3');
    expect(html).toContain('Built in 2015');
    expect(html).toContain('Germany');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Occupants per dwelling');
  });

  it('adds dwellings and occupants for a residential building, with BuEM defaults where unset', () => {
    const html = renderToStaticMarkup(<BuildingDetailsCard snapshotRows={rows} occupancy={{ dwellings: null, persons: null }} />);
    expect(html).toContain('Occupants per dwelling');
    expect(html).toContain('Statistical default');
  });
});
