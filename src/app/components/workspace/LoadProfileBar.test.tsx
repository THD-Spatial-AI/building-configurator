import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadProfileBar } from './LoadProfileBar';
import { profileCsv } from '../../lib/loadProfile';

describe('LoadProfileBar', () => {
  it('keeps the coming-soon note behind the Upload button until it is hovered, focused or clicked', () => {
    const html = renderToStaticMarkup(<LoadProfileBar />);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toMatch(/role="tooltip"[^>]*class="[^"]*\bhidden group-hover:block[^"]*"[^>]*>Custom consumption profile uploads will be available soon\./);
  });

  it('says the profile is simulated before a run, and offers a download once there is one', () => {
    expect(renderToStaticMarkup(<LoadProfileBar />)).toContain('Simulated after Save &amp; Preview');
    expect(renderToStaticMarkup(<LoadProfileBar />)).not.toContain('Download');
    const hour = { timestamp: '2018-01-01T00:00', heating: 2, hotwater: 0.5, electricity: 0.4, dhw: 0.3, kitchen: 0.1 };
    expect(renderToStaticMarkup(<LoadProfileBar timeseries={[hour]} />)).toMatch(/<button[^>]*>.*Download<\/button>/);
  });

  it('writes the five profiles as one CSV, cooling from the hotwater field', () => {
    const hour = { timestamp: '2018-01-01T00:00', heating: 2, hotwater: 0.5, electricity: 0.4, dhw: 0.3, kitchen: 0.1 };
    expect(profileCsv([hour])).toBe('timestamp,heating_kwh,cooling_kwh,electricity_kwh,hot_water_kwh,cooking_gas_kwh\n2018-01-01T00:00,2,0.5,0.4,0.3,0.1');
  });
});
