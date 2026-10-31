# Research integration into JoeyPR/Demo

Foundation: `f09759a375a093a50727f7d7b3a7862094f75fbc`, repository default branch `origin`. Work branch: `research-rendering-renovation`.

This revision integrates usable observations and data from Setplannergt_Research_Pack.zip, Setplannergt.zip and Setplannergt2.zip into the existing application. It is a core-system renovation, not a completed reproduction of every Set Planner or official Growtopia behavior. No sealed dataset was decrypted and no original obfuscated application bundle is shipped.

## Nameplate and wrench

The active nameplate path is now `js/nameplate-renderer.mjs`, initialized by the existing `js/plate.js` controller. The old compositor remains an initialization fallback. `P.plate.renderer` reports `bitmap` after the font is ready; `await P.plate.ready` returns whether initialization succeeded.

- Text uses the supplied bitmap font's real source rectangles, per-character offsets and advances. It no longer depends on browser measurements of the Century Gothic fallback after initialization.
- All 27 observed title choices are available, including Super Supporter, Moderator and Developer. Staff titles change the simulated nameplate; they do not represent real account permissions.
- Staff prefixes/colors, Dr. prefixes, legendary suffixes, guild role colors, paired ornaments, badge priority and pulsing/rainbow title styles are composed independently.
- Legendary uses the captured `flags/lg.png`; Mentor uses the newer `titles/master_icon.png`.
- Guild backgrounds and foreground emblems are separate layers. Guild artwork reuses the live inventory thumbnail canvas, so asynchronous loading does not permanently cache an empty banner.
- Super Supporter changes wrench size, tint and oscillation; existing styles, decorations and the Fist/Wrench toggle remain supported.
- The missing `img/wrench.png` has been restored from the supplied capture. The existing 32 styles and 32 decorations already matched the research metadata exactly.
- Glyph tint caching stores small glyph crops rather than dozens of complete 512px font sheets. Glyph, icon and terrain caches have explicit size limits.
- Names accept the captured alphanumeric/18-character format. Existing plate storage keys, GrowID entry, title selections and configuration API remain in place; reset no longer shares a mutable titles array with defaults.

The independent layout retains Demo's nameplate scale and host anchoring. Geometry and style rules are source-assisted. No pixel-identity claim is made for the source site or official client, and viewport/DPI sizing is not a full port of that site's platform rules.

## Equipment, appearance and player rendering

`src/equipment.mjs` and its active `demo/engine/` counterpart separate the original equipment list from its visible appearance list. Player Customization now offers visibility and same-slot appearance selectors for equipped clothing, using existing panel styling.

- Equipped identities continue to control abilities, lift/ride behavior, original XML/recipe effects, source punch poses and timed cues.
- Visible clothing comes from the selected appearance. A target must be a real catalog record in the same slot; invalid targets leave the original visible and do not invent records.
- Visual targets do not contribute their own particle recipes or abilities. Ancestral graphics follow the visible selection through the existing dedicated ancestral renderer; original captured ancestral sprite/FX draws are suppressed to prevent duplicated auras.
- Hiding or changing appearance does not unequip an item or refill an air jump. Appearance preferences use a separate `appearance` storage record.
- Changing one equipped item no longer resets the entire rig's ongoing particle state. Existing active item clocks remain intact.
- Source punch hide-item rules also remove a transmuted visual owned by that source item.
- Existing layered pass order, sleeves, generic punch curve/cadence, body animation, pet system, lift profiles, dyes and weather data remain the foundation. The research's numeric renderer-hook ranks were not misused as a replacement global painter order.

The scripting interface remains declarative. No `eval` or `Function` execution of item code was introduced.

## Particles and effects

Changes are applied to both the editable reference engine in `src/` and the actually imported engine in `demo/engine/`.

- XML particles now convert absolute birth positions into the host's local draw frame once. Travelling to a nonzero world position no longer adds world coordinates twice.
- World-born particles retain their birth position and facing when the player moves, turns or bobs. Relative emitters follow the current root; relative hand emitters use their arm anchor and rotation.
- Relative emitter offsets are applied once, rather than twice.
- Finite emitter counts count particles, including a partial last batch. Finite emitter lifetimes stop emission instead of silently restarting forever.
- Enable flags, nonlooping particle sprite clips, repeated event deduplication, punch-stop transitions, supplied respawn/tile events and explicit equipped-item predicates reach the shared particle host.
- Emission catch-up and secondary emission are bounded. Defaults cap each system at 512 live particles and each XML script at 2,048. Unknown Boolean predicates fail closed, and nonfinite particle draw records are skipped and recorded by the existing coverage diagnostics.
- Constant gravity integration includes the half-acceleration displacement term. Normal/additive/screen blending is carried through the draw path; leash lines explicitly restore normal blending.
- Export bounds now include transformed leash endpoints.
- The live app now creates the same six-cell, 192×32 procedural reference sheet expected by `item-fx.mjs`. Previously it registered only a 32×32 sheet, leaving bullets and other later cells without their intended art. These shapes remain labeled procedural reference FX.

Full native CFX scripts, unknown expression/predicate semantics, every per-item effect and official-client particle parity are not established by these changes.

## Timed punch metadata

`punch-timeline.mjs` reads the captured item-specific sequences and script sound mappings. It preserves timing, duplicate simultaneous cues, source ownership, birth position, facing and overlapping punch instances. A `punchFx` Boolean/dependency flag is not treated as a sound-style ID. Slot-dependent cues are resolved only when the supplied item-sound map supports them.

The host emits each due cue as `P.emit('punch-cue', cue)`. This is an integrated cue dispatch path, not audio playback. The captured sound files are empty/incomplete; no fake audio files or new sound settings are added. Existing sound behavior is not replaced. Consumers may subscribe with `P.on('punch-cue', handler)` when playable authorized audio is available.

## Terrain/world rendering

`js/world-renderer.mjs` caches the existing two-layer terrain renderer in viewport-culled chunks. Its fingerprint includes foreground/background cells, connection neighbors, flipping, relevant animation frame, source-image identity and sprite metadata. Missing art is never permanently cached as an empty chunk. Neighbor changes invalidate the connection halo, animated chunks update as frames change, and cache storage is bounded.

`js/app.js` uses the cache for the actual scrolling land layer, including its existing world-edge wrap. The existing autotiling rules, background-before-foreground order, tile scale, land options, camera behavior, weather engine and world data remain in use. This is not a replacement physics engine, a new world editor, a server-backed world service, or a complete GTW replay implementation.

## Protected interface and behavior

`index.html`, all stylesheets, inventory grid, side actions (including DROP), drawer handle, tabs, preview input/zoom handlers and pad controls are byte-identical to the base commit. See `evidence/research-protected-files.json` for hashes. New appearance/title/guild controls live inside the existing customization panel. No layout redesign or dropping-system rewrite was made.

## Validation

Commands:

```sh
node --test test/research-renovation.test.mjs test/research-host.test.mjs
node tools/audit-research-runtime.mjs evidence/research-runtime-audit.json
npm test
node --test demo/test/*.test.mjs
```

Results:

- 15 new tests pass. They cover glyph metrics, title styles, appearance/ability separation, cue timing/deduplication, cache invalidation, particle counts/budgets, offsets, hand anchors, world travel/facing/lift and leash bounds.
- The host smoke test imports the actual `js/app.js` and `js/plate.js`, loads real local JSON and image paths with recording canvas/DOM adapters, boots weather/terrain/nameplate, exercises all 27 titles, equipment/hiding/transmutation, and checks the bullet sheet cell. It caught the missing base-wrench asset. It is not a browser or raster test.
- The active `demo/engine/` sweep covers 4,081 items, 32,648 state cases and 399,839 draw calls, including nonzero world coordinates: zero invalid draw records and zero missing atlas files. It observes 9,348 XML particle calls and 243 cue deliveries. Counts are structural observations, not a completeness certificate.
- Root suite: baseline 153/163; revised 168/178. The same 10 pre-existing failures remain, with no new failure names.
- Legacy demo suite: baseline and revised both 65/72, with the same 7 failure names.
- Syntax, relative imports and change whitespace are checked separately. No new npm dependencies are required.

The baseline was rerun from an untouched worktree at the recorded base commit. Full failure names and before/after counts are in `evidence/research-validation.json`. Existing camera/zoom/land-scale/search-style assertions and a hill-band fixture remain inconsistent or failing; they were not edited to manufacture a green suite.

Browser visual verification remains blocked: the cloud browser cannot reach the workspace HTTP server and its policy blocks local-file navigation. A local Chromium runtime is unavailable and its download returned invalid archives. Desktop/mobile layout, actual canvas pixels, pointer gestures and official-client parity have therefore not been certified in this revision. Review those before merging/deploying.

## Data still unavailable

The larger capture has icon indexes and thousands of images, but its renderer directory is empty and the encrypted item/modifier/transmute datasets have no supplied key map. Twenty newer wearable IDs are therefore recorded, with known icon cells, in `evidence/research-new-items-unresolved.json` rather than added using guessed wearable placement or animation. The full wearable catalog remains 4,081 usable source records.

Archive hashes and every imported asset/metadata hash are in `evidence/research-provenance.json`. The raw obfuscated bundles, unrelated captured pages, empty sound files and encrypted payloads are not included in the application patch. The research bundle's conflicting rights notices remain a provenance concern; this implementation does not assert ownership of game/reference art or third-party metadata.
