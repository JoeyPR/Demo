# Demo-native inventory icon pipeline

Demo owns the inventory icon renderer in `js/inventory-icons.mjs`. It imports no Planner renderer or colorizer: all runtime cropping, compositing, tinting, and canvas fitting are implemented in Demo.

## Data sources

- **Set Planner GT / Website** `tools/setplanner_items_decoded.json`: explicit icon source/cell data, `iconTints`, `iconLayers`, `gameIcon` tint evidence, and the current-skin token `s`.
- **Planner** `data/inventory-index.json`: per-item valid icon source overrides, fallbacks, and composition rules (`iconProfile.source`, `fallback`, `rule`, `wornCell`, `iconSourceKind`). These are compiled into Demo's local metadata.
- **Demo** `demo/catalog.json` and `demo/assets/`: catalog and local runtime art.

The generated `demo/inventory-icons.json` maps all 4,081 Demo catalog items to local candidate cells and preserves Website tint/layer instructions plus Planner per-item icon-source overrides. Authored `*_icon.png` cells are preferred when available. Missing icon sheets referenced by valid source profiles were copied into Demo's own assets; for two tintable legacy sources without a separately published icon sheet, a locally named icon-sheet copy retains the source cell layout for tinting. Nothing is fetched remotely at runtime.

The Demo renderer crops item cells into a 32×32 frame, composes layered icons and tint cells, applies current-skin tint tokens, and keeps icon frames inside the inventory box. Skin-dependent frames are cached separately so changing skin does not reuse a stale icon.

Pinned data revisions:
- Website / Set Planner GT: `5b742caf0b29286cd4c560be966a7c8cb59a314e`
- Planner per-item icon indication: `4d53314439faa2c9f29e971d619b2d8975ae605d`
- Demo catalog baseline: `eec4b78fe010002a9272f1e9dad795efc1085bcd`
