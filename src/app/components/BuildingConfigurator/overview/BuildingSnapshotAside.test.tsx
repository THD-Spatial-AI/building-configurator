import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuildingSnapshotAside } from './BuildingSnapshotAside';
import type { EnergyTotals } from '../../../lib/loadProfile';

const totals: EnergyTotals = { heating: '6000', electricity: '3000', hotwater: '500', dhw: '2000', total: '11500', unit: 'kWh/year' };

describe('BuildingSnapshotAside', () => {
  it('shows the indicative heating class of the BuEM result', () => {
    const html = renderToStaticMarkup(<BuildingSnapshotAside energyTotals={totals} heatingPerM2={60} />);
    expect(html).toContain('>C<');
    expect(html).toContain('Indicative heating demand class');
    expect(html).toContain('60 kWh/m²');
  });

  it('says when the class is of the storeys last run, not of those now modelled', () => {
    expect(renderToStaticMarkup(<BuildingSnapshotAside energyTotals={totals} heatingPerM2={60} heatingClassStale />)).toContain('For the storeys as last run');
    expect(renderToStaticMarkup(<BuildingSnapshotAside energyTotals={totals} heatingPerM2={60} />)).not.toContain('For the storeys as last run');
  });

  it('shows no class without a BuEM heating figure', () => {
    expect(renderToStaticMarkup(<BuildingSnapshotAside energyTotals={totals} />)).not.toContain('Indicative heating demand class');
  });
});
