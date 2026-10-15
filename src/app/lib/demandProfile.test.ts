import { describe, expect, it } from 'vitest';
import { toThermalSummary, type DemandSeries } from './demandProfile';

function series(name: string, total: number, peak = 0, part: string | null = null): DemandSeries {
  return {
    name, part, total, peak,
    source: 'default',
    producer_version: '6.10.0',
    start: '1900-01-01T00:30:00Z',
    resolution_minutes: 60,
    energy_unit: name === 'kitchen' ? 'kWh_gas' : 'kWh',
    peak_unit: 'kW',
    peak_time: '1900-01-09T06:30:00Z',
    daily: [], weekly: [], monthly: [],
  };
}

describe('toThermalSummary', () => {
  it('sums the whole-building totals without kitchen gas or per-part series', () => {
    const summary = toThermalSummary({
      building_ref: '268426401',
      series: [
        series('heating', 44512, 20.96),
        series('cooling', 300, 4.5),
        series('electricity', 2500),
        series('hot_water', 1800),
        series('kitchen', 400),
        series('heating', 999, 99, 'roof_1'),
      ],
    });
    expect(summary.heatingKwh).toBe(44512);
    expect(summary.peakHeatingKw).toBe(20.96);
    expect(summary.peakCoolingKw).toBe(4.5);
    expect(summary.kitchenGasKwh).toBe(400);
    expect(summary.totalEnergyKwh).toBe(44512 + 300 + 2500 + 1800);
  });

  it('reads an absent series as zero', () => {
    const summary = toThermalSummary({ building_ref: 'x', series: [series('heating', 10)] });
    expect(summary.coolingKwh).toBe(0);
    expect(summary.totalEnergyKwh).toBe(10);
  });
});
