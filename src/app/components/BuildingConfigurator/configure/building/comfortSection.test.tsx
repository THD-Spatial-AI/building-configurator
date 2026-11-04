import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComfortSection } from './comfortSection';
import { DEFAULT_GENERAL } from '../../shared/buildingDefaults';
import { TOPICS } from '@/app/config/topics';

const render = (include_dhw: boolean) => renderToStaticMarkup(
  <ComfortSection general={{ ...DEFAULT_GENERAL, buildingType: 'Single-family House', include_dhw }} setGen={() => {}} mode="simple" />,
);
const button = (html: string, label: string) => new RegExp(`<button[^>]*class="([^"]*)"[^>]*>${label}</button>`).exec(html)?.[1] ?? '';

describe('the cooling setpoint', () => {
  const cooling = (comfortT_ub: number) => {
    const html = renderToStaticMarkup(
      <ComfortSection general={{ ...DEFAULT_GENERAL, buildingType: 'Single-family House', comfortT_lb: 20, comfortT_ub }} setGen={() => {}} mode="advanced" />,
    );
    return /<input[^>]*aria-label="Cooling setpoint"[^>]*>/.exec(html)?.[0] ?? '';
  };

  it('is marked while it is not above the heating setpoint', () => {
    expect(cooling(19)).toContain('aria-invalid="true"');
    expect(cooling(26)).not.toContain('aria-invalid');
  });
});

describe('the hot water choice', () => {
  it('fills Included in the heat colour while it is chosen, and leaves Not included plain', () => {
    expect(button(render(true), 'Included')).toContain(TOPICS.heat.tile);
    expect(button(render(false), 'Not included')).toContain('bg-card');
    expect(button(render(false), 'Not included')).not.toContain(TOPICS.heat.tile);
  });
});
