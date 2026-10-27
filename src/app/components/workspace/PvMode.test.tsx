import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { pvRenderSets, surfaceProduct, type PvMode } from './PvMode';
import { ProductValues, PvOverview } from './PvOverview';
import { PvSurfaceSection } from './PvSurfaceSection';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import type { PvLayout } from '../../lib/pvLayout';
import type { TechnologyProduct } from '../../lib/pvProducts';
import type { SurfacePolygon } from '../../lib/surfaceMesh';

const elements: Record<string, BuildingElement> = {
  r1: { id: 'r1', label: 'Roof south', type: 'roof', area: 40, uValue: 0.2, gValue: null, tilt: 35, azimuth: 180 },
  r2: { id: 'r2', label: 'Roof north', type: 'roof', area: 40, uValue: 0.2, gValue: null, tilt: 35, azimuth: 0 },
  w1: { id: 'w1', label: 'Wall west', type: 'wall', area: 25, uValue: 0.3, gValue: null, tilt: 90, azimuth: 270 },
  f1: { id: 'f1', label: 'Flat roof', type: 'roof', area: 51, uValue: 0.2, gValue: null, tilt: 0, azimuth: -1 },
};

function product(id: string, model: string, module: [number, number, number], cost: number): TechnologyProduct {
  return {
    id, key: id, type: 'pv_supply', manufacturer: 'Demo', model,
    constraints: [
      { key: 'module_width_m', default_value: module[0] }, { key: 'module_height_m', default_value: module[1] },
      { key: 'module_power_kwp', default_value: module[2] },
      { key: 'cost_energy_cap', default_value: cost, unit: 'EUR/kW' }, { key: 'cost_om_annual', default_value: 10, unit: 'EUR/kW' },
      { key: 'cont_lifetime', default_value: 25, unit: 'years' }, { key: 'losses', default_value: 14, unit: '%', alias: 'System losses' },
      { key: 'cont_export_cap', default_value: 'INF' },
    ],
  };
}

const mono = product('mono', 'Mono 420 W', [1.134, 1.762, 0.42], 500);
const compact = product('compact', 'Compact 300 W', [1.0, 1.5, 0.3], 600);

const pv: PvMode = {
  surfaces: {
    r1: { state: 'installed', usableShare: 0.6, maxKwp: 7.2 },
    r2: { state: 'suggested', usableShare: 0.5, maxKwp: 4.1 },
    w1: { state: 'available', usableShare: 0.4, maxKwp: 2.5 },
  },
  notice: 'Shading from trees and neighbouring buildings is not considered.',
  typeLabel: 'Monocrystalline 400 W',
  onToggle: () => {},
  onShareChange: () => {},
  onMountingChange: () => {},
};

const withCatalogue: PvMode = {
  ...pv,
  productId: 'mono',
  catalogue: [mono, compact],
  onAssignProduct: () => {},
  onConstraintChange: () => {},
  onSaveAsTechnology: async () => 'new',
};

const flush: PvLayout = {
  count: 24, kwp: 9.6, area: 48, capped: true, tilt: 35, azimuth: 180,
  mounting: { kind: 'flush' }, orientation: 'portrait', modules: [],
};
const racked: PvLayout = { ...flush, tilt: 15, mounting: { kind: 'racked', tilt: 15, azimuth: 180 } };

describe('pvRenderSets', () => {
  it('draws modules on installed surfaces and highlights suggested ones only', () => {
    const { installed, suggested } = pvRenderSets(pv.surfaces);
    expect([...installed]).toEqual(['r1']);
    expect([...suggested]).toEqual(['r2']);
  });
});

describe('surfaceProduct', () => {
  it("takes the surface's own product, else the building's, and the building's copy over the catalogue's", () => {
    const copy = { ...mono, model: 'Mono 420 W, edited' };
    const host: PvMode = { ...withCatalogue, products: { mono: copy }, surfaces: { ...pv.surfaces, r2: { ...pv.surfaces.r2, productId: 'compact' } } };
    expect(surfaceProduct(host, 'r1')).toBe(copy);
    expect(surfaceProduct(host, 'r2')).toBe(compact);
    expect(surfaceProduct(pv, 'r1')).toBeUndefined();
  });
});

describe('PvOverview', () => {
  const html = renderToStaticMarkup(<PvOverview pv={pv} elements={elements} mode="basic" onSelect={() => {}} />);

  it("shows the title, the host's notice and PV type", () => {
    expect(html).toContain('PV on this building');
    expect(html).toContain(pv.notice);
    expect(html).toContain(pv.typeLabel);
  });

  it('sums the installed capacity and counts the surfaces with PV', () => {
    expect(html).toContain('7.2 kWp');
    expect(html).toContain('1 of 3');
    expect(html).toContain('Surfaces with PV (1 of 3)');
  });

  it('lists installed, then suggested, then available surfaces, with their geometry', () => {
    const order = ['Roof south', 'Roof north', 'Wall west'].map((name) => html.indexOf(name));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('35° · facing 180° · 40 m²');
    expect(html).toContain('up to 4.1 kWp');
  });

  it('offers to use the suggested surfaces only when there are any', () => {
    expect(html).toContain('Use suggested surfaces');
    const none = renderToStaticMarkup(
      <PvOverview pv={{ ...pv, surfaces: { r1: pv.surfaces.r1 } }} elements={elements} mode="basic" onSelect={() => {}} />,
    );
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>Use suggested surfaces/);
  });

  it('shows no costs, catalogue or values without products', () => {
    expect(html).not.toContain('Investment');
    expect(html).not.toContain('Catalogue');
    expect(html).not.toContain('Technology values');
  });
});

describe('PvOverview with a catalogue', () => {
  const html = renderToStaticMarkup(
    <PvOverview pv={withCatalogue} elements={elements} layouts={{ r1: flush }} mode="basic" onSelect={() => {}} />,
  );

  it('estimates investment and O&M from the products and the layouts', () => {
    expect(html).toContain('9.6 kWp');
    expect(html).toContain('4,800 EUR');
    expect(html).toContain('96 EUR');
    expect(html).toContain('Estimates from the products');
  });

  it('lists the installed products with their modules and capacity, the catalogue closed behind a drop-down', () => {
    const installed = html.slice(html.indexOf('Installed on this building'), html.indexOf('Photovoltaic options ('));
    expect(installed).toContain('Demo Mono 420 W');
    expect(installed).not.toContain('Demo Compact 300 W');
    expect(installed).toContain('24 modules');
    expect(installed).toContain('on 1 surface');
    expect(html).toMatch(/<details class="group[^"]*"><summary[^>]*>Photovoltaic options \(2\)/);
  });

  it('keeps each installed product\'s values behind its edit button', () => {
    expect(html).toContain('aria-label="Edit the values of Demo Mono 420 W"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('What does it cost per kWp?');
  });

  it('lists the catalogue as draggable products with their module and price', () => {
    expect(html).toContain('Demo Mono 420 W');
    expect(html).toContain('1.13 × 1.76 m · 420 W · 500 EUR/kWp');
    expect(html).toMatch(/<li draggable="true"/);
  });

  const product = mono;
  const values = renderToStaticMarkup(<ProductValues pv={withCatalogue} product={product} mode="basic" />);

  it('asks the basic questions about an installed product, and offers to save it as new', () => {
    const html = values;
    expect(html).toContain('What does it cost per kWp?');
    expect(html).toContain('How many years does it last?');
    expect(html).not.toContain('System losses');
    expect(html).toContain('Changes to Demo Mono 420 W apply to this building only.');
    expect(html).toContain('Save as a new technology');
    expect(html).toContain('value="Demo Mono 420 W (copy)"');
  });

  it('adds every simulation value the product carries in expert mode, and never an unused one', () => {
    const expert = renderToStaticMarkup(<ProductValues pv={withCatalogue} product={product} mode="expert" />);
    expect(expert).toContain('System losses');
    expect(expert).not.toContain('cont_export_cap');
  });
});

describe('PvSurfaceSection', () => {
  it('offers the usable share as a percentage only on an installed surface', () => {
    const installed = renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} />);
    const suggested = renderToStaticMarkup(<PvSurfaceSection surfaceId="r2" surface={pv.surfaces.r2} pv={pv} />);
    expect(installed).toContain('Usable share');
    expect(installed).toContain('value="60"');
    expect(suggested).not.toContain('Usable share');
  });

  it('shows the surface geometry from the 3D model and offers to add PV to a suggested surface', () => {
    const html = renderToStaticMarkup(<PvSurfaceSection surfaceId="r2" surface={pv.surfaces.r2} pv={pv} elements={elements} onClose={() => {}} />);
    expect(html).toContain('35°');
    expect(html).toContain('0° N');
    expect(html).toContain('40 m²');
    expect(html).toContain('Add PV to this surface');
  });

  it('says PV follows the 3D model when the surface\'s tilt was edited for BuEM', () => {
    const edited = { ...elements, r1: { ...elements.r1, tilt: 10, defaultTilt: 35, defaultAzimuth: 180 } };
    expect(renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={edited} />))
      .toContain('PV follows the 3D model&#x27;s 35°');
    expect(renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} />))
      .not.toContain('PV follows the 3D model');
  });

  it('calls a flat roof flat and gives it no facing', () => {
    const html = renderToStaticMarkup(<PvSurfaceSection surfaceId="f1" surface={pv.surfaces.r1} pv={pv} elements={elements} />);
    expect(html).toContain('>Flat<');
    expect(html).not.toContain('Facing');
  });

  it('shows the module count, the mounting choice on a flat roof only, and the format', () => {
    const onFlat = renderToStaticMarkup(<PvSurfaceSection surfaceId="f1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={flush} />);
    const onPitched = renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={flush} />);
    expect(onPitched).toContain('Modules: 24 · 9.6 kWp · 48 m²');
    expect(onFlat).toContain('>Racked<');
    expect(onPitched).not.toContain('>Racked<');
    for (const label of ['Best fit', 'Portrait', 'Landscape']) expect(onPitched).toContain(`>${label}<`);
    expect(onPitched).toMatch(/font-semibold[^"]*"[^>]*>Best fit</);
  });

  it('offers the panel tilt and facing of a racked surface, and the way back to flush', () => {
    const html = renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={racked} />);
    expect(html).toContain('>Flush<');
    expect(html).toContain('Panel tilt');
    expect(html).toContain('value="15"');
    expect(html).toContain('Panel facing');
  });

  it('says when the surface\'s space, not the usable share, limits the modules', () => {
    const html = renderToStaticMarkup(
      <PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={{ ...flush, capped: false }} />,
    );
    expect(html).toContain('The space on this surface limits the modules; a larger usable share adds none.');
    const capped = renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={flush} />);
    expect(capped).not.toContain('limits the modules');
  });

  it('says when no whole module fits', () => {
    const html = renderToStaticMarkup(
      <PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={{ ...flush, count: 0, kwp: 0, area: 0 }} />,
    );
    expect(html).toContain('No whole module fits on this surface.');
  });

  it("shows the product, the investment, and a product that fits more on the surface", () => {
    // 3.3 m by 2.2 m: one Mono module fits, two of the smaller Compact.
    const polygon: SurfacePolygon = { id: 'r1', type: 'RoofSurface', coordinates: [[[0, 0, 3], [3.3, 0, 3], [3.3, 2.2, 3], [0, 2.2, 3], [0, 0, 3]]] };
    const surface = { ...pv.surfaces.r1, usableShare: 1, mounting: { kind: 'flush' as const } };
    const one: PvLayout = { ...flush, count: 1, kwp: 0.42, area: 2 };
    const html = renderToStaticMarkup(
      <PvSurfaceSection surfaceId="r1" surface={surface} pv={withCatalogue} elements={elements} layout={one} polygon={polygon} />,
    );
    expect(html).toMatch(/<option value="mono" selected="">Demo Mono 420 W<\/option>/);
    expect(html).toContain('Investment about 210 EUR, an estimate');
    expect(html).toContain('Fits more here');
    expect(html).toContain('Demo Compact 300 W');
    expect(html).toContain('Modules: 2 · 0.6 kWp · 600 EUR/kWp');
    expect(html).toContain('Use on this surface');
  });
});
