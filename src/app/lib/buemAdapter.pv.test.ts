import { describe, expect, it } from 'vitest';
import { serializeToBuemFeature } from './buemAdapter';
import { DEFAULT_PV_CONFIG } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';
import type { BuildingElement } from '@/app/components/BuildingConfigurator/configure/model/buildingElements';
import type { PvConfig } from '@/app/components/BuildingConfigurator/shared/buildingDefaults';

const identity = {
  id: 'building-1',
  label: 'Test building',
  coordinates: [11.58, 48.13] as [number, number],
  buildingType: 'Single-family House',
  constructionYear: 1990,
  country: 'DE',
  floorArea: 100,
  roomHeight: 2.5,
  storeys: 1,
};

const general = { floorArea: 100, storeys: 1, roomHeight: 2.5 };

const elements: Record<string, BuildingElement> = {
  wall_south: { id: 'wall_south', label: 'South Wall', type: 'wall', area: 40, uValue: 0.24, gValue: null, tilt: 90, azimuth: 180 },
  roof: { id: 'roof', label: 'Roof', type: 'roof', area: 60, uValue: 0.18, gValue: null, tilt: 35, azimuth: 180 },
};

function pv(overrides: Partial<PvConfig>): PvConfig {
  return { ...DEFAULT_PV_CONFIG, installed: true, ...overrides };
}

describe('serializeToBuemFeature — per-surface PV export', () => {
  it('emits one pv_supply__<surfaceId> tech per installed surface, carrying that surface\'s own params', () => {
    const surfacePvConfigs: Record<string, PvConfig> = {
      wall_south: pv({ system_capacity: 5, tilt: 90, azimuth: 180, cost_energy_cap: 600 }),
      roof:       pv({ system_capacity: 9, tilt: 35, azimuth: 180, cost_energy_cap: 550 }),
    };

    const feature = serializeToBuemFeature(
      identity, elements, general, undefined, undefined, undefined, undefined, undefined, surfacePvConfigs,
    );
    const techs = feature.properties.techs;

    expect(Object.keys(techs).sort()).toEqual(['pv_supply__roof', 'pv_supply__wall_south']);
    expect(techs['pv_supply__wall_south']).toMatchObject({ system_capacity: 5, tilt: 90, cost_energy_cap: 600 });
    expect(techs['pv_supply__roof']).toMatchObject({ system_capacity: 9, tilt: 35, cost_energy_cap: 550 });
  });

  it('excludes surfaces that are not installed', () => {
    const surfacePvConfigs: Record<string, PvConfig> = {
      wall_south: pv({ installed: false }),
      roof:       pv({}),
    };

    const feature = serializeToBuemFeature(
      identity, elements, general, undefined, undefined, undefined, undefined, undefined, surfacePvConfigs,
    );

    expect(Object.keys(feature.properties.techs)).toEqual(['pv_supply__roof']);
  });

  it('drops a PV config left over for a surface that no longer exists', () => {
    const surfacePvConfigs: Record<string, PvConfig> = {
      roof:            pv({}),
      deleted_surface: pv({}),
    };

    const feature = serializeToBuemFeature(
      identity, elements, general, undefined, undefined, undefined, undefined, undefined, surfacePvConfigs,
    );

    expect(Object.keys(feature.properties.techs)).toEqual(['pv_supply__roof']);
  });

  it('omits techs entirely when no PV or battery is installed', () => {
    const feature = serializeToBuemFeature(identity, elements, general);
    expect(feature.properties.techs).toBeUndefined();
  });
});
