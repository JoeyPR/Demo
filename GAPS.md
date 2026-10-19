# Fidelity and coverage gaps

Read INPUT_ABILITIES_FX_REVISION.md first for the current status, superseding older entries below. Default single jump, equipment-sourced high/double jump and held slow fall, Speedy, pointer aiming, continuous punch, adaptive bounds and persistent controls are implemented. Known hover without a recovered curve now uses a labelled reference bob. The seven-state/action probe observes 176 XML-particle items; seven additional named procedural recipes exist, and 940 flagged items remain unresolved. Native emitter count/delay/lifetime and action gating are implemented within bounded replay. Pet catch-up and heading are improved; native pet AI, combat, water abilities and complete native particle/rule execution are not implemented.

This matrix is part of the deliverable, not an optional disclaimer. It tells Claude which work is implemented, which is source-derived, and which still needs data or code.

## Status vocabulary

- **Implemented**: The handoff contains working code and a relevant test, without implying official parity.
- **Planner-numerical match**: Selected pure helper results were compared against isolated Set Planner functions on changed inputs.
- **Approximate reference**: The behavior is useful for development but omits known exceptions or has not been visually compared.
- **Metadata only**: A field or dependency is retained; its full behavior is not implemented.
- **Blocked on evidence**: The necessary official capture, asset, script, or validated field semantics were not available.

## Feature matrix

Latest details are in ARCHIVE_MOUNT_PET_REVISION.md, followed by STATE_ROUTING_REVISION.md and ANIMATION_FX_FLOAT_REVISION.md. The supplied archive now provides 314 renderer definitions; the runtime implements a bounded subset, not complete native execution. Public sprite clocks, eligible source lift profiles, split seated gait, selected XML tracks and public pet cells are implemented with the limitations below.

| Requested feature | Current status | Remaining work |
|---|---|---|
| Player affine rig | Implemented | Validate actual body raster, exact base-source cells, and all alternate bodies |
| Official rig/skeleton format | Blocked on evidence | No official skeletal format recovered; do not invent one |
| Joint/pivot math | Planner-numerical match | Add special hand pivots/reference-angle cases per item |
| Player following root | Implemented | Validate all special item attachment overrides |
| Arm rotation | Planner-numerical match | Script/item ownership arbitration incomplete |
| Hand item to arm joint | Implemented basic attachment | Full heldRef extraction and “only turns”/mount arm behavior |
| Walk-arm playback | Planner-numerical match | Official-client capture comparison |
| Walk feet | Source-derived implementation | Add differential foot sampler and raster fixtures |
| Jump/fall generic pose | Approximate reference | Item-specific tracks, exact frame transition policy, official captures |
| Glide | Approximate reference | Per-item arm rules, speed/slow-fall integration, captures |
| Landing | Event and return-to-ground implemented | Per-item landing effects/overrides; no universal clip claimed |
| Movement/collision engine | Flat-floor preview only | Tile collision, subpixel rules, platforms, water, slopes/blocks as applicable, modifiers |
| Generic punch | Approximate reference | Official timing/geometry and target interactions |
| Per-item punch | Explicit descriptor interface | Populate real tracks, owners, custom reach, tile variants, cooldowns, after-punch tails |
| Normal arm sleeve | Basic catalog/static sleeve path | Skin sleeve changes, hidden/replacement arms, special per-item sleeve rules |
| Punch sleeve | Implemented per-column mapping | Real item visual fixtures and unusual sleeve ownership |
| Static clothing composition | Implemented reference | Full icon fallback orientation/cell/scale exceptions |
| Public `parts` frames | Approximate reference | Correct all complex offsets, pet/orbit parts, front/back splitting, size rules |
| Movement item frame sequences | Air/travel/ambient routing, Morty family and generic mount ground gating implemented | Exact per-item clips, animated idle exceptions, full recorded `moves` data |
| `clockFrames` | Public cell clocks and pulse implemented | Native-script-specific pulse/fade exceptions |
| `clockOrbit` and orbit parts | Metadata only | Implement orbit evaluator and attachment policy |
| Layer order | Implemented base graph | All script-generated/multipart/custom pass cases |
| Over-hat/hood/early-face | Implemented basic rules | Full real-item raster regression |
| Clothing slot hiding | Basic implementation | `wornWith`, wrapped substitutions, under-raptor/mermaid exceptions |
| Anatomical hiding | Semantic API implemented | Native byte mapping and all renderer-owned masks |
| Headless/hidden face/legs | Basic implementation | Transform/ghost/role-head conflicts |
| Item skin changes | Basic metadata and tint | Official competing-item priority, role skins, dynamic overrides |
| Clothing dyes | Tint primitive only | Catalog dye channels, material masks, hue/rainbow behavior |
| Invisibility/alpha | Basic body handling | Ghost eyes, duplicate render copies, special ghost/transformed bodies |
| Player scaling | Host visual transform | Native per-item semantics, conflicting scales, source pivot changes |
| Riding | Captured seats, separate nonfloating vehicle root, shared floating root, idle/travel gating and semantic poses | Exact mount movement clips, animated idle exceptions, full script ownership |
| Floating/hover | Eligible source curves, metadata classification, user-specified moving 45-degree arms and neutral recovery | Missing native curves, competing-item semantics, official transition timing |
| Follow-along rigid items | Implemented | Descriptor population and capture comparison |
| Pets | Public state-specific cell clocks and bounded lagging follower implemented | Native AI, perching, trails, terrain, combat, state-specific movement and attachment exceptions |
| Double-jump event | Implemented preview event | Host-specific abilities, cooldown/transition rules |
| Per-item double-jump FX | Metadata/interface only | Authorized emitter recipes and clips for each flagged item |
| Per-item ordinary/punch FX | Selected aura XML sprite/particle subset implemented | General emitters, native history/distributions, owner rules, trails, punch effects and contextual passes |
| FX local/world distinction | Implemented | Advanced curves, orbit, spin, additive/image playback |
| Full script language | Not implemented | Authorized parser/compiler and exact semantics for original renderer format |
| Safe custom item hooks | Implemented new bounded VM | Expand only with tests; do not claim original script compatibility |
| 32/64/128/256 tile output | Implemented transform/backend support | Real atlas/raster/export validation |
| Dense 64/128/256 source atlases | Backend supports explicit density | Per-piece geometry normalization and source resolution manifests |
| Supersampling | Optional 1/2/4 working surface | Target raster comparison; not claimed as official behavior |
| Timeline seek | Not implemented | Checkpoints and deterministic replay for all stateful subsystems |
| Complete scripted wardrobe | Not achieved | Missing scripts, movement recordings, FX, and special-case code |
| Exact official movement rendering | Not verified | Official build-identified captures and differential imagery |

## Source availability limits

The inspected public catalog lists 317 renderer script references, while the application uses separate sealed-data loading for detailed renderer/FX content; this research did not acquire those payloads ([catalog](https://setplannergt.com/items.17c8f97f87.dat), [application](https://setplannergt.com/app.d5e8585e60.js)).

Do not describe the CSV as “4,081 fully rendered items.” It is an evidence inventory that deliberately highlights dependencies.

## Code limitations to address during integration

- **Approximate parts adapter**: `samplePublicParts` is a fallback, not a faithful port of every `drawPlain` branch; atlas-specific cell sizing and authored offsets require explicit descriptors.
- **Static icon sleeve logic**: The fallback identifies front/back sleeves through the known planner reference positions; do not assume every future icon recording has that shape.
- **Skin resolution**: Basic first-match precedence and multiplied alpha are not official arbitration rules.
- **Equipment hiding**: A hidden item's visual modifiers may have interactions beyond the basic visible-item resolver; capture and author these rather than guessing.
- **Head/eye rows**: Base-source frame choices are a reference path; alternate skins, eyes, blinking, role bodies, and head replacement need validation.
- **Body ordering**: Full transformations and scripts may replace several body pieces at once; this package does not implement that entire compositor.
- **Piece attachment density**: Registering `pixelsPerUnit` handles source pixel size, but the item descriptor must still have correctly normalized geometry.
- **FX wrapper**: `PlannerPlayer` returns emit requests but does not resolve or draw per-item emitters automatically.
- **Hook pieces**: They are already normalized draw calls, not ordinary piece records; supplying the wrong form should be caught by a host schema validator.
- **Untrusted input**: The VM is bounded, but not every public function validates every numeric field; add schema validation before accepting community-authored descriptors.
- **Seeking and snapshots**: State restoration is a required extension for backwards scrubbing, arbitrary timestamp export, and worker-based rendering.
- **Raster quality**: Numerical package tests use no real textures. The updated demo loads and browser-tests real atlas sprites, but has not been pixel-compared with a build-identified official client.

## How to prioritize the next work

Start with empty-body official captures and the user's actual source tree so integration can be checked before complex item work. Then choose a small real outfit matrix covering ordinary sleeves, robe hiding, face-over-hat, skin change, riding/hover, and double jump.

Populate canonical descriptors for that matrix and add captures/tests one feature at a time. Expand the supported-item manifest only when a new item has sufficient data and passes the relevant regression cases.
