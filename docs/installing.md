---
audience: developer
---

# Installing the component

The configurator publishes as `@thd-spatial-ai/building-configurator`: a React
component, `Building3DView`, that shows one building's envelope in 3D with its
parameters beside it. The host supplies the building, its geometry and four
functions that reach its services. The package makes no network call of its
own.

## Install

Install a tagged release straight from the repository, which needs no registry
configuration:

```bash
npm install github:THD-Spatial-AI/building-configurator#v0.6.0
```

The package builds itself on install, so the tag is the version. Pin one rather
than tracking the default branch.

It also publishes to GitHub Packages, which gives faster installs and a
resolvable version range at the cost of a token. To use that instead, add the
scope to the consuming project's `.npmrc`:

```
@thd-spatial-ai:registry=https://npm.pkg.github.com
```

```bash
npm install @thd-spatial-ai/building-configurator
```

`react`, `react-dom` and `three` are peer dependencies: the host provides them,
so the component shares its React and Three.js instances rather than shipping a
second copy.

## Mount it

```tsx
import {
  Building3DView,
  surfacesFromGeometryResponse,
  type ConfiguratorServices,
} from '@thd-spatial-ai/building-configurator';
import '@thd-spatial-ai/building-configurator/styles.css';

import axios from '@/lib/axios';

// Module constant: one identity for the life of the page.
const services: ConfiguratorServices = {
  fetchMatchingVariants: (country, typeCode, year) =>
    axios.get(`/v2/ignis/variants/${country}/match`, { params: { type: typeCode, year } })
      .then((r) => r.data.data),
  fetchVariantData: (code) =>
    axios.get(`/v2/ignis/data/${code}`).then((r) => r.data.data),
  calculateHeatDemand: (code, inputs) =>
    axios.post(`/v2/ignis/calculate/${code}`, inputs).then((r) => r.data.data),
  runBuemBuilding: (request) =>
    axios.post('/v1/buem/building', request).then((r) => r.data),
};

export function BuildingView({ building, geometryBuilding, onExit }) {
  const geometry = geometryBuilding === undefined
    ? null
    : { surfaces: geometryBuilding ? surfacesFromGeometryResponse([geometryBuilding]) : [] };

  return (
    <Building3DView
      building={building}
      geometry={geometry}
      services={services}
      onExit={onExit}
    />
  );
}
```

`geometryBuilding` is this building's entry from the host's
`GET /v1/city2tabula/geometry` response for its `object_id`.

| Prop | Meaning |
|---|---|
| `building` | The `BuildingState` to edit, see [Building a BuildingState](#building-a-buildingstate) |
| `geometry` | `{ surfaces }` for the 3D model, or `null` while it loads |
| `services` | The four calls below |
| `onExit(building)` | Called when the user leaves; receives the edited building, or the one passed in when nothing changed |

!!! warning "Hold the services stable"
    Keep the `services` object and each function in a module constant, a
    `useMemo` or a `useCallback`. An object written inline is a new identity on
    every render, and the view's effects key on the individual callbacks.

## Services

Every function returns a promise that rejects on failure. The package decides
what a failure means on screen, so a host never reimplements that policy. The
routes in the example are the EnerPlanET backend's; the package holds none.

| Function | What it carries | Budget |
|---|---|---|
| `fetchMatchingVariants(country, typeCode, year)` | TABULA variants for a classification. `typeCode` is already a TABULA code (`SFH`, `TH`, `MFH`, `AB`) | 8 s |
| `fetchVariantData(code)` | One variant's full TABULA record | 8 s |
| `calculateHeatDemand(code, inputs)` | Annual heat demand for a variant; `inputs` is `undefined` when nothing was overridden | 15 s |
| `runBuemBuilding(request)` | One building through BuEM. Forward the request unchanged, including `solver` | 15 s |

`Building3DView` does not call `calculateHeatDemand` today. It is part of the
type, so supply it.

## Styling

The component is built with Tailwind v4 and inherits the host's palette. Its
`@theme` mapping reads the host's tokens and falls back to its own values for
any the host does not define, so `--primary`, `--card`, `--border` and the rest
come from the host where they exist. The published stylesheet sets no custom
property of its own, which is what keeps the host's palette its own.

Two things are needed in the host's stylesheet. The first imports the
component's own tokens and the `.cfg-*` classes its inputs use:

```css
@import "@thd-spatial-ai/building-configurator/styles.css";
```

The second puts the published bundle in Tailwind's scan path, so the utility
classes the component names are compiled into the host's CSS:

```css
@source "../node_modules/@thd-spatial-ai/building-configurator/dist";
```

Without the `@source` line the component renders unstyled, because Tailwind
only emits utilities it has seen used.

## Geometry

Pass `geometry={null}` while the geometry is still loading; the view shows its
own loading state. A building City2TABULA holds no geometry for takes
`{ surfaces: [] }`, which the view says so about.

The surface ids in the geometry response are the envelope element ids, which is
what lets a click in the model resolve to the surface being edited. Geometry
from a different City2TABULA generation than the envelope matches nothing, and
the view reports that rather than rendering a model nothing can be selected in.

## Building a BuildingState

Two exported functions build one:

- `adaptBuemFeature(feature)` from a single BuEM GeoJSON Feature.
- `buildBuildingStates(services, buildings, enrichData)` from a footprint
  collection joined with a City2TABULA enrich response, keyed by `osm_id`.
  `services` needs only `fetchMatchingVariants` and `fetchVariantData`. A
  footprint with no enrich entry is left out of the result.

!!! warning "Memoise what you pass in"
    The view resets its editing state whenever `building` changes identity. A
    parent that rebuilds the object on every render discards the user's edits on
    every render with it.

## Storing an edited building

`onExit` hands back the edited `BuildingState`. `toBuem(building)` turns it
into `{ building, solver }`, the same two blocks a run of that building sends
as `BuemBuildingRunRequest.building` and `.solver`. To reopen, pass the stored
object as `properties.buem` of a Feature to `adaptBuemFeature`:

```ts
import { adaptBuemFeature, toBuem } from '@thd-spatial-ai/building-configurator';

const stored = toBuem(edited);

const reopened = adaptBuemFeature({
  type: 'Feature',
  id: osmId,
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { buem: stored },
});
```

`building` carries the building parameters (identity, floor area, storeys, room
height, air change rates, thermal mass, attached neighbours) and every surface
with its name. `solver.use_milp` records whether BuEM solves with MILP. Neither
carries the PV arrays or the battery.

!!! warning "PV and battery"
    Keep `edited.technologyState` beside the blocks and set it on the reopened
    state (`{ ...reopened, technologyState }`), or they reopen at their
    defaults.

!!! warning "Forward the solver"
    `runBuemBuilding` receives `request.solver`. A transport that drops it runs
    BuEM with its default solver whatever the user chose.
