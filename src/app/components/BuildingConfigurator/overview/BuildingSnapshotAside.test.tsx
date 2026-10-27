import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildingSnapshotAside } from './BuildingSnapshotAside';
import type { EnergyTotals } from '../../../lib/loadProfile';

const totals: EnergyTotals = { heating: '6000', electricity: '3000', hotwater: '500', dhw: '2000', total: '11500', unit: 'kWh/year' };

describe('BuildingSnapshotAside', () => {
  it('shows the annual demand by carrier and no energy class, which the energy grade section gives', () => {
    const html = renderToStaticMarkup(<BuildingSnapshotAside energyTotals={totals} />);
    expect(html).toContain('6,000');
    expect(html).not.toContain('Indicative heating demand class');
  });
});
