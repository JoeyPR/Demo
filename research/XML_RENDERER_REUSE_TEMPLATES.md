# Per-item renderer reuse templates

## First decide what kind of reuse is safe

**Exact reuse:** point a catalog item to the same script name only if the item uses the same renderer behavior and compatible atlas cells.

**Same rules, different images:** clone a renderer, explicitly alias source sprites to target sprites, map the target atlas and default cells, and provide a replacement frame list for every animation track whose cells differ.

**Same family, different behavior:** start from the nearest family template, then replace its state graph, render hooks, attachment logic and emitter rules where the source differs. A family label is only a research hint.

## Rendering pipeline checklist

1. Read Sprite definitions first: source texture, normalized atlas key, texture size and default cell.
2. Trace all state machines: initial state, transition edges, transition conditions, entry/exit behavior, and any ExitTime.
3. For each animation track, record tag, sprite, playOnState/playOnAction, animTime, isLoop, all Frame cells and all child curves.
4. Walk RenderRules in source order. Record hook/pass, nested groups, transforms, StopIf conditions, render operation, alignment, offset, scale, flip and blend.
5. Trace particle update and render hooks separately. Record emitter offset, emission interval, count, lifetime, total emission, particle lifetime, sprite, scale/alpha/velocity/rotation curves, gravity, blending and relative-to-emitter behavior.
6. Inventory every XML node the planner interpreter cannot execute. Preserve it as data and mark it unsupported until implemented.
7. Build a fixture for IDLE, WALK, JUMP, FALL, PUNCH and each item-specific event. Compare frame index, source cell, draw pass, transform and effects.

## Reuse by family

### Wings
Often composite. Keep each half, upper/lower part, mirrored copy, flare, bokeh and trail separate. Preserve orientation and alignment rules, state-gated frame tracks, plus per-wing particle systems. Use a separate track-frame override for each track if the new atlas cells are not identical.

### Cape / cloak / mantle
Keep the main back piece, collar/front detail, optional shimmer sprite, and particle trail separate. Copy the movement state graph and idle/walk/jump/fall tracks only if the destination frames are equivalent. Respect RenderBackpack versus RenderFrontpack ordering.

### Leash / companion / pet
Do not collapse the pet sprite, tether/held layer and punch effect into one sprite. Map pet velocity, sleep, death, punch and vertical movement to the correct host state. Preserve RenderPet, UpdatePet and UpdatePunch semantics. If the host has no pet simulation variables, the source renderer cannot be faithfully activated yet.

### Shoes / slippers
Compare the RenderShoes hook with pose/lift/foot curves. SpringLoadedShoes includes pogo-related motion curves; that is not an ordinary-shoe baseline. The uploaded source archive contains no Slippers-named XML, so slipper behavior must remain an explicitly inferred adaptation pending evidence.

### Auras
Keep RenderBehind and RenderInFront independent. Preserve mode/state-dependent cells (for example, ActiveType Light/Dark/Both/None) and event-specific update hooks such as tile-damage or tile-destroy events. Ambient particle lifetime is not the same clock as the aura sprite animation.

### Hand-held tools, including a possible pickaxe
Preserve hand anchor, arm/punch transform, facing/flip, draw pass, offset and UpdatePunch conditions. The uploaded archive contains no Pickaxe-named renderer; a tool renderer may be a starting hypothesis, but it is not verified pickaxe behavior.

## Adapter API and integration

The bundle includes templates/renderer-adapter.mjs. It deep-clones a source renderer and supports:
- spriteAliases: source sprite name -> target sprite name
- atlasAliases: normalized source atlas -> normalized target atlas
- frameOverrides: target sprite -> default source cell such as "0,0"
- trackFrames: animation track name -> replacement ordered list of [x,y] cells; list length must match the source track
- timingScale: scale numeric track durations only after comparison evidence
- offset: add a global offset to SpriteRender offsets and emitter offsets
- passOverrides: rename a root render hook/pass
- matchingItems: provenance only; record item IDs/names known to use the adaptation

Important: this helper preserves XML structure but does not teach the engine new tag semantics. If target state transitions or behavior differ, edit the cloned data deliberately or build a new renderer. Ensure the atlas actually contains each substituted cell at the source cell size before switching the item record to that script.

## Wiring pattern

After placing the library in your app's source tree, load the source module and register the clone by a unique script key. Update the target catalog entry to use that same key. The player normalizer then uses catalog.renderers[raw.script] and tries to bind item pieces only when atlas, dimensions and a source cell match. If a binding does not match, the item can appear static or use fallback art while the XML track is effectively unbound.

