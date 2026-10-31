# Preview and Live Preview

The main planner now starts in **Preview**: a close-up of the animated outfit,
selected land and weather. Movement pads are hidden and keyboard/canvas inputs
cannot move, jump or punch. The top-left **Live Preview** button enables the
existing keyboard and touch controls; its **Preview** action returns to passive
inspection. Changing modes releases held inputs and starts at the shared ground
origin without changing equipment. Both modes keep item animation and weather
running.

The Explore controls, generated exploration terrain and Weather Background tile
picker are removed from the main application. Both modes draw the same selected
land surface. Player components and terrain now use the same native **32-unit**
scale; the old 0.78 player reduction is gone. The existing UI structure, inventory,
quickslots, blackbox and Century Gothic Big nameplate font remain.

## Speech and dialogs

- Every speech bubble and talking state lasts exactly **5000 ms**, independent
  of text. The 1000 ms fade-in and 1000 ms fade-out are included in those five
  seconds. Word-count timing has been removed.
- Chat is compact and centered at the nameplate anchor, with text/padding scaled
  with the player. Menu and Chat remain attached to the preview's top-right
  corner. The uploaded dotted chat image appears while the composer is open and
  returns to the empty speech icon on close or submit.
- Confirming a negative numeric Drop amount closes the dialog and makes the
  player say `Nice try.  You remind me of myself at that age.` No pickup is
  created. The existing positive quantity and other validation behavior stays.
- Info descriptions use RTFont `o`; properties now use `1`. The Properties
  heading and Growtopia Wiki link were removed from the dialog. Source metadata
  remains in the item information dataset.
- Skin swatches use the shared panel border, radius and inset/outer shadows.
  Their borders use the skin color at full opacity; the matching panel fill uses
  that skin's alpha. Selection stays persistent.

## Rendering and riding

The player shadow removes all skin-palette metadata and is composited through a
black alpha mask. Buddy Legacy therefore cannot recolor it. Player, pickup and
world shadows use the shared crisp black, 50% opacity, left/down projection.

Terrain renders in separate passes: world shadow, walk-through foreground art,
player/pickup shadows, solid foreground art, then player/pickup art. Only collision
type 1 covers actor shadows; doors and other pass-through foreground do not.
World shadows use one combined foreground silhouette, avoiding internal tile
shadow edges. Pickup collection animation and timing remain independent of the
two rendering passes.

`set-1.mp4` shows **Tiny Horsie (592)**. Its rider moves on an approximately
333 ms cycle while the horse's atlas animation has its own clock. The new
component animation replaces the former 460 ms sine bounce with measured rider
head positions, keeps seat/body motion aligned, and leaves whole mount sprites
unsplit. The actual player/seat/horse textures remain in use. Jumping and punching
continue to control the arms instead of being frozen into the riding pose.

The capture hash, sampled head positions and calibration assumptions are in
[`evidence/riding-reference-fit.json`](../evidence/riding-reference-fit.json).
The motion is video-calibrated; exact compressed-video raster parity has not
been verified.

## Repeatable verification

```sh
npm test
python -m http.server 9002
python tools/browser-preview-modes.py http://127.0.0.1:9002 /tmp/preview-check
python tools/browser-player-chat.py http://127.0.0.1:9002 /tmp/chat-check
python tools/browser-item-info.py http://127.0.0.1:9002 /tmp/info-check
python tools/browser-skin-panels.py http://127.0.0.1:9002 /tmp/skin-check
python tools/browser-player-features.py http://127.0.0.1:9002 /tmp/player-check
python tools/browser-smoke.py http://127.0.0.1:9002 --output /tmp/regression-check
```
