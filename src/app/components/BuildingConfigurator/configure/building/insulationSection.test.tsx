import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatNumber, translate, type FormatNumber, type Translate } from '@/app/i18n';
import { InsulationSection, insulationSummary, type InsulationProps } from './insulationSection';

const t: Translate = (key, values) => translate('en', key, values);
const format: FormatNumber = (value, digits) => formatNumber('en', value, digits);

const STATES = { wall: 1, window: 1, roof: 1, floor: 1, door: 1 };

const insulation: InsulationProps = {
  elements: {}, levels: [], states: STATES, initial: STATES, variantCode: 'NL.N.SFH.05.Gen', avgUValue: 0.27,
  onSetState: () => {}, onSetTypeUValue: () => {}, onSetTypeLossFactor: () => {},
};

describe('the energy grade in Basic and Expert', () => {
  it('names the average U-value in the header in Expert only', () => {
    expect(insulationSummary(t, format, insulation, 'basic')).not.toContain('average U');
    expect(insulationSummary(t, format, insulation, 'expert')).toContain('average U 0.27');
  });

  it('shows the average U-value line in Expert only', () => {
    const render = (mode: 'basic' | 'expert') =>
      renderToStaticMarkup(<InsulationSection {...insulation} general={{}} setGen={() => {}} mode={mode} />);
    expect(render('basic')).not.toContain('Average U-value');
    expect(render('expert')).toContain('Average U-value');
  });
});

describe('the element types in Expert', () => {
  const elements = {
    w1: { id: 'w1', label: 'Wall', type: 'wall', area: 30, uValue: 0.22, gValue: null, tilt: 90, azimuth: 180 },
    win: { id: 'win', label: 'Window', type: 'window', area: 4, uValue: 1.1, gValue: 0.5, tilt: 90, azimuth: 180, parentId: 'w1' },
  } as InsulationProps['elements'];
  const html = renderToStaticMarkup(<InsulationSection {...insulation} elements={elements} general={{}} setGen={() => {}} mode="expert" />);

  it('lays them out as one table, the units in its header', () => {
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).toContain('W/m²K</span></th>');
    expect(html).toContain('0 to 1</span></th>');
  });

  it('names each field for its type, with a loss factor for opaque surfaces only', () => {
    expect(html).toContain('aria-label="Walls: U-value"');
    expect(html).toContain('aria-label="Walls: Loss factor"');
    expect(html).toContain('aria-label="Windows: U-value"');
    expect(html).not.toContain('aria-label="Windows: Loss factor"');
  });
});
