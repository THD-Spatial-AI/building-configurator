import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreysModelled } from './StoreysModelled';

const render = (props: Partial<Parameters<typeof StoreysModelled>[0]>) => renderToStaticMarkup(
  <StoreysModelled storeys={3} modelled={[1, 2]} floorAreaPerStorey={80} roomHeight={2.5} onChange={() => {}} {...props} />,
);

describe('StoreysModelled', () => {
  it('marks the storeys modelled and shows their floor area', () => {
    const html = render({});
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html).toContain('2 × 80 m² = 160 m²');
  });

  it('says when the model\'s storeys are much taller or lower than BuEM\'s room height', () => {
    expect(render({ storeyHeight: 3.4 })).toContain('a storey is 3.4 m tall; BuEM uses a room height of 2.5 m');
    expect(render({ storeyHeight: 2.8 })).not.toContain('room height');
  });
});
