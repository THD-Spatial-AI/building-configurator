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

// Runs before the model's first save are stored under a draft id the host mints.
const draftId = crypto.randomUUID();

// Module constant: one identity for the life of the page.
const services: ConfiguratorServices = {
  fetchMatchingVariants: (country, typeCode, year) =>
    axios.get(`/v1/ignis/variants/${country}/match`, { params: { type: typeCode, year } })
      .then((r) => r.data.data),
  fetchVariantData: (code) =>
    axios.get(`/v1/ignis/data/${code}`).then((r) => r.data.data),
  calculateHeatDemand: (code, inputs) =>
    axios.post(`/v1/ignis/calculate/${code}`, inputs).then((r) => r.data.data),
  runBuemBuilding: (request) =>
    axios.post(`/drafts/${draftId}/buildings/${request.osm_id}/buem`, request).then((r) => r.data),
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
| `runContext` | Optional. `{ startDate, endDate }` (RFC 3339 dates): the period a BuEM run covers. Without it, a run covers 2018 |
| `demandProfile` | Optional. The building's stored demand, `{ building_ref, series }` (type `BuildingDemandProfile`): `undefined` while it loads, `null` when none is stored. Its totals fill the energy card. Hold it stable: a new object resets the card to it |
| `attribution` | Optional. Credits for the building's data (React node, for example text with links), shown in a corner of the 3D view. Pass what the data's licences require |
| `pv` | Optional. Opens the view in PV mode, see [PV mode](#pv-mode) |
| `pvSurfaceIds` | Optional. Surface ids the host has PV on, drawn with panels in the normal view. Ignored in PV mode |
| `technologies` | Optional. The building's technologies as cards in a Technologies tab, see [Technologies](#technologies) |
| `seriesCsvUrl` | Optional. The URL the load profile's Download link points at, a CSV of the building's stored series. Without it there is no download |

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
| `runBuemBuilding(request)` | One building through BuEM. Forward the request unchanged, see [Forward solver and outputs](#storing-an-edited-building). Resolves to the building's stored demand, the same `BuildingDemandProfile` as the `demandProfile` prop | 15 s |

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

## PV mode

Pass `pv` to open the building for placing PV. The view then shows only the
model and a PV panel, and stores nothing: every change goes to a callback, and
the view follows the next `pv` the host passes.

```tsx
const pv = useMemo<PvMode>(() => ({
  surfaces,          // { [surfaceId]: { state, usableShare, maxKwp } }
  notice: t('pv.shadingNotice'),
  typeLabel: pvType.name,
  onToggle: (surfaceId, installed) => setInstalled(surfaceId, installed),
  onShareChange: (surfaceId, usableShare) => setShare(surfaceId, usableShare),
}), [surfaces, pvType, t]);

<Building3DView building={building} geometry={geometry} services={services} onExit={onExit} pv={pv} />
```

| Field | Meaning |
|---|---|
| `surfaces` | Keyed by surface id, the id the geometry and the envelope elements carry. Only these surfaces can be clicked |
| `surfaces[id].state` | `installed` draws panels on the surface, `suggested` lights and outlines it, `available` draws it as usual |
| `surfaces[id].usableShare` | Share of the surface usable for panels, 0 to 1, shown as a percentage |
| `surfaces[id].label` | Optional. Name for a surface that is not among the building's elements, such as a roof of a neighbouring 3D building. An element's own label takes precedence |
| `surfaces[id].maxKwp` | Capacity of the panels at the current usable share, in kWp, shown on its card. Pass the new value after `onShareChange` |
| `notice` | Shown for as long as PV mode is open. Pass it in the user's language |
| `typeLabel` | Name of the PV type, shown at the top of the panel |
| `onToggle(surfaceId, installed)` | A surface was switched. Clicking a surface without PV calls it with `true` |
| `onShareChange(surfaceId, usableShare)` | The usable share of a surface with PV was changed, 0 to 1 |

Clicking a surface opens its card: the PV switch, and on a surface with PV the
usable share. The panel lists every offered surface with its own switch.

## Technologies

Pass `technologies` to show the building's technologies as cards in a
Technologies tab. The host owns every value and label; the cards show them and
report edits, and the view stores nothing.

```tsx
const technologies = useMemo<Technologies>(() => ({
  items: [
    {
      id: 'pv',
      title: pvType.name,
      subtitle: `${surfaceCount} surfaces`,
      fields: [
        { key: 'capacity', label: t('capacity'), value: 18.2, unit: 'kWp' },
        { key: 'cost', label: t('investment'), value: 1100, unit: 'EUR/kW', editable: true },
      ],
      action: { label: t('pvSurfaces'), onClick: openPvMode },
    },
    {
      id: 'heat_pump',
      title: t('heatPump'),
      fields: [{ key: 'size', label: t('maxSize'), value: null, unit: 'kW', editable: true }],
    },
  ],
  onChange: (id, fieldKey, value) => setField(id, fieldKey, value),
  onRemove: (id) => removeTechnology(id),
}), [/* the values above */]);
```

| Field | Meaning |
|---|---|
| `items[].id` | Passed back to `onChange` and `onRemove` |
| `items[].title`, `subtitle` | Shown at the top of the card, in the user's language |
| `items[].action` | Optional button, `{ label, onClick }`; for example one that opens PV mode |
| `fields[].value` | A number, or `null` for unbounded, shown as "∞" |
| `fields[].editable` | A number input when true, plain text otherwise |
| `fields[].min`, `max`, `step` | Passed to the input as hints; the host clamps |
| `fields[].error` | Shown under the field with a red ring until the host clears it |
| `onChange(id, fieldKey, value)` | Fires with each valid number typed, and with `null` when the input is cleared |
| `onRemove(id)` | The card's remove button was pressed; the view does not ask first |

To show which surfaces carry PV in the normal view, pass their ids as
`pvSurfaceIds`.

## Geometry

Pass `geometry={null}` while the geometry is still loading; the view shows its
own loading state. A building City2TABULA holds no geometry for takes
`{ surfaces: [] }`, which the view says so about.

The surface ids in the geometry response are the envelope element ids, which is
what lets a click in the model resolve to the surface being edited. Geometry
from a different City2TABULA generation than the envelope matches nothing, and
the view reports that rather than rendering a model nothing can be selected in.
Saving such a building keeps its old ids; to move it to the current generation,
rebuild its `BuildingState` from current City2TABULA data. A host detects the
case with `isEnvelopeDetached(surfaces, new Set(Object.keys(building.envelope)))`.

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
into `{ building, construction_year, outputs, solver }`: the same three blocks
a run of that building sends as `BuemBuildingRunRequest.building`, `.outputs`
and `.solver`, plus the construction year, which BuEM's `construction_period`
cannot hold. Store the whole object and send BuEM only its blocks. To reopen,
pass the stored object as `properties.buem` of a Feature to
`adaptBuemFeature`:

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

`building` carries the building parameters (identity, total floor area, room
height, air change rates, thermal mass), the household inputs (dwellings,
occupants, household type, appliances; capacity for a service building) and
every surface with its name. `outputs` records which load profiles BuEM
computes, and `solver.use_milp` whether it solves with MILP. None of the three
carries the storey count: a reopened building keeps its total floor area and
shows the default storey count.

When `outputs` selects neither heating nor cooling, `building` has no envelope
and the run needs no weather.

!!! warning "Forward solver and outputs"
    `runBuemBuilding` receives `request.solver` and `request.outputs`, to be
    sent as `properties.buem.solver` and `properties.buem.outputs`. A transport
    that drops `solver` runs BuEM with its default solver; one that drops
    `outputs` gets annual summaries only, with no hourly profile to chart. Both
    need a buem-gateway that accepts the v6-draft request schema.
