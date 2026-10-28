// The BuEM payloads the configurator produces, validated against the request
// schema copied from buem-gateway (schemas/buem, see scripts/buem-schema.mjs).
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../../schemas/buem/v6-draft/request_schema.json';
import { adaptBuemFeature, serializeToBuemFeature, type BuildingIdentity } from './buemAdapter';
import { toBuem } from './buemRun';
import { DEFAULT_ELEMENTS, DEFAULT_GENERAL } from '../components/BuildingConfigurator/shared/buildingDefaults';

// date-time is the schema's only format; RFC 3339 as written in the requests,
// registered here so strict mode stays on without a formats package.
const ajv = new Ajv2020({ allErrors: true }).addFormat('date-time', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
const validate = ajv.compile(schema);

/** One hour of weather: the host embeds the resolved timeseries, the configurator sends none. */
const WEATHER = { index: ['2018-01-01T00:00:00Z'], variables: { T: [0], GHI: [0], DHI: [0], DNI: [0] } };

/** The schema's errors for a feature sent on its own, with the host's weather, as BuEM receives it; empty when valid. */
function errors(feature: Record<string, any>): string[] {
  const withWeather = { ...feature, properties: { ...feature.properties, buem: { ...feature.properties.buem, weather: WEATHER } } };
  const valid = validate({ type: 'FeatureCollection', features: [withWeather] });
  return valid ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message} ${JSON.stringify(e.params)}`);
}

const identity: BuildingIdentity = {
  id: 'b1', label: 'B1', coordinates: [6, 52], buildingType: 'Single-family House',
  constructionYear: 1990, country: 'NL', floorArea: 300, roomHeight: 2.5, storeys: 3,
};
const general = { ...DEFAULT_GENERAL, buildingType: 'Single-family House', floorArea: 100, storeys: 3, residential_units: 1 };
/** The default envelope with each surface's share inside what is modelled. */
const cut = (share: (type: string) => number) => Object.fromEntries(
  Object.entries(DEFAULT_ELEMENTS).map(([id, el]) => [id, { ...el, modelledShare: share(el.type) }]),
);

describe('the BuEM request the configurator sends', () => {
  it('is valid for a whole building', () => {
    expect(errors(serializeToBuemFeature(identity, DEFAULT_ELEMENTS, general))).toEqual([]);
  });

  it('is valid with storeys left out, their internal ceiling standing in', () => {
    const feature = serializeToBuemFeature(identity, cut((type) => (type === 'roof' ? 0 : 2 / 3)), { ...general, storeysModelled: [1, 2] });
    expect(errors(feature)).toEqual([]);
  });

  it('is valid with the attic left out, its ceiling standing in', () => {
    const feature = serializeToBuemFeature(identity, cut((type) => (type === 'roof' ? 0 : 1)), { ...general, atticModelled: false });
    expect(feature.properties.buem.building.envelope.elements.some((el: { id: string }) => el.id === 'attic_ceiling')).toBe(true);
    expect(errors(feature)).toEqual([]);
  });

  it('is valid for a building of flats with dwellings per storey and own storey heights', () => {
    const flats = {
      ...general, buildingType: 'Multi-family House', residential_units: 6,
      storeyDwellings: { 1: 2, 2: 2, 3: 2 }, storeyHeights: { 3: 3.2 }, storeysModelled: [1, 2],
    };
    const feature = serializeToBuemFeature({ ...identity, buildingType: 'Multi-family House' }, cut(() => 2 / 3), flats);
    expect(errors(feature)).toEqual([]);
  });

  it('is valid as the blocks a host stores, reopened and sent again', () => {
    const blocks = toBuem(adaptBuemFeature(serializeToBuemFeature(identity, DEFAULT_ELEMENTS, general)));
    const feature = {
      type: 'Feature', id: 'b1', geometry: { type: 'Point', coordinates: [6, 52] },
      properties: { start_time: '2018-01-01T00:00:00Z', end_time: '2018-12-31T23:00:00Z', resolution: '60', resolution_unit: 'minutes', buem: blocks },
    };
    expect(errors(feature)).toEqual([]);
  });

  it('fails a surface whose type BuEM does not know, so the check has teeth', () => {
    const feature = serializeToBuemFeature(identity, DEFAULT_ELEMENTS, general);
    feature.properties.buem.building.envelope.elements[0].type = 'attic_ceiling';
    expect(errors(feature).join('\n')).toContain('allowedValues');
  });
});
