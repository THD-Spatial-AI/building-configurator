import { describe, expect, it } from 'vitest';
import { HWB_CLASSES, hwbClass } from './energyClass';

describe('hwbClass', () => {
  it('places space heating per m² on the OIB-RL 6 HWB scale, each limit inclusive', () => {
    expect([5, 10, 10.1, 15, 25, 50, 100, 150, 200, 250, 251].map((kwh) => hwbClass(kwh).label))
      .toEqual(['A++', 'A++', 'A+', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('runs from A++ to G', () => {
    expect(HWB_CLASSES.map((c) => c.label)).toEqual(['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
});
