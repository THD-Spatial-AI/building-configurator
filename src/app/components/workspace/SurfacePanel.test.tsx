import { describe, expect, it } from 'vitest';
import { groupSurfaces } from './SurfacePanel';

describe('groupSurfaces', () => {
  it('groups roofs, walls, floors, windows and doors in that order, each by name, the rest last', () => {
    const groups = groupSurfaces([
      { id: 'w10', label: 'West wall 10', group: 'wall' },
      { id: 'r1', label: 'Flat roof 1', group: 'roof' },
      { id: 'pv', label: 'Carport' },
      { id: 'w2', label: 'West wall 2', group: 'wall' },
      { id: 'd1', label: 'Front door', group: 'door' },
      { id: 'g1', label: 'Ground floor', group: 'floor' },
      { id: 'x1', label: 'Shaft', group: 'shaft' },
    ]);
    expect(groups.map(({ group, surfaces }) => [group, surfaces.map((s) => s.id)])).toEqual([
      ['roof', ['r1']],
      ['wall', ['w2', 'w10']],
      ['floor', ['g1']],
      ['door', ['d1']],
      ['other', ['pv', 'x1']],
    ]);
  });
});
