import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepHints } from './Guidance';

const render = (props: Partial<Parameters<typeof StepHints>[0]>) => renderToStaticMarkup(
  <StepHints surfaceOpened={false} edited={false} ran={false} {...props} />,
);

describe('StepHints', () => {
  it('names the next step from what the user has done', () => {
    expect(render({})).toContain('Click a wall, roof or floor');
    expect(render({ surfaceOpened: true })).toContain('Step 2 of 3');
    expect(render({ surfaceOpened: true, edited: true })).toContain('Save and preview');
  });

  it('is gone once a run was started', () => {
    expect(render({ edited: true, ran: true })).toBe('');
  });
});
