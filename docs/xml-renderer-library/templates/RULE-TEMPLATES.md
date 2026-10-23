# Renderer Rule Templates and Wiring Guide

## Shared rendering pipeline

1. `Data/Sprite` defines a named sprite: texture/atlas, cell size (`textureSize`) and default atlas cell (`frame`).
2. `Data/StateMachines/StateMachine` defines named states and `Transition` edges. Conditions are evaluated each simulation tick using host variables and item/player events. State entry time is the animation clock for tracks guarded by `playOnState`.
3. `Data/Animations` contains independent tracks. `SpriteAnimation` selects a cell from an explicit `Frame` list. `CurveAnimation*` and `SpriteCurveAnimation` describe curves; they are not equivalent to an image frame loop. `SequenceAnimation` may sequence multiple timed child operations.
4. `RenderRules` contains ordered hooks (e.g. `RenderBackpack`, `RenderShoes`, `RenderInFront`, `RenderBehind`, `Update`, `UpdatePunch`, `RenderPet`). Nested `StopIf` conditions and `Group`/`Translate` nodes control whether/where a draw op runs. The hook name is part of the draw pass.
5. `Data/ParticleSystems/ParticleSystem` defines emitter timing/count/lifetime and particle sprite/motion/lifetime curves. A particle system becomes visible only when an appropriate `ParticleSystemRender` hook renders it; `ParticleSystemUpdate` controls simulation/update ownership. Emitter lifetime and individual particle lifetime are separate clocks.
6. Host integration maps game-native variables/events (state, velocity, facing, jump, punch, hit tile, selfie, equipment/context) to planner inputs. Any absent host feature leaves its conditions unverified.

## Frame timeline formulas

For a `SpriteAnimation` with N frames and total `animTime = D`, the current interpreter's frame step is `D/N`. For a looping track, elapsed time is `elapsed mod D`; for a non-looping track it clamps to the last frame. If `animTime` is absent, the current interpreter uses `175 ms × N` as fallback. For a track guarded by `playOnState="Machine.State"`, elapsed is time since that machine entered the requested state. Multiple tracks may target one sprite; state-guarded tracks take precedence over autoplay tracks.

A curve's `KeyFrame` time is normalized, and the remaining comma-separated values form the sample vector. Sample between two keyframes by linear interpolation unless the source declares a different curve operation. A curve with values `0,1`, `0.5,0.2`, `1,0` goes from 1 to 0.2 during the first half, then from 0.2 to 0 during the second half.

## Family templates

### Wings / large back items

Expected *pattern*, not a universal rule: sprites for body of wing plus optional flare/trail sprites; `RenderBackpack` or related hook; possibly `AddClothingParticles` and `RenderInFront`; state-dependent idle/move/jump/fall frame lists; particles split by side and layer. Keep item transform attached to the correct body root and mirror only if the XML does so. If XML sets orientation/facing context explicitly, don't add a second automatic flip.

### Capes / cloaks / mantles

Use back-facing sprite pass behind body, preserve collar and cape as separate named sprites when present, use independent state tracks for idle/walk/jump/fall. Extra shimmer particles may have their own frame loop and emitter; do not fold them into the cape's frame timeline.

### Leash / pet

Treat pet body, tether/player-facing attachment and punch sparkle as separate pieces. A pet can have its own `StateMachine` (idle/follow/run/jump), and the leash can depend on `UpdatePet`/`UpdatePunch`. Attach to the native pet anchor/hand anchor from the host model, not an arbitrary player center.

### Shoes / slippers

Check both `RenderShoes` and update hooks. A renderer may animate the feet themselves, add scale/offset curves, or change the player lift; these are different behaviors. Reusing `SpringLoadedShoes` for an ordinary slipper would incorrectly apply its pogo offsets unless those tracks are removed or adapted. The uploaded archive contains no Slippers-specific XML.

### Auras

Inspect `RenderBehind` and `RenderInFront` independently. Some split the aura into two layers, use state variants (e.g. light/dark/both), and emit hit/punch particles. The sprite row/cell layout is often part of the state selection. Keep event-specific emitters separate from ambient loops.

### Held tools / pickaxe-like items

Preserve `RenderHandItem`/hand attachment rules, arm matrix, facing, offset, and punch transitions. A new tool can inherit a nearby tool template only if the frame geometry and input/action rules match. The source archive has no Pickaxe-named renderer, so any pickaxe adaptation must be explicitly labelled inferred until verified.

## Adapter template

`templates/renderer-adapter.mjs` clones a source renderer to avoid mutating it and requires explicit sprite/atlas aliases. In practice, use aliases for every sprite whose name/cell differs, set a frame override only when the target atlas is verified, and adjust offset/pass/timing only after comparison to source captures. If two items differ in state graph or events, use a new renderer definition rather than only changing sprite names.
