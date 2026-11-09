# NATIVE PLAYER RENDER REVISION

Current state of the M2 native player renderer (branch `continue-player-render`,
commits a5626af → 34c18b1). Read RENDER_STRIP.md and PUNCH_RESTORATION.md first;
this note only covers the native character layer.

## What was built

- `js/render/player.mjs` — NativePlayerRenderer + PlayerWear (fx blob sampling:
  item.game static, item.moves walk/jump/fall/glide/stop), basePieces
  (body/head/feet rows/extraleg/eyes), ARM atlases, limbMatrix, punchMatrix
  (Set Planner punch curve), playerRoot (facing mirror once), U_TO_BAND
  band mapping, BAND_ORDER, sampleMoments.
- `js/render/rig.mjs`, `js/render/animation.mjs` — recovered verbatim from
  `c265acf^:demo/engine/`, imports rebased.
- `js/render/canvas-tint.mjs` — tint multiplies RGB preserving alpha.
- `js/render/draw.mjs` — PlayerAtlas + drawPlayerCalls.
- `js/render/player-draw-list.mjs` — buildPlayerDrawList (sleeve/extraleg/
  feet/sprite paths composing through the root; punch sleeve replaces the
  back arm while punching).
- `js/app.js` — frame-loop wiring inside P.on("frame"), between WorldEngine
  and drawPickups, wrapped in try/catch.

## Bugs found in browser QA (all fixed)

1. **applyMatrix used setTransform** — wiped the rig canvas's root translate
   and pinned every sprite to the canvas origin (character drawn at the
   rig's top-left, projecting off-screen). Now composes with ctx.transform,
   matching the setplanner drawCanvas contract (its viewport folded the
   camera INTO the matrix before setTransform).
2. **Root placed at the feet anchor** — the setplanner rig root is the HEAD
   TOP (base pieces span rig y 0..32, feet ≈ y 31). The rig translate is
   translate(padX, padY − 32) so the feet land on the feet anchor
   (cameraPivotY + 16·s·zoom).
3. **World x/y leaked into the rig matrices** — playerRoot translates by
   motion.x/y (correct for the setplanner camera-subtracting viewport).
   Our rig canvas is pivot-anchored, so app.js passes {...frame, x: 0, y: 0}
   to step(); facing/locomotion/vy still pass through. Symptom: the avatar
   slid off the rig canvas as it walked (x = +48 after a short walk).
4. **Earlier staged fixes** — missing translate(at) on base arm pieces,
   setTransform state leaking between calls in drawPlayerCalls (per-call
   save/restore), off-canvas rig canvas padding (padX 128 / padY 192).
5. **PlayerAtlas cached failed loads forever** — a 404/decode failure kept
   has() false and the player silently never drew. Broken entries are now
   dropped and retried with a one-time warning.
6. **tintPixelBuffer threw on tainted canvases** — hosts that serve atlas
   images cross-origin (redirecting proxies) taint the canvas; getImageData
   threw every frame and killed the character. Now falls back to the
   untinted copy with a one-time warning; same-origin hosts get the full
   RGB-multiplied skin tint.

## Verified in-browser (sandbox Chrome, localhost + deployed preview)

- Naked avatar at boot, standing on the ground line, camera-centered.
- 5-piece outfit (Green Shirt 36 / Shades 34 / Red Hair 44 / Jeans 48 /
  Brown Shoes 40, shoes hiding base feet via slot 3).
- Walk cycle (character stays camera-centered), jump/fall, punch overlay
  (player_puncharm replaces the back arm mid-swing), preview and live modes.
- npm test: 124/124.

## Still open

- Player Customization + Makeup tabs were removed in c265acf (before M2);
  restore is deferred until the user asks.
- Punch-adjacent FX, nameplates, riding lift and pet pieces remain
  unresolved (see RENDER_STRIP.md) — not silently approximated.
