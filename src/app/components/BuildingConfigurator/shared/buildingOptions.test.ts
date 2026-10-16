import { describe, it, expect } from 'vitest';
import { EQUIPMENT_GROUPS, TV_IDS, yearToConstructionPeriod } from './buildingOptions';

describe('yearToConstructionPeriod', () => {
  it('maps a year to the TABULA period band it falls in, at the boundaries', () => {
    expect(yearToConstructionPeriod(1850)).toBe('Pre-1919');
    expect(yearToConstructionPeriod(1918)).toBe('Pre-1919');
    expect(yearToConstructionPeriod(1919)).toBe('1919-1948');
    expect(yearToConstructionPeriod(1948)).toBe('1919-1948');
    expect(yearToConstructionPeriod(1957)).toBe('1949-1957');
    expect(yearToConstructionPeriod(1968)).toBe('1958-1968');
    expect(yearToConstructionPeriod(1983)).toBe('1979-1983');
    expect(yearToConstructionPeriod(2009)).toBe('2002-2009');
    expect(yearToConstructionPeriod(2010)).toBe('Post-2010');
  });

  it('resolves every year, including ones outside the demo range', () => {
    expect(yearToConstructionPeriod(1700)).toBe('Pre-1919');
    expect(yearToConstructionPeriod(2100)).toBe('Post-2010');
  });
});

/** building.equipment property names in buem-gateway's v6-draft request schema. */
const CONTRACT_APPLIANCES = [
  'air_fryer', 'answer_machine', 'cassette_cd_player', 'chest_freezer', 'clock', 'coffee_machine',
  'cordless_telephone', 'dish_washer', 'ev_charger', 'fax', 'fridge_freezer', 'hi_fi', 'hob', 'iron',
  'kettle', 'laptop', 'lighting', 'microwave', 'oven', 'personal_computer', 'printer', 'refrigerator',
  'robot_vacuum', 'small_cooking_group', 'smart_speaker', 'streaming_stick', 'tumble_dryer', 'tv_1',
  'tv_2', 'tv_3', 'tv_receiver_box', 'upright_freezer', 'vacuum', 'vcr_dvd', 'washer_dryer',
  'washing_machine', 'wifi_router',
];

describe('EQUIPMENT_GROUPS', () => {
  it('offers every appliance the contract accepts, once', () => {
    const offered = [...EQUIPMENT_GROUPS.flatMap((group) => group.items.map((item) => item.id)), ...TV_IDS];
    expect([...offered].sort()).toEqual(CONTRACT_APPLIANCES);
  });
});
