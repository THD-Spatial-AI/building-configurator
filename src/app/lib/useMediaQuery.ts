// Viewport queries that decide layout structure, not just styling: on a narrow
// screen the load profile moves inside the details panel and the surface editor
// docks to the bottom edge, neither of which a CSS breakpoint can express.

import { useEffect, useState } from 'react';

/**
 * Wide enough for the building view's side-by-side layout: the 3D model beside
 * a details panel. A tablet in portrait is not, and stacks instead.
 */
export const WIDE_LAYOUT = '(min-width: 1024px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
