# ignis field mapping

How Building Configurator reads TABULA building parameters out of ignis's `GET /api/v1/data/:code` response, and what we learned while fixing a bug where several fields silently showed as `0`.

## Investigation: the bug was not per-country

The bug was first noticed on a Netherlands (NL) building — the "Heating days" and "Outside temp θ_e" fields showed `0`. The original hypothesis was that ignis's TABULA database uses different column names per country.

!!! note "That hypothesis was wrong"
    ignis's `build_db` reads **one shared header row** from `data/tabula-calculator.xlsx` and creates an identical set of columns in every country's Postgres table (see `ignis/internal/models/tabula.go`). NL's raw data has no missing or differently-named columns, and passes 100% of ignis's own `q_h_nd` validation. The schema is uniform across all 20 TABULA countries — there is no per-country divergence to map.

The real, country-independent bug: `ignisInputsFromTabulaData` (`src/app/lib/ignisAdapter.ts`) read flat keys like `tabula['HeatingDays']`, but ignis's actual response nests every field under `BasicParameters`/`AdvancedParameters` sub-objects. The lookup silently returned `undefined` (→ `0` in the UI) for **every** country — NL is just where a human happened to notice it first.

## Field path mapping

`tabula_data` (the object returned by `GET /api/v1/data/:code`) nests every field under one of these groups. This table is the single source of truth for `TABULA_FIELD_PATHS` in `ignisAdapter.ts`.

| Group | Path prefix | Fields |
|---|---|---|
| Envelope areas | `BasicParameters.Envelope` | `A_C_Ref_Input`, `A_Roof_1/2`, `A_Wall_1/2/3`, `A_Floor_1/2`, `A_Window_1/2/South/East/West/North`, `A_Door_1` |
| Climate | `AdvancedParameters.ClimateConditions` | `HeatingDays`, `Theta_e`, `theta_i` (exposed as `Theta_i`) |
| U-values | `AdvancedParameters.Uvalues` | `U_Roof_1`, `U_Wall_1`, `U_Floor_1`, `U_Window_1`, `U_Door_1` |
| Air infiltration | `AdvancedParameters.AirInfiltration` | `n_air_infiltration`, `n_air_use` |
| Heat transfer | `AdvancedParameters.HeatTransfer` | `F_sh_hor`, `F_sh_vert`, `F_f`, `F_w`, `phi_int` (→ `Phi_int`), `c_m` (→ `C_m`) |
| Solar gains | `AdvancedParameters.SolarGains` | `I_Sol_South/East/West/North`, `I_Sol_Hor` (→ `I_Sol_Horizontal`) |
| Thermal bridging | `AdvancedParameters.ThermalBridges` | `delta_U_ThermalBridging_Original/Refurbished` |

!!! tip "Where this comes from"
    ignis also exposes this same mapping at runtime via `GET /api/v1/fields` (each entry's `path` field), generated directly from `internal/models/tabula.go`. The table above is a static copy kept in `ignisAdapter.ts` so that `ignisInputsFromTabulaData` stays a pure, synchronous, dependency-free function — see `src/app/lib/ignisAdapter.test.ts` for the regression tests covering DE/AT/FR/NL.
