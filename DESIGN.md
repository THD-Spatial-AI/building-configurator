# Building Configurator UI Refactor

Based on the current UI in the screenshots, here is a plain description of what to move where and why.

---

## Overall layout change

The current layout stacks everything vertically in a single column on the right side of the screen, with the map taking up the left half. The Load Profile Viewer sits entirely below the fold and requires scrolling to reach.

The new layout splits the right-hand area into three columns sitting side by side:

- A narrow left column for the building elements list
- A wide centre column for the 3D preview and load profile viewer
- A narrow right column for all configuration fields

The map stays where it is on the left of the screen and does not change.

---

## Top bar

A slim horizontal bar should span the full width of all three columns at the top. Move the following into it from the current side panel header:

- The building name and number ("Building 3 - MFH")
- The Basic and Expert toggle buttons
- The coordinates ("48.1351 N, 11.5820 E")
- The export and share icon buttons

This frees up significant vertical space in the panel below by removing that entire header block.

---

## Left column: Building Elements

Move the Building Elements list (Walls, Windows, Doors, Roof, Floor) into its own dedicated left column. This list does not change in content or behaviour, it just gets its own column rather than sharing space with the configuration fields.

Remove the Building Overview summary row (Total Area, Avg U-value, Elements count) from above this list. Those three values move to the right column instead.

---

## Centre column: 3D Preview and Load Profile Viewer

This column is split vertically into two halves.

The top half holds the 3D building preview. This component does not move far — it is already roughly in the centre of the screen — but it should now fill the top portion of this dedicated column rather than being constrained by the panel above it.

The bottom half holds the Load Profile Viewer. This is the most significant positional change. Currently the Load Profile Viewer sits below the entire side panel and requires scrolling to see. Move it up into the bottom half of the centre column so it is always visible alongside the 3D preview. The Hourly, Daily, Weekly, Monthly tabs and the Electricity, Heating, Hot Water, Combined tabs all stay exactly as they are. Only the position changes.

---

## Right column: Configuration

This column holds all the editable configuration fields. Stack them in this order from top to bottom:

1. The three summary values that are currently shown above the elements list — Total Area, Avg U-value, and Elements count — move here as small read-only cards at the very top of this column. Think of them as a quick-glance summary before the user edits anything.

2. The Identity section (Building Type, Construction Period, Country/Region) comes next. These fields do not change.

3. The Metrics section (Floor Area, Room Height, Storeys Above Ground, and the computed Volume and Per Storey Area values) comes after Identity. These fields do not change.

4. The Reset and Apply buttons stay pinned to the bottom of this column, exactly as they are now.

---

## Summary of moves

| What | From | To |
|---|---|---|
| Building name, toggle, coordinates, export buttons | Top of side panel header | Shared top bar |
| Building Overview cards (area, U-value, elements) | Above the elements list | Top of right column |
| Building Elements list | Shared side panel | Left column |
| 3D preview | Centre area | Top half of centre column |
| Load Profile Viewer | Below the fold, requires scrolling | Bottom half of centre column |
| Identity fields | Side panel | Right column |
| Metrics fields | Side panel | Right column |
| Reset and Apply buttons | Bottom of side panel | Pinned bottom of right column |
