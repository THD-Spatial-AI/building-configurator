import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { pvRenderSets, surfaceProduct, type PvMode } from './PvMode';
import { NoMatch, ProductValues, PvOverview } from './PvOverview';
import { PvSurfaceSection } from './PvSurfaceSection';
import { TechnologiesTab } from './TechnologiesTab';
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
  count: 24, fits: 24, kwp: 9.6, area: 48, capped: true, tilt: 35, azimuth: 180,
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
  const html = renderToStaticMarkup(<PvOverview pv={pv} elements={elements} mode="simple" onSelect={() => {}} />);

  it("shows the title, the host's notice and PV type", () => {
    expect(html).toContain('PV on this building');
    expect(html).toContain(pv.notice);
    expect(html).toContain(pv.typeLabel);
  });

  it('explains how to add PV as one bullet per method, naming the controls in bold, closed once there is PV', () => {
    expect(html).toMatch(/<details class="group[^"]*sky[^"]*"><summary/);
    expect(html).toContain('How to add PV');
    expect(html).toContain('<li><b class="font-semibold">Drag:</b> Open <b class="font-semibold">Photovoltaic options</b> and drag a product onto a roof or wall.</li>');
    expect(html).toContain('In <b class="font-semibold">Available surfaces for PV</b>, click <b class="font-semibold">Add PV to roofs</b> and choose every roof surface or only those marked <b class="font-semibold">Suggested for PV</b>.');
    const none = renderToStaticMarkup(
      <PvOverview pv={{ ...pv, surfaces: { r2: pv.surfaces.r2 } }} elements={elements} mode="simple" onSelect={() => {}} />,
    );
    expect(none).toMatch(/<details open="" class="group[^"]*sky/);
    expect(none).toContain('No PV installed yet.');
  });

  it('sums the installed capacity and counts the surfaces with PV', () => {
    expect(html).toContain('7.2 kWp');
    expect(html).toContain('1 of 3');
    expect(html).toContain('Available surfaces for PV (1 of 3 with PV)');
  });

  it('offers only the surfaces some PV option fits on, and any with PV on', () => {
    const offered = renderToStaticMarkup(
      <PvOverview pv={pv} available={new Set(['r2'])} elements={elements} mode="simple" onSelect={() => {}} />,
    );
    expect(offered).toContain('Available surfaces for PV (1 of 2 with PV)');
    expect(offered).toContain('Roof north');
    expect(offered).not.toContain('Wall west');
  });

  it('groups the surfaces into roofs, then walls, each in its own order', () => {
    const surfaces = { w1: { ...pv.surfaces.w1, state: 'installed' as const }, r2: pv.surfaces.r2, f1: { state: 'available' as const, usableShare: 0.6, maxKwp: 8 } };
    const grouped = renderToStaticMarkup(<PvOverview pv={{ ...pv, surfaces }} elements={elements} mode="simple" onSelect={() => {}} />);
    const at = (text: string) => grouped.indexOf(text);
    expect(at('>Roofs<')).toBeGreaterThan(-1);
    expect([at('>Roofs<'), at('Roof north'), at('Flat roof'), at('>Walls<'), at('Wall west')]).toEqual(
      [at('>Roofs<'), at('Roof north'), at('Flat roof'), at('>Walls<'), at('Wall west')].sort((a, b) => a - b),
    );
  });

  it('lists installed, then suggested, then available surfaces, with their geometry', () => {
    const order = ['Roof south', 'Roof north', 'Wall west'].map((name) => html.indexOf(name));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('35° · facing 180° · 40 m²');
    expect(html).toContain('up to 4.1 kWp');
  });

  it('adds PV to every roof surface or only the suggested ones, never to a wall', () => {
    const surfaces = { ...pv.surfaces, f1: { state: 'available' as const, usableShare: 0.6, maxKwp: 8 } };
    const roofs = renderToStaticMarkup(<PvOverview pv={{ ...pv, surfaces }} elements={elements} mode="simple" onSelect={() => {}} />);
    expect(roofs).toMatch(/<summary[^>]*>(?:(?!<\/summary>).)*Available surfaces for PV(?:(?!<\/summary>).)*Add PV to roofs(?:(?!<\/summary>).)*All roof surfaces \(2\)(?:(?!<\/summary>).)*<\/summary>/);
    expect(roofs).toContain('>All roof surfaces (2)</button>');
    expect(roofs).toContain('>Best roof surfaces only (1)</button>');
    expect(roofs).not.toContain('Use suggested surfaces');
  });

  it("counts a surface of the building's other 3D parts as a roof by its tilt, and a vertical one as a wall", () => {
    const surfaces = {
      n1: { state: 'available' as const, usableShare: 0.6, maxKwp: 5, label: 'Annex roof', tilt: 30, azimuth: 180, area: 30 },
      n2: { state: 'available' as const, usableShare: 0.6, maxKwp: 3, label: 'Annex wall', tilt: 90, azimuth: 180, area: 20 },
    };
    const html = renderToStaticMarkup(<PvOverview pv={{ ...pv, surfaces }} elements={elements} mode="simple" onSelect={() => {}} />);
    expect(html).toContain('>All roof surfaces (1)</button>');
  });

  it('offers neither roof choice once every roof surface has PV', () => {
    const none = renderToStaticMarkup(
      <PvOverview pv={{ ...pv, surfaces: { r1: pv.surfaces.r1, w1: pv.surfaces.w1 } }} elements={elements} mode="simple" onSelect={() => {}} />,
    );
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>All roof surfaces \(0\)/);
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>Best roof surfaces only \(0\)/);
  });

  it('shows no costs, catalogue or values without products', () => {
    expect(html).not.toContain('Investment');
    expect(html).not.toContain('Catalogue');
    expect(html).not.toContain('Technology values');
  });
});

describe('PvOverview with a catalogue', () => {
  const html = renderToStaticMarkup(
    <PvOverview pv={withCatalogue} elements={elements} layouts={{ r1: flush }} mode="simple" onSelect={() => {}} />,
  );

  it('estimates investment and O&M from the products and the layouts', () => {
    expect(html).toContain('9.6 kWp');
    expect(html).toContain('4,800 EUR');
    expect(html).toContain('96 EUR');
    expect(html).toContain('Estimates from the products');
  });

  it('lists the installed products with their modules and capacity, the catalogue closed behind a drop-down once there is PV', () => {
    const installed = html.slice(html.indexOf('Installed on this building'));
    expect(installed).toContain('Demo Mono 420 W');
    expect(installed).not.toContain('Demo Compact 300 W');
    expect(installed).toContain('24 modules');
    expect(installed).toContain('on 1 surface');
    expect(html).toMatch(/<details class="group[^"]*"><summary[^>]*><span[^>]*>Photovoltaic options \(2\)/);
  });

  it('orders the card: totals, how to add PV, the options, the surfaces, then what is installed', () => {
    const order = ['Investment', 'How to add PV', 'Photovoltaic options (', 'Available surfaces for PV (', 'Installed on this building'].map((text) => html.indexOf(text));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('opens the catalogue while no surface has PV, so its products can be dragged straight away', () => {
    const empty = renderToStaticMarkup(
      <PvOverview pv={{ ...withCatalogue, surfaces: { r2: pv.surfaces.r2 } }} elements={elements} mode="simple" onSelect={() => {}} />,
    );
    expect(empty).toMatch(/<details open="" class="group[^"]*"><summary[^>]*><span[^>]*>Photovoltaic options \(2\)/);
  });

  it('keeps the search and sort behind their icons until asked for', () => {
    const empty = renderToStaticMarkup(
      <PvOverview pv={{ ...withCatalogue, surfaces: { r2: pv.surfaces.r2 } }} elements={elements} mode="simple" onSelect={() => {}} />,
    );
    expect(empty).toMatch(/<button[^>]*aria-label="Search the photovoltaic options"[^>]*aria-expanded="false"/);
    expect(empty).toMatch(/<button[^>]*aria-label="Sort by"[^>]*aria-expanded="false"/);
    expect(empty).not.toContain('type="search"');
    expect(empty).not.toContain('<select');
  });

  it('says when no option matches the search, and offers to clear it', () => {
    const html = renderToStaticMarkup(<NoMatch query="mono" onClear={() => {}} />);
    expect(html).toContain('No photovoltaic option matches “mono”.');
    expect(html).toMatch(/<button[^>]*>Clear the search<\/button>/);
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
  const values = renderToStaticMarkup(<ProductValues pv={withCatalogue} product={product} mode="simple" />);

  it('asks the simple-mode questions about an installed product, and offers to save it as new', () => {
    const html = values;
    expect(html).toContain('What does it cost per kWp?');
    expect(html).toContain('How many years does it last?');
    expect(html).not.toContain('System losses');
    expect(html).toContain('Changes to Demo Mono 420 W apply to this building only.');
    expect(html).toContain('Save as a new technology');
    expect(html).toContain('value="Demo Mono 420 W (copy)"');
  });

  it('adds every simulation value the product carries in advanced mode, and never an unused one', () => {
    const advanced = renderToStaticMarkup(<ProductValues pv={withCatalogue} product={product} mode="advanced" />);
    expect(advanced).toContain('System losses');
    expect(advanced).not.toContain('cont_export_cap');
  });
});

describe('PvSurfaceSection', () => {
  it("shows the values of an installed surface's product where the host takes changes, and none before PV is on", () => {
    const installed = renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={withCatalogue} mode="simple" />);
    expect(installed).toContain('What does it cost per kWp?');
    expect(installed).toContain('Changes to Demo Mono 420 W apply to this building only.');
    const off = renderToStaticMarkup(<PvSurfaceSection surfaceId="r2" surface={pv.surfaces.r2} pv={withCatalogue} mode="simple" />);
    expect(off).not.toContain('What does it cost per kWp?');
    const readOnly = renderToStaticMarkup(
      <PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={{ ...withCatalogue, onConstraintChange: undefined }} mode="simple" />,
    );
    expect(readOnly).not.toContain('What does it cost per kWp?');
  });

  it('offers the usable share as a percentage only on an installed surface', () => {
    const installed = renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} />);
    const suggested = renderToStaticMarkup(<PvSurfaceSection surfaceId="r2" surface={pv.surfaces.r2} pv={pv} />);
    expect(installed).toContain('Usable share');
    expect(installed).toContain('value="60"');
    expect(suggested).not.toContain('Usable share');
  });

  it('shows the surface geometry from the 3D model and only the Install switch before PV is on', () => {
    const html = renderToStaticMarkup(<PvSurfaceSection surfaceId="r2" surface={pv.surfaces.r2} pv={pv} elements={elements} onClose={() => {}} />);
    expect(html).toContain('35°');
    expect(html).toContain('0° N');
    expect(html).toContain('40 m²');
    expect(html).toContain('aria-label="Install"');
    expect(html).not.toContain('up to');
    expect(html).not.toContain('Usable share');
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
    expect(onPitched).toMatch(/>Modules<\/th><td[^>]*>24<\/td>/);
    expect(onPitched).toContain('>9.6 kWp<');
    expect(onPitched).toContain('>48 m²<');
    expect(onFlat).toContain('>Racked<');
    expect(onPitched).not.toContain('>Racked<');
    for (const label of ['Best fit', 'Portrait', 'Landscape']) expect(onPitched).toContain(`>${label}<`);
    expect(onPitched).toMatch(/aria-pressed="true"[^>]*>Best fit</);
  });

  it('offers the module count, up to what fits, where the host stores it', () => {
    const withCount = renderToStaticMarkup(
      <PvSurfaceSection surfaceId="r1" surface={{ ...pv.surfaces.r1, moduleCount: 10 }} pv={{ ...pv, onModuleCountChange: () => {} }} elements={elements} layout={{ ...flush, count: 10 }} />,
    );
    expect(withCount).toContain('Modules (up to 24)');
    expect(withCount).toMatch(/aria-label="Modules \(up to 24\)"[^>]*value="10"/);
    const without = renderToStaticMarkup(<PvSurfaceSection surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={flush} />);
    expect(without).not.toContain('Modules (up to');
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
    const one: PvLayout = { ...flush, count: 1, fits: 1, kwp: 0.42, area: 2 };
    const html = renderToStaticMarkup(
      <PvSurfaceSection surfaceId="r1" surface={surface} pv={withCatalogue} elements={elements} layout={one} polygon={polygon} />,
    );
    expect(html).toMatch(/<option value="mono" selected="">Demo Mono 420 W<\/option>/);
    expect(html).toMatch(/>Investment, estimated<\/th><td[^>]*>210 EUR<\/td>/);
    expect(html).toMatch(/<details class="group[^"]*"><summary[^>]*><svg[^>]*>.*?<\/svg><span[^>]*>See our recommendation \(1\)/);
    expect(html).toContain('Demo Compact 300 W');
    expect(html).toContain('Modules: 2 · 0.6 kWp · 600 EUR/kWp');
    expect(html).toContain('Use on this surface');
  });
});

describe('removing PV from the building', () => {
  const layouts = { r1: flush };
  const tab = (surfaces: PvMode['surfaces']) => renderToStaticMarkup(
    <TechnologiesTab pv={{ ...withCatalogue, surfaces }} elements={elements} layouts={layouts} mode="simple" onSelectSurface={() => {}} />,
  );

  it('offers a bin per installed product and one for all PV', () => {
    const html = tab(pv.surfaces);
    expect(html).toContain('aria-label="Remove all PV from this building"');
    expect(html).toContain('aria-label="Remove Demo Mono 420 W from every surface"');
  });

  it('shows the building as the host passes it: with no PV installed, nothing to remove', () => {
    const html = tab({ r1: { state: 'suggested', usableShare: 0.6, maxKwp: 7.2 } });
    expect(html).not.toContain('Remove all PV');
    expect(html).toContain('No PV installed yet.');
  });

  it('offers to remove the PV technology itself while the host takes it, even with no PV installed', () => {
    const html = renderToStaticMarkup(
      <TechnologiesTab
        pv={{ ...withCatalogue, surfaces: { r1: { state: 'suggested', usableShare: 0.6, maxKwp: 7.2 } }, onRemove: () => {} }}
        elements={elements} layouts={layouts} mode="simple" onSelectSurface={() => {}}
      />,
    );
    expect(html).toContain('aria-label="Remove all PV from this building"');
  });

  it('shows the PV investment once in its tile and in the total, not again in the card header', () => {
    const html = tab(pv.surfaces);
    expect(html.match(/4,800 EUR/g)).toHaveLength(2);
    expect(html).toMatch(/>4,800 EUR<\/div><div[^>]*>Investment</);
  });

  it('pins the total to the bottom of the panel, below the cards however few there are', () => {
    const html = tab(pv.surfaces);
    expect(html).toMatch(/^<div class="flex flex-1 flex-col gap-2.5">/);
    expect(html).toMatch(/<div class="sticky bottom-0 [^"]*mt-auto[^"]*"><div[^>]*><span[^>]*>Estimated total cost of technologies/);
  });

  it("names PV without a product after the building's PV type, not as a product to choose", () => {
    const html = renderToStaticMarkup(
      <TechnologiesTab pv={pv} elements={elements} layouts={layouts} mode="simple" onSelectSurface={() => {}} />,
    );
    expect(html).toContain('aria-label="Remove Monocrystalline 400 W from every surface"');
    expect(html).not.toContain('Choose a product');
  });
});
