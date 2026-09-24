---
audience: developer
---

# Installing the component

The configurator publishes as `@thd-spatial-ai/building-configurator`, a React
component an application installs and mounts. It calls the EnerPlanET backend
and nothing else, over a transport the host supplies.

## Install

Install a tagged release straight from the repository, which needs no registry
configuration:

```bash
npm install github:THD-Spatial-AI/building-configurator#v0.1.0
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

`react`, `react-dom`, `echarts` and `echarts-for-react` are peer dependencies:
the host provides them, so the component shares its React instance and its
charting library rather than shipping a second copy of either.

## Mount it

The component reads its API clients from a provider. Pass a transport, and hold
it somewhere stable: a client rebuilt on every render rebuilds the clients with
it.

```tsx
import {
  BuildingConfigurator,
  BuildingConfiguratorProvider,
  type HttpClient,
} from '@thd-spatial-ai/building-configurator';
import '@thd-spatial-ai/building-configurator/styles.css';

import axios from '@/lib/axios';

// Paths arrive relative to the API root, so the host's own baseURL, session
// handling and CSRF apply unchanged.
const http: HttpClient = {
  get:  (path, options) => axios.get(path, options).then((r) => r.data),
  post: (path, body, options) => axios.post(path, body, options).then((r) => r.data),
};

export function BuildingPanel({ building, onClose }) {
  return (
    <BuildingConfiguratorProvider http={http}>
      <BuildingConfigurator buildingData={building} onClose={onClose} />
    </BuildingConfiguratorProvider>
  );
}
```

An application without a configured client can use `createFetchHttpClient()`,
which sends cookies and the CSRF header but does not renew an expired session.

## Transport contract

Paths are relative to the EnerPlanET API root: `/v2/ignis/fields`, never
`/api/v2/ignis/fields` and never an absolute URL. The host owns the origin, the
`/api` prefix, credentials and session renewal.

| Method | Contract |
|---|---|
| `get<T>(path, options?)` | Resolves with the parsed JSON body, rejects on a non-2xx status |
| `post<T>(path, body?, options?)` | As above; `body` is serialised as JSON |

`options.signal` carries an `AbortSignal`, which the component uses to bound
its ignis lookups.

!!! warning "The host's client decides what a failure looks like"
    Both methods must reject on a non-2xx response. A client that resolves with
    an error body instead makes a failed lookup look like an empty result, and
    the component will render it as one.

## Endpoints called

Every call goes to the EnerPlanET backend, which holds the credentials for the
services behind it and routes each request on through the orchestrator.

| Path | Purpose |
|---|---|
| `POST /v1/buem/building` | Runs the edited envelope through BuEM, returning the hourly series |
| `POST /v1/city2tabula/enrich` | Resolves 3D envelope geometry for a set of `osm_id`s |
| `GET /v1/city2tabula/geometry` | Surface polygons for one building, for the 3D view |
| `GET /v2/ignis/variants/{iso2}/match` | TABULA refurbishment variants for a classification |
| `GET /v2/ignis/data/{code}` | The full TABULA record for one variant |
| `POST /v2/ignis/calculate/{code}` | Annual heat demand for the working copy |
| `GET /v2/ignis/fields` | Field labels and descriptions for form tooltips |
| `POST /v2/pylovo/generate-grid` | Building footprints for an area |

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

## Experimental: the 3D building view

A second entry publishes `Building3DView`, a full-screen view where the
building's own envelope is what the user clicks: surfaces are selected in the
model rather than from a list, and each opens its editor beside it.

!!! warning "Unstable"
    Its props and its layout are still moving, and it is versioned as a
    prerelease. Pin an exact version rather than a range.

```bash
npm install github:THD-Spatial-AI/building-configurator#v0.3.0-experimental.0
```

`three` and `earcut` are dependencies of the package, so they install with it.

The host supplies the building and its geometry; the view knows nothing about a
particular area or dataset. Both come from calls the host already makes: the
building from `buildBuildingStates` or `adaptBuemFeature`, the geometry from
`GET /v1/city2tabula/geometry` for that building's `object_id`.

```tsx
import { BuildingConfiguratorProvider } from '@thd-spatial-ai/building-configurator';
import {
  Building3DView,
  surfacesFromGeometryResponse,
} from '@thd-spatial-ai/building-configurator/experimental';
import '@thd-spatial-ai/building-configurator/styles.css';

export function BuildingView({ building, geometryResponse, onExit }) {
  return (
    <BuildingConfiguratorProvider http={http}>
      <Building3DView
        building={building}
        geometry={{ surfaces: surfacesFromGeometryResponse(geometryResponse) }}
        onExit={onExit}
      />
    </BuildingConfiguratorProvider>
  );
}
```

Pass `geometry={null}` while the geometry is still loading; the view shows its
own loading state. A building City2TABULA holds no geometry for takes
`{ surfaces: [] }`, which the view says so about.

The surface ids in the geometry response are the envelope element ids, which is
what lets a click in the model resolve to the surface being edited. Geometry
from a different City2TABULA generation than the envelope matches nothing, and
the view reports that rather than rendering a model nothing can be selected in.

## Building a BuildingState

`BuildingConfigurator` takes a `buildingData` prop. Two exported adapters build
one:

- `adaptBuemFeature(feature)` from a single BuEM GeoJSON Feature.
- `buildBuildingStates(ignis, buildings, enrichData)` from a footprint
  collection joined with a City2TABULA enrich response, keyed by `osm_id`. The
  `ignis` argument comes from `useConfiguratorApi()`.

!!! warning "Memoise what you pass in"
    The component resets its editing state whenever `buildingData` changes
    identity. A parent that rebuilds the object on every render discards the
    user's edits on every render with it.
