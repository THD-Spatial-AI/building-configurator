import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfaceQuickEditor } from './SurfaceQuickEditor';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';

const flat: BuildingElement = { id: 'f1', label: 'Flat roof', type: 'roof', area: 51, uValue: 0.2, gValue: null, tilt: 0, azimuth: -1 };
const pitched: BuildingElement = { ...flat, id: 'r1', tilt: 35, azimuth: 180 };

const render = (element: BuildingElement) => renderToStaticMarkup(
  <SurfaceQuickEditor element={element} uValuePresets={[]} onUpdate={() => {}} onDelete={() => {}} />,
);

describe('SurfaceQuickEditor', () => {
  it('calls a flat roof flat instead of giving it a compass facing', () => {
    const html = render(flat);
    expect(html).toContain('>Flat<');
    expect(html).not.toContain('° N');
  });

  it('gives a pitched roof its facing dial', () => {
    expect(render(pitched)).not.toContain('>Flat<');
  });
});
