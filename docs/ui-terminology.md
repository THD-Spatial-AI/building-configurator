---
audience: developer
---

# UI Terminology

The names used for the regions and controls of the 3D view (`Building3DView`) in code, issues and pull requests. [Architecture](architecture.md) maps each region to its component.

## Regions

| Term | What it is | Component |
|---|---|---|
| Header | The strip at the top: back, building name, Tour, Export, Simple/Advanced, Undo | `Building3DView` |
| Model | The 3D building in the centre; a click opens a surface | `SurfaceGeometryViewer` |
| Surface panel | The column left of the model, showing the open surface; on a narrow screen a sheet from the bottom | `SurfacePanel` |
| Storey panel | Replaces the surface panel while storeys are picked in the model | `StoreyPanel` |
| Building panel | The column right of the model, with the Building and Technologies tabs | `BuildingDetailsCard` |
| Building tab | Load profile, annual demand, building data, storeys modelled and the building sections | `BuildingDetailsCard` |
| Technologies tab | PV and the host's technologies, one card each | `TechnologiesTab` |
| Run button | "Save & Preview Energy Demand" under the building panel | `Building3DView` |

## Building blocks

| Term | What it is | Component |
|---|---|---|
| Section | A titled block with a header band in its topic's colour and the topic's icon. A dashed border marks an Advanced-only section | `SectionCard` |
| Collapsible section | A section that shows a one-line summary until opened; its header and its arrow both open it | `SectionCard` with `onToggle` |
| Technology card | One technology on the Technologies tab, with a headline figure, products and cost; its header brings it into focus | `TechCardFrame` |
| Tile | One figure of the building in the building data section; a dot marks a changed value | `Tile` in `BuildingDetailsCard.tsx` |
| Info tip | The info icon in a header; hovering or focusing it explains the section | `InfoTip` |
| Status badge | "default" or "modified" beside a value in the editable building data table | `SnapshotStatusBadge` |
| Source tag | Marks a demand figure as estimated (ignis) or user-defined; a BuEM figure has none | `SourceTag` |
| Segmented control | A filled pill of exclusive options that switches a mode, such as Simple/Advanced | `SegmentedControl` |
| Tabs | Underlined labels that swap the whole body of a panel, such as Building and Technologies | `BuildingDetailsCard` |
| Dialog | Asks before unsaved changes are lost | `UnsavedChangesDialog` |

## Guidance

| Term | What it is | Component |
|---|---|---|
| Tour | Five steps that each light up one region with a card explaining it; started from the header or by the host's `tour` prop | `Tour` |
| Step hints | A card over the model naming the next step until a run is started | `StepHints` |
| PV hint | The pill over the model on the Technologies tab saying where products can be dropped | `PvHintPill` |

!!! tip "Choosing a control"
    - A segmented control for a mode that changes how the same content is shown; tabs when the whole body changes.
    - A section for each topic in a panel; never a section inside a section.
    - A dialog only to confirm losing changes; everything else is edited in place.
