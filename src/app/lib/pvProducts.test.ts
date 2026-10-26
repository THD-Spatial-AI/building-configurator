import { describe, expect, it } from 'vitest';
import { fitsMore, productModule, pvCosts, shownConstraints, type TechnologyProduct } from './pvProducts';
import { DEFAULT_PV_MODULE } from './pvLayout';
import type { SurfacePolygon } from './surfaceMesh';

function product(id: string, constraints: Record<string, number | string>): TechnologyProduct {
  return {
    id, key: `pv_${id}`, type: 'pv_supply', alias: id,
    constraints: Object.entries(constraints).map(([key, default_value]) => ({ key, default_value })),
  };
}

const mono = product('mono', { module_width_m: 1.134, module_height_m: 1.762, module_power_kwp: 0.42, cost_energy_cap: 575, cost_om_annual: 10, cont_lifetime: 25, losses: 14, cont_export_cap: 'INF' });
const compact = product('compact', { module_width_m: 1.0, module_height_m: 1.5, module_power_kwp: 0.3, cost_energy_cap: 610 });

describe('productModule', () => {
  it('reads the module size and power from the product', () => {
    expect(productModule(mono, DEFAULT_PV_MODULE)).toEqual({ width: 1.134, height: 1.762, kwp: 0.42 });
  });

  it('falls back for a product without all three module values', () => {
    expect(productModule(product('x', { module_width_m: 1 }), DEFAULT_PV_MODULE)).toBe(DEFAULT_PV_MODULE);
    expect(productModule(undefined, DEFAULT_PV_MODULE)).toBe(DEFAULT_PV_MODULE);
  });
});

describe('pvCosts', () => {
  it('multiplies the per-kWp costs by the capacity', () => {
    expect(pvCosts(mono, 4)).toEqual({ investment: 2300, omPerYear: 40 });
  });

  it('leaves out a cost the product does not carry', () => {
    expect(pvCosts(compact, 2)).toEqual({ investment: 1220, omPerYear: undefined });
  });
});

describe('shownConstraints', () => {
  it('asks the basic questions in basic mode, in their own order', () => {
    expect(shownConstraints(mono, 'basic').map((c) => c.key)).toEqual(['cost_energy_cap', 'cost_om_annual', 'cont_lifetime']);
  });

  it('adds the simulation keys the product carries in expert mode, and never the unused ones', () => {
    const keys = shownConstraints(mono, 'expert').map((c) => c.key);
    expect(keys).toEqual(['cost_energy_cap', 'cost_om_annual', 'cont_lifetime', 'losses']);
    expect(keys).not.toContain('cont_export_cap');
    expect(keys).not.toContain('module_width_m');
  });
});

describe('fitsMore', () => {
  // 3.3 m by 2.2 m, flat: the compact module fits more of its smaller size.
  const roof: SurfacePolygon = { id: 'r', type: 'RoofSurface', coordinates: [[[0, 0, 3], [3.3, 0, 3], [3.3, 2.2, 3], [0, 2.2, 3], [0, 0, 3]]] };
  const options = { usableShare: 1, mounting: { kind: 'flush' as const } };

  it('ranks other products by the capacity they reach on the surface, when more than now', () => {
    const current = 0.42 * 1;
    const ranked = fitsMore(roof, options, [mono, compact], 'mono', current, DEFAULT_PV_MODULE);
    expect(ranked.map((r) => r.product.id)).toEqual(['compact']);
    expect(ranked[0].layout.kwp).toBeGreaterThan(current);
  });

  it('offers nothing when no other product reaches more', () => {
    expect(fitsMore(roof, options, [mono, compact], 'compact', 99, DEFAULT_PV_MODULE)).toEqual([]);
  });
});
