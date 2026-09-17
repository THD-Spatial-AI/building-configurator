---
audience: developer
---

# ignis field mapping

`ignisInputsFromTabulaData` in `src/app/lib/ignisAdapter.ts` reads TABULA building parameters from `tabula_data`, the object returned by ignis's `GET /api/v1/data/:code`.

!!! warning "Every field is nested"
    `tabula_data` nests every field under a group. A flat lookup such as `tabula['HeatingDays']` returns `undefined`, and the UI shows it as `0` without an error. Read each field by its full path from the table below.

| Group | Path prefix | Fields |
|---|---|---|
| Envelope areas | `BasicParameters.Envelope` | `A_C_Ref_Input`, `A_Roof_1/2`, `A_Wall_1/2/3`, `A_Floor_1/2`, `A_Window_1/2/South/East/West/North`, `A_Door_1` |
| Climate | `AdvancedParameters.ClimateConditions` | `HeatingDays`, `Theta_e`, `theta_i` (exposed as `Theta_i`) |
| U-values | `AdvancedParameters.Uvalues` | `U_Roof_1`, `U_Wall_1`, `U_Floor_1`, `U_Window_1`, `U_Door_1` |
| Air infiltration | `AdvancedParameters.AirInfiltration` | `n_air_infiltration`, `n_air_use` |
| Heat transfer | `AdvancedParameters.HeatTransfer` | `F_sh_hor`, `F_sh_vert`, `F_f`, `F_w`, `phi_int` (exposed as `Phi_int`), `c_m` (exposed as `C_m`) |
| Solar gains | `AdvancedParameters.SolarGains` | `I_Sol_South/East/West/North`, `I_Sol_Hor` (exposed as `I_Sol_Horizontal`) |
| Thermal bridging | `AdvancedParameters.ThermalBridges` | `delta_U_ThermalBridging_Original/Refurbished` |

The paths are the same for every TABULA country. ignis's `build_db` creates every country table from one header row in `data/tabula-calculator.xlsx` (see `internal/models/tabula.go` in ignis), so the mapping has no per-country variants.

## Keeping the mapping in step

- `TABULA_FIELD_PATHS` in `ignisAdapter.ts` is a static copy of these paths. `ignisInputsFromTabulaData` is synchronous and does not fetch them from ignis.
- ignis serves the same mapping at runtime: `GET /api/v1/fields` returns a `path` for each field, generated from `internal/models/tabula.go`. When that file changes, update `TABULA_FIELD_PATHS` and this table.
- `src/app/lib/ignisAdapter.test.ts` holds the regression tests for DE, AT, FR and NL.
