# Item Wrench dialog

The item Wrench dialog is separate from the nameplate Wrench style/decorations UI.

## Definition precedence

When an item is selected and the sidebar WRENCH action is pressed, the dialog resolves a definition in this order:

1. `data/item-wrench-definitions.json` — authored layout overrides for items whose dialog needs a deliberate presentation, currently Rift Cape (10424) and Rift Wings (11478).
2. `data/item-wrench-variable-maps.json` — generated control metadata from native renderer XML `VariableMap` entries with `UIName`, joined to item IDs through `str_version_16`. This includes Anomaly Aura (15230), Wings of Infinity (15826), Spiezels' Galactic Scarf (16314), and swiftpie's Aura-Mantle (16316).
3. `data/item-wrench-game-options.json` — compact native `gameOptions` records that can produce controls when no authored or XML VariableMap definition exists.

The generator reads each item's labels, descriptions, default values, order, radio groups, input limits and choice labels. `RadioGroup` entries become exclusive checkbox-style choices; booleans become checkboxes; RGB triples become RGB inputs; numeric values become number inputs; enumerated values become selects.

## Dialog behavior

- The generated dialog is a portrait 6:19 panel, auto-scaled and centered within the preview rectangle.
- Content scrolls inside the dialog; the header and footer remain available.
- Footer order is Reset to Default, then left-aligned Cancel and OK buttons styled like the Drop dialog.
- Reset replaces the draft with definition defaults but does not save.
- Cancel discards the draft and restores the saved settings.
- Update validates and saves a per-item value object using the core `P.store`.
- Labels are inserted as text and passed through `P.rtfont.scan`; descriptions strip the Properties-only blue code so they remain plain white text.

RGB fields are plain text inputs with no color swatches. Select inputs hide their native dropdown arrows.

## Checkbox specification

The checkbox is a transparent 1:1 square with no panel fill. Its border uses `var(--bd)`, `var(--radius)`, and `#95C9FF`. Both the outer and inset shadows use `#145EAE` with the existing `var(--sh)` thickness. When checked, the image at `img/c-chk.png` is displayed. The asset is intentionally not included yet; it will be supplied separately.

## Runtime events

The UI emits:

- `item-wrench-request` — request to open an item definition.
- `item-wrench-open` — dialog opened.
- `item-wrench-preview` — current draft values changed.
- `item-wrench-cancel` — draft discarded.
- `item-wrench-update` — validated settings saved.

The saved values are also available through `P.itemWrench.get(itemId)`.

## Runtime rendering and current boundary

The app attaches the same definition precedence to equipped item instances, then hydrates their saved per-item settings. The renderer hook runs during each item's normal frame advance, so colour changes are reapplied after animation sampling rather than being lost on the next frame.

The first source-backed visual bindings are:

- **Rift Cape:** `tc=0` uses the Cape colour and `tc=1` uses the Collar colour. The Time Dilation cycle selects the first or second native colour slots using the recovered `cyc`, `cycP`, and 500 ms flip behavior. Its separate Collar flag hides the dedicated collar sprite when disabled.
- **Rift Wings:** `tc=0` and `tc=1` use the two native wing/metal colour pairs. The Time Cycle uses its 15-second period, 501 ms flip interval, and `restart: swap` behavior. The Wing Opening choice is translated to the recovered `s1` / `s1b` setting keys.

The runtime builds an in-memory Set Planner-style settings object (`c*`, `f*`, `l_*`, `l2_*`, `s*`, `cyc`, `cycP`). This is **not** a native game packet writer and does not send options to Growtopia.

Several controls remain state-only until their original item variant/effect data is available: Rift Cape's open/closed animation and aura visuals; Rift Wings' alternate open/closed geometry, feather/blade/scale variants, stamp particles, and named trails; and XML `VariableMap` values that do not yet have renderer setters. These are clearly distinguished from the preview-backed colour/collar controls in their `bindingStatus` metadata.
