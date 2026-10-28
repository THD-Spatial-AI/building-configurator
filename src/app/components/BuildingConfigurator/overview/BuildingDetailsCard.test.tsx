import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildingDetailsCard } from './BuildingDetailsCard';
import { buildSnapshotRows } from '../shared/snapshotUtils';
import { DEFAULT_GENERAL } from '../shared/buildingDefaults';

const rows = buildSnapshotRows({ ...DEFAULT_GENERAL, storeys: 3, storeysModelled: [1, 2] }, {}, 0, 'en');
/** A summary row's value, or undefined when the summary has no row of that label. */
const fact = (html: string, label: string) => new RegExp(`<th scope="row"[^>]*>${label}</th><td[^>]*>([^<]*)</td>`).exec(html)?.[1];

describe('BuildingDetailsCard building data', () => {
  it('opens on its summary, the storeys as modelled, without the editing table', () => {
    const html = renderToStaticMarkup(<BuildingDetailsCard snapshotRows={rows} modelHeight={2.6} />);
    expect(fact(html, 'Storeys')).toBe('2 of 3 modelled');
    expect(fact(html, 'Construction year')).toBe('2015');
    expect(fact(html, 'Country')).toBe('Germany');
    expect(fact(html, 'Height to the eaves')).toBe('2.6 m');
    expect(html).toContain('aria-label="Edit Building data"');
    expect(html).not.toContain('<select');
  });

  it('leaves out the eaves without a 3D model, and flags no storeys taller than it here', () => {
    const html = renderToStaticMarkup(<BuildingDetailsCard snapshotRows={rows} />);
    expect(fact(html, 'Height to the eaves')).toBeUndefined();
    expect(fact(html, 'Footprint area')).toBeDefined();
    expect(html).not.toContain('taller than the 3D model');
    expect(html).toContain('aria-label="1. Building data, complete"');
  });
});
