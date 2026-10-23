# Growtopia XML Item Rendering — Analysis & JavaScript Convertibility

This document analyzes the `growtopia-xml-renderer-library` archive (copied to
`docs/xml-renderer-library/`) and explains how Growtopia's XML-driven item
rendering works, how the Demo engine already consumes it, and what a full
JavaScript conversion would look like. It is the grounding for future
progressive work on this planner.

## 1. What the library contains

The archive is a conversion of the "player stuff" renderer pack
(20.3 MB of XML) into a structured, JavaScript-friendly form:

| Piece | Count / size | Purpose |
| --- | --- | --- |
| `source-xml/` | 347 XML files | The original `ItemRenderers/*.xml` (314) and `WorldRenderers/*.xml` (33) |
| `renderer-modules/item/*.mjs` | 314 modules | Each XML compiled to an ES module exporting a JSON IR tree (trimmed from this repo; the parsed data the engine uses lives in `demo/renderer-data.json`) |
| `manifest/summary.json` | — | Inventory: 1,467 unique sprite names, 1,426 animation tracks, 4,095 explicit sprite frames, 3,520 key-frame nodes, 921 particle systems |
| `manifest/tag-inventory.json` | — | Frequency table of every XML tag (Set ×14,009, Frame ×4,209, KeyFrame ×3,597, StateMachine ×413, …) |
| `manifest/family-map.json` | — | Renderers grouped into 13 families (wings 30, held-weapon-or-tool 60, particle-heavy-special-effect 101, mount-or-vehicle 23, aura 12, …) |
| `runtime/sequence.mjs` | — | Timeline helpers that sample the IR (see §4) |

## 2. How Growtopia's XML rendering works

An item's renderer is a **declarative program**, not a sprite list. The XML is
a tag tree with six cooperating systems:

### 2.1 Data (variables)
`<Data>` declares per-item variables (`IsVariableFloat`, `IsVariableBool`,
`VariableMap`) that other nodes read and write with `<Set>` (the single most
frequent tag, 14,009 uses) and `<ArithmethicOperation>`. Renderers keep
runtime state — e.g. a wing renderer tracks flap phase or a charge level.

### 2.2 Sprites
`<Sprite name="s_equip" atlas="player_cosmetics3.png" frame="3,23" textureSize="32"/>`
binds a logical sprite name to a cell in a sprite atlas (the `.rttex` sheets,
32 px cells). Sprites are referenced by name everywhere else — the renderer
never hard-codes pixel rectangles.

### 2.3 Animations
Two track types drive time-based motion:
- `<SpriteAnimation>` — frame sequences (`<Frame>` values are atlas cells),
  optionally gated with `playOnState="Motion.Move"` and looped via `isLoop`.
- Curves (`<Curve>`, `<SpriteCurveAnimation>`, `<InterpolationVec4Animation>`)
  — `<KeyFrame>` lists of piecewise-linear values (position, scale, rotation,
  color, alpha) sampled by time.

### 2.4 State machines
`<StateMachine>` (`×413`) with `<States>`, `<Transitions>` and `<Conditions>`
(e.g. `IsWearing`, `IsFacingLeft`, `IsZombified`, `IsSitting`,
`IsSleepingOnaBed`, `IsAction`). The game's actor state selects which
animations and rules are active — the same renderer behaves differently
while punching vs. idling.

### 2.5 Particle systems
`<ParticleSystem>` (`×981`) with `<Emitter>` and `<Particle>` nodes: emitted
sprites with lifetimes, velocities (`VectorTo`, `RandomRadial`), blending
(`add`), and per-keyframe color/alpha curves. Updated in
`updateStage` and drawn in `renderStage` (behind or in front of the avatar).

### 2.6 Render rules
`<RenderRules>` is the per-frame program. It walks the tag tree, evaluates
conditions, mutates variables, and emits draw operations:
- **Layer passes**: `RenderBehind`, `RenderBackpack`, `RenderShirt`,
  `RenderShoes`, `RenderHandItem`, `RenderInFront`, … — the same back-to-front
  pass stack the Demo engine already implements (`PASS_NAMES` in the old UI).
- **Draw ops**: `SpriteRender`, `Translate`, `Rotate`, `AvatarTransform`
  (attach to a rig joint), `Group` (compose transforms).
- **Reactions**: `OnPunchUpdate`, `OnPunchStart`, `OnDamagedTile`,
  `OnDestroyedTile`, `AddClothingParticles`, `ParticleSystemUpdate`.

So a frame of Growtopia rendering is: advance state machines → update
variables and particles → walk RenderRules → emit layered, transformed
sprite draw calls around the 32 px player cell.

## 3. What the Demo already runs

The Demo engine already consumes this library's data end to end:

- `demo/renderer-data.json` carries the 314 parsed item renderer scripts
  (the same content as the library's per-item modules, compacted).
- `demo/engine/xml-renderer.mjs` binds a renderer to an equipped item and
  advances it per frame; `xml-particles.mjs` and `fx-engine.mjs` run matched
  particle tracks.
- `demo/engine/render.mjs`'s pass stack (`RenderBehind` → `RenderInFront`)
  mirrors the XML layer tags.
- The ancestral system (`docs/ancestral/`) is the fully-ported proof: its
  fx tracks, keyframe sampling, world anchoring and per-facing track sets
  are exactly the XML particle model running in plain JavaScript.

## 4. JavaScript convertibility

The library's own `runtime/sequence.mjs` is the conversion pattern — the IR
is directly executable:

```js
// sprite tracks: pick the track for the current state machine, step by time
sampleSpriteTrack(renderer, "s_equip", timeMs, stateSinceMs, stateNames);
// → { frameIndex, cell, elapsedMs, durationMs, loop }

// curves: piecewise-linear keyframe sampling with clamping
sampleCurve(curve, normalizedTime);
```

**What converts cleanly (and is already converted):**
- Sprite animation tracks → frame-index lookup.
- Keyframe curves → lerp between sorted keyframes.
- Layer/pass structure → the existing draw-call stack.
- Simple particles → the ancestral fx engine's track sampler.

**What is partially handled:**
- State machines with conditions (`×413` machines, `×1,148` conditions) —
  the Demo evaluates common states (move/punch/sit) but not every condition
  tag.
- Arithmetic/variable programs (`Set`, `ArithmethicOperation`,
  `CompareCustomVariable`) — only the subsets used by matched tracks run.

**What would need real work for full coverage:**
- The full condition vocabulary (`IsZombified`, `IsTrnsformed`,
  `IsRenderMod`, custom variables).
- World renderers (33 XML files) — none are present in the player pack, so
  weather/world rendering stays on the separate growtopia-weather pipeline.
- Complex particle behaviors (radial emitters, trails, collision-adjacent FX).

**The conversion recipe** for any renderer:
1. Parse the XML tag tree once into JSON IR (already done — the library).
2. At equip time, bind sprites to atlases by name.
3. Per frame: advance state machines, sample tracks/curves with
   `sampleSpriteTrack`/`sampleCurve`, walk RenderRules emitting
   `{atlas, sx, sy, sw, sh, transform, alpha, blend, pass}` draw calls.
4. Feed the calls to the existing pass stack — no renderer-specific code.

## 5. Provenance note

The library header states the conversion "preserves source values but does
not imply every XML operation is implemented by the current planner
runtime" — the same stance the Demo takes: parsed definitions are reference
data; running behavior is limited to the interpreted subset, and unsupported
rules degrade gracefully rather than crash the render loop.
