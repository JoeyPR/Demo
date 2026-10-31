# October 31 research integration

This renovation starts at `de2711c629f97b01e49f5cc522a8af34f136d953` on
`camera-quickslot-nameplate`. It uses the research pack, the first raw capture,
and the larger Dropbox capture. The independent runtime remains in this repo;
the obfuscated Set Planner application, worldplay and CFX bundles are not copied
into the app or executed.

## What changed

### Equipped items and displayed appearance

`src/look.mjs` resolves equipment, displayed items and modifier contributors
separately. The existing Player Customization panel now has **Outfit Appearance**
controls for each equipped slot: visibility and same-slot transmutation. The
inventory, quickslots and Drop continue to identify the original equipped item.
Abilities, body effects and item FX remain attached to equipment. Visual slot
hiding, bare feet, poses, mounted gait and sprite selection use the displayed
items. A hidden mount's geometry therefore does not remove the bare feet.

The live interface also exposes:

```js
P.look.get();
P.look.setVisible(14278, false); // Requires this item to be equipped.
P.look.transmute(14278, anotherHandItemId); // Returns false for another slot.
P.look.setEffects(false);
```

Appearance follows the current session's equipment. The original naked startup
behavior remains. This does not introduce a new outfit persistence format.

### Particles and rendering

The main preview incorrectly loaded the direct FX map as `data.scripts`. Both
entry points now use an adapter that accepts direct maps and wrapped bundles.
All 314 available FX scripts reach the dedicated particle runtime.

Emitter state, live particles, integration and draw calls remain separate. The
runtime now handles partial finite bursts, interval carry, disabled emitters,
live particle limits, explicit punch-start/punch-stop/respawn stages, deduplicated
motion events and the equipped/render context. Unknown predicates fail closed.
Equipping an unrelated slot retains the existing scripts and live particles.
Turning effects off clears their simulation state.

Absolute particle birth coordinates are distinct from the caller's draw origin.
This keeps effects attached in the camera-following preview, and keeps detached
trails fixed when the player travels, turns, jumps or changes rider bob height.

`particle-state.mjs` integrates acceleration and interpolated velocity independently
of the render rate. Relative particles apply the emitter offset once, and hand
attachments use the arm anchor. Animation honors looping, angle and rotation-rate
interpolation; screen blending and background particle passes reach the compositor.
An optional host collision query handles `destroyOnCollision`.

The compositor preserves explicit pass order and accepts per-item/per-piece
ordering within a pass. Line primitives restore normal blending after additive
sprites. The two entry points share a six-cell procedural reference atlas; the
main preview previously allocated one cell for recipes that referenced six.
These simple reference recipes remain identified as approximations, separate
from source-backed XML particle art.

### Punch cue timelines

`demo/punch-sfx.json` contains the recovered 249 style entries, 223 item overrides
and 56 script sound mappings. `PunchTimeline` applies the item override before
the explicitly supplied numeric style, delivers each cue once, preserves offsets
and origins, and allows delayed cues from successive punches to overlap. A
rewind or equipment reset cancels pending attacks. Reconstructed `RP-###` labels
are never treated as recovered numeric style IDs.

`PlannerPlayer.step()` returns `audioCues`. The main planner publishes them as
`P.on('punch-cue', callback)` events with their original timestamp, origin,
offset, owner and facing. **This does not play sound:** the capture's referenced
audio files are absent or empty. An audio consumer can use these events when
playable assets are supplied. No unavailable sound URL is requested.

### World rendering

`world-rules.mjs` compiles the existing verified local tile definitions into
numeric arrays once per rule revision. `buildWorldDrawList()` collects only
visible cells, keeps foreground and background passes explicit, caches connected
variants and repeats horizontal scenery for arbitrary viewport widths and camera
positions. The main preview uses this in place of its two-copy wrapping workaround.

The existing blob/strip/attachment lookup tables, tile families, land choices,
camera and preview movement remain. The draw result exposes visible tiles, drawn
tiles and resolved sheet counts through `plannerApp.landStats/backgroundStats`.
`placeBlock()` and `removeBlock()` invalidate the affected neighbourhood. Call
`invalidateWorld(world, x, y)` after direct grid writes, or omit the coordinates
after bulk edits. Rule registration invalidates all compiled variants.

### Nameplate and wrench

The existing name styles, guild roles, country art, title effects and wrench
rotation are retained. Saved state now validates title names, conflicts, local
asset keys, roles, numeric IDs and wrench status. Reads and resets use independent
title arrays. Formatted unstylized names no longer reference an undefined
character index. Missing guild thumbnails can retry after the catalog loads.

The recovered 278 frame records are loaded and validated, and all 32 wrench styles
and 32 decorations remain available. Wrench chooser thumbnails use each record's
icon sheet, while the plate uses its display sheet. The existing Weather Machine
sprite and captured Master icon are available as additional badge choices. Their
labels are local sprite labels, not a claim to recover additional official title
privileges. The nameplate still uses the existing **Nameplate CG** font and its
current requested scale.

## Preserved behavior

The page shell, CSS, tabs, drawer and UI event infrastructure retain their
structure. The existing Player panel hosts the new appearance controls. One
inventory selector was corrected from `P.$` to `P.$$` because quickslot focus was
throwing on every refresh; its behavior and layout are unchanged.

`js/drop.js`, `js/drop-world.mjs`, the pickup section of `js/app.js`, blackbox,
RTFont handling, font files, page HTML and CSS are unchanged. Drop, pickup
animation, Fist/Wrench restrictions, camera controls and export were checked in
the browser. The separately tuned browser mounted gait was preserved.

## Evidence and limits

`evidence/setplanner-research-import.json` records archive hashes, imported
metadata counts and the 20 captured wearable identities missing from the local
4,081-item catalog. The newer directory reports 4,101 wearables. The additional
item pages and preview PNGs establish identity and slot; they do not supply
wearable atlas geometry or complete animations. They were not presented as
working wearable implementations.

Both captures still lack the latest AES-GCM key map. The larger capture's
`items.json`, `mods.json`, `transmute.json`, renderer/FX endpoints and most dynamic
asset directories are empty. Consequently this change does not claim exact
latest-item behavior, full proprietary CFX parity, recovered modifier stacking
coefficients, a GTW importer, world-play physics or online parkour/replays. The
available local scripts remain a partial interpreter, with their existing
source/fidelity qualifications.

## Run and verify

Serve the repository root for the integrated planner:

```sh
python -m http.server 9000
npm test
node tools/audit-research-runtime.mjs
```

The tests include active emitter lifecycles, partial bursts, transform separation,
cue delivery, context predicates, nameplate state/drawing, world culling,
repetition, connection invalidation and parity between the renovated source and
browser engine modules. Four baseline assertions were stale: pickup icon size,
the shadow check's scope, the multiline land predicate/Data aliases, and treating
sparse desert wobble accents as a continuous hill sheet. The assertions now
check the current intended behavior; the related production systems were not
changed to satisfy those assertions.

The catalog audit steps every item through 18 idle/walk/jump/punch frames and
checks finite draw calls and referenced atlas availability. Its stored result is
`evidence/research-runtime-audit.json`. This is structural coverage, not a visual
comparison with an official client or proof that every conditional effect fired.

For the optional browser smoke test, install Python Playwright and Chromium,
serve the root, then run:

```sh
python tools/browser-smoke.py http://127.0.0.1:9000 --output /tmp/planner-smoke
```

It exercises desktop and phone layouts, appearance controls, effects, punch cues,
nameplate/wrench, Drop, blackbox, search/focus, movement and PNG export. On the
phone it also sends actual touch-pad and pinch gestures. Screenshots and exports
are written to the output directory. The recorded result is
`evidence/research-browser-smoke.json`.
