# Player actions, skins and item information

The subsequent [Preview / Live Preview revision](PREVIEW_LIVE_REVISION.md)
replaces the exploration/background-wall UI, word timing, swatch styling and
shadow composition described in this historical revision.

Serve the repository root (`python -m http.server 9000`). These changes extend
the existing main planner and use its inventory, preview and customization UI.

## Preview and speech

Menu stays at the top right, with Chat directly below it. Both use the uploaded
artwork on transparent buttons. The extra flat canvas background was removed;
the weather renderer supplies the scene.

The speech bubble has shorter padding and line height, a 160ms fade-in and
220ms fade-out. Total visibility is 900ms per visible word, including the fades.
RTFont control codes do not count as words. The mouth uses the captured
`player_eyes.png` cells `(6,1)` for the first 100ms of each 300ms cycle and `(5,1)`
for the rest. It shares the bubble's speech state and returns to the ordinary
face when speech expires. Air and punch expressions take precedence temporarily.
The existing Century Gothic Big font and opaque panel styling remain.

Typing `/dance` starts the dance emote instead of displaying a command bubble.
The captured Set Planner state 13 supplies the alternating arm targets, approach
speeds, foot bob, root compensation, smile `(0,1)` and one-second turn phases.
Arm silhouettes were compared across 214 dancing GIF frames; a fixed 25ms pose
step improved the match while retaining those source rules. The input hash,
candidate scores and measurement limits are in
[`evidence/dance-reference-fit.json`](../evidence/dance-reference-fit.json).
The rig moves the actual player components and shares its pose with sleeves,
hand items and other attachments. Walking, jumping, punching and ordinary speech
stop dancing. The implementation is source-backed; official-client pixel parity
has not been certified against the supplied GIF.

World tiles now occupy **30 logical units**, up from 20, while the avatar size
stays the same. Drawing, collision and pointer editing share this scale. Native
tile raster positions use whole source pixels, and the final canvas composite
retains camera movement, preventing transparent seams at fractional camera
positions. Both Explore World and the outfit-only terrain use the larger tiles.

## Skin colors

`js/skin-colors.js` is the shared palette for UI and rendering. Its stable IDs
persist the selection and migrate the old five numeric choices. The 25 raised
rectangular swatches include:

- Eight default colors and the supporter/super-supporter colors from
  [Growtopia Wiki](https://growtopiawiki.com/w/Skin_Colors).
- Subscriber purple/turquoise and **Buddy Legacy** from
  [JoeyPR/Planner](https://github.com/JoeyPR/Planner/blob/main/js/core/app.js).
- Black, grey, white and Mod from the supplied selector reference. Mod is a
  visual color selection.

Buddy Legacy uses four grayscale shade replacements (`#CC9F4E`, `#DAB169`,
`#E6C489`, `#F1D7B1`), preserving colored face pixels and source alpha. Subscriber
colors and translucent red retain alpha 184. Item-contributed skin changes
continue to take precedence over the chosen base skin.

## Item Info

The side **INFO** action opens a dialog using Drop's panel, border, corners and
shadows. It contains the item icon/name, description in RTFont `o`, a spacer,
and properties in RTFont `3`. Keyboard focus stays in the dialog; Escape or OK
closes it and returns focus. Opening the dialog releases movement/punch input.

`data/item-info.json` stores descriptions for all **4,081** catalog items and
verified wiki property records for **4,076**. Exact native descriptions fill the
five Treasure Map variants absent from the public wiki infobox results; their
permissions are left unspecified. Every verified record retains its item URL
and original rendered property lines. No item permission is inferred from an
item name, category or native breaking flag.

The wiki's complete rendered infobox and
[property module](https://growtopiawiki.com/w/Module:Item/Properties) supply the
Transmutable, Untradable and NoSeed rules. The dialog shows CAN/CANNOT transmute, untradable restrictions, and no-seed
status where explicitly present. The positive “This item can be dropped and
traded.” line is intentionally omitted. The existing
Drop behavior is preserved independently of this information display.

To rebuild the source snapshot, use Python with `lxml` and `curl`:

```sh
python tools/build-item-info.py --cache /tmp/setplanner-item-info-wiki
```

## Verification

```sh
npm test
python tools/browser-player-chat.py http://127.0.0.1:9000 /tmp/chat-check
python tools/browser-player-features.py http://127.0.0.1:9000 /tmp/player-check
python tools/browser-item-info.py http://127.0.0.1:9000 /tmp/info-check
python tools/browser-world-chat.py http://127.0.0.1:9000 /tmp/world-check
python tools/browser-smoke.py http://127.0.0.1:9000 --output /tmp/regression-check
```

Browser checks cover desktop and touch-phone layouts, speech/fade timing,
command-to-rig integration, dance cancellation, skin alpha/palette/persistence,
Info content/focus, tile boundaries/collision/editing, and preserved effects,
Drop, blackbox, movement, touch/pinch controls and PNG export.
