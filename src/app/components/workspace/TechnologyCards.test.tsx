import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TechnologyCards, fieldValueFromInput, type Technologies } from './TechnologyCards';

const technologies: Technologies = {
  items: [
    {
      id: 'pv',
      title: 'PV, monocrystalline',
      subtitle: '3 surfaces',
      fields: [
        { key: 'capacity', label: 'Capacity', value: 18.2, unit: 'kWp' },
        { key: 'cost', label: 'Investment', value: 1100, unit: 'EUR/kW', editable: true },
      ],
      action: { label: 'PV surfaces', onClick: () => {} },
    },
    {
      id: 'battery',
      title: 'Battery',
      fields: [
        { key: 'cont_energy_cap_max', label: 'Max size', value: null, unit: 'kW', editable: true },
        { key: 'cont_storage_cap_max', label: 'Max energy', value: null, unit: 'kWh' },
        { key: 'power', label: 'Power', value: null, unit: 'kW', editable: true, error: 'Operate mode needs a fixed size.' },
      ],
    },
  ],
  onChange: () => {},
  onRemove: () => {},
};

describe('fieldValueFromInput', () => {
  it('reports a cleared input as unbounded', () => {
    expect(fieldValueFromInput('', false)).toBeNull();
  });

  it('reports nothing while a number is half typed', () => {
    expect(fieldValueFromInput('', true)).toBeUndefined();
  });

  it('reports the number typed', () => {
    expect(fieldValueFromInput('12.5', false)).toBe(12.5);
  });
});

describe('TechnologyCards', () => {
  const html = renderToStaticMarkup(<TechnologyCards technologies={technologies} />);

  it('shows each card with its title, action and a remove button', () => {
    expect(html).toContain('PV, monocrystalline');
    expect(html).toContain('PV surfaces');
    expect(html).toContain('aria-label="Remove Battery"');
  });

  it('shows an unbounded value as ∞, and an editable one as an empty input with that placeholder', () => {
    expect(html).toMatch(/Max energy<\/span><span[^>]*>∞/);
    const input = html.match(/<input[^>]*aria-label="Max size"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('value=""');
    expect(input).toContain('placeholder="∞"');
  });

  it("shows the host's error under its field", () => {
    expect(html).toContain('Operate mode needs a fixed size.');
    expect(html).toMatch(/aria-label="Power" aria-invalid="true"/);
  });

  it('says so when there are no technologies', () => {
    const empty = renderToStaticMarkup(<TechnologyCards technologies={{ ...technologies, items: [] }} />);
    expect(empty).toContain('No technologies on this building.');
  });
});
