# Growtopia player-to-tile scale calibration

## Source-derived dimensions

- Demo's land renderer defines `TILE = 32` and crops and draws each block atlas cell into a 32-by-32 world-space rectangle in `js/land-system.mjs`.
- An independent client-style world-system reference also documents a 32-by-32 pixel tile and a 100-by-60 tile world: https://github.com/NetroIndonesia/Growtopia/blob/main/docs/05-world-system.md
- The Growtopia asset sheet inventory lists the player head, extra-leg and arm sprites separately from its tile sheets: https://www.spriters-resource.com/pc_computer/growtopia/asset/133966/
- Ubisoft's public overview confirms that Growtopia worlds are measured in blocks, but does not specify the player's rendered silhouette-to-tile ratio: https://news.ubisoft.com/en-gb/article/3tCqgdSlsYhmaKvKl4vz3v/growtopia-creativity-abounds-in-ubisofts-mmo

## Pixel comparison against the supplied Demo screenshot

Approximate measured bounds in the supplied 991-by-1512 capture:

| Measurement | Screen pixels |
| --- | ---: |
| Bare avatar silhouette height, with the old `PS = 1.5625` | 229 |
| One land tile row | 160 |
| Tile-relative avatar height in that capture | 229 / 160 = 1.431 |

The renderer applies `PS` only to the avatar and its attached effects; the land remains a 32-unit tile rendered with the common camera scale. Therefore the observed ratio at `PS = 1` would be approximately:

`1.431 / 1.5625 = 0.916` tile heights.

For a single-tile visible base silhouette, the calibrated multiplier is:

`PS = (160 × 1.5625) / 229 = 1.092`.

That is the new constant in `js/app.js`. The same `PS` is applied at each camera zoom, so the ratio is fixed rather than changing while zooming. Headwear, wings and other worn items can extend beyond the base silhouette as their source artwork requires; this calibration targets the bare base only.

## Inventory icon source

The icon adapter formerly requested `/Planner/data/inventory-index.json` and `/Planner/js/inventory/itemIcons.js` from the Demo website's own origin. Those paths are not guaranteed to exist there, so the requests failed and every icon fell back to `?`. The adapter now loads the module and metadata from the Planner repository's jsDelivr root, matching the existing relative asset paths inside Planner's own `itemIcons.js`.
