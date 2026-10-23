# Growtopia XML Renderer Library (source: `player stuff.zip`)

This bundle separates each XML renderer into a readable ES module and adds searchable frame/state/particle manifests. It is meant for reverse-engineering and for integration into the Render Lab, not a claim that every game-native operation has already been reproduced pixel-perfectly.

## Inventory

- **314 item renderer XMLs** and **33 world/effect renderer XMLs** present in the uploaded archive (347 total).
- Item renderer data has **1475 `<Sprite>` definition nodes** across **1467 unique sprite-name keys**, **1426 top-level animation-track elements** (across the XML animation types), **4095 explicit `SpriteAnimation` frame entries**, **3520 total `KeyFrame` nodes**, and **921 particle-system definitions**.
- The original XML files are copied, unmodified, into `source-xml/`.
- Each renderer module exports `renderer` and `default`. It contains the runtime-oriented fields (`sprites`, `rules`, `animations`, `particles`, `machines`) and an intact `sourceTree`/`renderData` representation for analysis. Attribute values remain strings because that's how XML encodes them; parse numeric fields at the point of use.
- Atlas names are normalized to `*.png` for the current browser demo's atlas loader. The original `fileName` is retained as `sourceFileName` and in `sourceTree` so this aliasing does not erase provenance.

## Files

- `renderer-modules/item/*.mjs`: one module per `ItemRenderers/*.xml`.
- `renderer-modules/world/*.mjs`: one module per `WorldRenderers/*.xml`.
- `renderer-modules/registry.mjs`: lazy import registry; call `loadRenderer(name, "item"|"world")`.
- `manifest/renderer-index.csv`: one row per renderer with family, matching catalog item IDs, sprite/frame/keyframe/particle counts, states, transitions and render-pass names.
- `manifest/renderers.json`: expanded data for every renderer, including per-track frame timelines, curve keyframes, state transitions, particle fields, sprite definitions, and hook summaries.
- `manifest/representative-renderers.json`: deeper inspectable extracts for Wings, Capes, Leashes, Shoes/Sneakers, Auras and a sample world effect.
- `ANIMATION_TIMING_REPORT.md`: frame-by-frame timelines, state transitions, particle emitter parameters and render passes for representative item families.
- `templates/renderer-adapter.mjs`: safe cloning/reuse adapter with explicit alias, atlas, frame, offset, draw-pass and timing overrides.
- `runtime/sequence.mjs`: standalone helpers to sample sprite frame timelines and piecewise-linear curves.
- `source-xml/`: verbatim source XML copy.

## Runtime timing interpretation

For `SpriteAnimation`, the current Render Lab interpreter treats `animTime` as the total track duration and spreads the explicit `Frame` children evenly across that duration. If no `animTime` exists, the current code uses `175 ms × frame count` (the `frameMs` value in `items.json`). This yields an explicit frame-by-frame timeline in the manifest. For example, a four-frame loop with `animTime="200"` changes frames every **50 ms** under this interpretation; a 16-frame loop with `animTime="900"` changes every **56.25 ms**. This is what the existing interpreter computes, not independent proof of the official client's scheduling semantics.

Curves contain normalized keyframe times, e.g. `0`, `0.25`, `0.5`, `1`; the helper linearly interpolates the value vector between adjacent points, clamps before/after endpoints, and the current runtime uses the track's duration and loop flag to compute progress. Where XML curves use variables, named curves, nested sequences, or unsupported easing/actions, this archive preserves the definitions and marks them for implementation instead of silently flattening them to fake constants.

## Reuse templates — how to wire another item

### A. Exact same renderer behavior

The safest route is to map the new item to the same `script` name **only if** the item's sprites/atlas cells and its intended behavior are the same. The current Render Lab looks up `catalog.renderers[item.raw.script]`, binds a piece to a renderer sprite only when atlas, dimensions and a matching frame cell agree, runs the renderer state machines for the item's motion clock, then samples its animation and transforms. Merely changing `script` is not enough when the new item uses different texture cells.

### B. Same behavior, different sprite/atlas

Copy the nearest source module and create an adapter with an explicit `spriteAliases` map, `atlasAliases`, `frameOverrides`, per-track `trackFrames`, `offset`, optional `timingScale`, and `passOverrides`. This avoids mutating the source and makes every visual difference auditable. Use the shape in `templates/renderer-adapter.mjs` as a starting point; confirm that each target texture really contains the corresponding animation frames in the same order before relying on frame reuse.

### C. Same family, new rule set

Reuse only the behavior layer that actually matches:

- **Wings** — commonly use a back-pack render hook, separate left/right particle systems, animation states for idle/move/air, additive flares or trails. Keep sprite frame tracks separate from emitter tracks; one particle does not automatically mean one wing sprite.
- **Cape/cloak/mantle** — map body-anchored pieces to the backpack/back pass; often use `IDLE`, `WALK`, `JUMP`, and `FALL` state tracks, plus small movement trails. Preserve `animTime`, exact frame list, and the pass in front/behind player.
- **Leash/companion** — treat player-held leash art and pet sprite as separate layers/attachments; the state machines can have independent pet movement and punch states. Do not attach a pet to the hand or player root just because the renderer filename says “leash.”
- **Footwear** — shoes may modify feet/body offsets or use curves on lift and foot state, not simply cycle shoe cells. `SpringLoadedShoes` includes several `CurveAnimationFloat`/`CurveAnimationVec3` tracks keyed to `MotionY` and separate `No`, `Yes`, `Mannequin` states. A standard shoe renderer should not inherit pogo lift/foot motion by default.
- **Auras** — usually split behind-player and front-player layers and may render particle hooks on action/events. State may switch `ActiveType`, and sprite animation frame rows may encode different aura states. Avoid treating every aura as a single centered looping sprite.
- **Held weapon/tool** — preserve hand/arm attachment and punch-specific state/`UpdatePunch`/`Update` conditions. No `Pickaxe.xml` is present in this archive; you can use a structurally similar tool renderer only as a hypothesis, not as an observed pickaxe template.

## Known data gaps and cautions

- The archive's embedded `inventory.json` refers to 361 XML files including 14 WeatherRenderers, but the actual uploaded ZIP contains 347 XML files: 314 in `ItemRenderers/` and 33 in `WorldRenderers/`. There is no `WeatherRenderers/` folder in the uploaded ZIP, so the missing 14 source XMLs are not included or fabricated.
- No item renderer filename matching `Pickaxe` and no filename matching `Slippers` are present. `SpringLoadedShoes` and `DiamondSparklingSneakers` exist, but their implementation rules must not be generalized to missing source XMLs.
- Every module preserves every XML node. “Preserved” is not the same as “executed.” The Demo engine's interpreter is explicitly partial: it supports a selected subset of conditions, state transitions, sprite-frame tracks, `SpriteScaleAnimation`, `SpritePositionAnimation`, and a bounded set of particle emission behavior. XML nodes such as `SequenceAnimation`, interpolation/curve families, visibility/camera/context/outline hooks, render-object flags, native pet attachments, and other operations require specific implementation before they can be called functioning.
- Full native accuracy needs the matching original atlas assets, host variables/events, attachment matrices and exact pass semantics. The XML by itself often refers to `.rttex` source atlas names and assumes native engine state/context.

## Suggested implementation sequence

1. Use this manifest to select one renderer and inspect its `renderPasses`, `stateMachines`, `animationTracks`, and `particleSystems`.
2. Make the current runtime report which ops it executed and which it skipped for that renderer; do not hide unsupported operations.
3. Implement/test one node class with a fixture before enabling it for all renderers.
4. Compare captured idle/walk/jump/fall/punch timestamps against the source XML's computed sequence, then add event-sensitive cases.
5. Create adapter entries for similar items rather than altering the shared source renderer.

## Sanity checks

The generator parses each source XML successfully, copies it byte-for-byte, and creates one ES module per source file. It does not perform a live-game image comparison, and it does not assert that every track is supported by the existing browser runtime.
