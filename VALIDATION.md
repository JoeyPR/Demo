# Validation and exact-match protocol

The current code has 81 passing package tests. The separate demo has 72 passing tests, including 48,972 archive-runtime catalog state/time checks. See INPUT_ABILITIES_FX_REVISION.md and evidence/input-browser-qa.json for the latest scope. Earlier fixtures retain 800 original math comparisons, 2,072 changed-input lift samples and five texture-edge checks. New checks cover ability budgets, aimed/held punches, expanded bounds, shared reference float and native emitter counts, delays, lifetime, context and action-event gating. These establish tested numerical and integration contracts, not complete official-client fidelity.

## Current automated coverage

Run the suite with `npm test` from the package root. There are no external dependencies in this test path.

| Group | What is checked |
|---|---|
| Affine geometry | Composition order, invariant pivots, held y+1 pivot, facing reflection, angle wrap |
| Walk/air/action | Recovered keys, loop/interpolation rules, shared walk phase, jump approach, punch overlay |
| Clocks/events | Unequal frame durations, nonloop hold, crossed-event boundaries, fixed-step batching |
| Preview state | Jump edge, one air jump, landing event and ability refresh |
| Data/rules | Planner/native distinction, missing-script warnings, slot conflict, layer order, semantic hiding |
| Body/items | Skin alpha, headless handling, over-hat face, rider versus mount lift, punch-sleeve column/tint |
| Backend | 32/64/128/256 transforms, source density, alpha-preserving tint, supersampling plumbing |
| FX/VM | World/local particles, deduplication, seeded repeatability, unsupported operations, instruction budget |
| Integration | Hook → pose → draw-list path |
| Differential | 200 walk-arm samples, 400 arm matrices, 200 sprite matrices against isolated planner functions |

The differential target is the public Set Planner bundle's selected pure functions, not the official Growtopia runtime ([target bundle](https://setplannergt.com/app.d5e8585e60.js)).

The fixtures include real changed inputs, including arbitrary times, rotations beyond one revolution, source flips, nonuniform scales, anchors, and rotation pivots. The application bootstrap and private loader were not executed to create them.

## Catalog-wide structural audit

The latest offline audit exercises 4,081 public wearable references in idle, walk, jump, and fall states, totaling 16,324 cases and 197,520 generated draw calls. It finds zero invalid numeric draw-geometry cases and zero cases with no item-owned draw call; results are preserved in `evidence/catalog-audit.json`. The earlier unadapted fallback audit produced 188,092 calls and 168 missing item/state draw cases; those results are superseded by the captured-geometry adapter, not proof that every item's scripts are now implemented.

This checks that the adapter can produce structurally usable commands without malformed matrices or rectangles. It does not confirm correct crops, prove frame timing, implement missing scripts, or turn every generated draw call into a supported exact animation.

```sh
node tools/audit-catalog.mjs decoded-catalog.json
```

## What was not validated

- **No official client**: No build-specific image, trajectory, timing, or sprite-frame parity was measured.
- **No live planner pixels**: Full application behavior and target screenshots were not compared.
- **Numerical versus raster tests**: Numerical package tests do not load assets. The separate revised demo does load real atlas PNGs and was browser-tested at desktop and 375px, including mounted still/punch poses and PNG dimensions at all four resolutions; it was not compared with official-client images.
- **No wardrobe completion**: The CSV does not establish every item's static correctness, much less complete scripts and FX.
- **No native binary fixture**: The optional native inspection wrapper was not exercised on a native items.dat file in this session.
- **No advanced systems**: Pets, full script compatibility, world collision, hover interactions, and transformations remain outside tested implementation coverage.

## Official-client capture manifest

Capture from an authorized client installation or a user-provided recording. Record the metadata below alongside every capture so later findings are reproducible.

```json
{
  "clientVersion": "USER_SUPPLIED",
  "platform": "USER_SUPPLIED",
  "assetManifestSha256": "USER_SUPPLIED",
  "itemsDatVersion": null,
  "itemsDatSha256": "USER_SUPPLIED",
  "captureFps": 60,
  "gameWindowPixels": [0, 0],
  "displayScale": 1,
  "cameraScale": 1,
  "itemIds": [],
  "skin": null,
  "worldCondition": "flat empty test area",
  "inputTimeline": [],
  "notes": "No automatic claim of parity from this manifest alone"
}
```

Use original timestamps when available and preserve the unmodified video. A variable-frame-rate recording must not be treated as a fixed 60 fps sequence merely because the metadata says “60.”

## Capture matrix

### Empty player

Record both facings with the same camera and world origin. Capture at least two complete walk loops after acceleration settles.

- **Idle**: Grounded body, neutral face, blinking if relevant, then transition to movement.
- **Start walk**: First moving frame, velocity ramp, arm/foot phase initialization.
- **Steady walk**: Arm angles, foot offsets, body root, loop wrap.
- **Stop walk**: Friction/deceleration versus immediate visual idle, phase retention/reset.
- **Reverse**: Facing transition, root mirroring, limb interpolation.
- **Held jump**: Launch, rising pose, apex, falling pose, land.
- **Tapped jump**: Button release timing and changed trajectory.
- **Fall without jumping**: Pose initialization while leaving an edge.
- **Ground punch**: Arm envelope, sleeve replacement, item timing, cooldown/repeat.
- **Air punch**: Punch while rising and falling, including landing during punch.

### Item matrix

Use exact IDs from the user's target catalog, not just names. Start with one item per relevant slot, then add combinations that deliberately exercise conflicts.

- **Ordinary shirt**: Normal arm sleeve, tint, back/front pass.
- **Colored or skin sleeve**: Punch-arm column and skin/dye behavior.
- **Robe**: Clothing slot hiding without accidental anatomical deletion.
- **Over-hat face item**: Face/hat/hair pass ordering.
- **Hood**: Face-over-hair interaction.
- **Skin-changing item**: RGB/alpha priority versus dyes and role skin.
- **Large hand item**: Arm reference angle, both facings, walk/punch/fall.
- **Mount**: Rider lift versus grounded mount geometry.
- **Hover item**: Lift period, grounded/airborne interaction, item following.
- **Double-jump item**: Event timing, clip, emitter birth space, facing.
- **Transformation/full set**: Body replacement, masks, special pass behavior.
- **Pet**: Independent motion, follow lag, turn behavior, and punch interaction.

## Measurements

Extract root position and visual pose independently. A trajectory mismatch can shift every body pixel without implying the source sprite or sleeve pivot is wrong.

For each sample, record:

```js
{
  timeMs,
  root: [x, y],
  facing,
  locomotion,
  armAngles: {back, front},
  footOffsets: {back, front},
  punchAgeMs,
  itemFrames: [{itemId, atlas, sourceRect, attachment, pass}],
  hiddenBodyTags: [],
  hiddenClothingSlots: [],
  skinRGBA,
  riderLift,
  fxBirths: []
}
```

Do not use a hand-authored spline as ground truth when a measured sequence exists. Retain uncertainty ranges when video compression or occlusion prevents exact pixel identification.

## Image comparison protocol

- **Align**: Match root world origin, facing, camera, viewport, and timestamp; do not permit an arbitrary per-frame alignment that hides root errors.
- **Sample**: Render all four output scales from the same logical state.
- **Compare geometry**: Use landmarks and alpha silhouettes before comparing every RGB pixel.
- **Compare raster**: Then compare exact RGBA pixels, transparent borders, tint multiplication, and rotated-edge sampling.
- **Separate errors**: Report root trajectory, phase timing, source-frame, pivot, pass-order, tint, and raster errors independently.
- **Preserve diagnostics**: Save reference, candidate, absolute-difference image, and metadata.
- **Test transitions**: Include action start/end, apex, landing, facing change, and loop wrap rather than only attractive mid-cycle frames.

An exact-match label should require zero unexplained mismatches for a stated build and test set. Passing one static pose must not be generalized to the entire engine or every item.

## Recommended support manifest

Keep evidence and completeness machine-readable. The example below is a schema suggestion, not a result achieved by this package.

```js
{
  itemId: 123456,
  metadata: "verified",
  idle: "capture-verified",
  walk: "planner-only",
  jump: "missing",
  punch: "approximate",
  doubleJumpFx: "missing",
  scripts: "missing",
  captures: ["build-x-case-1"],
  knownMismatches: ["punch sleeve pivot"],
  sourceHashes: {}
}
```

Keep the term `official-capture-verified` reserved for actual client observations. The delivered numeric fixtures should be labeled `planner-numerical-match`.
