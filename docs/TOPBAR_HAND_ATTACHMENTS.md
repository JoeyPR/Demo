# topBar, hand attachments and inventory details

The main planner now uses a pull-down **topBar** for Player Chat. Its handle is
cloned from the actual inventory handle, including the desktop/mobile artwork
and drag-arrow variants, flipped vertically and aligned with the inventory
handle's horizontal position. It starts inside the preview's top edge.

Dragging down reveals the input; dragging up collapses it. The height stays
where released, and the last expanded height is remembered. The Chat button
opens it and synchronously focuses the native text field. Enter sends,
Shift+Enter adds a line, and Escape closes it. Keyboard users can also operate
the handle with arrows or Enter. Menu, Chat and Run remain anchored in their
corners. The input reserves room for those controls.

The old popup header, help row and action buttons are removed. The input's
placeholder is **Enter message here**. topBar uses the same `--fill`, `--line`,
`--bd`, `--radius` and `--sh` panel treatment as the existing dialogs. Input and
drag gestures release held actions and cannot trigger canvas punches or zoom.
The original inventory handle and drawer remain independent.

## Chat font and speech

The exact `font/cg.ttf` originally present in JoeyPR/Demo was restored from
commit `0ce4d28c8e20a549d81878b90cea57419f3eb46d`, before its removal in
`3d147a7`. Both typed and spoken chat use it through the dedicated
**PlayerChat CG** face. The shared UI and nameplate fonts retain their existing
faces. Font hash and provenance are in
[`evidence/player-chat-font.json`](../evidence/player-chat-font.json).

Speech has more padding between the text and bubble border. Existing fixed
five-second duration, one-second fades, safe RTFont runs, typing indicator and
negative-Drop response remain.

## Arms and held items

`hand-attachments.mjs` resolves the actual front/back arm from captured grip
coordinates and draw bands. Each side retains its own captured reference angle.
Player arms, sleeves and props share the physical shoulder pivot, preventing a
one-pixel rotation-center mismatch. Rigid back-hand props follow the stretched
punch fist without stretching the prop itself. The same transforms compose
through facing and player lift.

Explicit pre-transformed body pieces, pets, mount pieces, world particles and
loose effects retain their authored coordinate systems. Existing XML prop
bindings use the corrected attachment; XML particles are not attached to arms.

Riding travel now has a separate **660 ms / 20-frame arm track**, fitted using
the actual arm components from `set-1.mp4`. It moves through approximately
−35° to −55° independently of the faster rider body bob. Per-item rest angles
remain relative offsets. Jump, fall, punch and explicit state descriptors take
precedence. The visible-arm fit has about 2° RMS error; hidden rear-arm motion
is inferred from the visible sway because the capture occludes it. This is a
measured reconstruction, not a proof of exact video raster parity. Measurements
and limits are in
[`evidence/riding-arm-reference.json`](../evidence/riding-arm-reference.json).

## Inventory and buttons

- **Equipped** shows every worn ID, independently of Clothing search/category
  filters or the dropped/stored state of an inventory copy. Membership updates
  immediately when equipment changes. Its search and category controls are
  disabled while that complete view is active.
- The supplied Run artwork starts Live Preview; returning to Preview keeps the
  existing accessible control. The status HUD moves aside if the artwork would
  overlap it.
- Favorited item boxes use the supplied favorite artwork. No new favorite
  dialog is introduced.
- Info and Drop **OK** buttons fit their text with equal left/right spacing.

## Verification

```sh
npm test
python -m http.server 9002
python tools/browser-player-chat.py http://127.0.0.1:9002 /tmp/topbar-check
python tools/browser-inventory-details.py http://127.0.0.1:9002 /tmp/inventory-check
python tools/browser-preview-modes.py http://127.0.0.1:9002 /tmp/preview-check
python tools/browser-player-features.py http://127.0.0.1:9002 /tmp/player-check
python tools/browser-smoke.py http://127.0.0.1:9002 --output /tmp/regression-check
```

Attachment tests check actual grip coincidence through rotation, facing, lift
and punch, authored XML props, independent particles and body descriptors.
The structural audit samples all 4,081 catalog items through 18 frames and finds
no invalid draw calls or missing referenced atlases. Browser checks cover
desktop and touch-phone input, drawer alignment/dragging, exact font loading,
all equipped slots, favorite/Run artwork, OK spacing and preserved planner flows.
