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
