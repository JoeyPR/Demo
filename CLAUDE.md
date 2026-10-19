# Claude implementation instructions

Read PUNCH_RESTORATION.md first. Preserve its Set Planner-derived generic punch curve and 200ms held cadence; do not substitute a new extension/retraction easing curve.

Current revision: read INPUT_ABILITIES_FX_REVISION.md before the older revision notes below. Use the sourced ability registry, default naked/single-jump startup, adaptive draw bounds, held pointer punch, positive animal gait classification and shared reference float fallback. Unknown FX flags remain unresolved, not generically “implemented.”

You are implementing a Growtopia planner's player rendering system. Read RESEARCH.md, API.md, GAPS.md, and VALIDATION.md before editing the host application, and preserve its existing weather system.

Read ARCHIVE_MOUNT_PET_REVISION.md first, then STATE_ROUTING_REVISION.md and older revision notes. Use catalog-adapter.mjs to retain seats, legacy lift metadata, captured still arms and public piece sequences; do not truncate the wearable catalog or reintroduce unconditional neutral-pose overrides. Load compiled renderer XML before normalization; a loaded XML file is not proof of full native support.

Latest: start with STATE_ROUTING_REVISION.md, then ANIMATION_FX_FLOAT_REVISION.md and the riding revision. Preserve full frame size and source-cell-local offsets; PlannerPlayer.step now advances normalized catalog items from the same MotionFrame, so do not advance them again separately. Load the shipped lift profiles before normalization. “Generated draw call” is not “correct animation,” and missing renderer/FX references must remain explicit.

## Objective

Implement player body, clothing, movement poses, punch, sleeves, held items, layer ordering, body hiding, skin tint, ride/float offsets, and per-item animation/effect descriptors. Preserve editable source and support 32, 64, 128, and 256 output pixels per logical 32-unit tile.

Treat this handoff as a tested reference foundation, not proof that every feature matches Growtopia. The public Set Planner bundle and catalog are the principal source-assisted reference, and neither is the official game client ([application](https://setplannergt.com/app.d5e8585e60.js), [catalog](https://setplannergt.com/items.17c8f97f87.dat)).

## Non-negotiable rules

- **Evidence**: Never label approximate public-part playback, a generic punch, or preview physics as exact official-client behavior.
- **No invented item data**: Do not turn an `airJumpFx` flag into an invented emitter, a renderer filename into an implemented script, or a static `gameIcon` into a complete animation.
- **Units**: World/rig coordinates use logical pixels; time uses milliseconds except internal physics calculations in seconds; angles use degrees; atlas rectangles use actual source pixels.
- **Format separation**: Public planner `.dat` is packed JSON; native Growtopia `items.dat` is a versioned binary schema; handle these through different adapters.
- **Slot separation**: Keep planner slots, native raw fields, draw bands, semantic body-part tags, and render-pass names distinct.
- **Rig**: Treat this implementation as an affine sprite rig, not evidence of a recovered official skeletal format.
- **Transforms**: Mirror the player once; attach hand pieces to an arm/hand transform rather than assigning a fixed world position.
- **Phases**: Keep locomotion, action, global item time, double-jump time, and particle ages separate.
- **Punch**: Keep punch as an overlay and preserve airborne state underneath it.
- **Layering**: Preserve ordered passes and explicit over-hat/hood/early-face exceptions.
- **Hiding**: Separate clothing-slot suppression from hiding the player's head, arms, feet, or eyes.
- **Tint**: Multiply RGB while preserving source alpha; do not tint an entire body-plus-clothes composite.
- **Riding**: Separate nonfloating contact geometry from rider lift; floating mounts share the complete root. Split horse-sit gait uses one movement-only phase for body, seat and opposing halves.
- **FX**: Define whether an emitter follows the player or leaves particles in world space.
- **Scaling**: Do not multiply simulation coordinates or physics by the export size; source atlas density is independent from display scale.
- **Safety**: Do not use eval/Function for item scripts or bypass sealed/private data access; require authorized descriptors or captures.
- **Integration**: Inspect the existing application before replacing interfaces, clocks, or weather passes.

## Implementation sequence

- **Host survey**: Identify the canvas/WebGL renderer, asset registry, weather pass graph, simulation clock, item store, and export pipeline; record the relevant interfaces before modifying them.
- **Core port**: Integrate math.mjs, planner-profile.mjs, animation.mjs, rig.mjs, and render.mjs with an empty outfit.
- **Asset adapter**: Load authorized source atlases and use canvas-assets.mjs or an equivalent alpha-correct GPU shader.
- **Equipment adapter**: Import catalog records through items.mjs; surface every item's incompleteness warnings in a debug panel.
- **State adapter**: Prefer the host's calibrated motion controller; use PreviewMotion only as a labeled flat-floor development harness.
- **Simple clothes**: Add explicit pieces and frame clips before advanced scripts; make left/right facing and movement work at all four output scales.
- **Sleeves**: Verify back/front sleeve pivots and punch-arm columns; replace rather than duplicate the punching sleeve.
- **Rules**: Integrate semantic hiding, clothing slot hiding, skin/alpha, over-hat and hood cases, and equipment conflict resolution.
- **Special movement**: Supply captured item-specific punch tracks, jump/fall/glide tracks, rider lifts, and double-jump clips.
- **FX and pets**: Add authorized emitters, pet behavior, and script descriptors without pretending they are derived from flags alone.
- **Validation**: Run the numerical suite, then add official-client capture comparisons and visual fixtures.

## Files to preserve

`evidence/provenance.json` records the research target identity and hashes. `evidence/item-coverage.csv` is an inventory, not a completeness certificate.

Keep the planner profile's recovered numeric values until evidence justifies a change. If a live official-client capture contradicts Set Planner, record the client build and prefer the stronger evidence in a separate profile rather than silently overwriting the old reference.

## Minimum acceptance checklist

- All package tests pass after integration.
- An empty avatar draws without missing base parts.
- Walk cycle time is independent of display refresh rate.
- Jump and fall are separate, punch can occur in either, and landing returns to ground without invented squash.
- A hand item follows the arm when moving and punching.
- Shirt sleeve and punch sleeve replace the correct side.
- A robe can suppress hand clothing without necessarily removing the anatomical arm.
- A face item can move over the hat; a hood can reorder face/hair.
- Player skin changes do not recolor every piece of clothing.
- A mount remains grounded while the rider lift applies to the body.
- A world-space particle remains behind while the player moves.
- 32/64/128/256 exports use identical simulation states and have no double scaling.
- Missing scripts and FX are visibly unresolved, not silently replaced with made-up behavior.
- Any “exact Growtopia match” claim includes target build, captured test cases, and comparison results.

## Work to do, not conceal

The package does not implement the official native renderer, every item script, full world collision, every per-item punch owner, pet AI, or all transformation/hover interactions. Public reference playback is deliberately approximate for those cases, and the official client's images and trajectories were not available in this research session.

Ask the user for their current planner source tree, authorized atlas pack, native items.dat version, target client build, and short official-client movement recordings when these become necessary. Continue independent implementation while keeping blocked item IDs in a manifest.
