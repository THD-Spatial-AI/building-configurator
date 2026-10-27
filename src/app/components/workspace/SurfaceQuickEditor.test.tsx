import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { importedValues, SurfaceQuickEditor } from './SurfaceQuickEditor';
import { SectionCard } from '../BuildingConfigurator/shared/SectionCard';
import { TOPICS } from '@/app/config/topics';
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

describe('resetting a surface from its section header', () => {
  const imported: BuildingElement = { ...pitched, defaultArea: 51, defaultUValue: 0.2, defaultTilt: 35, defaultAzimuth: 180 };

  it('offers a reset only while a value differs from the imported one, and restores just those', () => {
    expect(importedValues(imported)).toBeNull();
    expect(importedValues({ ...imported, uValue: 0.5, area: 60 })).toEqual({ uValue: 0.2, area: 51 });
  });

  it('puts the reset in the header and not beside the delete button', () => {
    const header = renderToStaticMarkup(<SectionCard topic={TOPICS.envelope} title="Roof surface" onReset={() => {}} resetLabel="Reset" />);
    expect(header).toMatch(/<header[^>]*>.*aria-label="Reset".*<\/header>/);
    expect(renderToStaticMarkup(<SectionCard topic={TOPICS.envelope} title="Roof surface" />)).not.toContain('aria-label="Reset"');
    expect(render({ ...imported, uValue: 0.5 }, 'basic')).not.toContain('Reset');
  });
});
