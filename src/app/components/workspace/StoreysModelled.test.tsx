import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreysModelled, pickInSelection, pickWithAttic, toggleSelected, withStoreys } from './StoreysModelled';

const render = (props: Partial<Parameters<typeof StoreysModelled>[0]>) => renderToStaticMarkup(
  <StoreysModelled
    storeys={3}
    roomHeight={2.5}
    heights={{ values: {}, onChange: () => {} }}
    onStoreysChange={() => {}}
    onRoomHeightChange={() => {}}
    modelled={[1, 2]}
    selected={[]}
    onSelect={() => {}}
    floorAreaPerStorey={80}
    onChange={() => {}}
    {...props}
  />,
);

describe('StoreysModelled', () => {
  it('holds the storey count and room height, with one storey too', () => {
    const html = render({ storeys: 1, modelled: null });
    expect(html).toContain('aria-label="Storeys"');
    expect(html).toContain('aria-label="Room height"');
    expect(html).not.toContain('Storeys modelled');
  });

  it('turns the up arrows off with the reason once another step would pass the eaves', () => {
    const html = render({ modelHeight: 7.5 });
    expect(html).toContain('aria-disabled="true" title="Another storey at 2.5 m would be taller than the 3D model, which is 7.5 m to the eaves."');
    expect(html).toContain('title="A taller storey would make the storeys taller than the 3D model, which is 7.5 m to the eaves."');
    expect(render({ modelHeight: 12 })).not.toContain('aria-disabled="true"');
  });

  it('keeps storeys taller than the model as they are and says so', () => {
    const html = render({ modelHeight: 6, heights: { values: { 3: 3 }, onChange: () => {} } });
    expect(html).toContain('value="3"');
    expect(html).toContain('The storeys are 8.0 m tall together');
  });

  it('gives a selected storey its own height, with the room height as its default', () => {
    expect(render({ selected: [2] })).toContain('placeholder="2.5"');
    const own = render({ selected: [2], heights: { values: { 2: 3.2 }, onChange: () => {} } });
    expect(own).toContain('value="3.2"');
    expect(own).toContain('Use room height');
  });

  it('names each storey in or out of the model and shows the floor area modelled', () => {
    const html = render({});
    expect(html).toContain('aria-label="Storey 0, in the model"');
    expect(html).toContain('aria-label="Storey 2, left out"');
    expect(html).toContain('2 × 80 m² = 160 m²');
  });

  it('offers the in-model switch and the dwellings per storey only while storeys are selected', () => {
    const dwellings = { values: { 2: 4, 3: 4 }, onChange: () => {} };
    const none = render({ dwellings });
    expect(none).not.toContain('Dwellings per storey');
    const two = render({ dwellings, selected: [2, 3] });
    expect(two).toContain('2 storeys selected');
    expect(two).toContain('aria-label="In the model"');
    expect(two).toContain('aria-checked="false"');
    expect(two).toContain('Dwellings per storey');
    expect(two).toContain('value="4"');
  });

  it('names the modelled storeys that still need a dwelling count', () => {
    expect(render({ dwellings: { values: { 1: 2 }, onChange: () => {} } })).toContain('Missing: storey 1.');
  });
});

describe('storey selection', () => {
  it('leaves the chosen storeys out, keeps at least one, and is null when all are back', () => {
    expect(withStoreys(null, 4, [3, 4], false)).toEqual([1, 2]);
    expect(withStoreys([1], 2, [1], false)).toBeUndefined();
    expect(withStoreys([1, 2], 3, [3], true)).toBeNull();
  });

  it('adds a storey to the selection or takes it out, in order', () => {
    expect(toggleSelected([3], 1)).toEqual([1, 3]);
    expect(toggleSelected([1, 3], 3)).toEqual([1]);
  });
});

describe('a click on a storey', () => {
  it('selects that storey alone by default, and adds it while configuring several', () => {
    expect(pickInSelection([1, 2], 3, false)).toEqual([3]);
    expect(pickInSelection([3], 3, false)).toEqual([]);
    expect(pickInSelection([1], 3, true)).toEqual([1, 3]);
  });
});

describe('StoreysModelled with an attic', () => {
  const attic = { modelled: true, floorArea: null, onModelledChange: () => {}, onFloorAreaChange: () => {} };

  it('names the ground floor 0 and puts the attic after the top storey', () => {
    const html = render({ modelled: null, attic });
    const order = ['Storey 0, in the model', 'Storey 1, in the model', 'Storey 2, in the model', 'Attic, in the model'].map((label) => html.indexOf(`aria-label="${label}"`));
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]))).toBe(true);
    expect(render({ selected: [1] })).toContain('Storey 0');
  });

  it('shows the attic as its own chip, with one storey too', () => {
    const html = render({ storeys: 1, modelled: null, attic });
    expect(html).toContain('aria-label="Attic, in the model"');
    expect(render({ storeys: 1, modelled: null, attic: { ...attic, modelled: false } })).toContain('aria-label="Attic, left out"');
    expect(render({ storeys: 1, modelled: null })).not.toContain('Attic');
  });

  it('gives the selected attic its switch, floor area and dwellings, not a storey height', () => {
    const html = render({ selected: [4], attic: { ...attic, onDwellingsChange: () => {} } });
    expect(html).toContain('placeholder="Not counted"');
    expect(html).toContain('aria-label="Dwellings in the attic"');
    expect(html).not.toContain('Storey height');
    expect(render({ selected: [4], attic: { ...attic, modelled: false } })).not.toContain('Attic floor area');
  });

  it('adds a heated attic\'s floor area to the floor area modelled', () => {
    expect(render({ attic: { ...attic, floorArea: 40 } })).toContain('2 × 80 m² + 40 m² = 200 m²');
  });
});

describe('pickWithAttic', () => {
  it('selects the attic on its own, never with storeys', () => {
    expect(pickWithAttic([1, 2], 4, true, 4)).toEqual([4]);
    expect(pickWithAttic([4], 4, true, 4)).toEqual([]);
    expect(pickWithAttic([4], 2, true, 4)).toEqual([2]);
    expect(pickWithAttic([1], 2, true, 4)).toEqual([1, 2]);
  });
});

describe('StoreysModelled with a measured attic', () => {
  const attic = { modelled: true, floorArea: null, measuredArea: 25, onModelledChange: () => {}, onFloorAreaChange: () => {} };

  it('offers the measured area without counting it', () => {
    const html = render({ selected: [4], attic });
    expect(html).toContain('Use measured (25.0 m²)');
    expect(html).toContain('placeholder="Not counted"');
    expect(html).toContain('2 × 80 m² = 160 m²');
  });

  it('stops offering it once taken', () => {
    expect(render({ selected: [4], attic: { ...attic, floorArea: 25 } })).not.toContain('Use measured');
  });
});
