import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PvPanel, PvSurfaceCard, pvRenderSets, type PvMode } from './PvMode';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';

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
