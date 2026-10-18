# Changelog

All notable changes to `@thd-spatial-ai/building-configurator`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/). While the version is 0.x, a minor release may break the public API; its entry says so first.

Each version's GitHub release entry carries the full notes.

## [Unreleased]

This release breaks the host interface: the package no longer defines or stores technologies. The host owns them.

### Removed

- The Technology tab and every technology editor: the PV planner, the per-surface PV settings, the battery and heat-pump cards, and the renewables and technology-cost figures on the energy overview.
- `TechnologyState` and the `BuildingState` fields `technologies`, `installedTechIds` and `technologyState`. A stored building that still carries `technologyState` opens without it.
- The `batteryConfig` and `surfacePvConfigs` parameters of `serializeToBuemFeature` and `exportToBuemGeojson`, and the `techs` block they wrote. Opening a building no longer reads `properties.techs`.
- The `pv_installed` and `pv_capacity_kwp` columns of the surfaces table.

## [0.7.0] - 2026-10-16

This release breaks the host interface in three places, and its building block needs a buem-gateway that accepts the v6-draft request schema:

- `runBuemBuilding` resolves to a `BuildingDemandProfile` instead of `{ osm_id, buem: { thermal_load_profile } }`.
- `BuemBuildingRunRequest` gains `outputs`, which the transport forwards as `properties.buem.outputs`, and `toBuem` returns `{ building, construction_year, outputs, solver }`.
- `BuemBuildingRunRequest.model_id`, deprecated in 0.6.2, is removed.

### Changed

- `ConfiguratorServices.runBuemBuilding` resolves to the building's stored demand, `{ building_ref, series }`, the same body as the `demandProfile` prop. `BuemBuildingRunResponse` is now that type. A run updates the energy card from the returned totals and no longer holds an hourly series in the browser.
- The building block follows buem-gateway's v6-draft request schema. Building types are BuEM's four residential codes and eight service types; Retail, which BuEM has no type for, is gone. Residential buildings send their household inputs (dwellings, occupants, household type, region code, cooking carrier, hot water, appliances) and service buildings send a capacity and none of them. `setback_profile` is sent for every building. `neighbour_status` and `n_storeys` are no longer sent, the attached-neighbours picker is removed, and a reopened stored building shows the default storey count.
- A run refuses a multi-family house or apartment block with no number of dwellings, and says so, since BuEM rejects it.
- The building block no longer carries `construction_period`, which the contract defines as a TABULA class code, not the year it held. The year is stored beside the block as `construction_year`, and a block stored before 0.7.0 still reopens with the year from `construction_period`.
- A run no longer refuses a building with a zero-area surface. Such surfaces are left out of the BuEM envelope, since BuEM rejects them, in a run, in `toBuem` and in the BuEM GeoJSON export, so a building stored or exported this way reopens without them. The 3D view still marks them.

### Added

- `Building3DView` takes an optional `demandProfile` prop, the building's stored demand as the host's backend summarises it (`BuildingDemandProfile` and `DemandSeries` types). Its annual totals fill the energy card, with the total excluding kitchen gas as BuEM does.
- `Building3DView` takes an optional `seriesCsvUrl` prop; the load profile's Download link points at it.
- `Building3DView` takes an optional `attribution` prop, credits for the building's data shown in a corner of the 3D view.
- Expert mode edits what BuEM reads beyond the envelope. Occupancy: dwellings (prefilled from TABULA for MFH and AB), occupants per dwelling, household type, Dutch region code, cooking carrier, hot water and heating setback; a service building shows capacity and setback. Results to compute: each of the five load profiles off, annual or hourly. Appliances: each of BuEM's 37 appliances set to default, yes or no, with a TV count of 0 to 3.
- The cooking carrier starts at "Model default", which sends no `cooking_carrier`, so a host's model-wide setting applies; electric, gas or not reported can be set per building.
- A wall can be marked as shared with a neighbouring building, sent as `b_transmission` 0, which BuEM treats as a party wall.
- `isEnvelopeDetached` is exported, so a host can tell when a saved envelope matches none of the current City2TABULA surfaces. The view's notice for that case no longer tells the user to reload, which only the demo could do.

### Fixed

- The package shipped type declarations for the demo shell (`dist/demo/*.d.ts`, `dist/demoClient.d.ts`). They are no longer emitted.

### Removed

- The demo shell's connection to a live EnerPlanET backend: its dev login, the `/api` proxy and the weather CORS shim (`demo-proxy/`). `npm run dev` runs on bundled captures, including real ignis responses for the Loenen buildings. Not part of the package.
- The load profile's client-side download, which zipped the hourly series held in the browser. The download now comes only from `seriesCsvUrl`; without it there is none. Uploading a profile is unchanged.

## [0.6.2] - 2026-10-12

### Fixed

- A BuEM run always covered 2018, whatever period the host's model had. `Building3DView` takes an optional `runContext` prop (`{ startDate, endDate }`, exported as the `RunContext` type), and a run covers that period. Without it a run covers 2018.
- A run no longer sends the building's own id as `model_id`; it sends no `model_id` at all. buem-gateway only logs the field. `BuemBuildingRunRequest.model_id` is optional and deprecated, to be removed in the next minor release.

## [0.6.1] - 2026-10-02

### Fixed

- The `VeryHeavy` thermal mass class was sent to BuEM as `light`. The five editor classes now map to `light`, `light`, `medium`, `heavy` and `heavy`, and an unmapped class throws with its name. A building stored under 0.6.0 as VeryHeavy carries `thermal_class: light` until it is saved again.
- The MILP toggle describes BuEM's solver choice (MILP or the default sparse solver) instead of dispatch optimisation. The building CSV's `calculation_method` reads `MILP` or `sparse`.
- The building CSV labels `thermal_capacity` in `kJ/(m2K)` instead of `Wh/m2K`.

### Changed

- `docs/installing.md` describes `Building3DView` with its four `ConfiguratorServices` callbacks and peer dependencies.

### Removed

- Source files and fixtures nothing imported since the 3D view replaced the dialog. No behaviour change.

## [0.6.0] - 2026-09-28

### Added

- `toBuem(state)` returns the `{ building, solver }` blocks a run sends, for a host to store. `adaptBuemFeature` reopens them with the same state.
- `BuemBuildingRunRequest.solver` carries the MILP choice. A host transport must forward it as `properties.buem.solver`.

### Fixed

- Air change rates, `c_m`, thermal mass class, attached-neighbours code and the MILP choice survive `onExit` and reopening instead of resetting to defaults.
- Building and surface names round-trip through the stored block.

## [0.5.0] - 2026-09-24

### Changed

- **Breaking for strict consumers.** The package compiles with `strict`, so its published declarations include `| null` where the code can return null (for example `ignis`, `chartTimeseries`, `uploadError`). No behaviour change.

## [0.4.1] - 2026-09-24

### Fixed

- `ConfiguratorServices.calculateHeatDemand` types its second argument as `IgnisCalculatePayload`, which may be `undefined` when nothing was overridden. No behaviour change.

## [0.4.0] - 2026-09-24

### Changed

- **Breaking.** The package performs no I/O. `Building3DView` takes a `services` prop with four callbacks (`fetchMatchingVariants`, `fetchVariantData`, `calculateHeatDemand`, `runBuemBuilding`) that the host implements.
- **Breaking.** The 3D view replaces the card dialog as the configurator.
- `buildBuildingStates` takes the two lookup callbacks instead of a client.
- `three` is a required peer dependency; `echarts` and `echarts-for-react` are no longer peers.

### Added

- Exports `Building3DView`, `Building3DViewProps`, `ConfiguratorServices`, `VariantLookupServices`, `BuemBuildingRunRequest`, `BuemBuildingRunResponse`, `TechnologyState`, and the ignis, enrich and geometry types.

### Removed

- Exports `BuildingConfigurator`, `BuildingConfiguratorProvider`, `useConfiguratorApi`, `ConfiguratorApi`, `BuildingConfiguratorProviderProps`, `createFetchHttpClient`, `HttpError`, `HttpClient`, `RequestOptions`, `FetchHttpClientOptions`, `EnerplanetApi`, `IgnisApi`, and the `./experimental` entry point.

Versions before 0.4.0 have no changelog entries; see their git tags.

[0.7.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.7.0
[0.6.2]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.2
[0.6.1]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.1
[0.6.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.0
[0.5.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.5.0
[0.4.1]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.4.1
[0.4.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.4.0
