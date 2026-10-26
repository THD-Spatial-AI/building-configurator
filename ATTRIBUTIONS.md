# Attributions

This project includes components from [shadcn/ui](https://ui.shadcn.com/) used under [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

The icons in `src/app/components/icons.tsx` are copied from [Lucide](https://lucide.dev/) 0.487.0, used under the [ISC license](https://lucide.dev/license): copyright Lucide Contributors 2022, and for portions from Feather, Cole Bemis 2013-2022 (MIT).

## Data bundled with the demo application

`src/assets/data/` holds captures for buildings in Loenen, Netherlands, used only by the demo application (`npm run dev`). None of it is part of the published package. The demo shows the credits below on its map and in the 3D view (`src/demo/attribution.tsx`).

| Data | Source | Licence | Credit |
|---|---|---|---|
| Building footprints and identifiers (`loenen_live_fixture.json`, `buildings`) | OpenStreetMap, processed by PyLovo | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | © OpenStreetMap contributors, https://www.openstreetmap.org/copyright |
| Building envelopes and surface geometry (`loenen_live_fixture.json`, `enrich`; `loenen_surfaces_fixture.json`) | 3DBAG, processed by City2TABULA | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | © 3DBAG by tudelft3d and 3DGI, https://docs.3dbag.nl/en/copyright/ |
| TABULA building typology (`loenen_ignis_fixture.json`) | Institut Wohnen und Umwelt (IWU), served by ignis | [TABULA usage terms](https://episcope.eu/communication/download/), not an open licence | IEE Projects TABULA + EPISCOPE (www.episcope.eu) |
| Weather behind the BuEM demand (`loenen_demand_fixture.json`, `loenen_series_*.csv`) | MERRA-2, NASA GMAO, distributed by GES DISC | [NASA EOSDIS data use guidance](https://earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance) | Global Modeling and Assimilation Office (GMAO) (2015), MERRA-2, GES DISC, https://doi.org/10.5067/VJAFPLI1CSIV and https://doi.org/10.5067/Q9QMY5PBNV1T |

Changes made to the 3DBAG data: City2TABULA derives building attributes (areas, heights, volume, storeys, TABULA type) from the geometry, merges a building's parts into one building, removes or clips faces shared between parts, and omits buildings without wall or roof faces. The files hold 18 of those buildings and their surfaces.

The usage classification, floor areas and grid assignment in the footprint file are PyLovo output, not OpenStreetMap data. The TABULA values are unchanged. The demand profiles are BuEM output computed from the MERRA-2 p50 typical year: months from the 1980 to 2025 record ranked by monthly global horizontal irradiance, so their timestamps carry the placeholder year 1900 rather than a calendar year.
