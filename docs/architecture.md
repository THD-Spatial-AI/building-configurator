# Architecture

The Building Configurator is a single-page React application. All application state lives in one component (`BuildingConfigurator`), which renders one of two workspace layers depending on the user's current view.

## Two-layer structure

```mermaid
graph TD
    App["App<br>(map shell + data seeding)"]
    BC["BuildingConfigurator<br>State owner"]
    OV["Overview layer<br>workspaceView = overview"]
    CF["Configure layer<br>workspaceView = configure"]

    App --> BC
    BC --> OV
    BC --> CF
```

The header toggle (`Overview ↔ Configure`) switches `workspaceView` in `BuildingConfigurator`. Both layers read from the same state; neither owns its own copy.

---

## Overview layer

Displayed when `workspaceView === 'overview'`. Split into two fixed columns.

```mermaid
graph TD
    BC["BuildingConfigurator"]

    subgraph OV["Overview layout — grid-cols: 430px | flex"]
        BSA["BuildingSnapshotAside<br>(left column)"]
        EEC["EnergyEnvelopeColumn<br>(right column)"]

        BSA --> N1["Data quality notice"]
        BSA --> N2["Energy hero<br>Heating / Electricity / Hot Water / Thermal efficiency"]
        BSA --> N3["Building parameters table<br>snapshotRows (type, area, U-value, storeys …)"]

        EEC --> LPV["LoadProfileViewer<br>Recharts line chart — hourly → monthly"]
        EEC --> ECS["ElementCompositionSection<br>Envelope accordion per surface group"]
        EEC --> TS["TechnologiesSection<br>4 tech cards"]

        TS --> T1["Solar PV card<br>per-surface scope — not togglable"]
        TS --> T2["Battery card<br>togglable install toggle"]
        TS --> T3["Heat Pump card<br>togglable install toggle"]
        TS --> T4["EV Charger card<br>togglable install toggle"]
    end

    BC --> OV
```

### Data flowing into Overview

| Prop | Source | Destination |
|---|---|---|
| `energyTotals` | `computeEnergyTotals(timeseries, thermalSummary)` | Energy hero numbers |
| `snapshotRows` | `buildSnapshotRows(general, elements)` | Parameters table |
| `thermalRating` | `getThermalRating(avgUValue)` | Thermal efficiency badge |
| `installedTechIds` | `otherTechIds + batteryConfig.installed` | Technology cards |
| `pvSummary` | derived from `surfacePvConfigs` | Solar PV card |
| `initialTimeseries` | `buildingData.thematic.timeseries` | Load profile chart |
| `elements` | surface state | Envelope composition |

---

## Configure layer

Displayed when `workspaceView === 'configure'`. Also split into two columns; the right column is further divided.

```mermaid
graph TD
    BC["BuildingConfigurator"]

    subgraph CF["Configure layout — grid-cols: 430px | flex"]
        LA["Left aside"]
        RS["Right section"]

        LA --> BV["BuildingVisualization<br>Clickable SVG 3D preview<br>Rotates to face direction on element select"]
        LA --> ED["Energy demand mini-panel<br>Same energyTotals as Overview — read-only"]

        RS --> CP["Center panel<br>switches on panelView"]
        RS --> SC["Selector column (w-72)<br>SurfaceGroupSelector"]

        CP --> PB["panelView = building<br>BuildingEditor<br>Type / area / height / storeys"]
        CP --> PSG["panelView = surface-group<br>(non-roof, element selected)<br>SurfaceGroupEditor<br>Geometry tab + Thermal tab + PV tab"]
        CP --> PRG["panelView = surface-group (roof)<br>SurfaceGroupGrid (type picker)<br>+ embedded SurfaceGroupEditor"]
        CP --> PPV["panelView = technology-pv<br>PvSurfaceManager<br>List of PV-enabled surfaces"]
        CP --> PBT["panelView = technology-battery<br>BatteryEditor<br>Capacity / efficiency / cost params"]

        SC --> SNav["Building nav item → panelView = building"]
        SC --> SGNav["Surface group nav items<br>Wall / Roof / Floor / Window / Door"]
        SC --> STNav["Technology nav items<br>Solar PV → technology-pv<br>Battery → technology-battery"]
    end

    BC --> CF
```

### Panel navigation state machine

`panelView` is driven by user interaction. The transitions are:

```mermaid
stateDiagram-v2
    [*] --> building : initial / reset

    building --> surface_group : click surface group in selector
    building --> technology_pv : click Solar PV in selector
    building --> technology_battery : click Battery in selector

    surface_group --> building : click Building in selector
    surface_group --> surface_group : click different group or surface
    surface_group --> technology_pv : click Solar PV
    surface_group --> technology_battery : click Battery

    technology_pv --> surface_group : click a surface to configure its PV tab
    technology_pv --> building : click Building
    technology_battery --> building : click Building
```

---

## State owned by BuildingConfigurator

```mermaid
classDiagram
    class BuildingConfigurator {
        workspaceView: overview | configure
        mode: basic | expert
        panelView: building | surface-group | technology-pv | technology-battery
        activeGroupType: ElementGroupKey | null
        selectedId: string | null
        elements: Record~string, BuildingElement~
        general: GeneralConfig
        roofConfig: RoofConfig
        surfacePvConfigs: Record~string, PvConfig~
        batteryConfig: BatteryConfig
        otherTechIds: string[]
        energyTotals: EnergyTotals
        pvInvalidated: boolean
        savedState: snapshot for unsaved-change detection
    }

    class BuildingElement {
        id: string
        label: string
        type: wall | window | door | roof | floor
        area: number
        uValue: number
        gValue: number | null
        tilt: number
        azimuth: number
        source: city | default | custom
        customMode: boolean
    }

    class PvConfig {
        installed: boolean
        geometryMode: surface | manual
        system_capacity: number
        tilt: number
        azimuth: number
        cont_energy_cap_max: number
        cont_energy_eff: number
        inv_eff: number
        cost_energy_cap: number
    }

    class BatteryConfig {
        installed: boolean
        cont_energy_cap_max: number
        cont_storage_cap_max: number
        cont_energy_eff: number
        cont_storage_loss: number
        cost_energy_cap: number
        cost_storage_cap: number
    }

    BuildingConfigurator "1" --> "0..*" BuildingElement : elements
    BuildingConfigurator "1" --> "0..*" PvConfig : surfacePvConfigs
    BuildingConfigurator "1" --> "1" BatteryConfig : batteryConfig
```

---

## Data model output (`exportToBuemGeojson`)

The export assembles state into a BUEM GeoJSON FeatureCollection. Which fields appear depends on which technologies are installed.

```mermaid
graph LR
    S["BuildingConfigurator state"]

    S --> ID["identity<br>id / label / coordinates<br>buildingType / constructionPeriod<br>floorArea / roomHeight / storeys"]
    S --> ENV["envelope<br>one feature per BuildingElement<br>area / uValue / tilt / azimuth"]
    S --> PV["techs.pv_supply<br>per-surface PV params<br>only if installed = true"]
    S --> BAT["techs.battery_storage<br>capacity / efficiency / cost<br>only if installed = true"]
    S --> OTH["techs (other)<br>heat_pump / ev_charger<br>only if in installedTechIds"]
```

---

## Redesign: tech card visibility registry

### Problem

Technologies (Solar PV, Battery, Heat Pump, EV Charger) are hardcoded in `TechnologiesSection.tsx` and `SurfaceGroupSelector.tsx`. Adding or hiding a technology requires editing multiple files and manually pruning the data model.

### Proposed design

Replace the hardcoded lists with a **tech registry** — a single configuration file that is the only place a developer touches when adding, removing, or hiding a technology.

```mermaid
graph TD
    REG["techRegistry.ts<br>Array of TechCardDefinition"]

    REG --> OV2["Overview: TechnologiesSection<br>renders only visible cards"]
    REG --> CFG2["Configure: SurfaceGroupSelector<br>shows only visible tech nav items"]
    REG --> EXP["exportToBuemGeojson<br>includes params only when<br>visible OR includeInModel = true"]
```

#### `TechCardDefinition` type

```typescript
interface TechCardDefinition {
  /** Stable identifier used in installedTechIds and GeoJSON output. */
  id: string;

  /** Display name shown on the card. */
  label: string;

  /** Lucide icon component. */
  Icon: React.ElementType;

  /**
   * When false, the card is hidden from Overview and Configure nav.
   * The technology is effectively disabled for users.
   * Default: true.
   */
  visible: boolean;

  /**
   * When true, the tech's parameters are written to the exported data model
   * even if visible = false. Useful for pre-populating params that the
   * simulation engine always expects, regardless of whether the user sees the card.
   * Default: false.
   */
  includeInModel: boolean;

  /**
   * Where the technology is configured.
   * 'per-surface' → PV-style (no install toggle; scope is each surface).
   * 'building'    → building-level toggle + optional detail editor panel.
   * 'none'        → toggle only, no configure panel.
   */
  scope: 'per-surface' | 'building' | 'none';

  /**
   * panelView key to navigate to when the card is opened.
   * Required when scope = 'building'.
   */
  panelView?: string;
}
```

#### Example registry (`src/app/config/techRegistry.ts`)

```typescript
export const TECH_REGISTRY: TechCardDefinition[] = [
  {
    id:             'solar_pv',
    label:          'Solar PV',
    Icon:           Sun,
    visible:        true,
    includeInModel: false,
    scope:          'per-surface',
  },
  {
    id:             'battery',
    label:          'Battery',
    Icon:           Battery,
    visible:        true,
    includeInModel: false,
    scope:          'building',
    panelView:      'technology-battery',
  },
  {
    id:             'heat_pump',
    label:          'Heat Pump',
    Icon:           Thermometer,
    visible:        true,
    includeInModel: false,
    scope:          'none',
  },
  {
    id:             'ev_charger',
    label:          'EV Charger',
    Icon:           Plug,
    visible:        false,       // hidden — card does not appear in UI
    includeInModel: false,
    scope:          'none',
  },
];
```

To hide a card: set `visible: false`.
To keep its parameters in the exported JSON even when hidden: also set `includeInModel: true`.
To add a new technology: append one entry and implement the configure panel if `scope = 'building'`.

!!! info "Implementation scope"
    The registry change requires updating three files: `TechnologiesSection.tsx` (reads `TECH_REGISTRY` instead of the hardcoded `BUILDING_TECHNOLOGIES` array), `SurfaceGroupSelector.tsx` (reads `TECH_REGISTRY` for nav items), and `exportToBuemGeojson` in `buemAdapter.ts` (checks `visible || includeInModel` before writing tech params).
