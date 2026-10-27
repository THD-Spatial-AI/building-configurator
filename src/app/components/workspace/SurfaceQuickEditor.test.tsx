import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfaceQuickEditor } from './SurfaceQuickEditor';
import type { BuildingElement } from '../BuildingConfigurator/configure/model/buildingElements';

const flat: BuildingElement = { id: 'f1', label: 'Flat roof', type: 'roof', area: 51, uValue: 0.2, gValue: null, tilt: 0, azimuth: -1 };
const pitched: BuildingElement = { ...flat, id: 'r1', tilt: 35, azimuth: 180 };

const render = (element: BuildingElement, mode: 'basic' | 'expert' = 'expert') => renderToStaticMarkup(
  <SurfaceQuickEditor element={element} mode={mode} onUpdate={() => {}} onDelete={() => {}} />,
);

describe('SurfaceQuickEditor', () => {
  it('calls a flat roof flat instead of giving it a compass facing', () => {
    const html = render(flat);
    expect(html).toContain('>Flat<');
    expect(html).not.toContain('° N');
  });

  it('gives a pitched roof its facing dial in Expert', () => {
    expect(render(pitched)).not.toContain('>Flat<');
    expect(render(pitched)).toContain('S-facing');
  });

  it('takes the U-value in a number field, without a slider or level buttons', () => {
    const html = render(pitched, 'basic');
    expect(html).toMatch(/<input[^>]*aria-label="U-value \(W\/m²K\)"[^>]*value="0.2"/);
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain('Existing');
  });

  it('shows tilt and facing read-only from the 3D model in Basic', () => {
    const html = render(pitched, 'basic');
    expect(html).not.toContain('S-facing');
    expect(html).toContain('Tilt</div>');
    expect(html).toContain('35° · Pitched');
    expect(html).toContain('Facing</div>');
    expect(html).toContain('180° S');
    expect(html).toContain('Source: the building&#x27;s 3D model');
  });
});
