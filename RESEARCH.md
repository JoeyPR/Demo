# Growtopia player, clothing, and movement rendering research

This guide is a Claude-ready, source-assisted reconstruction reference for an animated Growtopia planner. It combines inspected Set Planner GT application logic, its public wearable catalog, native item-format parser code, other public rendering tools, and SDK context, while keeping implementation facts separate from official-client claims.

**The central limitation is important: this research did not recover or execute Growtopia's official player renderer, and cannot honestly certify exact official walk, jump, land, fall, or punch rendering.** The included code implements a useful reference architecture and numerically matches selected Set Planner functions; the work still requires authorized client captures and missing per-item data before “exact Growtopia” is a defensible label.

## Evidence and trust model

### Which source answers which question

| Evidence | What it supports | What it does not prove |
|---|---|---|
| Set Planner GT's shipped `app.d5e8585e60.js` | Its own transforms, pose tables, passes, sleeve logic, recording logic, script/FX interfaces, preview movement, rider/hover rules, and data loading ([bundle](https://setplannergt.com/app.d5e8585e60.js)) | That the code is the official renderer or pixel-identical to any particular client build |
| Public `items.17c8f97f87.dat` | Its wearable IDs, public parts, static icon records, sleeves, flags, and renderer filenames after the public packing transformation is decoded ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Full renderer scripts, all captured animation tracks, complete FX definitions, or a native binary item database |
| StileDevs `grow-items` | How this parser reads native binary fields, including versioned renderer and punch-related metadata ([parser implementation](https://raw.githubusercontent.com/StileDevs/grow-items/main/lib/Items.ts)) | The exact meaning or runtime effect of every field in the official client |
| claralaw `GrowtopiaRenderPlayer` | Static composition, atlas cropping, nearest resizing, tinting, and item-specific positioning examples ([renderer source](https://raw.githubusercontent.com/claralaw/GrowtopiaRenderPlayer/main/src/Render/render.ts)) | A complete movement renderer, current item coverage, or authoritative timing |
| Raey's Growtopia Explorer | Editable per-item positions and frame-sequence descriptors in a separate planner implementation ([position module](https://raw.githubusercontent.com/araeys/growtopia-explorer/main/public/avatar_positioning.js), [sequence module](https://github.com/araeys/growtopia-explorer/blob/main/public/wearable_sequence.js)) | Official per-item offsets, frame intervals, physics, or universal sprite-sheet rules |
| NetroIndonesia Growtopia docs | Secondary explanation of item and game-state concepts associated with a private-server project ([item docs](https://raw.githubusercontent.com/NetroIndonesia/Growtopia/main/docs/07-item-database.md), [game-system docs](https://raw.githubusercontent.com/NetroIndonesia/Growtopia/main/docs/08-game-systems.md)) | Authoritative client rasterization or universally correct field interpretations |
| Seth Robinson's Proton SDK | Engine/toolkit lineage and graphics abstractions; the upstream repository explicitly lists Growtopia among projects made with Proton ([SDK repository](https://github.com/SethRobinson/proton)) | That today's SDK renderer matches a particular shipped Growtopia client |

Use a stronger source for a narrower claim rather than treating every repository as equally authoritative. For example, a server packet or item parser can establish a field's presence without establishing the client's visual interpretation.

### Recorded target identity

The source-assisted target was Set Planner GT, not an unidentified “Growtopia engine,” and its public page points to a hashed application bundle and hashed packed catalog ([page](https://setplannergt.com/), [application](https://setplannergt.com/app.d5e8585e60.js), [catalog](https://setplannergt.com/items.17c8f97f87.dat)).

| Artifact | Snapshot fact |
|---|---|
| Application | `app.d5e8585e60.js`, 669,406 bytes, SHA-256 `b447fd776e5c721f69b1708e00b1dc0770e8b69ed31459bfc75c9b46228b4b71` |
| Public catalog | `items.17c8f97f87.dat`, 277,089 bytes, SHA-256 `c238bacd2062213794c5aa2752e548ea29f6bd7fc76e92e8877166acfdb25138` |
| Research date | October 17, 2026 |
| Analysis | Static inventory using `rea-agents@6.5.0`, local AST/string analysis, and isolated reviewed pure-function comparisons |
| Official client | Not obtained, executed, disassembled, or captured in this session |

The hashes identify the inspected public files rather than asserting their license, provenance from Ubisoft, or official accuracy. The package's provenance manifest records these locally computed identifiers alongside the public artifact URLs.

### Important availability boundary

The public application contains `PACKED`/`SEALED` paths, public catalog unpacking, and separate session/key-based loading for sealed data; the catalog snapshot contains renderer names and FX flags, but no populated public `game` or `moves` recordings on its item records ([application loader and record selectors](https://setplannergt.com/app.d5e8585e60.js), [catalog](https://setplannergt.com/items.17c8f97f87.dat)).

Only the public application and public catalog were analyzed. No session/key endpoints were called and no sealed script or FX payloads were acquired.

## Public wearable coverage

### What the catalog actually contains

The inspected catalog describes 4,081 wearables and 459 atlas entries, with a logical tile size of 32 and a default frame interval of 175 ms ([public catalog](https://setplannergt.com/items.17c8f97f87.dat)).

| Field or capability | Records containing the field | Interpretation |
|---|---:|---|
| `gameIcon` | 4,019 | Static draw-record reference, not proof of a full movement sequence ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `parts` | 1,551 | Public multipart/frame descriptors, sometimes accompanied by special rules ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `punchSleeves` | 329 | Per-item punch-arm column/tint mappings ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `script` | 317 | Renderer filename references requiring separately obtained definitions ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `fx` | 536 | Presence of an FX dependency, not a complete emitter ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `punchFx` | 536 | Punch-effect dependency or selector ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `airJumpFx` | 78 | Double/air-jump effect flag or selector ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `riderLift` | 62 | Explicit rider vertical offset reference ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `playmod` | 29 | Public visual-modifier metadata, including some skin/alpha changes ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `pose` | 115 | Per-item pose override metadata ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `hides` | 53 | Suppression of other planner clothing slots, not anatomical bone indices ([catalog](https://setplannergt.com/items.17c8f97f87.dat), [dress logic](https://setplannergt.com/app.d5e8585e60.js)) |
| `overHat` | 93 | Item-specific render-order exception ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `hood` | 28 | Hair/face ordering interaction ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `clockFrames` | 73 | Global-clock cell replacement or related clock behavior ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |
| `clockOrbit` | 36 | Item-specific orbit metadata needing its own evaluator ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) |

Counts above mean “field present,” not “feature fully implemented by this package.” An item may be counted in multiple rows.

### Useful real-item regression cases

| Item | Publicly observed metadata | Why it matters |
|---|---|---|
| Air Robinsons, ID 496 | Feet slot in the planner ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Check ordinary shoe composition separately from bare feet |
| Cultist Robe, ID 1218 | Shirt slot; `hides: [5]` ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Slot 5 is hand clothing; do not automatically erase an anatomical arm |
| Legendbot-009, ID 1780 | Hides planner slots `[2,3,5,6,8]`, has five public parts and FX dependency metadata ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Test equipment suppression and multipart completeness |
| Dragon of Legend, ID 1782 | Hand slot, three public parts, punch FX dependency ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | A hand-slot item is not necessarily a small rigid prop |
| Rayman's Fist, ID 5480 | Hand slot, two public parts, punch FX dependency ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Do not assume the generic punch envelope reproduces its special behavior |
| Robotic MK.IV Wings, ID 7582 | Back slot, three public parts, FX and air-jump FX metadata ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Separate wing frames, movement pose, and the air-jump burst |
| Devil Wings, ID 1206 | Back slot with a public part descriptor ([catalog](https://setplannergt.com/items.17c8f97f87.dat)) | Test ordinary back-item attachment without inventing an effect |

The CSV includes every public wearable record's basic dependency flags, not just this small test set. Use it to prioritize items with missing scripts, FX, or rider behavior.

## Two different item databases

### Native Growtopia items.dat

The inspected native parser reads a version and item count, then variable-length item records containing fields such as item type, texture coordinates, body-part type, flags, extra options, and later version-gated additions ([native parser](https://raw.githubusercontent.com/StileDevs/grow-items/main/lib/Items.ts)).

Correction after re-reading the actual version branches: the parser reads `punchOptions` from version 11 onward, nine `bodyPart` bytes from version 12 onward, sitting/player offset fields from version 15 onward, `itemRenderer` from version 16 onward, and `itemRendererHash` from version 18 onward; the earlier handoff incorrectly gave versions 20 and 25 for the last two fields ([native parser](https://raw.githubusercontent.com/StileDevs/grow-items/main/lib/Items.ts)).

GTopia calls those latter fields `configName` and `configNameHash`, and explicitly labels its version-20 byte `hiddenPartsFlags`, with version-21 `canTransform`; do not assume names from different parsers establish runtime semantics or interchangeable byte widths without testing the exact target file ([GTopia serializer](https://raw.githubusercontent.com/keichira/GTopia/main/Source/Item/ItemInfo.cpp)).

The package preserves these fields as raw metadata. Their existence does not imply that a parser alone supplies every renderer definition or that the nine bytes can safely be mapped to this handoff's semantic body tags.

### Set Planner's public .dat

The public planner loader reverses a bytewise rolling XOR transformation and gzip-decompresses the result before parsing JSON; its initial key is `0x5a`, and the key update is `(key * 31 + index + 7) & 255` ([public loader](https://setplannergt.com/app.d5e8585e60.js)).

The decoded catalog includes `version`, `tile`, `frameMs`, atlas metadata, base body metadata, arm metadata, origins, slot offsets, and wearable records ([public catalog](https://setplannergt.com/items.17c8f97f87.dat)).

These formats must not share a decoder just because both filenames end in `.dat`. `tools/unpack-planner.mjs` handles a user-supplied public packed catalog, while `tools/inspect-native-items.mjs` is an optional wrapper around a separately installed native parser.

### Planner slot map

The planner's named slot enum and item records establish this domain: 0 Hat, 1 Shirt, 2 Pants, 3 Feet, 4 Face, 5 Hand, 6 Back, 7 Hair, 8 Chest, and 9 Ancestral ([slot enum](https://setplannergt.com/app.d5e8585e60.js), [catalog](https://setplannergt.com/items.17c8f97f87.dat)).

Do not reuse these integers for draw-pass bands, body sprite IDs, or native parser bytes. In particular, planner `hides` is processed against equipped clothing slots, while anatomical hiding is also controlled by separate flags and renderer logic ([dress and body-render methods](https://setplannergt.com/app.d5e8585e60.js)).

## Rendering architecture

### What “rig” means here

The inspected planner composes separately drawn body, head, eyes, feet, arm, sleeve, and item pieces with affine matrices and named attachment origins; no official skeletal file format was recovered in this work ([body and arm rendering](https://setplannergt.com/app.d5e8585e60.js)).

Model it as a sprite rig with semantic attachment nodes. This is sufficient to express player-following pieces, arm rotation, held items, rider offsets, and local FX without claiming that Growtopia uses a particular third-party skeleton format.

Recommended hierarchy:

```text
world
  playerRoot: position, facing, player scale
    riderVisualRoot: item/script lift
      body
      head / eyes
      backFoot / frontFoot
      backArm
        backSleeve
        backHand
      frontArm
        frontSleeve
        frontHand
      clothing pieces attached to those nodes
    mount contact root: NOT lifted with rider
  world-space particles: retain birth transform
  following pet: independent update/attachment policy
```

This hierarchy is a recommended implementation, not an extracted native scene graph. A render pass can draw a node's piece before or after another node without changing the attachment hierarchy.

### Coordinate and transform conventions

The planner uses a logical 32-pixel tile and origins including default `[16,32]`, front hand/arm reference `[9,18]`, back hand/arm reference `[24,18]`, a special `backHandPivot` `[23,18]`, and pet reference `[-40,28]` ([origins](https://setplannergt.com/app.d5e8585e60.js), [catalog](https://setplannergt.com/items.17c8f97f87.dat)).

Its arm source metadata describes a 6×10 arm sprite with back placement `[21,17]` and front placement `[6,17]`; placement coordinates and rotation pivots are related but are not interchangeable ([catalog arm metadata](https://setplannergt.com/items.17c8f97f87.dat)).

For an affine matrix `[a,b,c,d,tx,ty]`, this handoff uses:

```text
x' = a*x + c*y + tx
y' = b*x + d*y + ty
Mworld = Mroot * Mattachment * Mpiece
```

For a piece with anchor fractions, nonuniform scale, rotation pivot, and optional source flips:

```text
Mpiece =
  T(x,y) * T(rotationPivot) * R(degrees) * T(-rotationPivot)
  * S(kx,ky) * T(-anchorX*sourceWidth, -anchorY*sourceHeight)
  * optionalSourceFlip
```

The isolated planner sprite-transform function is numerically compared against this implementation in 200 changed-input cases. This is a numerical equivalence test, not a rendered-image comparison.

### Facing and hand attachment

The planner applies rotations around named arm/hand origins and uses a held-item reference angle to avoid double-rotating items whose reference recording already contains an arm pose ([armMatrix, heldMatrix, and heldRef logic](https://setplannergt.com/app.d5e8585e60.js)).

The supplied hand helper adds one logical pixel to the origin's y coordinate for the held-item pivot, matching the planner helper's formula, while the caller can supply a calibrated reference angle ([heldMatrix](https://setplannergt.com/app.d5e8585e60.js)).

For left facing, reflect the logical player once using `[-1,0,0,1,32,0]` and then apply world translation. Do not mirror the player root, the arm, and the hand item independently unless a descriptor explicitly calls for an additional source-cell flip.

## Locomotion and pose animation

### Separate simulation from drawing

The planner's play-mode controller maintains velocity, grounded state, jump/punch state, movement clocks, collision handling, and pet state separately from its avatar rendering routines ([play-mode controller and avatar renderer](https://setplannergt.com/app.d5e8585e60.js)).

Follow that separation in the host planner. The renderer should accept a `MotionFrame` rather than infer physics from whichever animation happens to be playing.

Use separate clocks for global item animation, locomotion phase, punch age, double-jump age, and particle age. A global rainbow loop should not restart simply because the avatar changes direction, while an action clip usually needs an action-local start time.

### Source-derived walk reference

The bundle contains a recorded walk-arm track with a 1,320 ms loop and samples spaced at 33 ms; its first keys are `[0,20,330.3]`, `[33,11.8,348.2]`, `[66,3.5,356.5]`, `[99,333.8,26.2]`, and `[132,347,13]` ([walk tables and bareArms sampler](https://setplannergt.com/app.d5e8585e60.js)).

The walk-foot track shares the 1,320 ms reference period, with initial y offsets `[0,-2]` at time 0, `[-0.4,-1.6]` at 33 ms, `[-0.8,-1.2]` at 66 ms, and `[-1.2,-0.8]` at 99 ms, plus additional discrete channels ([foot table and sampler](https://setplannergt.com/app.d5e8585e60.js)).

The arm sampler uses shortest-path angle interpolation and holds its final sample until loop wrap, whereas the foot sampler interpolates its tail toward the first sample and holds the discrete foot channels ([bareArms and feet sampling logic](https://setplannergt.com/app.d5e8585e60.js)).

All recovered keys are retained in `planner-profile.mjs`. Do not replace them with a generic sine wave and call the result exact.

### Jump, fall, and glide

The planner's generic movement step approaches arm target 200° while rising at 900°/s, and target 330° while falling at 200°/s; it approaches foot offset +1 while rising and −2 while falling at 30 logical pixels/s, with item-dependent glide behavior ([movement pose update](https://setplannergt.com/app.d5e8585e60.js)).

The bundle also contains separate reference jump/fall tables and item-recording selectors, so generic pose approach is only one path through the rendering system ([pose tables and move-record selection](https://setplannergt.com/app.d5e8585e60.js)).

The supplied rig implements the generic stateful approach and preserves the reference tables for further work. It does not claim to reproduce unavailable per-item recordings or all hover/glide exceptions.

### Landing

The inspected generic controller detects landing through collision/ground state and moves into an appropriate grounded movement state; no universally applicable standalone landing-squash clip was established by this research ([movement controller](https://setplannergt.com/app.d5e8585e60.js)).

Therefore the supplied reference emits a `land` event and returns to ground pose without inventing a squash animation. A real item can supply a landing hook once an authorized definition or capture establishes it.

### Preview physics values are not an official specification

The planner declares speed 250, acceleration 1,200, gravity 1,000, friction 1,200, jump 450, released-jump extra gravity 5,000, maximum fall 400, and a slow-fall factor of 0.3 in its play-mode constants ([planner physics constants](https://setplannergt.com/app.d5e8585e60.js)).

These constants are supplied as a labeled reference profile. The included `PreviewMotion` controller only uses a flat floor and a subset of the planner's behavior, so even matching the constants does not reproduce the planner's full collision and subpixel movement, let alone the official game.

For official parity, capture trajectories for held jump, tapped jump, walking acceleration, stop, reverse direction, fall, landing, double jump, and item modifiers in a known client build. Calibrate collisions and pixel rounding as well as the continuous equations.

## Punch, sleeves, and arm ownership

### Punch is more than arm rotation

The planner supports generic punch geometry, item-specific punch poses/recordings, held-reference offsets, punch ownership, delayed/extended action clocks, punch-type variants, FX, and special render paths ([punch and recording logic](https://setplannergt.com/app.d5e8585e60.js)).

The generic planner constants include a 260 ms nominal punch duration, 200 ms punch cooldown, and a target displacement of `[40,-2]` in its default facing basis ([punch constants and target helper](https://setplannergt.com/app.d5e8585e60.js)).

The package includes that generic envelope as a fallback and accepts explicit per-item punch tracks. It does not implement all punch-owner arbitration, transformed punch bodies, custom streams, tile-specific interactions, or after-punch recording tails.

### Normal arm sleeves versus punch sleeves

The planner renders normal shirt sleeves from `player_sleeve.png` around arm transforms and switches the punching sleeve to `player_puncharm.png`, whose punch cells use 20×48 source rectangles ([sleeve and punch-arm routines](https://setplannergt.com/app.d5e8585e60.js)).

The public `punchSleeves` entries associate an item's sleeve column with optional tint data; these are per-item facts rather than a universal relationship between a clothing item's atlas x coordinate and a punch texture ([catalog](https://setplannergt.com/items.17c8f97f87.dat)).

The reference implementation preserves mappings, selects the corresponding punch column for the back/punching sleeve, and leaves the other sleeve attached to its normal arm. Additional skin-sleeve, hidden-sleeve, replacement-arm, or script-owned exceptions need calibrated descriptors.

### Correct layering of a punch

An item's punch sprite may belong to a different pass from its ordinary held piece, and the planner sometimes treats hand-held pieces, arm pieces, front/back fragments, and script-owned pieces separately ([draws, sleeve, and hand-item logic](https://setplannergt.com/app.d5e8585e60.js)).

Do not solve this with one global “hand item is always on top” rule. Use a per-piece render pass and attachment, and ensure the old normal arm/sleeve does not remain visible under the replacement.

## Layering, hiding, and visual modifiers

### Ordered passes

The planner declares named passes for behind items, back hair, back hat, backpack, aura, back hand, back arm, back chest, shoes, pants, shirt, chest, frontpack, front arm, face, hair, hat, hand, pets, in-front items, and particles, with body rendering inserted between the back and front clothing groups ([render order](https://setplannergt.com/app.d5e8585e60.js)).

The reference pass order is:

```text
RenderBehind
RenderBackHair
RenderBackHat
RenderBackpack
RenderAura
RenderBackHandItem
RenderBackArm
RenderChestBackItem
BODY
RenderShoes
RenderPants
RenderShirt
RenderChestItem
RenderFrontpack
RenderFrontArm
RenderFaceItem
RenderHair
RenderHat
RenderHandItem
RenderPet
RenderInFront
PARTICLES
```

This is a planner-oriented pass graph, not a declaration that all clothing can be sorted by a single native z index. A multipart item may emit into several passes.

### Exceptions are data, not accidents

The planner's `faceLayer` logic gives `faceEarly` precedence, then face `overHat`, then hood-dependent `overHair`, with a separate chest-over-hat condition ([face-layer logic](https://setplannergt.com/app.d5e8585e60.js)).

The package implements those basic pass relocations. Additional behaviors such as back hat pieces, wrapped clothes, “under raptor,” “under mermaid,” transformed full sets, or script-generated front/back fragments remain item-specific work.

### Body-part hiding is a separate domain

The source distinguishes clothing slot removal, hidden pets/worn items, pants suppression, hidden legs, hidden face/head behavior, invisible/ghost behavior, and renderer-owned body overrides ([dress, bodyHidden, hiddenParts, drawBody, and transformed logic](https://setplannergt.com/app.d5e8585e60.js)).

The implementation exposes semantic body tags such as `head`, `eyes`, `eyelids`, `backArm`, `frontArm`, `backFoot`, `frontFoot`, `backLeg`, and `frontLeg`. These are this package's API names, not recovered official bone IDs.

Do not map `hides: [5]` to “hide body part 5.” The catalog's Cultist Robe example and the planner's equipment resolver instead demonstrate suppression of hand clothing slot 5 ([catalog](https://setplannergt.com/items.17c8f97f87.dat), [dress logic](https://setplannergt.com/app.d5e8585e60.js)).

### Skin, clothing tint, and alpha

The planner obtains skin and visual changes from role/skin choices and item modifiers, and treats body color/alpha separately from eye layers and clothing records ([skinRGB, effectiveSkin, bodyAlpha, and playmod logic](https://setplannergt.com/app.d5e8585e60.js)).

The catalog exposes some per-item `playmod.skin`, `alpha`, and `invisible` metadata, while also containing dye and other item-specific visual fields ([public catalog](https://setplannergt.com/items.17c8f97f87.dat)).

The reference adapter supports basic skin/alpha/invisible inputs and RGB multiplication with preserved alpha. It deliberately does not claim official priority resolution when multiple equipped items compete to change skin, player scale, role appearance, ghost body, or head replacement.

In a Canvas implementation, recolor a cached source crop, not the whole composited avatar. In a GPU implementation, keep a texture sample's alpha and multiply its RGB by the requested tint before ordinary premultiplied-alpha compositing.

## Per-item frame animation and scripts

### Source rectangles are not enough

The catalog has ordinary cell metadata, static icon records, multipart descriptors, clock-frame overrides, sprite transforms, and references to scripts; the application's more detailed recording system additionally handles movement-specific records, variants, once/loop/hold behavior, and interpolation between recorded moments ([catalog](https://setplannergt.com/items.17c8f97f87.dat), [recording and sampling methods](https://setplannergt.com/app.d5e8585e60.js)).

Never infer an item's entire animation by walking rightward across its sprite sheet until a transparent cell appears. A neighboring cell may be another item, a punch-only frame, an overlay, or a different-sized part.

### Required descriptor layers

For each fully supported item, define:

- **Identity**: Stable item ID, planner slot, source build/hash, and evidence status.
- **Geometry**: Atlas rectangle, logical scale, anchor, rotation pivot, source flips, and attachment.
- **Passes**: One or more named render passes, including front/back fragments when needed.
- **Clips**: Explicit idle/walk/jump/fall/glide/punch/double-jump/land clips when available.
- **Time**: Global versus movement/action clock, frame durations, loop region, hold behavior, and event times.
- **Overrides**: Arm pose, body hiding, clothing slot hiding, skin/alpha, player scale, and rider lift.
- **Effects**: Per-trigger emitter IDs and local/world placement policies.
- **Dependencies**: Required renderer/FX/atlas files and unresolved features.
- **Validation**: Capture/fixture IDs and the scope of any equivalence claim.

This is the normalized format Claude should author or compile into. It is intentionally richer than a single `textureX`, `textureY`, and `frameCount`.

### What the planner script evaluator reveals

The public bundle includes an XML-like tree evaluator with named render passes, sprite definitions, curves, variables/settings, condition-dependent drawing, skin tint overrides, additive blending, target stretching, character copying, particle systems, and attachment/world-position queries ([renderer and particle evaluator](https://setplannergt.com/app.d5e8585e60.js)).

The public code therefore gives useful semantics for a future authorized descriptor compiler. It does not make the unavailable item-specific script definitions magically present.

The included `script-vm.mjs` is a new, bounded descriptor hook language supporting `if`, `pose`, `hide`, `piece`, and `emit`. It is not a parser for Growtopia's original renderer language, does not execute the catalog's renderer filenames, and should not be advertised as such.

### Item follow behavior

The planner contains rigid hand attachments, orbiting parts, separate pet movement, recording-based transforms, and special thrown/punch effects that preserve information about the player position and facing at an earlier moment ([hand, pet, orbit, and thrown-effect logic](https://setplannergt.com/app.d5e8585e60.js)).

Use explicit attachment policies rather than forcing every item to follow the same player root. A rigid held item, a bobbing shoulder item, an independently trailing pet, and a world-space punch trail need different clocks and parent transforms.

## Riding, floating, and FX

### Riding and hover

The planner's rider logic uses `riderLift`, `ClothingOffsetFromShoes`, and `AdditionalClothingOffset`, while hover logic separately considers `ShouldHover`, recorded lift, and script/item interactions ([playerLift, rider, liftOf, and clientLift logic](https://setplannergt.com/app.d5e8585e60.js)).

That distinction matters: hovering is not just “always move the full avatar upward by a constant.” The renderer may need time-varying body lift, different arm behavior, mount contact geometry, and interaction with other equipped items.

The reference supports an explicit rider offset plus host-supplied visual lift and an unlifted mount attachment. Automatic evaluation of all native-looking lift logic, full mount animation, hover-script dependencies, and pet-rider combinations is not implemented.

### Double jump and air-jump effects

The planner selects a `doublejump` recording when appropriate air-jump state and item conditions are present, and separately loads or draws air-jump FX records; the catalog's `airJumpFx` field only identifies a dependency ([move-record selection and air-jump FX logic](https://setplannergt.com/app.d5e8585e60.js), [catalog](https://setplannergt.com/items.17c8f97f87.dat)).

Implement a discrete `doubleJump` event with a stable ID and event-local age. Do not re-spawn an effect every display frame while a boolean “can double jump” or “is airborne” remains true.

### Particle system scope

The planner's particle evaluator includes emitter-relative versus world-relative behavior, gravity, particle-angle-dependent velocity, scale interpolation, spin, tint/alpha curves, frame animation, and additive blending ([particle creation and rendering](https://setplannergt.com/app.d5e8585e60.js)).

The package's seeded FX system deliberately implements only bounded spawning, local/world placement, velocity, gravity, lifetime, and fade plumbing. It provides a deterministic foundation, not a substitute for every item's real emitter recipe.

For weather integration, keep foreground weather, player-attached effects, world-space trails, and background weather in the host's explicit pass graph. Do not let player animation reset the weather clock or accidentally apply the player tint to weather.

## Resolution, sampling, and supersampling

### What 32x through 256x means here

This handoff interprets the requested sizes as pixels per logical tile: 32→1×, 64→2×, 128→4×, and 256→8×. The avatar's final canvas bounds remain a separate viewport/cropping choice so large wings, hats, mounts, and particles are not clipped.

If the host application instead uses “32x” to mean atlas frame resolution or an exact square export dimension, adapt that output interface without changing the logical rig coordinates. These three meanings must not be conflated.

### Independent scale domains

Keep four quantities separate:

- **Logical geometry**: Player positions and pivots in 32-unit coordinates.
- **Source density**: Atlas pixels per logical unit, independently specified per atlas.
- **Output scale**: Chosen pixels per tile divided by 32.
- **Raster scale**: Device-pixel ratio and optional supersampling.

For a 64-source-pixel frame spanning 32 logical units, register `pixelsPerUnit: 2`; drawing to 128 pixels per tile then applies a net scale of `4 / 2 = 2` to those source pixels. Do not multiply both crop coordinates and world geometry by the output scale.

### Sampling policy

Set Planner explicitly disables Canvas image smoothing on its main sprite-oriented drawing/export paths and uses device-pixel ratio in some canvas sizing; this is not evidence that the official game uses a specific supersampling algorithm ([canvas and export code](https://setplannergt.com/app.d5e8585e60.js)).

The included Canvas adapter uses nearest-neighbor source sampling by default. Its optional 2×/4× supersampled working surface uses an intentional filtered resolve, which is a quality option for this planner rather than a claim about Growtopia's renderer.

Validate rotated sprites, fractional pivots, transparent borders, tinting, and atlas-edge bleed at all output scales. A nearest-neighbor 8× screenshot should not be accepted as proof of a correct arm pivot if the underlying 1× geometry is wrong.

## Implementation delivered

### Modules and responsibilities

| Module | Responsibility | Fidelity boundary |
|---|---|---|
| `math.mjs` | Affine composition, pivots, angular interpolation | Generic mathematical implementation |
| `planner-profile.mjs` | Source-derived planner tracks, origins, passes, constants | Planner reference, not official constants |
| `animation.mjs` | Tracks, frame timing, crossed events | Generic playback; no automatic missing-data recovery |
| `rig.mjs` | Walk/air pose, generic punch, arm/held transforms | Selected planner behavior; not all item owners/overrides |
| `motion.mjs` | Fixed-step helper and flat-floor preview | Not a world collision engine |
| `items.mjs` | Catalog validation/import and public-part fallback | Fallback is approximate and visibly incomplete |
| `render.mjs` | Body, basic clothes/sleeves, passes, hiding, root/lift, draw calls | No full native/script compositor |
| `canvas-assets.mjs` | Alpha-preserving tint cache and output surface | Browser Canvas adapter, not official rasterization |
| `script-vm.mjs` | Bounded descriptor hooks | New language, not Growtopia script compatibility |
| `effects.mjs` | Seeded local/world particle foundation | Recipes and advanced particle features missing |
| `player.mjs` | Integration of hook/pose/draw steps | Host connects assets, clocks, emitters, weather |

### What was tested

The original 36 tests cover transform order, arm-pivot invariance, held pivots, facing, angular wrap, recovered walk keys, interpolation, air/punch overlays, event boundaries, frame sequences, fixed-step consistency, jump edge handling, format separation, incomplete-item warnings, render ordering, hiding, skin alpha, rider lift, punch-sleeve mapping, all output scales, tint alpha preservation, supersampling plumbing, local/world FX behavior, VM budgets, and integration. Eight additional adapter/pose tests cover the catalog and riding revision; see RIDING_AND_CATALOG_REVISION.md and VALIDATION.md for current coverage.

The differential fixture set contains 200 walk-arm samples, 400 arm matrices, and 200 sprite matrices evaluated from isolated reviewed planner functions on changed inputs. No application bootstrap, private data loader, native client, or target rasterizer was executed.

These tests support numerical parity for the named helper functions only. They do not prove full frame parity, complete wardrobe coverage, or official motion accuracy.

## Remaining work for exact fidelity

The user's requirement of exact official movement is not fulfilled merely by this package passing its tests. The next evidence needed is an authorized, build-identified official-client capture set and the missing per-item definitions or equivalent observations.

Before making a parity claim:

- **Pin the target**: Client version/platform, asset hashes, items.dat version/hash, frame/capture rate, display scale, and equipped item IDs.
- **Capture the empty player**: Idle, start/stop walk, reverse, tapped/held jump, apex, falling, landing, ground punch, and airborne punch in both facings.
- **Capture special outfits**: Sleeve colors, robe hiding, over-hat face items, skin-changing items, mounts, hover items, transformed bodies, and double-jump emitters.
- **Measure coordinates**: Root trajectory, each arm angle/pivot, foot offset, item anchor, source frame, and pass at each sample.
- **Compare images**: Align world origin and crop, compare RGBA output, and distinguish timing error from geometry and rasterization error.
- **Track coverage**: Mark each item/feature as metadata-only, static-reference, approximate-animation, planner-numerical-match, or official-capture-verified.
- **Retain failures**: Store known mismatch cases rather than hiding them behind an “all items supported” label.

Read VALIDATION.md for a concrete recording and comparison protocol. Read GAPS.md before describing the current code's completeness.

## Licensing and reuse cautions

Public availability is not a license to redistribute an entire application's source or copyrighted game textures. The inspected Set Planner application bundle and sealed files are not included. The current revision adds a locally runnable demo with the catalog and reference atlases used for the requested reconstruction, alongside independently written integration code and factual evidence summaries. Asset ownership remains unchanged; this reference package does not grant permission for public redistribution. Check permissions or replace those assets before distributing a separate product.

Growtopia Explorer's published terms identify Raey (@araeys) as its creator and require visible creator attribution when substantial original Explorer code or design is reused in a public derivative ([attribution terms](https://raw.githubusercontent.com/araeys/growtopia-explorer/main/ATTRIBUTION_TERMS.md)).

The handoff did not import Explorer's implementation into its runtime modules. If Claude later copies external code, it must review and preserve the relevant notices and attribution rather than assuming that every GitHub repository has the same permissions.
