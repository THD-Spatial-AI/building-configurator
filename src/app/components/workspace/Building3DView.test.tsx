import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Building3DView } from './Building3DView';
import { adaptBuemFeature, serializeToBuemFeature, type BuildingIdentity } from '../../lib/buemAdapter';
import { DEFAULT_ELEMENTS, DEFAULT_GENERAL } from '../BuildingConfigurator/shared/buildingDefaults';
import type { ConfiguratorServices } from '../../lib/services';

const identity: BuildingIdentity = {
  id: 'b1', label: 'B1', coordinates: [6, 52], buildingType: 'Single-family House',
  constructionYear: 1990, country: 'NL', floorArea: 300, roomHeight: 2.5, storeys: 3,
};
const general = { ...DEFAULT_GENERAL, buildingType: 'Single-family House', floorArea: 100, storeys: 3 };
const building = adaptBuemFeature(serializeToBuemFeature(identity, DEFAULT_ELEMENTS, general));
// Effects do not run in a static render, so no service is called.
const unused = () => Promise.reject(new Error('not called in a static render'));
const services: ConfiguratorServices = { fetchMatchingVariants: unused, fetchVariantData: unused, calculateHeatDemand: unused, runBuemBuilding: unused };

describe('Building3DView', () => {
  // The node test environment has no window; the layout query only reads matches.
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });

  it('shows the Building tab steps in the chosen language', () => {
    const html = renderToStaticMarkup(<Building3DView building={building} geometry={null} services={services} onExit={() => {}} language="de" />);
    expect(html).toContain('Geschosse und Belegung');
    expect(html).not.toContain('Storeys and occupancy');
  });
});
