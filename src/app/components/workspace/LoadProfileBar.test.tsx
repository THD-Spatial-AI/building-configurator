import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadProfileBar } from './LoadProfileBar';

describe('LoadProfileBar', () => {
  it('keeps the coming-soon note behind the Upload button until it is hovered, focused or clicked', () => {
    const html = renderToStaticMarkup(<LoadProfileBar />);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toMatch(/role="tooltip"[^>]*class="[^"]*\bhidden group-hover:block[^"]*"[^>]*>Uploading your own consumption profile is coming soon\./);
  });
});
