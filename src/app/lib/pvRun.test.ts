import { describe, expect, it } from 'vitest';
import { pvRunRequest, runPvBuilding } from './pvRun';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';
import type { ConfiguratorServices } from './services';
import type { PvLayout } from './pvLayout';

function roof(id: string, area: number, tilt: number, azimuth: number): BuildingElement {
  return { id, label: id, type: 'roof', area, uValue: 0.2, gValue: null, tilt, azimuth };
}

describe('pvRunRequest', () => {
  const elements = { r1: roof('r1', 40, 35, 180), r2: roof('r2', 38, 35, 0) };

  it('sends the host\'s PV surfaces with their current geometry', () => {
    expect(pvRunRequest('osm-1', elements, ['r1'])).toEqual({
      osm_id: 'osm-1',
      surfaces: [{ id: 'r1', area: 40, tilt: 35, azimuth: 180 }],
    });
  });

  it('sends the geometry of the 3D model, not an expert\'s edits for BuEM', () => {
    const edited = { ...roof('r1', 30, 5, 90), defaultArea: 40, defaultTilt: 35, defaultAzimuth: 180 };
    expect(pvRunRequest('osm-1', { r1: edited }, ['r1'])?.surfaces).toEqual([{ id: 'r1', area: 40, tilt: 35, azimuth: 180 }]);
  });

  it('adds the module count, capacity and panel angles of a surface with a layout', () => {
    const layout: PvLayout = {
      count: 20, kwp: 8, area: 40, capped: true, tilt: 15, azimuth: 170,
      mounting: { kind: 'racked', tilt: 15, azimuth: 170 }, orientation: 'portrait', modules: [],
    };
    expect(pvRunRequest('osm-1', elements, ['r1'], { r1: layout })?.surfaces).toEqual([
      { id: 'r1', area: 40, tilt: 35, azimuth: 180, modules: 20, kwp: 8, panel_tilt: 15, panel_azimuth: 170 },
    ]);
  });

  it('adds the product of each surface that has one', () => {
    const surfaces = pvRunRequest('osm-1', elements, ['r1', 'r2'], {}, (id) => (id === 'r1' ? 'mono-420' : undefined))?.surfaces;
    expect(surfaces?.[0]).toMatchObject({ id: 'r1', product_id: 'mono-420' });
    expect(surfaces?.[1]).not.toHaveProperty('product_id');
  });

  it('leaves out a PV surface that is not among the building\'s elements', () => {
    expect(pvRunRequest('osm-1', elements, ['r1', 'neighbour-roof'])?.surfaces.map((s) => s.id)).toEqual(['r1']);
  });

  it('builds no request for a building without PV', () => {
    expect(pvRunRequest('osm-1', elements, [])).toBeNull();
  });
});

describe('runPvBuilding', () => {
  const request = { osm_id: 'osm-1', surfaces: [] };

  it('gives the annual generation', async () => {
    const services = { runPvBuilding: async () => ({ annualKwh: 4120 }) } as Partial<ConfiguratorServices>;
    expect(await runPvBuilding(services, request)).toBe(4120);
  });

  it('gives null when the host has no PV run or it fails', async () => {
    expect(await runPvBuilding({}, request)).toBeNull();
    const failing = { runPvBuilding: async () => { throw new Error('timeout'); } } as Partial<ConfiguratorServices>;
    expect(await runPvBuilding(failing, request)).toBeNull();
  });
});
