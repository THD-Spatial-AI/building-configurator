import { describe, it, expect } from 'vitest';
import { technologyCosts, formatEuro } from './technologyCosts';
import { DEFAULT_BATTERY_CONFIG, DEFAULT_PV_CONFIG } from './buildingDefaults';
import type { BuildingElement } from '../configure/model/buildingElements';

const surface = { id: 'roof', label: 'Roof' } as BuildingElement;

describe('technologyCosts', () => {
  it('is empty when nothing is installed', () => {
    const summary = technologyCosts([], DEFAULT_BATTERY_CONFIG);
    expect(summary.items).toEqual([]);
    expect(summary.capexTotal).toBe(0);
    expect(summary.omAnnualTotal).toBe(0);
  });

  it('sums PV capacity across surfaces at the per-kWp rates', () => {
    const pv = { ...DEFAULT_PV_CONFIG, installed: true, system_capacity: 4 };
    const summary = technologyCosts([{ element: surface, pv }, { element: surface, pv }], DEFAULT_BATTERY_CONFIG);
    // 8 kWp total: 8 × €575 up front, 8 × €8/year O&M.
    expect(summary.capexTotal).toBe(4600);
    expect(summary.omAnnualTotal).toBe(64);
    expect(summary.items[0].basis).toBe('8.0 kWp over 2 surfaces');
  });

  it('reports an annualized PV capital cost as a yearly cost, not capex', () => {
    const pv = { ...DEFAULT_PV_CONFIG, installed: true, system_capacity: 10, cost_basis: 'annualized' as const };
    const summary = technologyCosts([{ element: surface, pv }], DEFAULT_BATTERY_CONFIG);
    expect(summary.capexTotal).toBe(0);
    expect(summary.omAnnualTotal).toBe(10 * DEFAULT_PV_CONFIG.cost_energy_cap + 10 * DEFAULT_PV_CONFIG.cost_om_annual);
  });

  it('charges the battery for both power and storage capacity', () => {
    const battery = { ...DEFAULT_BATTERY_CONFIG, installed: true };
    const summary = technologyCosts([], battery);
    // 10 kW × €1028 + 20 kWh × €1007.93
    expect(summary.capexTotal).toBeCloseTo(30438.6, 1);
    expect(summary.omAnnualTotal).toBeCloseTo(251.9, 1);
  });
});

describe('formatEuro', () => {
  it('rounds and groups thousands', () => {
    expect(formatEuro(30438.6)).toBe('€30,439');
  });
});
