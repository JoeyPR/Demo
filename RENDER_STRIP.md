# Render strip — commit 9ac9f16 baseline

This revision removes **all rendering** from the demo while keeping every
non-rendering subsystem intact. It is the clean foundation for rebuilding the
site's renderer (setplanner-derived) on top of the demo's simulation.

## What was kept

| System | Where | Notes |
| --- | --- | --- |
| DROP system | `js/drop.js`, `js/drop-world.mjs`, `drawPickups` in `js/app.js` | Full lifecycle: equip → drop dialog → pickup spawn → walk-over collection → inventory restore. Fist/Wrench drop attempts still use the blackbox. |
| Preview box | `js/preview.js`, `js/preview-mode.js`, `css/preview.css` | RAF loop (`P.on("frame")` clears the canvas and emits `{dt, ctx, w, h}`), live/static toggle, camera zoom. |
| Weather | `js/weather.js`, `weather-engine/`, `data/variants/base/*.json`, `sheets/` | Dropdown, static-first-then-animated handoff, black fallback on failure. **Paradise City fixed**: the six missing `bg_pc_*.webp` sheets were copied in (config was already valid), so Paradise now renders instead of falling back to black. |
| Movement buttons | `js/pads.js`, `js/handle.js` | Pointer + keyboard → `P.input` (left/right/jump/punch); movement runs in live preview mode. |
| Inventory system | `js/grid.js`, `js/inventory-icons.mjs`, `js/tabs.js`, `js/favorites.js`, `js/side.js` | Tabs (equip/fav/cloth/custom), search + category filter, quick drawer with the Fist/Wrench tool box (`toolState` replaces `P.plateConfig`; wrench state persists via `P.store 'toolWrenchOn'`). |
| Land concept | `js/land-system.mjs`, `js/land.js`, `js/world-motion.mjs` | World grid, block registry, collision/physics (`stepPlayer`), spawn/respawn, land editing (`placeBlock`/`removeBlock`), Dirt/Bedrock land dropdown. **The player genuinely walks and stands on land** — `WorldMotion` collides with real tiles; `None` falls back to the flat preview floor. |
| Motion/abilities/info engines | `demo/engine/*.mjs` (motion, motion-policy, abilities, item-info, math, planner-profile), `src/` mirrors | Simulation, punch policy, ability resolution, item metadata — all untouched. |
| Camera math | `js/camera.mjs` | `computeCameraLayout`, zoom clamps, projection helpers. |
| Core bus / UI shell | `js/core.js`, `index.html`, css | Event bus, side panel (STORE/DROP/INFO/FAV), HUD, mobile CSS. |

## What was removed

- **Player rendering**: `demo/engine/player.mjs`, `render.mjs`, `rig.mjs`,
  `pose-resolver.mjs`, `animation.mjs`, `blink.mjs`, `dance.mjs`, `look.mjs`,
  `canvas-assets.mjs` and their `src/` mirrors. No avatar drawing remains.
- **Item/equipment rendering**: `items.mjs`, `hand-attachments.mjs`,
  `item-fx.mjs`, `renderer-adapter.mjs`, `renderer-sequence.mjs`,
  `catalog-adapter.mjs` (render-side), `draw-bounds.mjs`.
- **Particles/effects**: `particle-state.mjs`, `xml-particles.mjs`,
  `xml-renderer.mjs`, `fx-engine.mjs`, `effects.mjs`, `reference-fx.mjs`.
- **Terrain rendering**: in `js/land-system.mjs` — `tintedAtlas`,
  autotile variant selection (`tileVariant`), the world draw list,
  `animFrame`, `renderWorld`, `SPREAD_GRID`/rules table, `invalidateWorld`,
  background-wall registry/selection (`BACKGROUND_BLOCK_IDS`,
  `registerBackgroundBlocks`, `resolveBackgroundSelection`,
  `uniformBackgroundWorld`). World state, blocks and physics remain.
- **Punch rendering**: `punch-data.mjs`, `punch-timeline.mjs` (policy
  lives on in `motion-policy.mjs`); the punch gesture/input still works.
- **Pet system, mounts, nameplate (plate.js), player chat, item wrench UI,
  customization panel** and their CSS (`customization.css`,
  `item-wrench.css`, `player-chat.css`, `world-ui.css`).
- `js/player-shadow.mjs` trimmed to the shadow constants +
  `playerShadowOffset` (pickups still use them).
- 24 rendering-only tests deleted; the remaining tests were updated to the
  stripped source (118/118 pass).

## Structure notes for the rebuild

- `js/app.js` is now the thin shell: state, equip/normalize, `step()` (WorldMotion
  only), punch gesture, weather, land, `P.previewMode`, frame loop (weather +
  pickups + HUD), and the DROP pipeline.
- The frame loop emits through `P.on("frame")` with a cleared canvas — the new
  renderer hooks in there.
- setplanner's encrypted `d/` blobs (AES-256-GCM + gzip, keys in `fx_keys.json`)
  should be decrypted/bundled locally into self-contained per-subsystem files
  rather than fetched at runtime.

## Paradise weather fix

`data/variants/base/paradise-city.json` was already byte-identical to the
setplanner blob; only the sheets were missing. `bg_pc_city/island/sky/
waves1/waves2/waves3.webp` now live in `sheets/`.
