import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OccupancySection } from './householdSections';
import { DEFAULT_GENERAL } from '../../shared/buildingDefaults';

const render = (mode: 'basic' | 'expert', region_code = '') => renderToStaticMarkup(
  <OccupancySection general={{ ...DEFAULT_GENERAL, country: 'NL', region_code }} setGen={() => {}} mode={mode} />,
);

describe('the region code', () => {
  it('is asked for in Expert only', () => {
    expect(render('basic')).not.toContain('Region code');
    expect(render('expert')).toContain('Region code');
  });

  it('is optional: empty, the field shows its example and no warning', () => {
    const html = render('expert');
    expect(html).toContain('placeholder="e.g. GM0200"');
    expect(html).not.toContain('text-destructive');
    expect(render('expert', 'GM0200')).toContain('value="GM0200"');
  });
});
