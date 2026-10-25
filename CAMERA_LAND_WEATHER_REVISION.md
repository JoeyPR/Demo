# Camera, land and weather revision

This revision renovates the preview camera into a single system, halves the land tile scale, restricts the Land picker to None plus the Dirt and Bedrock families, moves Cave Background behind the land blocks, removes the "None" weather, and makes hill-bearing weathers drift with player travel beyond one rendered world region. All changes are unit-tested and checked with representative browser scenarios (measurements below); the weather config data itself is untouched.

Read after `PET_SYSTEM_REVISION.md`.

## Camera: one system, zoom that moves nothing

`js/camera.mjs` was rewritten to a single `computeCameraLayout({width, height, scale, frameY, zoom})` returning `{ground, rootX, rootY, cameraPivotX, cameraPivotY, zoom}`. There is exactly one camera path now:

- **Focus**: the layout always covers the whole screen — the ground line sits at `height/2 + 16*scale` (the player's feet), the player is horizontally centered at `width/2`. No camera Y, top margin, offset or "ground cam" fields exist anymore; the old interrupting/overriding lift and top-unit paths were deleted.
- **Zoom**: the only thing zoom changes is scale. The transform is `translate(pivot) → scale(zoom) → translate(−pivot)` with the pivot pinned at `(width/2, ground)`, so zooming stretches the scene away from/toward the player's feet with **no zoom-induced panning**: the standing-feet/ground anchor stays fixed on screen, the player stays horizontally centered, and the weather background is untouched — only sizes change (non-pivot pixel positions necessarily scale). `CAMERA_ZOOM_DEFAULT = 1` (close to the player; previously the default view was farther out).
- **Pinch and wheel zoom are untouched** (`js/preview.js`): `P.camZoom = {v: 1, min: 0.5, max: 2}` with the existing wheel and two-pointer pinch handlers; the frame loop just feeds `zoom` into the layout.
- The weather canvases are viewport-space and sit outside the camera transform entirely, so zooming never scales or moves the sky, clouds, sun or hills.

## Land: half-size tiles, restricted options, None

- **Scale**: land tiles now render at **half the player's unit scale** (`landS = s/2` in `drawLandGround`, `js/app.js`) — two land tiles match the player's height. Tile/world coordinates stay native (32px tiles); only the draw scale changed. The ground strip still spans the full screen width with wrap-around at the world edge.
- **Options**: the Land dropdown (`js/land.js`) offers exactly **None**, the **Dirts** category and the **Bedrocks** category (`CATS = [[17,'Dirts'],[15,'Bedrocks']]`, filter `/dirt|bedrock/i` on block names). A genuine blank "None" tile is prepended. Any other selection (including legacy stored ids like Cave Background) normalizes to None via `resolveLandSelection` (`js/land-system.mjs`).
- **None**: `setLand('none')` clears the land entirely — no ground strip, no grass, and **no Cave Background** (the world is null; nothing draws).
- **Cave Background (block 14)**: it is a backdrop, not a land choice. `uniformLandWorld(blockId)` builds the fg rows 24–59 from the selected block and the **bg rows 24–59 from Cave Background**, so `renderWorld` draws it behind the blocks. Behavior note: with a solid uniform land the backdrop is fully occluded by the foreground (consistent with "behind the blocks"), and it disappears entirely when land is None. (The bg sheet page is loaded alongside the block's page.)
- The world is the standard 100×60 Growtopia layout: rows 0–23 air, rows 24–59 land.

## Weather: no None, hills drift with travel

- **None removed**: the Weather dropdown (`js/weather.js`) no longer shows a "None" tile, and the `renderStill` 'none' gradient branch is gone. A stored `'none'` normalizes to `'sunny'`.
- **Hill drift** (`weather-engine/weather-renderer.js` + `js/app.js`): every weather whose sheet names contain "hill" (23 of 81 weathers) now scrolls its hill bands with the player.
  - `hillTravelExcess(worldX, 0, WORLD_PX_W)` measures how far past the rendered region (one 100-tile world span, 3200 world px) the player has traveled; inside the region the excess is 0 and the hills are perfectly still.
  - `hillSceneOffset(excess, …, HILL_PARALLAX = 0.25)` converts the excess into a scene-unit offset — positive travel (right) moves the hills right, in the direction the player is going, growing with distance past the region edge and retracing exactly when the player comes back.
  - `hillDrawXs` wraps each hill band at its derived period (sibling spacing or sprite width) and draws two copies so the band stays seamless at every offset. Sky, sun and clouds are untouched — only hill tracks shift.
  - The offset is zoom-independent (weather canvases are outside the camera transform), and `renderStill` omits it so thumbnails stay static.

## Verification status

- `npm test`: **133/133 pass** (was 113; +20 tests: `test/camera-preview.test.mjs` rewritten for the new semantics — zoom invariance at the pivot, ground line, defaults, `preview.js` zoom-field sync — and new `test/preview-scene.test.mjs` covering the land option policy, cave-background-behind-blocks world structure, no-None weather, and hill wrap/direction/region/coverage and zoom independence). The hill coverage test uses each band's real geometry — every sibling track and keyframe (static x asserted), wrap boundaries at `offset = k·period − x` checked on both sides for every track, and the combined sibling draw intervals asserted gap-free (no internal hole) at every offset.
- `demo/test` suite (rerun for this revision): 65/72 — the **same 7 pre-existing failures as the previous commit**, confirmed by name: floating vehicle delta, default-state fixtures, texture edge clamping/pet wrapping, Riding Cloud, horse-sit mounts, XML emitter hooks, generic float. No new failures; not fixed here per the house rule against bundling unrelated cleanups.
- **Browser QA** (proxy-deployed shipped UI, 1760×990 emulated viewport, fresh state per load):
  - Camera: default `camZoom.v = 1`; wheel zoom out then in ended at a captured `1.749`, and the grass line stayed at **exactly 56.0% of screen height at zoom 1, zoomed out and zoomed in** (pixel-measured on screenshots), the player stayed centered with feet on the grass, and the sky/hills/sun/clouds did not change size or position — no zoom-induced panning.
  - Pinch: a synthetic two-pointer `PointerEvent` spread exercised the handler directly (zoom 1 → 1.3333, exactly the 400/300 finger-distance ratio); a native two-finger touch pinch through the browser's input pipeline (`Input.dispatchTouchEvent` start/move/end) then confirmed the full path — `touchStart` alone does not zoom (base armed), the 300→400 px spread moved zoom 1.1594 → 1.5459 exactly per the ratio, release retained it, the grass line stayed at 56.0%, and a native wheel tick afterwards still zoomed (1.5459 → 1.7778) — controls alive after release.
  - Land dropdown: 17 tiles — None plus 16 Dirt/Bedrock-family blocks (Dirt, Bedrock and 14 variants); categories All/Dirts/Bedrocks only.
  - Weather dropdown: 81 tiles, no None (stored 'none' loads sunny).
  - Land None: no ground, no grass, no cave background; character and weather render normally; no leftover pixels.
  - Land tiles: two half-size tiles match the character height (character is exactly 32 units = one native tile; tiles draw at s/2).
  - Hills (sunny): holding right for 23 s reached `frame.x = 5762.5`; the renderer's applied `hillOffset = 1601.56` scene units (excess 2562.5 × 0.25 × scale ratio), and pixel correlation of the hill band between the before/after screenshots measured a clean **+479 px rightward shift** — the direction of travel. (The shift is the offset modulo the band's tiling period; no independent geometric prediction is claimed.)
  - Hills inside the region: a 9 s run stopped at `frame.x = 2262.5` (< 3200) with `hillOffset = 0` — hills static within the rendered region.
- The proxy-stub QA screenshots live outside the repo and are not committed.

## Remaining work

1. The 7 pre-existing `demo/test` failures remain for a separate cleanup commit.
