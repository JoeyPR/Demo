# Playable world, blinking, and Player Chat

This continuation implements visible features in the main planner on top of the
earlier research renovation. Serve the repository root, not just `/demo/`.

## Main preview

- **Menu:** the supplied first image occupies the preview's top-right corner.
  It intentionally has no action. The old logo DOM remains, with its visual
  slot replaced by these controls.
- **Player Chat:** the supplied second image sits beside Menu. Clicking it
  synchronously focuses a real textarea so mobile browsers can open their
  keyboard. Enter or Say submits; Shift+Enter inserts a line break; Escape or
  Close dismisses the composer. The archived chatbar supplies the 120-character
  limit and Enter/Say interaction. Chat is local to this preview, with no server
  or multiplayer transport.
- **Speech:** the bubble sizes to its contents and wraps longer text within the
  visible preview. It uses the existing Century Gothic Big font, an opaque
  `#277D9F` panel, existing border/radius/shadow tokens, padding, and a 1px
  bottom-right text shadow. It follows the player/nameplate through camera zoom.
  Safe RTFont color runs are supported; entered HTML is displayed as text.
- **Blinking:** the avatar closes and reopens its eyes using the actual captured
  skin-tinted lid cell at `player_eyes.png` `(5,3)`. Closing/holding/opening is
  sampled from simulation time with deterministic varying pauses. The cadence
  is independent preview tuning, not a recovered official client constant.
  Face expressions and visibility rules remain in control of whether this lid
  is compatible. `visual.blink` forces a 0–1 closure, and `blinking:false`
  disables it for engine consumers.

Opening chat releases held movement/punch inputs. Typing does not trigger the
action pads, canvas punches, or pinch/wheel handlers. The controls and composer
are positioned inside the visible preview and adapt to the mobile visual
viewport/keyboard; the physical keyboard itself remains browser/OS controlled.

## Explore World

The main preview starts in Explore World for new sessions. The **World** button
opens controls within the existing dropdown infrastructure:

1. **Play** uses the existing keyboard and touch pads, with terrain collision.
2. Choose a block/background and use **Place**, then click/tap the preview.
3. Use **Erase** and click/tap to remove a tile from the selected item's layer.
4. **Respawn** (or R outside text fields) returns to spawn. **New world** replaces
   only the session's editable terrain.
5. Turn Explore World off to return to the original outfit-only land strip.

The provided LAND archive supplies the full 1,766-row renderable block/background
catalog, world generator, connected textures and tile definitions. The active
100×60 foreground/background grids are now the same grids used by drawing,
collision and editing. The Land and Background pickers also update the selected
terrain family and existing backdrop cells in the active world. Choosing Land
None returns to the outfit-only view without terrain.

`WorldMotion` shares the existing ability/punch/event clocks. It adds swept solid
collision, one-way platforms, ceilings, walking off ledges, landing/jump refill,
horizontal wrapping and respawn. Physics uses the planner's existing coefficients
and a visual-sized hitbox; this is not a claim of official client physics.
Tile rendering, hit testing and pointer editing consistently map a native 32px
cell to 20 logical preview units. Blocks cannot be placed through the avatar.
Pet and particle hosts receive coordinate-correct terrain queries.

The existing Drop/pickup implementation, blackbox, RTFont parsing, nameplate font
and inventory layout remain. World editing is separate from the dropping flow.

## Supplied textures

`missing_tiles.zip` contains two RTTEX resources:

- `tiles_candyblock`: decoded to the native **512×256** layout, correcting the
  previous world's **256×512** orientation. All 256 neighbour masks for each
  candy rule remain within the source sheet.
- `tiles_page17`: decoded **1024×1024**, installed in both world and player/UI
  asset directories. All 42 page 17 wrench/decor cells contain nonempty artwork.

`tools/import-missing-textures.py` reproduces decoding and records provenance in
`evidence/new-textures-import.json`. Changed atlas URLs are versioned in the
world, player, inventory, picker and wrench loaders to avoid stale browser art.
The two uploaded button PNGs are copied unchanged.

The texture ZIP has no additional item, renderer, FX or decryption metadata.
The earlier documented gaps for the 20 new wearables and full proprietary CFX
behavior therefore remain. World hazards/exotic collision types and the 118
archive animation previews retain the LAND archive's approximation limits.
Online worlds, GTW import, multiplayer chat and ranked play are not introduced.

## Verification

```sh
npm test
python -m http.server 9000
python tools/browser-world-chat.py http://127.0.0.1:9000 /tmp/world-chat-smoke
python tools/browser-smoke.py http://127.0.0.1:9000 --output /tmp/planner-smoke
```

The Node suite includes blink phases/expression guards, terrain support/walls/
ceilings/platforms/wrapping, and native texture geometry. The new browser check
uses actual pointer placement and erasing, verifies collision against the placed
wall, and exercises chat focus, multiline text, safe text, autosizing, opaque
styling, natural blinking, respawn and mode switching on desktop and phone.
The existing browser check covers equipped appearance/FX, Drop, blackbox,
movement, touch pads, pinch zoom and PNG export. Stored browser receipts are in
`evidence/world-chat-browser-smoke.json` and `evidence/research-browser-smoke.json`.
