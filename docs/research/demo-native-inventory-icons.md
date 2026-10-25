# Demo-native inventory icon pipeline

Demo now owns its inventory icon renderer in `js/inventory-icons.mjs`; it does not import Planner's icon renderer or recoloring modules, and it loads only local assets from `demo/assets/`.

The generated `demo/inventory-icons.json` maps every Demo catalog item ID to one or more valid local sprite cells. The icon indication fields are distilled from Planner's `data/inventory-index.json` (`iconProfile.source`, its valid fallback, per-item rule, and wearable-cell fallback). The color and compositional icon fields come from Website's Set Planner GT `tools/setplanner_items_decoded.json`: `icon`, `iconTints`, `iconLayers`, and tint data recorded by the item's `gameIcon` entries.

Renderer behavior:
- Uses a valid per-item icon-profile cell when its local sprite exists, otherwise tries the Set Planner item icon source and then local icon-sheet/worn-cell fallbacks.
- Applies explicit `iconTints` from Set Planner data, including its `s` (current skin) token, and the item's recorded `gameIcon` tint when applicable.
- Composes per-item `iconLayers` locally, and honors per-item icon rules such as authored feet/icon cells.
- Caches local source images and 32×32 icon frames, preserves pixel edges, and fits each result inside the white box.
- Does not import Planner's `itemIcons.js`, `clothingColorizer.js`, or request any remote runtime/data at page load.

Source refs used to generate the local metadata:
- Website / Set Planner GT: `5b742caf0b29286cd4c560be966a7c8cb59a314e`, `tools/setplanner_items_decoded.json`
- Planner icon indication metadata: `4d53314439faa2c9f29e971d619b2d8975ae605d`, `data/inventory-index.json`
- Demo catalog/asset baseline: `1013c0e33d0ff7a87d560a5411fa1be667f325ef`
