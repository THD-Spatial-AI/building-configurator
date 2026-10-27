import { describe, expect, it } from 'vitest';
import { HWB_CLASSES, heatingPerM2, hwbClass } from './energyClass';

describe('hwbClass', () => {
  it('places space heating per m² on the OIB-RL 6 HWB scale, each limit inclusive', () => {
    expect([5, 10, 10.1, 15, 25, 50, 100, 150, 200, 250, 251].map((kwh) => hwbClass(kwh).label))
      .toEqual(['A++', 'A++', 'A+', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('runs from A++ to G', () => {
    expect(HWB_CLASSES.map((c) => c.label)).toEqual(['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
});

describe('heatingPerM2', () => {
  const general = { floorArea: 50, storeys: 2 };

  it('divides by the area of the storeys the result was computed for', () => {
    expect(heatingPerM2({ heating: '10000' }, general, null)).toBe(100);
    expect(heatingPerM2({ heating: '10000' }, general, [2])).toBe(200);
  });

  it('has no figure for a heating demand that is not BuEM\'s', () => {
    expect(heatingPerM2({ heating: '10000', heatingSource: 'ignis' }, general, null)).toBeNull();
    expect(heatingPerM2({ heating: '—' }, general, null)).toBeNull();
  });
});
