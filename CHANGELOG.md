# Changelog

All notable changes to `@thd-spatial-ai/building-configurator`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/). While the version is 0.x, a minor release may break the public API; its entry says so first.

Each version's GitHub release entry carries the full notes.

## [0.6.2] - 2026-10-12

### Fixed

- A BuEM run always covered 2018, whatever period the host's model had, and sent the building's own id as `model_id`. `Building3DView` takes an optional `runContext` prop (`{ startDate, endDate, modelId? }`, exported as the `RunContext` type): a run covers that period and carries that model id. Without it a run covers 2018 and sends no `model_id`.
- `BuemBuildingRunRequest.model_id` is optional: absent for an unsaved model or when no `runContext` is given. A host transport must handle it being absent.

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

[0.6.2]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.2
[0.6.1]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.1
[0.6.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.0
[0.5.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.5.0
[0.4.1]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.4.1
[0.4.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.4.0
