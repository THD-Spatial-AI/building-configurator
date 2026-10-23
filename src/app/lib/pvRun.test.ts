import { describe, expect, it } from 'vitest';
import { pvRunRequest, runPvBuilding } from './pvRun';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';
import type { ConfiguratorServices } from './services';

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
