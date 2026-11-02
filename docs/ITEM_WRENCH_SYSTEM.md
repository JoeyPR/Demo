# Item Wrench dialog

The item Wrench dialog is separate from the nameplate Wrench style/decorations UI.

## Definition precedence

When an item is selected and the sidebar WRENCH action is pressed, the dialog resolves a definition in this order:

1. `data/item-wrench-definitions.json` — authored layout overrides for items whose dialog needs a deliberate presentation, currently Rift Cape (10424) and Rift Wings (11478).
2. `data/item-wrench-variable-maps.json` — generated control metadata from native renderer XML `VariableMap` entries with `UIName`, joined to item IDs through `str_version_16`. This includes Anomaly Aura (15230), Wings of Infinity (15826), Spiezels' Galactic Scarf (16314), and swiftpie's Aura-Mantle (16316).
3. `data/item-wrench-game-options.json` — compact native `gameOptions` records that can produce controls when no authored or XML VariableMap definition exists.

The generator reads each item's labels, descriptions, default values, order, radio groups, input limits and choice labels. `RadioGroup` entries become exclusive checkbox-style choices; booleans become checkboxes; RGB triples become RGB inputs; numeric values become number inputs; enumerated values become selects.

## Dialog behavior

- The generated dialog is anchored to the preview rectangle and scales with it.
- Content scrolls inside the dialog; the header and footer remain available.
- Footer order is Reset to Default, then Cancel and Update.
- Reset replaces the draft with definition defaults but does not save.
- Cancel discards the draft and restores the saved settings.
- Update validates and saves a per-item value object using the core `P.store`.
- Labels are inserted as text and passed through the existing `P.rtfont.scan` color-code renderer.

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

## Current boundary

This phase implements UI generation, per-item state, validation and persistence. It does not yet write the settings into native item option packets or bind every control to player-renderer variables. Each definition carries binding metadata and a status so source-backed fields can be connected next without mistaking a stored UI value for a working visual effect. In particular, several Rift Wings controls are user-requested UI options whose native renderer mapping still requires verification.
