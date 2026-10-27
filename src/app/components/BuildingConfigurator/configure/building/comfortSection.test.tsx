import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComfortSection } from './comfortSection';
import { DEFAULT_GENERAL } from '../../shared/buildingDefaults';
import { TOPICS } from '@/app/config/topics';

const render = (include_dhw: boolean) => renderToStaticMarkup(
  <ComfortSection general={{ ...DEFAULT_GENERAL, buildingType: 'Single-family House', include_dhw }} setGen={() => {}} mode="basic" />,
);
const button = (html: string, label: string) => new RegExp(`<button[^>]*class="([^"]*)"[^>]*>${label}</button>`).exec(html)?.[1] ?? '';

describe('the hot water choice', () => {
  it('fills Included in the heat colour while it is chosen, and leaves Not included plain', () => {
    expect(button(render(true), 'Included')).toContain(TOPICS.heat.tile);
    expect(button(render(false), 'Not included')).toContain('bg-card');
    expect(button(render(false), 'Not included')).not.toContain(TOPICS.heat.tile);
  });
});
