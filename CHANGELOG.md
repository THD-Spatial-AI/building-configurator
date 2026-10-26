# Changelog

All notable changes to `@thd-spatial-ai/building-configurator`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/). While the version is 0.x, a minor release may break the public API; its entry says so first.

Each version's GitHub release entry carries the full notes.

## [Unreleased]

Breaking: there is no PV mode. `pv` now feeds the Technologies tab and draws the building's modules on every tab; open a building there with `defaultTab="technologies"`. `Building3DView`'s `pvSurfaceIds`, `pvSurfaces` and `pvModule` are removed: the installed surfaces, their settings and the module come from `pv`.

### Added

- PV is placed on the Technologies tab. Suggested surfaces are highlighted there, a clicked surface opens its PV settings in the surface panel, and the PV overview shows capacity, surfaces with PV, investment and yearly O&M, the surfaces as a collapsed list, the catalogue and the product values.
- A PV catalogue: `PvMode.catalogue` (products in EnerPlanET's technology DTO shape, exported as `TechnologyProduct`), `products` (this building's copies), `productId` and `PvSurface.productId`. A product is dragged onto a surface or chosen in its panel (`onAssignProduct`); its module comes from `module_width_m`, `module_height_m` and `module_power_kwp`.
- "Fits more here" in a surface's panel: up to three catalogue products that reach more capacity on that surface, with their cost per kWp and "Use on this surface".
- Investment and yearly O&M before a run, from each product's `cost_energy_cap` and `cost_om_annual` times its layout's kWp, marked as estimates.
- Product values: basic mode asks cost per kWp, yearly upkeep per kWp and lifetime; expert mode adds every value the product carries that reaches Calliope or the PV yield service. Changes go to this building's copy (`onConstraintChange`); "Save as a new technology" calls `onSaveAsTechnology`.
- The `runPvBuilding` request carries each surface's `product_id`.
- `defaultTab` opens the view on a given tab.
- `pvLayout`'s result carries `capped`: whether the usable share or the surface's space limits the modules. A surface's panel says when it is the space, as on most racked flat roofs, where the usable share then changes nothing.

### Fixed

- A building saved by the configurator reopened with 4 storeys (or 0 from an imported file) and its floor area split across them, because BuEM takes no storey count and none was stored. The count is now stored beside the BuEM block as `properties.buem.storeys`, like `construction_year`. Buildings saved before this keep the old behaviour until saved again.

### Changed

- The clicked surface's panel is a fixed column left of the model on a wide screen, so it no longer covers the building while it turns, and a sheet over the bottom of the screen on a narrow one. A flat surface shows "Flat" and no facing.

- The package installs no dependencies of its own; `react`, `react-dom` and `three` stay peer dependencies. Removed: `@radix-ui/react-dialog`, `@radix-ui/react-switch` and `@radix-ui/react-tooltip` (the browser's `<dialog>`, a plain switch and a small tooltip instead), `lucide-react` (the 26 icons used are copied into the package under their ISC licence), `clsx` and `tailwind-merge`, `fflate` (a small writer for the stored ZIP of the model tables) and `earcut` (three.js's own triangulation). The demo application also drops `@vercel/analytics`, `@vercel/edge` and the unused `@thd-spatial-ai/feedback-kit`.

## [0.13.0] - 2026-10-26

Breaking: `PvMode` requires `onMountingChange(surfaceId, mounting, orientation)`. Store both values per surface and pass them back as `surfaces[id].mounting` and `orientation`.

### Added

- PV is laid out as whole modules from each surface's geometry instead of a module pattern trimmed to the surface. Modules keep 0.3 m from every edge, cover at most the usable share of the surface, and are drawn in 3D at their own tilt and facing. `PvMode.module` and `Building3DView`'s `pvModule` give the module size and kWp; without them a 1.134 by 1.762 m, 0.4 kWp module is used (`DEFAULT_PV_MODULE`).
- Mounting per surface: flush in the surface's plane, or racked at its own tilt and facing in rows spaced so no row shades the next with the sun 20° up. A surface under 10° starts racked at 15° facing south, any other flush. Racking is offered on surfaces under 10° only. Until the user picks portrait or landscape, a flush surface takes whichever fits most: one orientation, or one with the room it leaves filled by modules turned the other way. A racked surface keeps one orientation, since a row's spacing follows its modules' height. The surface card offers all three and shows the module count, capacity and module area, or that no whole module fits.
- `pvLayout`, the same calculation, is exported with its types so a host can store the module count and capacity the user saw.
- The `runPvBuilding` request carries each surface's `modules`, `kwp`, `panel_tilt` and `panel_azimuth` from its layout.

- PV mode is redesigned. The panel has a "PV configurator" title, a hint that clicking a roof or wall adds or removes PV (also shown over the 3D view), totals for capacity, surfaces with PV and panel area, and per surface its tilt, facing, area and capacity ("up to" without PV) with a Suggested chip and a switch. "Use suggested surfaces" turns on every suggested surface through `onToggle`. The host's `notice` moves below the list.
- Hovering a surface in PV mode shows its name, geometry, state and what a click does. A clicked surface's card shows its tilt, facing and area, the PV switch and the usable share, and Remove PV and Done; a suggested surface without PV offers "Add PV to this surface".
- In 3D, suggested surfaces have a light fill and a dashed orange outline, and a legend explains the three states.
- `PvSurface` takes optional `tilt`, `azimuth` and `area` for a surface that is not among the building's elements. `Building3DView` takes an optional `pvSurfaces`, each surface's usable share, mounting and orientation, so the normal view lays out the same modules as PV mode.

### Changed

- `PvSurface.maxKwp` is shown only for a surface the view has no polygon for; every other surface shows its layout's capacity.
- Hot water is shown in red and cooking gas in violet in the energy overview.

### Fixed

- Leaving PV mode with Escape also closed the normal view that replaced it: the view mounted by the key press took the same press. A view now ignores key presses from before it mounted.

## [0.12.0] - 2026-10-23

### Added

- `ConfiguratorServices.runPvBuilding` (optional, with `PvBuildingRunRequest` and `PvBuildingRunResponse` types): when the host passes `pvSurfaceIds`, Save & Preview also asks the host for the building's annual PV generation, sending each PV surface's area, tilt and azimuth as currently edited. The energy overview shows it as a PV generation row. A failed PV run shows its own message and leaves the demand result in place. Without the service nothing changes.

## [0.11.0] - 2026-10-23

### Added

- `Building3DView` takes an optional `language` prop: `en`, `de`, `es`, `fr`, `it`, `nl`, `pl` or `cs`, EnerPlanET's languages. A region tag counts as its language (`de-DE` is `de`); any other code, or none, is `en`. Changing it re-renders the open view without losing edits. The view's own text comes from the package's translation files under `src/app/i18n/locales/`; a text missing from a language shows in English. Text the host passes in is shown as given. The `Language` type is exported. All eight languages are bundled, which takes `dist/index.js` from about 196 kB to about 350 kB (94 kB gzipped).
- Numbers follow the view's language: 0,40 and 21.356 in German, 0.40 and 21,356 in English. Number fields are text fields that show the language's decimal separator and accept a comma or a point; the arrow keys still step the value. `lang` is set on the view's root.
- The view follows the host's light or dark theme. Its colours come from the host's theme variables (`--background`, `--card`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary` and the rest of the shadcn set), so a host that switches them, for example with a `.dark` class, switches the view; there is no theme prop. The 3D model's background is the host's muted colour.

### Changed

- Cooking with (BuEM `cooking_carrier`) is set per building: electric (default), gas or none. The "Model default" option is gone and the building always sends its value, so the model's cooking setting no longer applies to a building opened in the view. A stored building that names none opens as electric.
- `EnergyTotals.*ComparisonLabel` holds a translation key instead of English text.
- A single surface reads "1 surface", not "1 surfaces".

## [0.10.1] - 2026-10-21

### Fixed

- Escape did not leave the 3D view in a host that re-renders it while a key press is being dispatched, as EnerPlanET does: the view replaced its key listener during that press, and the event never reached the new one. The listener is now registered once for the life of the view.

### Changed

- The Map button shows an Esc hint.

## [0.10.0] - 2026-10-20

### Added

- `Building3DView` takes an optional `defaultMode` prop, `basic` (default) or `expert`: the mode it opens in. The user can still switch.

- A Heating and comfort group in the Parameters tab. Basic sets the heating setpoint (BuEM `comfortT_lb`, default 18 °C), when to lower it (setback) and whether hot water is included. Expert adds the cooling setpoint (`comfortT_ub`, default 21 °C), the air changes and the thermal mass. The setpoints are saved with the building.

- An Insulation and windows group replaces the refurbishment level buttons. Basic sets the whole building to one of TABULA's variants for it: existing state, usual refurbishment or advanced refurbishment, under the names ignis gives. Expert sets a state, U-value and, for walls, roof and floor, a loss factor (BuEM `b_transmission`, 0 to 1) per element type. A state change leaves surfaces set one by one at their values; they show as Custom. Party walls keep their loss factor of 0. Without TABULA variants for the building, only the U-values are offered.
- The states and the building's City2TABULA variant code are saved with the building: `toBuem` returns them as `refurbishment` beside the building block, `{ variant_code?, states? }`, and `adaptBuemFeature` reads them back from `properties.buem.refurbishment`. They are not sent to BuEM. `BuildingState` takes an optional `refurbishment`, and `buildBuildingStates` fills its variant code from the enrich response.
- A building opens in the state its City2TABULA variant code names (`...ReEx.001.002` is usual refurbishment) and looks up the variants of its own subtype (`...SFH.02.Deta...` is `Deta`).
- `ConfiguratorServices.fetchMatchingVariants` takes an optional fourth argument, `subtype`, to forward to ignis as the `subtype` query parameter.
- Expert sets the windows BuEM adds to a building without window surfaces: window share (`window_to_wall_ratio`), U-value (`window_U`) and g-value (`window_g_gl`). Left empty, BuEM uses its defaults.

- Expert adds a surface the 3D data does not show, such as a wall against ground or a floor over an open passage, with a name, area, U-value and loss factor. It is listed in the Envelope tab, not drawn in the model, and a refurbishment state leaves its U-value as entered.

### Changed

- Appliances are grouped into five collapsible categories, each with a one-line summary of what is set by hand.
- Only variants 1 to 3 of the building's own subtype are offered. ignis releases before the subtype filter list other subtypes as further levels, and their generic labels (Medium refurbishment, Refurbishment level N) show as TABULA's names.
- The Parameters tab shows the building editor in Basic too, with fewer groups than Expert, and scrolls as one panel instead of a fixed-height box inside it.
- Setback and hot water moved from Occupancy to Heating and comfort; the separate air and thermal mass groups are now part of it.
- The side panel is wider (400 px, 520 px from the xl breakpoint) so the expert parameters fit.

### Fixed

- A refurbishment state changed no U-value. The configurator read TABULA's `U_*_1` fields, which hold the elements' original U-values in every variant; a variant's own values are in `U_Actual_*_1`. The variant's own value is now used, and the original where TABULA gives none. This also corrects the U-values of a building whose City2TABULA variant is refurbished, and the per-surface TABULA presets.
- Window and door elements carry `parent_id`, which the v6-draft schema requires: the surface the element names, else the largest wall on the same face (a roof for a window tilted under 60°), else the wall closest in azimuth. A window or door with no wall or roof to sit in stops the request with an error naming it. `BuildingElement` takes an optional `parentId`, read from `parent_id` on load.
- With no TABULA data for a building, the panel no longer points at a service on `localhost:8080`; it says the TABULA service holds no variant for the building or could not be reached.
- Thermal mass offers BuEM's three classes (light, medium, heavy), so a saved choice reopens as chosen. Each sets the heat capacity c_m to its EN ISO 13790 value (110, 165, 260 kJ/(m²K)).
- Editing and importing a building share one set of defaults, the v6-draft schema's: air changes 0.5 and 0.5 1/h, c_m 165 kJ/(m²K), medium thermal mass. Editing used 0.4, 0.4, 110 and importing fell back to light.

## [0.9.0] - 2026-10-19

### Added

- `Building3DView` takes an optional `pvSurfaceIds` prop: the surfaces the host has PV on are drawn with panels in the normal view, read-only.
- `PvSurface` takes an optional `label`, the name shown for a surface that is not among the building's elements, such as a roof of a neighbouring 3D building. An element's own label takes precedence, then this label, then the surface id.
- `Building3DView` takes an optional `technologies` prop (`Technologies`, `TechCard`, `TechField` types) that adds a Technologies tab with one card per technology the host passes. A card shows the host's fields, as number inputs where editable, with `null` shown as "∞" for an unbounded value and a field `error` shown under its input; an optional action button, for example one that opens PV mode; and a remove button. Edits go to `onChange` and `onRemove`; the view stores nothing.

## [0.8.1] - 2026-10-18

### Fixed

- Leaving a building that was opened and not edited asked about unsaved changes, and choosing to save handed the host a changed building. This happened in PV mode, where the view stores nothing, as well as in the normal view. The adjustments made while a building opens (TABULA U-values and, where the building brings none, the dwelling count) now count as part of opening it: leaving without an edit calls `onExit` with the building as passed in.

## [0.8.0] - 2026-10-18

This release breaks the host interface: the package no longer defines or stores technologies. The host owns them.

### Added

- `Building3DView` takes an optional `pv` prop (`PvMode` and `PvSurface` types) that opens it in PV mode, driven entirely by the host. Surfaces the host offers are drawn with panels (`installed`), lit and outlined (`suggested`) or as usual (`available`). Clicking one switches PV through `onToggle`, and a surface with PV takes a usable share through `onShareChange`. The host's `notice` stays visible throughout. The view stores nothing.

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

[0.9.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.9.0
[0.8.1]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.8.1
[0.8.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.8.0
[0.7.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.7.0
[0.6.2]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.2
[0.6.1]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.1
[0.6.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.6.0
[0.5.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.5.0
[0.4.1]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.4.1
[0.4.0]: https://github.com/THD-Spatial-AI/building-configurator/releases/tag/v0.4.0
