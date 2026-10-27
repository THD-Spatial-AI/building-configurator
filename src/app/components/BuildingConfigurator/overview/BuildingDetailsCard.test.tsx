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

  it('flags storeys and a room height taller than the 3D model, and gives the model height', () => {
    const low = renderToStaticMarkup(<BuildingDetailsCard snapshotRows={rows} modelHeight={2.6} />);
    expect(low).toContain('3 storeys of 2.7 m are taller than the 3D model, which is 2.6 m to the eaves');
    expect(low).toContain('2.6 m to the eaves');
    expect(low).toContain('Footprint area');
    expect(renderToStaticMarkup(<BuildingDetailsCard snapshotRows={rows} modelHeight={9} />)).not.toContain('taller than the 3D model');
  });
});
