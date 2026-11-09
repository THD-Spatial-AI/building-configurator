import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurfaceGeometryViewer } from './SurfaceGeometryViewer';

describe('SurfaceGeometryViewer', () => {
  it('offers zoom in, zoom out and a button that shows the whole building', () => {
    const html = renderToStaticMarkup(<SurfaceGeometryViewer surfaces={[]} />);
    for (const label of ['Zoom in', 'Zoom out', 'Show the whole building']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
  });
});
