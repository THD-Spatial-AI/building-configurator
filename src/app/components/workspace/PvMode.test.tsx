import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PvPanel, PvSurfaceCard, pvRenderSets, type PvMode } from './PvMode';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';
import type { PvLayout } from '../../lib/pvLayout';

const elements: Record<string, BuildingElement> = {
  r1: { id: 'r1', label: 'Roof south', type: 'roof', area: 40, uValue: 0.2, gValue: null, tilt: 35, azimuth: 180 },
  r2: { id: 'r2', label: 'Roof north', type: 'roof', area: 40, uValue: 0.2, gValue: null, tilt: 35, azimuth: 0 },
  w1: { id: 'w1', label: 'Wall west', type: 'wall', area: 25, uValue: 0.3, gValue: null, tilt: 90, azimuth: 270 },
};

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

describe('pvRenderSets', () => {
  it('draws panels on installed surfaces and highlights suggested ones only', () => {
    const { installed, suggested } = pvRenderSets(pv.surfaces);
    expect([...installed]).toEqual(['r1']);
    expect([...suggested]).toEqual(['r2']);
  });
});

describe('PvPanel', () => {
  const html = renderToStaticMarkup(<PvPanel pv={pv} elements={elements} onSelect={() => {}} />);

  it("shows the host's notice and PV type", () => {
    expect(html).toContain(pv.notice);
    expect(html).toContain(pv.typeLabel);
  });

  it('lists installed, then suggested, then available surfaces', () => {
    const order = ['Roof south', 'Roof north', 'Wall west'].map((name) => html.indexOf(name));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('PvPanel surface names', () => {
  it("uses the element's label, else the host's label, else the id", () => {
    const html = renderToStaticMarkup(
      <PvPanel
        pv={{
          ...pv,
          surfaces: {
            r1: { state: 'installed', usableShare: 0.6, maxKwp: 7.2, label: 'Ignored host label' },
            n1: { state: 'available', usableShare: 0.5, maxKwp: 8.3, label: 'Roof on another 3D building (2 of 7), south, 30°' },
            n2: { state: 'available', usableShare: 0.5, maxKwp: 1.0 },
          },
        }}
        elements={elements}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('Roof south');
    expect(html).not.toContain('Ignored host label');
    expect(html).toContain('Roof on another 3D building (2 of 7), south, 30°');
    expect(html).toContain('>n2<');
    expect(html).not.toContain('> · 8.3 kWp');
  });
});

describe('PvSurfaceCard', () => {
  it('offers the usable share as a percentage only on an installed surface', () => {
    const installed = renderToStaticMarkup(<PvSurfaceCard surfaceId="r1" surface={pv.surfaces.r1} pv={pv} />);
    const suggested = renderToStaticMarkup(<PvSurfaceCard surfaceId="r2" surface={pv.surfaces.r2} pv={pv} />);
    expect(installed).toContain('Usable share');
    expect(installed).toContain('value="60"');
    expect(suggested).not.toContain('Usable share');
  });
});

describe('PvPanel layout', () => {
  const html = renderToStaticMarkup(<PvPanel pv={pv} elements={elements} onSelect={() => {}} />);

  it('titles the panel and says how to add PV', () => {
    expect(html).toContain('PV configurator');
    expect(html).toContain('Click a roof or wall to add PV. Click it again to remove it.');
  });

  it('sums the installed capacity and panel area and counts the surfaces with PV', () => {
    expect(html).toContain('7.2 kWp');
    expect(html).toContain('1 of 3');
    expect(html).toContain('24 m²');
  });

  it('gives each surface its geometry, and the reachable capacity where it has no PV', () => {
    expect(html).toContain('35° · facing 180° · 40 m²');
    expect(html).toContain('up to 4.1 kWp');
    expect(html).toContain('Suggested');
  });

  it('offers to use the suggested surfaces only when there are any', () => {
    expect(html).toContain('Use suggested surfaces');
    const none = renderToStaticMarkup(
      <PvPanel pv={{ ...pv, surfaces: { r1: pv.surfaces.r1 } }} elements={elements} onSelect={() => {}} />,
    );
    expect(none).toMatch(/<button[^>]*disabled=""[^>]*>Use suggested surfaces/);
  });
});

describe('PvSurfaceCard layout', () => {
  it('shows the surface geometry from the 3D model and offers to add PV to a suggested surface', () => {
    const html = renderToStaticMarkup(
      <PvSurfaceCard surfaceId="r2" surface={pv.surfaces.r2} pv={pv} elements={elements} onClose={() => {}} />,
    );
    expect(html).toContain('35°');
    expect(html).toContain('0° N');
    expect(html).toContain('40 m²');
    expect(html).toContain('Add PV to this surface');
  });

  it('shows the panels on an installed surface and offers to remove them', () => {
    const html = renderToStaticMarkup(
      <PvSurfaceCard surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} onClose={() => {}} />,
    );
    expect(html).toContain('7.2 kWp on 24 m² of panels');
    expect(html).toContain('Remove PV');
    expect(html).toContain('Done');
  });
});

describe('PV with module layouts', () => {
  const flush: PvLayout = {
    count: 24, kwp: 9.6, area: 48, tilt: 35, azimuth: 180,
    mounting: { kind: 'flush' }, orientation: 'portrait', modules: [],
  };
  const racked: PvLayout = { ...flush, tilt: 15, mounting: { kind: 'racked', tilt: 15, azimuth: 180 } };

  it('takes capacity and panel area from the layouts in the panel', () => {
    const html = renderToStaticMarkup(<PvPanel pv={pv} elements={elements} layouts={{ r1: flush }} onSelect={() => {}} />);
    expect(html).toContain('9.6 kWp');
    expect(html).toContain('48 m²');
    expect(html).not.toContain('7.2 kWp');
  });

  it('shows the module count and offers mounting and orientation in the card', () => {
    const html = renderToStaticMarkup(
      <PvSurfaceCard surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={flush} />,
    );
    expect(html).toContain('Modules: 24 · 9.6 kWp · 48 m²');
    for (const label of ['Flush', 'Racked', 'Best fit', 'Portrait', 'Landscape']) expect(html).toContain(`>${label}<`);
    // No orientation chosen, so best fit is the active choice, whatever the layout picked.
    expect(html).toMatch(/font-semibold[^"]*"[^>]*>Best fit</);
    expect(html).not.toContain('Panel tilt');
  });

  it('offers the panel tilt and facing of a racked surface', () => {
    const html = renderToStaticMarkup(
      <PvSurfaceCard surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={racked} />,
    );
    expect(html).toContain('Panel tilt');
    expect(html).toContain('value="15"');
    expect(html).toContain('Panel facing');
  });

  it('says when no whole module fits', () => {
    const html = renderToStaticMarkup(
      <PvSurfaceCard surfaceId="r1" surface={pv.surfaces.r1} pv={pv} elements={elements} layout={{ ...flush, count: 0, kwp: 0, area: 0 }} />,
    );
    expect(html).toContain('No whole module fits on this surface.');
  });
});
