import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TechnologyCards, type Technologies } from './TechnologyCards';
import { TechnologiesTab } from './TechnologiesTab';

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
      type: 'battery_storage',
      figures: [{ label: 'Power', value: 10, unit: 'kW' }, { label: 'Energy', value: 20, unit: 'kWh' }],
      investment: { amount: 12000, currency: 'EUR' },
      catalogue: {
        products: [{ id: 'li', name: 'Lithium-ion home storage', detail: '10 kW · 20 kWh' }, { id: 'lfp', name: 'LFP storage' }],
        productId: 'li',
        onSelect: () => {},
      },
      fields: [
        { key: 'cont_energy_cap_max', label: 'Max size', value: null, unit: 'kW', editable: true },
        { key: 'cont_storage_cap_max', label: 'Max energy', value: null, unit: 'kWh' },
        { key: 'power', label: 'Power', value: null, unit: 'kW', editable: true, error: 'Operate mode needs a fixed size.' },
      ],
    },
    {
      id: 'heat_pump',
      title: 'Heat pump',
      type: 'air_source_heat_pump',
      figures: [{ label: 'COP', value: 3.3 }],
      investment: { amount: null, currency: 'EUR', rate: '1,400 EUR/kW' },
      fields: [],
    },
  ],
  onChange: () => {},
  onRemove: () => {},
};

describe('TechnologyCards', () => {
  const html = renderToStaticMarkup(<TechnologyCards technologies={technologies} focusId="battery" />);

  it('shows each card with its title and a remove button, the one in focus with its action and fields', () => {
    expect(html).toContain('PV, monocrystalline');
    expect(html).toContain('aria-label="Remove Battery"');
    expect(html).toContain('In focus');
    expect(html).not.toContain('PV surfaces');
  });

  it('lists a closed card\'s figures and investment, a rate while its size is open', () => {
    expect(html).toMatch(/<dt[^>]*>COP<\/dt><dd[^>]*>3.3<\/dd><\/div><div[^>]*><dt[^>]*>Investment<\/dt><dd[^>]*>1,400 EUR\/kW<\/dd>/);
    const closed = renderToStaticMarkup(<TechnologyCards technologies={technologies} focusId={null} />);
    expect(closed).toMatch(/<dt[^>]*>Power<\/dt><dd[^>]*>10 kW<\/dd><\/div><div[^>]*><dt[^>]*>Energy<\/dt><dd[^>]*>20 kWh<\/dd><\/div><div[^>]*><dt[^>]*>Investment<\/dt><dd[^>]*>12,000 EUR<\/dd>/);
    expect(html).not.toMatch(/<dt[^>]*>Power<\/dt>/);
  });

  it('puts the products behind a drop-down with a search field', () => {
    expect(html).toMatch(/<details[^>]*><summary[^>]*><span[^>]*><span[^>]*><span[^>]*>Product: <\/span>Lithium-ion home storage/);
    expect(html).toContain('placeholder="Search the catalogue"');
    expect(html).toContain('LFP storage');
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

describe('TechnologiesTab', () => {
  it('counts the technologies, adds up the amounts but not the rates, and offers to add one', () => {
    const html = renderToStaticMarkup(
      <TechnologiesTab technologies={{ ...technologies, onAdd: () => {} }} elements={{}} layouts={{}} mode="simple" onSelectSurface={() => {}} />,
    );
    expect(html).toContain('3 technologies');
    expect(html).toMatch(/Estimated total cost of technologies<\/span><span[^>]*>12,000 EUR</);
    expect(html).toContain('Without 1 technology the optimiser sizes');
    expect(html).toContain('Add a technology');
  });
});
