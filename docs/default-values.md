---
audience: non-technical
---

# Default values

A field left empty, or showing "Default", uses the value below when the building's yearly energy demand is calculated. Type your own value into the field to replace it.

The Source column names where a value comes from. BuEM is the building energy model that calculates the demand. TABULA is a European catalogue of typical buildings by type and age. CBS is Statistics Netherlands.

## Occupancy

| Field | Default | Source |
|---|---|---|
| Dwellings | 1 dwelling. Required for a multi-family house and an apartment block. | BuEM |
| Occupants per dwelling | The household size for the building's country and type, in the table below | CBS for the Netherlands, typical figures elsewhere |
| Household type | Set by the building type, in the table below | The occupancy model in BuEM |
| Capacity, for a non-residential building | Floor area divided by the floor area per occupant for the type, in the table below | European and US standards for how many people occupy a space (EN 16798-1, ASHRAE 62.1) |

### Household size

People per dwelling. A country or region without its own figure takes the general one.

| Building type | Netherlands | Elsewhere |
|---|---|---|
| Single-family house | 2.55 | 2.6 |
| Terraced house | 2.41 | 2.4 |
| Multi-family house | 1.54 | 1.9 |
| Apartment block | 1.54 | 1.7 |

The Dutch figures are those of CBS for 2024 and 2025: people in private households per dwelling. In Apeldoorn (region code GM0200), a multi-family house or apartment block has 1.37.

### Household type

| Building type | Household type |
|---|---|
| Single-family house | Family with children |
| Terraced house | Working couple |
| Multi-family house | Generic household |
| Apartment block | Generic household |

### Floor area per occupant

For a non-residential building without a capacity.

| Building type | m² per occupant |
|---|---|
| Office | 15 |
| School | 5 |
| Restaurant | 3 |
| Supermarket | 10 |
| Hotel | 20 |
| Warehouse | 100 |
| Clinic | 15 |
| Bakery | 10 |

## Windows

These apply when the building has no window surfaces of its own, so windows are added to each exposed wall.

| Field | Default | Source |
|---|---|---|
| Window share | 20 % of each exposed wall | BuEM |
| Window U: heat lost through the window, in W/m²K; lower loses less | The value for the building's type and age, else 2.8 | TABULA, else BuEM |
| Window g: share of the sunlight on the window that enters as heat, from 0 to 1 | The value for the building's type and age, else 0.5 | TABULA, else BuEM |

## Comfort and air

The fields start with these values.

| Field | Default | Source |
|---|---|---|
| Heating setpoint | 18 °C | BuEM |
| Cooling setpoint | 21 °C | BuEM |
| Air leakage: indoor air replaced through gaps each hour | 0.5 times per hour | BuEM |
| Ventilation by occupants: indoor air replaced by opening windows and fans while the building is in use | 0.5 times per hour | BuEM |
| Thermal mass: how much heat the structure stores | Medium, 165 kJ per m² of floor and kelvin | BuEM |
| Hot water | Included | BuEM |
| Cooking with | Electric | BuEM |
