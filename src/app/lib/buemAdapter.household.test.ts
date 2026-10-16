import { describe, expect, it } from 'vitest';
import { serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
import { toSimulationResult } from './buemApi';
import { DEFAULT_GENERAL } from '../components/BuildingConfigurator/shared/buildingDefaults';
import type { BuildingElement } from '../components/BuildingConfigurator/configure/model/buildingElements';

const identity: BuildingIdentity = {
  id: 'b1', label: 'B1', coordinates: [6, 52], buildingType: 'Single-family House',
  constructionYear: 1990, country: 'NL', floorArea: 100, roomHeight: 2.5, storeys: 1,
};

const partyWall: BuildingElement = {
  id: 'w_east', label: 'East wall', type: 'wall', area: 30, uValue: 0.5, gValue: null,
  tilt: 90, azimuth: 90, bTransmission: 0,
};

const household = {
  ...DEFAULT_GENERAL,
  residential_units: 6,
  num_persons: 2,
  archetype: 'retired_single',
  region_code: 'GM0200',
  capacity: 40,
  equipment: { tv_1: true, tv_2: false },
};

function buem(buildingType: string, general: Record<string, any> = household) {
  return serializeToBuemFeature({ ...identity, buildingType }, { w_east: partyWall }, general).properties.buem;
}

describe('building block against the v6-draft contract', () => {
  it('sends the BuEM code for a service building type', () => {
    expect(buem('Office').building.building_type).toBe('office');
    expect(buem('Warehouse').building.building_type).toBe('warehouse');
  });

  it('sends the household inputs for a residential building', () => {
    const { building } = buem('Multi-family House');
    expect(building).toMatchObject({
      residential_units: 6, num_persons: 2, archetype: 'retired_single', region_code: 'GM0200',
      include_dhw: true, setback_profile: 'none',
      equipment: { tv_1: true, tv_2: false },
    });
    expect(building).not.toHaveProperty('capacity');
  });

  it('leaves the cooking carrier to the host when none was chosen', () => {
    expect(buem('Single-family House').building).not.toHaveProperty('cooking_carrier');
    expect(buem('Single-family House', { ...household, cooking_carrier: 'gas' }).building.cooking_carrier).toBe('gas');
  });

  it('sends a capacity and no household inputs for a service building', () => {
    const { building, outputs } = buem('School');
    expect(building.capacity).toBe(40);
    for (const key of ['equipment', 'num_persons', 'archetype', 'region_code', 'residential_units', 'include_dhw', 'cooking_carrier']) {
      expect(building).not.toHaveProperty(key);
    }
    expect(outputs).toMatchObject({ hot_water: 'none', kitchen: 'none' });
  });

  it('refuses an apartment block with no number of dwellings', () => {
    expect(() => buem('Apartment Block', { ...household, residential_units: null })).toThrow('Apartment Block');
  });

  it('leaves the dwelling count to BuEM for a single-family house', () => {
    expect(buem('Single-family House', { ...household, residential_units: null }).building)
      .not.toHaveProperty('residential_units');
  });

  it('sends no deprecated field', () => {
    const { building } = buem('Terraced House');
    for (const key of ['n_storeys', 'neighbour_status', 'attic_condition', 'cellar_condition']) {
      expect(building).not.toHaveProperty(key);
    }
  });

  it('marks a party wall with b_transmission 0', () => {
    const [wall] = buem('Terraced House').building.envelope.elements;
    expect(wall.b_transmission).toEqual({ value: 0, unit: '-' });
  });
});

describe('output selection', () => {
  it('sends the selected profiles', () => {
    expect(buem('Single-family House').outputs).toEqual(DEFAULT_GENERAL.outputs);
  });

  it('sends no envelope when neither heating nor cooling is selected', () => {
    const outputs = { ...DEFAULT_GENERAL.outputs, heating: 'none', cooling: 'none' };
    const { building } = buem('Single-family House', { ...household, outputs });
    expect(building).not.toHaveProperty('envelope');
    expect(building.A_ref).toEqual({ value: 100, unit: 'm2' });
  });

  it('reads a result whose heating and cooling were not computed', () => {
    const result = toSimulationResult({
      summary: { electricity: { total: { value: 3000, unit: 'kWh' } } },
      timeseries: { unit: 'kWh', timestamps: ['2018-01-01T00:00:00Z'], electricity: [0.4] },
    });
    expect(result.thermalSummary).toMatchObject({ heatingKwh: 0, coolingKwh: 0, electricityKwh: 3000, totalEnergyKwh: 3000 });
    expect(result.timeseries[0]).toMatchObject({ heating: 0, electricity: 0.4 });
  });
});
