# Full catalog and riding revision

This revision addresses the first demo's incomplete wardrobe and incorrectly generalized pose handling. It contains a full-public-catalog adapter and separates source-supported still poses from fallback movement; it does not claim to recover Growtopia's native renderer.

## What was actually wrong

- **Catalog truncation**: The first demo shipped only 39 selected records despite the inspected public snapshot containing 4,081 wearables; the revised demo uses all records and exposes all ten planner slots ([public catalog](https://setplannergt.com/items.17c8f97f87.dat)).
- **Discarded seats**: Filtering out `seat` records removed authored seated body geometry such as `player_sit.png` and `player_horsepants.png`, which the public records retain separately from vehicle artwork ([catalog](https://setplannergt.com/items.17c8f97f87.dat)).
- **Pose precedence**: Applying each item's neutral `pose` every frame incorrectly displaced walk, jump, fall, and punch poses; the inspected renderer applies those neutral item poses only with no move or with a `stop` move lacking an item-specific stop recording ([renderer `step`](https://setplannergt.com/app.d5e8585e60.js)).
- **Missing legacy lift**: Older mounts can supply `{lift:[x,y]}` in captured icon metadata without a top-level `riderLift`; explicit zero lift must not be treated as missing ([catalog](https://setplannergt.com/items.17c8f97f87.dat)).
- **One-frame-fits-all animation**: Replacing every piece's atlas coordinates with the first public part's current cell can corrupt split upper/lower mount rows and unrelated seat sprites; public pieces and parts have independent dimensions, coordinates, and atlases ([catalog](https://setplannergt.com/items.17c8f97f87.dat)).
- **Arms drawn twice**: Some scripted-item public stills include literal skin arm sprites with authored rotations, rather than a top-level neutral pose; CyberCycle includes both arm sprites at −45 degrees ([catalog](https://setplannergt.com/items.17c8f97f87.dat)).

## Source-derived rules Claude should preserve

### Arm resolution

The inspected renderer resolves an arm from an explicit script pose, then post-punch `armsHome`, then recorded item arms, then the bare walking sample, and finally the underlying motion angle; its item-arm search prioritizes feet-slot recordings before other equipped items ([`armAngle`, `itemArms`, and `bareArms`](https://setplannergt.com/app.d5e8585e60.js)).

The hand item's independent locomotion recording can be suppressed when mount arms already own the pose, while the held-item transform still follows the selected arm; source hand placement uses a reference arm angle and a pivot one logical pixel below the arm origin ([`anyMoveRec`, `mountArms`, and `heldMatrix`](https://setplannergt.com/app.d5e8585e60.js)).

Implementation boundary: `resolveItemPose` now prevents ordinary neutral item poses from overriding active movement and punch, and prioritizes supplied feet-item `statePoses` over hand-item descriptors. It does not implement the complete external movement-recording selector, native after-punch recordings, or the original renderer-script language.

### Mount, rider, seat, and floating are different domains

The source distinguishes seated recordings, clothing lift, hover settings, vehicle-related pants suppression, and separately hidden anatomical legs; it does not identify every elevated item as a horse-style seat ([`riding`, `rider`, `playerLift`, `pantsOff`, and `drawBody`](https://setplannergt.com/app.d5e8585e60.js)).

The adapter therefore uses feet-slot seat records to establish seated geometry, keeps standing vehicles separate, and never turns a floating face item into a mounted player. A vehicle inferred from public lift metadata is a reference classification, not proof of its unavailable script's complete semantics.

Preserve these spaces:

```text
player root: world translation + a single facing reflection
  rider root: clothing lift + body + sleeves + hair + hat + held item
  vehicle root: authored mount pieces + captured seat geometry
  world root: detached effects / trails when descriptors explicitly require them
```

The `RenderSeat` pass is our integration pass for captured front-seat bands, placed after shirt and before front arm. Captured `u` draw bands remain metadata and are not reinterpreted as native slot IDs; complex cross-item compositing still needs per-item descriptors and capture comparison.

### Static geometry is not a native movement clip

No literal native `ridingstill` animation definition was recovered from the sources inspected for this revision. The demo uses that label as an observable semantic state, with a disclosed fallback rather than an invented official timeline.

```text
grounded + vehicle + no travel + no punch  -> ridingstill
grounded + vehicle + walking              -> ridingmove
airborne + vehicle                       -> ridingair
punch overlay + vehicle                  -> ridingpunch
```

Without an authorized movement descriptor, the reference holds an item's authored still arm angles during mounted motion, suppresses bare walking foot offsets, and restores generic punch ownership during punching. If an item supplies neither a neutral angle nor captured arm sprites, do not manufacture a “correct” motorcycle or dragon angle.

## Public examples and their different evidence

| Item | Public evidence | Reference integration |
|---|---|---|
| Tiny Horsie #592 | Neutral arms −35°/−35°, seat geometry, static lift −0.5, two-frame public part ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Keep seat; apply rider lift separately; advance only matched mount rows |
| Stick Horse #1012 | Neutral arms −35°/−35°, `still`, `hideLegs`, sit and horse-pants pieces, lift −0.5 ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | No walking legs through the captured seat; no invented mount sequence |
| Riding Raptor #1320 | Neutral arms −35°/−35°, `still`, `hideLegs`, two-frame part and horse-pants seat ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Share geometry pipeline, not one hardcoded item ID |
| Growley Motorcycle #1950 | Seat geometry and explicit captured zero lift, but no top-level neutral pose ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Retain zero lift; mark missing exact arm animation instead of assuming horse angles |
| Riding Comet #2048 | Seat pieces and captured lift −3, no top-level neutral pose ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Use its own lift and geometry |
| Red Bicycle #2974 | `hideLegs`, seated body sprite and zero captured lift, no top-level neutral pose ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Preserve bicycle seat geometry; no universal handlebar-angle claim |
| Riding Fiesta Axolotl #6040 | Neutral arms −35°/−35° and captured lift −4.5 ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Separate its higher rider offset from horse geometry |
| CyberCycle #14720 | External `CyberCycle` script, top-level lift −10, two captured skin arms at −45° ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Resolve still arm angles once; do not draw a second pair of skin arms |
| Self Balancing Scooter #15120 | External script, lift −8, no captured `seat` body pieces ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Standing vehicle, not automatically seated |
| Cumulus Cloud #15934 | Top-level lift −20.09, captured still lift −22 and external renderer reference ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Time-varying float cannot be recovered from one still sample |
| Sheep Chariot #16366 | Lift −6 plus separate vehicle, sheep, and rope artwork ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Keep independent pieces; no invented pet locomotion script |
| Justice Lens #15698 | Face slot, external script, top-level lift −3.09 and extra leg/feet still geometry ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Floating face cosmetic, not a seated feet-slot mount |

## What private servers and other archives contribute

- **GrowServer**: The inspected `Peer.ts` supplies item-to-punch-ID selection, `OnSetClothing` packet construction, and double-jump character-state flags; it does not supply the client's per-frame riding rig or arm-angle timelines ([server implementation](https://raw.githubusercontent.com/StileDevs/GrowServer/main/apps/server/src/core/Peer.ts)).
- **GTopia**: The native-item serializer retains chair player/arm placement, renderer configuration, hidden-part flags, and transformation metadata, useful for a version-pinned native metadata adapter but not a replacement for movement clips ([serializer](https://raw.githubusercontent.com/keichira/GTopia/main/Source/Item/ItemInfo.cpp)).
- **Legacy GrowtopiaServer**: The inspected legacy project is a private-server implementation, not a modern official player animation engine; its code and licensing should not be treated as unrestricted renderer source ([repository](https://github.com/LucarioGamer/GrowtopiaServer)).
- **Growtopia Explorer**: Its positioning module stores editable per-item x/y offsets clamped to −32…32, not authoritative native arm curves; configurable preview sequences likewise require independent validation before being called exact ([positioning module](https://raw.githubusercontent.com/araeys/growtopia-explorer/main/public/avatar_positioning.js), [repository](https://github.com/araeys/growtopia-explorer)).
- **GrowtopiaRenderPlayer**: Useful static composition and sprite-cropping examples are not evidence of full mounted movement, punch ownership, or current script coverage ([static renderer](https://raw.githubusercontent.com/claralaw/GrowtopiaRenderPlayer/main/src/Render/render.ts)).
- **Sprite archive**: The inspected clothing archive is an older sprite-sheet collection, not a complete current wearable database or a source of per-frame state transitions ([archived sprites](https://www.spriters-resource.com/pc_computer/growtopia/asset/133958/)).

Native schema correction: `itemRenderer` is read at version ≥16 and its hash at ≥18 in the inspected TypeScript parser, corresponding to `configName` and `configNameHash` names in GTopia; the original handoff's ≥20/≥25 statement was incorrect ([TypeScript parser](https://raw.githubusercontent.com/StileDevs/grow-items/main/lib/Items.ts), [C++ serializer](https://raw.githubusercontent.com/keichira/GTopia/main/Source/Item/ItemInfo.cpp)).

## Integration entry points

Use the adapter rather than calling `importPlannerItem` alone if you want the public catalog's captured geometry:

```js
import {normalizeCatalogItem} from "./src/catalog-adapter.mjs";
import {PlannerPlayer} from "./src/player.mjs";

const items = equippedRawRecords.map(raw => normalizeCatalogItem(raw, catalog));
const player = new PlannerPlayer(catalog, items);

function tick(motionFrame, dtMs) {
  // Item frame sampling happens inside player.step, using motionFrame.
  const result = player.step(motionFrame, dtMs, {skin: baseSkinRGBA});
  // result.poseResolution.state/evidence/owner explain pose selection.
  // Load/validate atlas assets before drawing result.calls.
  return result;
}
```

Supply calibrated per-state arm ownership without modifying the core:

```js
mount.statePoses = {
  // Populate only from a real authorized capture/descriptor.
  ridingstill: calibratedIdleArms,
  ridingmove: motion => sampleVerifiedMountedArms(motion.moveMs),
  ridingair: motion => sampleVerifiedMountedAirArms(motion.moveMs),
  ridingpunch: motion => sampleVerifiedMountedPunchArms(motion.punch.ageMs)
};
```

These functions are application-owned adapters, not functions already recovered from Growtopia. State-specific sprite clips use the existing `item.clips` interface; native script execution, full FX, and pets need separately authorized descriptors.

## Catalog and validation boundaries

The revised demo exposes all 4,081 public wearables, not every block or every item ever released by the official game; its catalog still contains 317 external script references without those script definitions ([public catalog](https://setplannergt.com/items.17c8f97f87.dat)).

Local asset synchronization found one unavailable raw atlas name, `io_rif_wing.png`, but Rift Wings' captured icon pieces use other available sheets. The normalized draw-piece dependency audit therefore has zero missing local atlas files; that checks file availability, not every crop's visual correctness.

The demo's regression suite covers 16,324 single-item/state cases with 197,512 finite draw calls, plus seat retention, neutral-pose precedence, supplied mount-versus-hand pose priority, zero-lift preservation, standing-versus-seated classification, CyberCycle arm de-duplication, and mount row offsets. These are structural/behavioral tests of this implementation, not an official-client pixel-difference test and not every possible outfit combination.

Before claiming exact Growtopia rendering, obtain synchronized authorized idle, mounted idle, walk, mounted travel, jump, apex, fall, land, punch, and double-jump captures for each unresolved item family, on both facings. Record client build, item IDs, texture hashes, capture timing, and source density; then compare attachment pivots, silhouettes, crop selection, layer occlusion, lift, and frame timing independently.
