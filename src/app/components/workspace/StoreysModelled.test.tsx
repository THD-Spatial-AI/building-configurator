import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreysModelled, pickInSelection, toggleSelected, withStoreys } from './StoreysModelled';

const render = (props: Partial<Parameters<typeof StoreysModelled>[0]>) => renderToStaticMarkup(
  <StoreysModelled storeys={3} modelled={[1, 2]} selected={[]} onSelect={() => {}} floorAreaPerStorey={80} roomHeight={2.5} onChange={() => {}} {...props} />,
);

describe('StoreysModelled', () => {
  it('names each storey in or out of the model and shows the floor area modelled', () => {
    const html = render({});
    expect(html).toContain('aria-label="Storey 1, in the model"');
    expect(html).toContain('aria-label="Storey 3, left out"');
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
    expect(render({ dwellings: { values: { 1: 2 }, onChange: () => {} } })).toContain('Missing: storey 2.');
  });

  it('says when the model\'s storeys are much taller or lower than BuEM\'s room height', () => {
    expect(render({ storeyHeight: 3.4 })).toContain('a storey is 3.4 m tall; BuEM uses a room height of 2.5 m');
    expect(render({ storeyHeight: 2.8 })).not.toContain('room height');
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
