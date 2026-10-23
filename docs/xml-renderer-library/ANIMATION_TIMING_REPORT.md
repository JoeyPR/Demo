# Frame-by-frame XML Renderer Timing Report

Source: the attached `player stuff.zip` archive. All cells and conditions below are extracted from those XML files. Timing boundaries are the converter/current Render Lab interpretation, not proof that the original client schedules them identically.

## Interpretation rules used for the timelines

- A `SpriteAnimation` with N explicit frames and numeric total `animTime=D` is displayed in this report as N equal intervals of D/N milliseconds.
- When `animTime` is absent, this report uses the planner fallback `175 ms × N` (the value from `items.json`); this is an implementation assumption.
- State-gated tracks use the time since the state was entered; the active track selection, exit behavior, and transition timing need exact host/state-machine semantics.
- A missing `isLoop` flag is recorded as unspecified; it is not silently promoted to a verified looping behavior.
- Curve keyframes use the source value vectors. Normalized time is converted to milliseconds using the track duration only where the data make that duration explicit.

## Archive scope

- 314 item renderer XML files and 33 world/effect renderer XML files are present (347 total).
- 1,426 top-level animation-track entries, 4,095 explicit `SpriteAnimation` frame entries, 3,520 `KeyFrame` nodes and 921 item particle-system definitions are recorded in the bundle-level manifest. (Definitions and node totals are source-derived; timeline behavior is interpreter-dependent.)
- No Pickaxe-named XML and no Slippers-named XML are present in this archive. The index mentions 14 weather renderers, but those XML files are absent from the ZIP.

## EclipseWings

- Source: `ItemRenderers/EclipseWings.xml`; family classification: `wings` (heuristic).
- Structure: 3 sprite names / 3 definitions; 5 top-level animation tracks; 4 direct sprite frames; 1 state machines / 2 states / 2 transitions; 4 particle systems.

- Catalog matches: #15980 Eclipse Wings (slot Back).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_wings` | `game/particles_large17.rttex` | 64 | `4,6` |
| `s_flare` | `game/particles_large17.rttex` | 64 | `8,6` |
| `s_bokeh` | `game/particles_large17.rttex` | 64 | `9,6` |

### Animation tracks and frame sequence

**a_wings** — type `SpriteAnimation`; sprite `s_wings`; loop unspecified; 700 ms total (175 ms/frame fallback).
  - Frame 0: cell `[4, 6]` from 0 to 175 ms; interval 175 ms.
  - Frame 1: cell `[5, 6]` from 175 to 350 ms; interval 175 ms.
  - Frame 2: cell `[6, 6]` from 350 to 525 ms; interval 175 ms.
  - Frame 3: cell `[7, 6]` from 525 to 700 ms; interval 175 ms.
**flash_sequence** — type `SequenceAnimation`; state `SelfieTake.Max`; loop unspecified; duration not resolved.
  - No direct frame cells/keyframes on this node. Attributes: `{"name":"flash_sequence","playOnState":"SelfieTake.Max"}`.
**saturationValueFrom** — type `InterpolationFloatAnimation`; state `SelfieTake.Default`; loop unspecified; 600 ms total.
  - No direct frame cells/keyframes on this node. Attributes: `{"name":"saturationValueFrom","variableName":"saturationValue","playOnState":"SelfieTake.Default","targetVariableName":"saturationValueDefault","animTime":"600"}`.
**contrastValueFrom** — type `InterpolationFloatAnimation`; state `SelfieTake.Default`; loop unspecified; 600 ms total.
  - No direct frame cells/keyframes on this node. Attributes: `{"name":"contrastValueFrom","variableName":"contrastValue","playOnState":"SelfieTake.Default","targetVariableName":"contrastValueDefault","animTime":"600"}`.
**brightnessValueFrom** — type `InterpolationFloatAnimation`; state `SelfieTake.Default`; loop unspecified; 600 ms total.
  - No direct frame cells/keyframes on this node. Attributes: `{"name":"brightnessValueFrom","variableName":"brightnessValue","playOnState":"SelfieTake.Default","targetVariableName":"brightnessValueDefault","animTime":"600"}`.

### State machines

**SelfieTake** (initial `Default`): Default, Max.
  - `Max` → `Default`; condition: `null`
  - `Default` → `Max`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsAction","v":"JUMPDOUBLE"}]}`

### Particle systems

**ps_wingsLeft** — update stage `AddClothingParticles`; emitter: `{"offset":"0,-16","emissionInterval":"0.2","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"s_wings","relativeToEmitter":"true","blendingMode":"ADDITIVE","lifeTime":"1.0","inSpecificOrder":"true","renderAlignment":"RIGHT_CENTER"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.45, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.3, 0.3"},{"tag":"KeyFrame","v":"1, 1.1, 1.1"}]}]`
**ps_wingsRight** — update stage `AddClothingParticles`; emitter: `{"offset":"0,-16","emissionInterval":"0.2","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"s_wings","relativeToEmitter":"true","blendingMode":"ADDITIVE","lifeTime":"1.0","inSpecificOrder":"true","flipX":"true","renderAlignment":"LEFT_CENTER"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.45, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.3, 0.3"},{"tag":"KeyFrame","v":"1, 1.1, 1.1"}]}]`
**ps_flare** — update stage `(unspecified)`; emitter: `{"particlesPerEmission":"3","offset":"0,-16"}`; particle: `{"sprite":"s_flare","inSpecificOrder":"true","blendingMode":"ADDITIVE","relativeToEmitter":"true","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.5,0.5"},{"tag":"KeyFrame","v":"1, 2.6,2.6"}]}]`
**ps_bokeh** — update stage `(unspecified)`; emitter: `{"particlesPerEmission":"1","offset":"0,-16"}`; particle: `{"sprite":"s_bokeh","inSpecificOrder":"true","blendingMode":"ADDITIVE","relativeToEmitter":"true"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.5,0.5"},{"tag":"KeyFrame","v":"1, 1.5,1.5"}]}]`

### Render hooks and draw order

- `AddClothingParticles`: sprites — no direct SpriteRender; particles — ps_flare, ps_bokeh.
- `OnDrawCustomOutline`: sprites — no direct SpriteRender; particles — no direct particle operation.
- `RenderBackpack`: sprites — s_wings @ 0,-16, s_wings @ 0,-16; particles — ps_wingsLeft, ps_wingsRight, ps_flare.

### Reuse rule

copy only after matching each split sprite, mirror rule, state track, pass, and separate per-side particle emitter; preserve the movement-state machine.

## WingsOfInfinity

- Source: `ItemRenderers/WingsOfInfinity.xml`; family classification: `wings` (heuristic).
- Structure: 11 sprite names / 11 definitions; 15 top-level animation tracks; 31 direct sprite frames; 2 state machines / 5 states / 5 transitions; 12 particle systems.

- Catalog matches: #15826 Wings of Infinity (slot Back).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_FeatheredWingTop` | `game/particles_large17.rttex` | 64 | `0,1` |
| `s_FeatheredWingTipTop` | `game/particles_large17.rttex` | 64 | `1,1` |
| `s_FeatheredWingBottom` | `game/particles_large17.rttex` | 64 | `0,0` |
| `s_FeatheredWingTipBottom` | `game/particles_large17.rttex` | 64 | `1,0` |
| `s_FeatheredTrail` | `game/particles12.rttex` | 32 | `21,11` |
| `s_MechanicalWingTop` | `game/particles_large17.rttex` | 64 | `0,5` |
| `s_MechanicalWingTipTop` | `game/particles_large17.rttex` | 64 | `1,5` |
| `s_MechanicalWingBottom` | `game/particles_large17.rttex` | 64 | `0,4` |
| `s_MechanicalWingTipBottom` | `game/particles_large17.rttex` | 64 | `1,4` |
| `s_MechanicalTrail` | `game/particles12.rttex` | 32 | `22,11` |
| `s_MechanicalSpark` | `game/particles12.rttex` | 32 | `21,12` |

### Animation tracks and frame sequence

**a_FeatheredWingTop_Idle** — type `SpriteAnimation`; sprite `s_FeatheredWingTop`; state `Movement.Idle`; loop `True`; 400 ms total.
  - Frame 0: cell `[0, 1]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[2, 1]` from 200 to 400 ms; interval 200 ms.
**a_FeatheredWingTipTop_Idle** — type `SpriteAnimation`; sprite `s_FeatheredWingTipTop`; state `Movement.Idle`; loop `True`; 400 ms total.
  - Frame 0: cell `[1, 1]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[3, 1]` from 200 to 400 ms; interval 200 ms.
**a_FeatheredWingBottom_Idle** — type `SpriteAnimation`; sprite `s_FeatheredWingBottom`; state `Movement.Idle`; loop `True`; 400 ms total.
  - Frame 0: cell `[0, 0]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[2, 0]` from 200 to 400 ms; interval 200 ms.
**a_FeatheredWingTipBottom_Idle** — type `SpriteAnimation`; sprite `s_FeatheredWingTipBottom`; state `Movement.Idle`; loop `True`; 400 ms total.
  - Frame 0: cell `[1, 0]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[3, 0]` from 200 to 400 ms; interval 200 ms.
**a_FeatheredWingTop_Jump** — type `SpriteAnimation`; sprite `s_FeatheredWingTop`; state `Movement.Jump`; loop `False`; 400 ms total.
  - Frame 0: cell `[0, 3]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[2, 3]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[4, 3]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[8, 1]` from 300 to 400 ms; interval 100 ms.
**a_FeatheredWingTipTop_Jump** — type `SpriteAnimation`; sprite `s_FeatheredWingTipTop`; state `Movement.Jump`; loop `False`; 400 ms total.
  - Frame 0: cell `[1, 3]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[3, 3]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[5, 3]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[9, 1]` from 300 to 400 ms; interval 100 ms.
**a_FeatheredWingBottom_Jump** — type `SpriteAnimation`; sprite `s_FeatheredWingBottom`; state `Movement.Jump`; loop `False`; 400 ms total.
  - Frame 0: cell `[0, 2]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[2, 2]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[4, 2]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[6, 2]` from 300 to 400 ms; interval 100 ms.
**a_FeatheredWingTipBottom_Jump** — type `SpriteAnimation`; sprite `s_FeatheredWingTipBottom`; state `Movement.Jump`; loop `False`; 400 ms total.
  - Frame 0: cell `[1, 2]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[3, 2]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[5, 2]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[7, 2]` from 300 to 400 ms; interval 100 ms.
**a_FeatheredWingTop_Fall** — type `SpriteAnimation`; sprite `s_FeatheredWingTop`; state `Movement.Fall`; loop `True`; 400 ms total.
  - Frame 0: cell `[8, 1]` from 0 to 400 ms; interval 400 ms.
**a_FeatheredWingTipTop_Fall** — type `SpriteAnimation`; sprite `s_FeatheredWingTipTop`; state `Movement.Fall`; loop `True`; 400 ms total.
  - Frame 0: cell `[9, 1]` from 0 to 400 ms; interval 400 ms.
**a_FeatheredWingBottom_Fall** — type `SpriteAnimation`; sprite `s_FeatheredWingBottom`; state `Movement.Fall`; loop `True`; 400 ms total.
  - Frame 0: cell `[6, 2]` from 0 to 400 ms; interval 400 ms.
**a_FeatheredWingTipBottom_Fall** — type `SpriteAnimation`; sprite `s_FeatheredWingTipBottom`; state `Movement.Fall`; loop `True`; 400 ms total.
  - Frame 0: cell `[7, 2]` from 0 to 400 ms; interval 400 ms.
**a_MechanicalWingTipTop_JumpFall** — type `SpriteCurveAnimation`; sprite `s_MechanicalWingTipTop`; state `Movement.Jump|Movement.Fall`; loop `True`; 1000 ms total.
  - Keyframes: t=0.0: None.
**a_MechanicalWingTipBottom_JumpFall** — type `SpriteCurveAnimation`; sprite `s_MechanicalWingTipBottom`; state `Movement.Jump|Movement.Fall`; loop `True`; 1000 ms total.
  - Keyframes: t=0.0: None.
**a_MechanicalSpark** — type `SpriteAnimation`; sprite `s_MechanicalSpark`; loop unspecified; 525 ms total (175 ms/frame fallback).
  - Frame 0: cell `[21, 12]` from 0 to 175 ms; interval 175 ms.
  - Frame 1: cell `[22, 12]` from 175 to 350 ms; interval 175 ms.
  - Frame 2: cell `[23, 12]` from 350 to 525 ms; interval 175 ms.

### State machines

**Movement** (initial `Idle`): Idle, Jump, Fall.
  - `Fall` → `Idle`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableBool","a":{"name":"onGround"},"v":"true"}]}`
  - `Idle|Fall` → `Jump`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","v":"JUMP"}]}`
  - `Jump|Idle` → `Fall`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","v":"FALL"}]}`
**Moving** (initial `No`): No, Yes.
  - `Yes` → `No`; condition: `{"tag":"Condition","c":[{"tag":"IsVariableFloat","a":{"name":"speed.length","operator":"Less","abs":"true"},"v":"0.1"}]}`
  - `No` → `Yes`; condition: `{"tag":"Condition","c":[{"tag":"IsVariableFloat","a":{"name":"speed.length","operator":"Greater","abs":"true"},"v":"0.1"}]}`

### Particle systems

**ps_FeatheredTrail_TL** — update stage `(unspecified)`; emitter: `{"offset":"5,0","offsetFacing":"false","infParticles":"true","lifeTime":"0.8","particlesPerEmission":"1"}`; particle: `{"sprite":"s_FeatheredTrail","inSpecificOrder":"true","lifeTime":"1.5","blendingMode":"PREMULTIPLIED_ALPHA","useGravity":"true","gravityVector":"0, 50"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialVelocity"},"c":[{"tag":"KeyFrame","v":"0, -30"},{"tag":"KeyFrame","v":"0.2, -20, -30"},{"tag":"KeyFrame","v":"0.4, 50, -30"},{"tag":"KeyFrame","v":"0.6, -50, -30"},{"tag":"KeyFrame","v":"0.8, 50, -30"},{"tag":"KeyFrame","v":"1, 0, 0"}]}]`
**ps_FeatheredTrail_TR** — update stage `(unspecified)`; emitter: `{"offset":"5,0","offsetFacing":"false","infParticles":"true","lifeTime":"0.8","particlesPerEmission":"1"}`; particle: `{"sprite":"s_FeatheredTrail","inSpecificOrder":"true","lifeTime":"1.5","blendingMode":"PREMULTIPLIED_ALPHA","useGravity":"true","gravityVector":"0, 50"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialVelocity"},"c":[{"tag":"KeyFrame","v":"0, -30"},{"tag":"KeyFrame","v":"0.2, -20, -30"},{"tag":"KeyFrame","v":"0.4, 50, -30"},{"tag":"KeyFrame","v":"0.6, -50, -30"},{"tag":"KeyFrame","v":"0.8, 50, -30"},{"tag":"KeyFrame","v":"1, 0, 0"}]}]`
**ps_FeatheredTrail_BL** — update stage `(unspecified)`; emitter: `{"offset":"0,18","offsetFacing":"false","infParticles":"true","lifeTime":"0.8","particlesPerEmission":"1"}`; particle: `{"sprite":"s_FeatheredTrail","inSpecificOrder":"true","lifeTime":"1.5","blendingMode":"PREMULTIPLIED_ALPHA","useGravity":"true","gravityVector":"0, 50"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialVelocity"},"c":[{"tag":"KeyFrame","v":"0, -30"},{"tag":"KeyFrame","v":"0.2, -20, -30"},{"tag":"KeyFrame","v":"0.4, 50, -30"},{"tag":"KeyFrame","v":"0.6, -50, -30"},{"tag":"KeyFrame","v":"0.8, 50, -30"},{"tag":"KeyFrame","v":"1, 0, 0"}]}]`
**ps_FeatheredTrail_BR** — update stage `(unspecified)`; emitter: `{"offset":"0,18","offsetFacing":"false","infParticles":"true","lifeTime":"0.8","particlesPerEmission":"1"}`; particle: `{"sprite":"s_FeatheredTrail","inSpecificOrder":"true","lifeTime":"1.5","blendingMode":"PREMULTIPLIED_ALPHA","useGravity":"true","gravityVector":"0, 50"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialVelocity"},"c":[{"tag":"KeyFrame","v":"0, -30"},{"tag":"KeyFrame","v":"0.2, -20, -30"},{"tag":"KeyFrame","v":"0.4, 50, -30"},{"tag":"KeyFrame","v":"0.6, -50, -30"},{"tag":"KeyFrame","v":"0.8, 50, -30"},{"tag":"KeyFrame","v":"1, 0, 0"}]}]`
**ps_MechanicalTrail_TL** — update stage `(unspecified)`; emitter: `{"offset":"-22,-12","emissionInterval":"0.025","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalTrail","inSpecificOrder":"true","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0.5"},{"tag":"KeyFrame","v":"0.3, 0.5"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_MechanicalTrail_TR** — update stage `(unspecified)`; emitter: `{"offset":"22,-12","emissionInterval":"0.025","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalTrail","inSpecificOrder":"true","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0.5"},{"tag":"KeyFrame","v":"0.3, 0.5"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_MechanicalTrail_BL** — update stage `(unspecified)`; emitter: `{"offset":"-6,18","emissionInterval":"0.025","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalTrail","inSpecificOrder":"true","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0.5"},{"tag":"KeyFrame","v":"0.3, 0.5"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_MechanicalTrail_BR** — update stage `(unspecified)`; emitter: `{"offset":"6,18","emissionInterval":"0.025","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalTrail","inSpecificOrder":"true","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0.5"},{"tag":"KeyFrame","v":"0.3, 0.5"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_MechanicalSpark_TL** — update stage `(unspecified)`; emitter: `{"offset":"0,0","emissionInterval":"0.1","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalSpark","relativeToEmitter":"false","inSpecificOrder":"true","blendingMode":"ADDITIVE","initialScale":"0.5, 0.5","lifeTime":"0.75","initialVelocity":"0, 20"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_MechanicalSpark_TR** — update stage `(unspecified)`; emitter: `{"offset":"0,0","emissionInterval":"0.1","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalSpark","relativeToEmitter":"false","inSpecificOrder":"true","blendingMode":"ADDITIVE","initialScale":"0.5, 0.5","lifeTime":"0.75","initialVelocity":"0, 20"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_MechanicalSpark_BL** — update stage `(unspecified)`; emitter: `{"offset":"0,18","emissionInterval":"0.1","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalSpark","relativeToEmitter":"false","inSpecificOrder":"true","blendingMode":"ADDITIVE","initialScale":"0.5, 0.5","lifeTime":"0.75","initialVelocity":"0, 20"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_MechanicalSpark_BR** — update stage `(unspecified)`; emitter: `{"offset":"0,18","emissionInterval":"0.1","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","offsetFacing":"false","rgbTint":""}`; particle: `{"sprite":"s_MechanicalSpark","relativeToEmitter":"false","inSpecificOrder":"true","blendingMode":"ADDITIVE","initialScale":"0.5, 0.5","lifeTime":"0.75","initialVelocity":"0, 20"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`

### Render hooks and draw order

- `RenderBackpack`: sprites — s_FeatheredWingBottom @ (offset unspecified), s_FeatheredWingTipBottom @ (offset unspecified), s_MechanicalWingBottom @ (offset unspecified), s_MechanicalWingTipBottom @ (offset unspecified), s_FeatheredWingBottom @ (offset unspecified), s_FeatheredWingTipBottom @ (offset unspecified), s_MechanicalWingBottom @ (offset unspecified), s_MechanicalWingTipBottom @ (offset unspecified), s_FeatheredWingTop @ (offset unspecified), s_FeatheredWingTipTop @ (offset unspecified), s_MechanicalWingTop @ (offset unspecified), s_MechanicalWingTipTop @ (offset unspecified), s_FeatheredWingTop @ (offset unspecified), s_FeatheredWingTipTop @ (offset unspecified), s_MechanicalWingTop @ (offset unspecified), s_MechanicalWingTipTop @ (offset unspecified); particles — ps_FeatheredTrail_BL when Moving.Yes, ps_MechanicalSpark_BL when Moving.Yes, ps_MechanicalTrail_BL when Moving.Yes, ps_FeatheredTrail_BR when Moving.Yes, ps_MechanicalSpark_BR when Moving.Yes, ps_MechanicalTrail_BR when Moving.Yes, ps_FeatheredTrail_TL when Moving.Yes, ps_MechanicalSpark_TL when Moving.Yes, ps_MechanicalTrail_TL when Moving.Yes, ps_FeatheredTrail_TR when Moving.Yes, ps_MechanicalSpark_TR when Moving.Yes, ps_MechanicalTrail_TR when Moving.Yes, ps_FeatheredTrail_TL, ps_MechanicalTrail_TL, ps_MechanicalSpark_TL, ps_FeatheredTrail_TR, ps_MechanicalTrail_TR, ps_MechanicalSpark_TR, ps_FeatheredTrail_BL, ps_MechanicalTrail_BL, ps_MechanicalSpark_BL, ps_FeatheredTrail_BR, ps_MechanicalTrail_BR, ps_MechanicalSpark_BR.

### Reuse rule

copy only after matching each split sprite, mirror rule, state track, pass, and separate per-side particle emitter; preserve the movement-state machine.

## CrepeCape

- Source: `ItemRenderers/CrepeCape.xml`; family classification: `cape-cloak-mantle` (heuristic).
- Structure: 3 sprite names / 3 definitions; 5 top-level animation tracks; 14 direct sprite frames; 2 state machines / 6 states / 6 transitions; 1 particle systems.

- Catalog matches: #15392 Crepe Cape (slot Back).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_Cape` | `game/particles_large15.rttex` | 64 | `0,11` |
| `s_Collar` | `game/player_cosmetics3.rttex` | 32 | `21,28` |
| `s_spark` | `game/particles12.rttex` | 32 | `17,0` |

### Animation tracks and frame sequence

**s_Wing_idle** — type `SpriteAnimation`; sprite `s_Cape`; state `Action.Idle`; loop `True`; 50 ms total.
  - Frame 0: cell `[0, 11]` from 0 to 50 ms; interval 50 ms.
**s_Wing_jump** — type `SpriteAnimation`; sprite `s_Cape`; state `Action.JumpStraight`; loop `True`; 200 ms total.
  - Frame 0: cell `[0, 12]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[1, 12]` from 100 to 200 ms; interval 100 ms.
**s_Wing_fall** — type `SpriteAnimation`; sprite `s_Cape`; state `Action.FallStraight`; loop `True`; 200 ms total.
  - Frame 0: cell `[2, 12]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[3, 12]` from 100 to 200 ms; interval 100 ms.
**s_spark_frames** — type `SpriteAnimation`; sprite `s_spark`; loop unspecified; 350 ms total (175 ms/frame fallback).
  - Frame 0: cell `[18, 0]` from 0 to 175 ms; interval 175 ms.
  - Frame 1: cell `[18, 0]` from 175 to 350 ms; interval 175 ms.
**s_Wing_walk** — type `SpriteAnimation`; sprite `s_Cape`; state `Action.Walk`; loop `True`; 700 ms total.
  - Frame 0: cell `[1, 11]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[2, 11]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[3, 11]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[4, 11]` from 300 to 400 ms; interval 100 ms.
  - Frame 4: cell `[5, 11]` from 400 to 500 ms; interval 100 ms.
  - Frame 5: cell `[6, 11]` from 500 to 600 ms; interval 100 ms.
  - Frame 6: cell `[7, 11]` from 600 to 700 ms; interval 100 ms.

### State machines

**Action** (initial `Idle`): Idle, Walk, JumpStraight, FallStraight.
  - `FallStraight|Walk` → `Idle`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"speed.length","operator":"Less","abs":"true"},"v":"0.1"},{"tag":"IsVariableBool","a":{"name":"onGround"},"v":"true"}]}`
  - `FallStraight|Idle|JumpStraight` → `Walk`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableBool","a":{"name":"onGround"},"v":"true"},{"tag":"IsVariableFloat","a":{"name":"speed.x","operator":"Greater","abs":"true"},"v":"0.1"}]}`
  - `Idle|FallStraight|Walk` → `JumpStraight`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"speed.y","operator":"Less"},"v":"-0.1"},{"tag":"IsVariableBool","a":{"name":"onGround"},"v":"false"}]}`
  - `JumpStraight|Idle|Walk` → `FallStraight`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"speed.y","operator":"Greater"},"v":"0.1"},{"tag":"IsVariableBool","a":{"name":"onGround"},"v":"false"}]}`
**Trail** (initial `Idle`): Idle, Move.
  - `Move` → `Idle`; condition: `{"tag":"Condition","c":[{"tag":"IsVariableFloat","a":{"name":"speed.length","operator":"Less","abs":"true"},"v":"0.1"}]}`
  - `Idle` → `Move`; condition: `{"tag":"Condition","c":[{"tag":"IsVariableFloat","a":{"name":"speed.length","operator":"Greater","abs":"true"},"v":"0.1"}]}`

### Particle systems

**ps_luteTrailMove** — update stage `(unspecified)`; emitter: `{"offset":"0, -12","infParticles":"true","infLifeTime":"true","particlesPerEmission":"5","emissionInterval":"0.1"}`; particle: `{"sprite":"s_spark","renderAlignment":"CENTER","blendingMode":"ADDITIVE","initialScale":"0.25, 0.25","finalScale":"0.75, 0.75","interpolateScale":"true","useGravity":"true","gravityVector":"0, 30","lifeTime":"0.75","inSpecificOrder":"true","interpolateAngle":"true"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.5, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`

### Render hooks and draw order

- `AddClothingParticles`: sprites — no direct SpriteRender; particles — ps_luteTrailMove when Trail.Move.
- `RenderBackpack`: sprites — s_Cape @ -1,-16; particles — ps_luteTrailMove.
- `RenderFrontpack`: sprites — s_Collar @ 0.5,0.5; particles — no direct particle operation.

### Reuse rule

keep cape body, collar/front layer, and movement trail separate. Reuse the idle/walk/jump/fall tracks only where target frames and cells are verified.

## RoseCape

- Source: `ItemRenderers/RoseCape.xml`; family classification: `cape-cloak-mantle` (heuristic).
- Structure: 3 sprite names / 3 definitions; 2 top-level animation tracks; 12 direct sprite frames; 1 state machines / 2 states / 2 transitions; 1 particle systems.

- Catalog matches: #15196 Rose Cape (slot Back).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_capeBack` | `game/particles_large14.rttex` | 64 | `0,0` |
| `s_capeFront` | `game/player_cosmetics3.rttex` | 32 | `19,23` |
| `s_sparkle` | `game/particles10.rttex` | 32 | `0,0` |

### Animation tracks and frame sequence

**a_Sparkles** — type `SpriteAnimation`; sprite `s_sparkle`; loop unspecified; 300 ms total.
  - Frame 0: cell `[0, 29]` from 0 to 75 ms; interval 75 ms.
  - Frame 1: cell `[5, 29]` from 75 to 150 ms; interval 75 ms.
  - Frame 2: cell `[6, 29]` from 150 to 225 ms; interval 75 ms.
  - Frame 3: cell `[4, 28]` from 225 to 300 ms; interval 75 ms.
**a_cape** — type `SpriteAnimation`; sprite `s_capeBack`; loop `True`; 1600 ms total.
  - Frame 0: cell `[12, 7]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[13, 7]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[14, 7]` from 400 to 600 ms; interval 200 ms.
  - Frame 3: cell `[15, 7]` from 600 to 800 ms; interval 200 ms.
  - Frame 4: cell `[12, 8]` from 800 to 1000 ms; interval 200 ms.
  - Frame 5: cell `[13, 8]` from 1000 to 1200 ms; interval 200 ms.
  - Frame 6: cell `[14, 8]` from 1200 to 1400 ms; interval 200 ms.
  - Frame 7: cell `[15, 8]` from 1400 to 1600 ms; interval 200 ms.

### State machines

**Motion** (initial `Idle`): Idle, Move.
  - `Move` → `Idle`; condition: `{"tag":"Condition","c":[{"tag":"IsVariableFloat","a":{"name":"speed.length","operator":"Less","abs":"true"},"v":"0.1"}]}`
  - `Idle` → `Move`; condition: `{"tag":"Condition","c":[{"tag":"IsVariableFloat","a":{"name":"speed.length","operator":"Greater","abs":"true"},"v":"0.1"}]}`

### Particle systems

**ps_SparklesTrail** — update stage `(unspecified)`; emitter: `{"offset":"-5,0","offsetFacing":"true","emissionInterval":"0.1","infParticles":"true","lifeTime":"0.8","particlesPerEmission":"2"}`; particle: `{"sprite":"s_sparkle","inSpecificOrder":"true","lifeTime":"1.5","blendingMode":"PREMULTIPLIED_ALPHA","useGravity":"true","gravityVector":"0, 50"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialVelocity"},"c":[{"tag":"KeyFrame","v":"0, -30"},{"tag":"KeyFrame","v":"0.2, -20, -30"},{"tag":"KeyFrame","v":"0.4, 50, -30"},{"tag":"KeyFrame","v":"0.6, -50, -30"},{"tag":"KeyFrame","v":"0.8, 50, -30"},{"tag":"KeyFrame","v":"1, 0, 0"}]}]`

### Render hooks and draw order

- `AddClothingParticles`: sprites — no direct SpriteRender; particles — ps_SparklesTrail when Motion.Move.
- `RenderBackpack`: sprites — s_capeBack @ -16,-1; particles — ps_SparklesTrail.
- `RenderFrontpack`: sprites — s_capeFront @ 0,0; particles — no direct particle operation.

### Reuse rule

keep cape body, collar/front layer, and movement trail separate. Reuse the idle/walk/jump/fall tracks only where target frames and cells are verified.

## 14DEViLsFriendlyDoggyLeash

- Source: `ItemRenderers/14DEViLsFriendlyDoggyLeash.xml`; family classification: `leash-or-companion-control` (heuristic).
- Structure: 3 sprite names / 3 definitions; 7 top-level animation tracks; 14 direct sprite frames; 2 state machines / 9 states / 9 transitions; 1 particle systems.

- Catalog matches: #15592 14DEViL's Friendly Doggy Leash (slot Pants).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_Pants` | `game/player_cosmetics4.rttex` | 32,32 | `0,0` |
| `s_Dog` | `game/pets/p_friendly_dog.rttex` | 32,32 | `0,0` |
| `s_Punch` | `game/particles12.rttex` | 32 | `31,3` |

### Animation tracks and frame sequence

**s_Dog_Idle** — type `SpriteAnimation`; sprite `s_Dog`; state `Motion.None`; loop `True`; 400 ms total.
  - Frame 0: cell `[0, 0]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[1, 0]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[2, 0]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[3, 0]` from 300 to 400 ms; interval 100 ms.
**s_Dog_Death** — type `SpriteAnimation`; sprite `s_Dog`; state `Motion.Death`; loop `False`; 2000 ms total.
  - Frame 0: cell `[4, 1]` from 0 to 1000 ms; interval 1000 ms.
  - Frame 1: cell `[5, 1]` from 1000 to 2000 ms; interval 1000 ms.
**s_Dog_Sleep** — type `SpriteAnimation`; sprite `s_Dog`; state `Motion.Sleep`; loop `True`; 100 ms total.
  - Frame 0: cell `[3, 1]` from 0 to 100 ms; interval 100 ms.
**s_Dog_Jump** — type `SpriteAnimation`; sprite `s_Dog`; state `Motion.Up`; loop `True`; 100 ms total.
  - Frame 0: cell `[7, 0]` from 0 to 100 ms; interval 100 ms.
**s_Dog_Fall** — type `SpriteAnimation`; sprite `s_Dog`; state `Motion.Down`; loop `True`; 100 ms total.
  - Frame 0: cell `[0, 1]` from 0 to 100 ms; interval 100 ms.
**s_Dog_Move** — type `SpriteAnimation`; sprite `s_Dog`; state `Motion.Horizontal`; loop `True`; 300 ms total.
  - Frame 0: cell `[4, 0]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[5, 0]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[6, 0]` from 200 to 300 ms; interval 100 ms.
**s_Dog_Punch** — type `SpriteAnimation`; sprite `s_Dog`; state `Motion.Punch`; loop `True`; 400 ms total.
  - Frame 0: cell `[1, 1]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[2, 1]` from 200 to 400 ms; interval 200 ms.

### State machines

**Motion** (initial `None`): None, Up, Down, Horizontal, Punch, Death, Sleep.
  - `Punch|Up|Down|Horizontal|Sleep|Death` → `None`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"pet.velocity.length","operator":"Less","abs":"true"},"v":"0.1"},{"tag":"IsAction","a":{"operatorType":"NotEqual"},"v":"PUNCH"},{"tag":"I...`
  - `Punch|None|Down|Horizontal` → `Up`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"pet.velocity.y","operator":"Less"},"v":"-0.1"},{"tag":"IsAction","a":{"operatorType":"NotEqual"},"v":"PUNCH"}]}`
  - `Punch|None|Up|Horizontal` → `Down`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"pet.velocity.y","operator":"Greater"},"v":"0.1"},{"tag":"IsAction","a":{"operatorType":"NotEqual"},"v":"PUNCH"}]}`
  - `Punch|None|Down|Up` → `Horizontal`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"pet.velocity.x","operator":"Greater","abs":"true"},"v":"0.1"},{"tag":"IsVariableFloat","a":{"name":"pet.velocity.y","operator":"Less","a...`
  - `None|Up|Down|Horizontal|Sleep` → `Punch`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","v":"PUNCH"}]}`
  - `None` → `Sleep`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","v":"SLEEP"}]}`
  - `None|Punch|Up|Down|Horizontal|Sleep` → `Death`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","v":"DIE"}]}`
**SleepParticle** (initial `On`): On, Off.
  - `Off` → `On`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","v":"SLEEP"}]}`
  - `On` → `Off`; condition: `null`

### Particle systems

**PunchParticle** — update stage `(unspecified)`; emitter: `{"offset":"10, -16","emissionInterval":"0.2","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"s_Punch","blendingMode":"PREMULTIPLIED_ALPHA","rotateWithVelocity":"false","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.8, 0.8"},{"tag":"KeyFrame","v":"1, 1.2, 1.2"}]}]`

### Render hooks and draw order

- `Update`: sprites — no direct SpriteRender; particles — no direct particle operation.
- `RenderPet`: sprites — s_Dog @ (offset unspecified); particles — PunchParticle when Motion.Punch, 5.
- `UpdatePunch`: sprites — no direct SpriteRender; particles — no direct particle operation.
- `UpdatePet`: sprites — no direct SpriteRender; particles — no direct particle operation.

### Reuse rule

pet motion states and leash/player layers are not one animation. Map the pet host variables and `RenderPet` / `UpdatePet` / `UpdatePunch` hooks explicitly.

## XenososNebulafinLeash

- Source: `ItemRenderers/XenososNebulafinLeash.xml`; family classification: `leash-or-companion-control` (heuristic).
- Structure: 3 sprite names / 3 definitions; 3 top-level animation tracks; 6 direct sprite frames; 1 state machines / 2 states / 2 transitions; 1 particle systems.

- Catalog matches: #16320 Xenoso's Nebulafin Leash (slot Hand).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_Pet` | `game/pets/p_nebulafin.rttex` | 32 | `0,0` |
| `s_Hand` | `game/player_cosmetics4.rttex` | 32 | `29,9` |
| `s_sparkle` | `game/particles12.rttex` | 32 | `0,22` |

### Animation tracks and frame sequence

**a_PetIdle** — type `SpriteAnimation`; sprite `s_Pet`; state `Punch.No`; loop `True`; 600 ms total.
  - Frame 0: cell `[0, 0]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[1, 0]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[2, 0]` from 400 to 600 ms; interval 200 ms.
**a_PetPunch** — type `SpriteAnimation`; sprite `s_Pet`; state `Punch.Yes`; loop `True`; 1000 ms total.
  - Frame 0: cell `[3, 0]` from 0 to 1000 ms; interval 1000 ms.
**a_sparkle** — type `SpriteAnimation`; sprite `s_sparkle`; loop `True`; 200 ms total.
  - Frame 0: cell `[0, 22]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[1, 23]` from 100 to 200 ms; interval 100 ms.

### State machines

**Punch** (initial `No`): No, Yes.
  - `Yes` → `No`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","a":{"operatorType":"NotEqual"},"v":"PUNCH"}]}`
  - `No` → `Yes`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","v":"PUNCH"}]}`

### Particle systems

**ps_sparkle** — update stage `(unspecified)`; emitter: `{"offset":"0,-16","offsetFacing":"true","emissionInterval":"0.4","infParticles":"true","infLifeTime":"true","particlesPerEmission":"2","particlesToEmit":"2"}`; particle: `{"sprite":"s_sparkle","blendingMode":"ADDITIVE","lifeTime":"0.85"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"0.8, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`

### Render hooks and draw order

- `RenderHandItem`: sprites — s_Hand @ (offset unspecified); particles — no direct particle operation.
- `RenderPet`: sprites — s_Pet @ (offset unspecified); particles — ps_sparkle.

### Reuse rule

pet motion states and leash/player layers are not one animation. Map the pet host variables and `RenderPet` / `UpdatePet` / `UpdatePunch` hooks explicitly.

## SpringLoadedShoes

- Source: `ItemRenderers/SpringLoadedShoes.xml`; family classification: `footwear` (heuristic).
- Structure: 3 sprite names / 3 definitions; 8 top-level animation tracks; 0 direct sprite frames; 1 state machines / 3 states / 3 transitions; 0 particle systems.

- Catalog matches: #16092 Spring-Loaded Shoes (slot Feet).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_foot1` | `game/player_feet16.rttex` | 32 | `6,26` |
| `s_foot2` | `game/player_feet16.rttex` | 32 | `6,27` |
| `s_pogoStick` | `game/particles12.rttex` | 32 | `9,16` |

### Animation tracks and frame sequence

**a_Offset** — type `CurveAnimationFloat`; state `MotionY.No`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None; t=0.07: None; t=0.25: None; t=0.5: None; t=0.75: None; t=0.93: None; t=1.0: None.
**a_PoleScale** — type `CurveAnimationVec3`; state `MotionY.No`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None; t=0.07: None; t=0.25: None; t=0.5: None; t=0.75: None; t=0.93: None; t=1.0: None.
**a_PoleOffset** — type `CurveAnimationVec3`; state `MotionY.No`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None; t=0.07: None; t=0.25: None; t=0.5: None; t=0.75: None; t=0.93: None; t=1.0: None.
**a_PoleScaleAir** — type `CurveAnimationVec3`; state `MotionY.Yes`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None.
**a_PoleScaleManne** — type `CurveAnimationVec3`; state `MotionY.Mannequin`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None.
**a_OffsetAir** — type `CurveAnimationFloat`; state `MotionY.Yes`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None.
**a_LeftFoot** — type `CurveAnimationFloat`; state `MotionY.No`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None; t=0.07: None; t=0.25: None; t=0.5: None; t=0.75: None; t=0.93: None; t=1.0: None.
**a_RightFoot** — type `CurveAnimationFloat`; state `MotionY.No`; loop `True`; 700 ms total.
  - Keyframes: t=0.0: None; t=0.07: None; t=0.25: None; t=0.5: None; t=0.75: None; t=0.93: None; t=1.0: None.

### State machines

**MotionY** (initial `No`): No, Yes, Mannequin.
  - `Yes` → `No`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"speed.y","operator":"Less","abs":"true"},"v":"0.1"},{"tag":"IsVariableBool","a":{"name":"isMannequin"},"v":"false"}]}`
  - `No` → `Yes`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsVariableFloat","a":{"name":"speed.y","operator":"Greater","abs":"true"},"v":"0.1"},{"tag":"IsVariableBool","a":{"name":"isMannequin"},"v":"false"}]}`
  - `No|Yes` → `Mannequin`; condition: `{"tag":"Condition","c":[{"tag":"IsVariableBool","a":{"name":"isMannequin"},"v":"true"}]}`

### Particle systems

No particle systems recorded.

### Render hooks and draw order

- `Update`: sprites — no direct SpriteRender; particles — no direct particle operation.
- `RenderShoes`: sprites — s_pogoStick @ -4,0, s_pogoStick @ 8,0, s_foot1 @ (offset unspecified), s_foot2 @ (offset unspecified); particles — no direct particle operation.

### Reuse rule

this renderer contains pose/lift curves; do not reuse its curves for ordinary footwear unless the target item has the same foot/lift behavior.

## DiamondSparklingSneakers

- Source: `ItemRenderers/DiamondSparklingSneakers.xml`; family classification: `footwear` (heuristic).
- Structure: 4 sprite names / 4 definitions; 2 top-level animation tracks; 5 direct sprite frames; 0 state machines / 0 states / 0 transitions; 2 particle systems.

- Catalog matches: #14994 Diamond Sparkling Sneakers (slot Feet).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_foot1` | `game/player_feet16.rttex` | 32 | `30,14` |
| `s_foot2` | `game/player_feet16.rttex` | 32 | `30,15` |
| `s_godRays` | `game/particles_large11.rttex` | 64 | `5,15` |
| `s_sparks` | `game/particles11.rttex` | 32 | `18,28` |

### Animation tracks and frame sequence

**a_godRays** — type `SpriteAnimation`; sprite `s_godRays`; loop unspecified; 350 ms total (175 ms/frame fallback).
  - Frame 0: cell `[5, 15]` from 0 to 175 ms; interval 175 ms.
  - Frame 1: cell `[8, 14]` from 175 to 350 ms; interval 175 ms.
**a_sparks** — type `SpriteAnimation`; sprite `s_sparks`; loop unspecified; 600 ms total.
  - Frame 0: cell `[18, 28]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[19, 29]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[20, 28]` from 400 to 600 ms; interval 200 ms.

### State machines

No state machines recorded.

### Particle systems

**ps_godRays** — update stage `AddClothingParticles`; emitter: `{"emissionInterval":"0.7","infParticles":"true","infLifeTime":"true","particlesPerEmission":"2"}`; particle: `{"sprite":"s_godRays","relativeToEmitter":"true","renderAlignment":"DOWN_CENTER","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"true","lifeTime":"1"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.7, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 1, 1"},{"tag":"KeyFrame","v":"0.7, 1.75, 1.75"},{"tag":"KeyFrame","v":"1, 1.75, 1.75"}]}]`
**ps_sparkles** — update stage `AddClothingParticles`; emitter: `{"infParticles":"true","infLifeTime":"true","particlesPerEmission":"2"}`; particle: `{"sprite":"s_sparks","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.7","finalVelocity":"0, 0","interpolateVelocity":"true"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`

### Render hooks and draw order

- `RenderShoes`: sprites — s_foot1 @ (offset unspecified), s_foot2 @ (offset unspecified); particles — no direct particle operation.

### Reuse rule

preserve renderer-specific state, pass, animation, and attachment logic; name similarity alone is not evidence of compatibility.

## AnomalyAura

- Source: `ItemRenderers/AnomalyAura.xml`; family classification: `aura` (heuristic).
- Structure: 4 sprite names / 4 definitions; 4 top-level animation tracks; 44 direct sprite frames; 3 state machines / 11 states / 11 transitions; 2 particle systems.

- Catalog matches: #15230 Anomaly Aura (slot Ancestral).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `auraBack` | `game/particles_large15.rttex` | 64 | `0,4` |
| `auraFront` | `game/particles_large15.rttex` | 64 | `0,5` |
| `s_hitFlash` | `game/particles12.rttex` | 32 | `8,1` |
| `s_Sparkles` | `game/particles12.rttex` | 32 | `7,1` |

### Animation tracks and frame sequence

**darkEnabledBack** — type `SpriteAnimation`; sprite `auraBack`; state `ActiveType.Dark`; loop `True`; 900 ms total.
  - Frame 0: cell `[0, 5]` from 0 to 81.8182 ms; interval 81.8182 ms.
  - Frame 1: cell `[1, 5]` from 81.8182 to 163.636 ms; interval 81.8182 ms.
  - Frame 2: cell `[2, 5]` from 163.636 to 245.454 ms; interval 81.8182 ms.
  - Frame 3: cell `[3, 5]` from 245.454 to 327.273 ms; interval 81.8182 ms.
  - Frame 4: cell `[4, 5]` from 327.273 to 409.091 ms; interval 81.8182 ms.
  - Frame 5: cell `[5, 5]` from 409.091 to 490.909 ms; interval 81.8182 ms.
  - Frame 6: cell `[6, 5]` from 490.909 to 572.727 ms; interval 81.8182 ms.
  - Frame 7: cell `[7, 5]` from 572.727 to 654.545 ms; interval 81.8182 ms.
  - Frame 8: cell `[8, 5]` from 654.545 to 736.364 ms; interval 81.8182 ms.
  - Frame 9: cell `[9, 5]` from 736.364 to 818.182 ms; interval 81.8182 ms.
  - Frame 10: cell `[10, 5]` from 818.182 to 900 ms; interval 81.8182 ms.
**darkEnabledFront** — type `SpriteAnimation`; sprite `auraFront`; state `ActiveType.Dark`; loop `True`; 900 ms total.
  - Frame 0: cell `[0, 4]` from 0 to 81.8182 ms; interval 81.8182 ms.
  - Frame 1: cell `[1, 4]` from 81.8182 to 163.636 ms; interval 81.8182 ms.
  - Frame 2: cell `[2, 4]` from 163.636 to 245.454 ms; interval 81.8182 ms.
  - Frame 3: cell `[3, 4]` from 245.454 to 327.273 ms; interval 81.8182 ms.
  - Frame 4: cell `[4, 4]` from 327.273 to 409.091 ms; interval 81.8182 ms.
  - Frame 5: cell `[5, 4]` from 409.091 to 490.909 ms; interval 81.8182 ms.
  - Frame 6: cell `[6, 4]` from 490.909 to 572.727 ms; interval 81.8182 ms.
  - Frame 7: cell `[7, 4]` from 572.727 to 654.545 ms; interval 81.8182 ms.
  - Frame 8: cell `[8, 4]` from 654.545 to 736.364 ms; interval 81.8182 ms.
  - Frame 9: cell `[9, 4]` from 736.364 to 818.182 ms; interval 81.8182 ms.
  - Frame 10: cell `[10, 4]` from 818.182 to 900 ms; interval 81.8182 ms.
**lightEnabledBack** — type `SpriteAnimation`; sprite `auraBack`; state `ActiveType.Light`; loop `True`; 900 ms total.
  - Frame 0: cell `[0, 7]` from 0 to 81.8182 ms; interval 81.8182 ms.
  - Frame 1: cell `[1, 7]` from 81.8182 to 163.636 ms; interval 81.8182 ms.
  - Frame 2: cell `[2, 7]` from 163.636 to 245.454 ms; interval 81.8182 ms.
  - Frame 3: cell `[3, 7]` from 245.454 to 327.273 ms; interval 81.8182 ms.
  - Frame 4: cell `[4, 7]` from 327.273 to 409.091 ms; interval 81.8182 ms.
  - Frame 5: cell `[5, 7]` from 409.091 to 490.909 ms; interval 81.8182 ms.
  - Frame 6: cell `[6, 7]` from 490.909 to 572.727 ms; interval 81.8182 ms.
  - Frame 7: cell `[7, 7]` from 572.727 to 654.545 ms; interval 81.8182 ms.
  - Frame 8: cell `[8, 7]` from 654.545 to 736.364 ms; interval 81.8182 ms.
  - Frame 9: cell `[9, 7]` from 736.364 to 818.182 ms; interval 81.8182 ms.
  - Frame 10: cell `[10, 7]` from 818.182 to 900 ms; interval 81.8182 ms.
**lightEnabledFront** — type `SpriteAnimation`; sprite `auraFront`; state `ActiveType.Light`; loop `True`; 900 ms total.
  - Frame 0: cell `[0, 6]` from 0 to 81.8182 ms; interval 81.8182 ms.
  - Frame 1: cell `[1, 6]` from 81.8182 to 163.636 ms; interval 81.8182 ms.
  - Frame 2: cell `[2, 6]` from 163.636 to 245.454 ms; interval 81.8182 ms.
  - Frame 3: cell `[3, 6]` from 245.454 to 327.273 ms; interval 81.8182 ms.
  - Frame 4: cell `[4, 6]` from 327.273 to 409.091 ms; interval 81.8182 ms.
  - Frame 5: cell `[5, 6]` from 409.091 to 490.909 ms; interval 81.8182 ms.
  - Frame 6: cell `[6, 6]` from 490.909 to 572.727 ms; interval 81.8182 ms.
  - Frame 7: cell `[7, 6]` from 572.727 to 654.545 ms; interval 81.8182 ms.
  - Frame 8: cell `[8, 6]` from 654.545 to 736.364 ms; interval 81.8182 ms.
  - Frame 9: cell `[9, 6]` from 736.364 to 818.182 ms; interval 81.8182 ms.
  - Frame 10: cell `[10, 6]` from 818.182 to 900 ms; interval 81.8182 ms.

### State machines

**Punch** (initial `True`): True, False.
  - `False` → `True`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"IsAction","v":"PUNCH"},{"tag":"IsZombified","v":"false"}]}`
  - `True` → `False`; condition: `{"tag":"Condition","c":[{"tag":"IsAction","a":{"operatorType":"NotEqual"},"v":"PUNCH"}]}`
**ActiveType** (initial `Light`): Light, Dark, None, Both.
  - `Dark|Light|None` → `Both`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"darkAnomaly"},"v":"true"},{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"lightAnomaly"},"v":"true"}]}`
  - `Dark|Light` → `None`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"darkAnomaly"},"v":"false"},{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"lightAnomaly"},"v":"false...`
  - `None|Dark` → `Light`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"darkAnomaly"},"v":"false"},{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"lightAnomaly"},"v":"true"}]}`
  - `None|Light` → `Dark`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"darkAnomaly"},"v":"true"},{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"lightAnomaly"},"v":"false"}]}`
**TimerState** (initial `Stay`): Stay, Reset, Idle, Init, TimerChanged.
  - `Stay|Reset` → `Idle`; condition: `{"tag":"Condition","c":[{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"timeCycle_On"},"v":"false"}]}`
  - `Idle` → `Init`; condition: `{"tag":"Condition","c":[{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"timeCycle_On"},"v":"true"}]}`
  - `Stay` → `TimerChanged`; condition: `{"tag":"Condition","c":[{"tag":"CompareCustomVariable","a":{"operatorType":"NotEqual","VariableNameToCompare":"timeCyclePrevious","RightHSVariableNameToCompare":"timeCycle"},"v":"15"}]}`
  - `Reset|Init|TimerChanged` → `Stay`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"CompareCustomVariable","a":{"operatorType":"Greater","VariableNameToCompare":"timeCycleTemp"},"v":"0"},{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"ti...`
  - `Stay|TimerChanged` → `Reset`; condition: `{"tag":"Condition","a":{"type":"and"},"c":[{"tag":"CompareCustomVariable","a":{"operatorType":"Less","VariableNameToCompare":"timeCycleTemp"},"v":"0"},{"tag":"CompareCustomVariable","a":{"VariableNameToCompare":"timeC...`

### Particle systems

**ps_hitFlash** — update stage `(unspecified)`; emitter: `{"lifeTime":"0","particlesPerEmission":"1"}`; particle: `{"sprite":"s_hitFlash","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 1, 1"},{"tag":"KeyFrame","v":"1, 1.6, 1.6"}]},{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.6, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**ps_wandSparklesPunchTarget** — update stage `(unspecified)`; emitter: `{"offset":"0,0","offsetFacing":"true","emissionInterval":"0.2","particlesPerEmission":"8","particlesToEmit":"1"}`; particle: `{"sprite":"s_Sparkles","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.4","rotateWithVelocity":"true"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"0.8, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`

### Render hooks and draw order

- `Update`: sprites — no direct SpriteRender; particles — no direct particle operation.
- `RenderInFront`: sprites — auraFront @ 0,-20; particles — no direct particle operation.
- `RenderBehind`: sprites — auraBack @ 0,-20; particles — no direct particle operation.
- `OnDamagedTile`: sprites — no direct SpriteRender; particles — ps_hitFlash, ps_wandSparklesPunchTarget.
- `OnDestroyedTile`: sprites — no direct SpriteRender; particles — ps_hitFlash, ps_wandSparklesPunchTarget.

### Reuse rule

keep front and behind hooks independent, match state variant rows, and map hit/punch event emitters separately.

## DirtAura

- Source: `ItemRenderers/DirtAura.xml`; family classification: `aura` (heuristic).
- Structure: 6 sprite names / 6 definitions; 9 top-level animation tracks; 23 direct sprite frames; 0 state machines / 0 states / 0 transitions; 3 particle systems.

- Catalog matches: #14420 Dirt Aura (slot Chest).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `dirtSprite1` | `game/particles11.rttex` | 32 | `0,19` |
| `dirtSprite2` | `game/particles11.rttex` | 32 | `1,19` |
| `dirtSprite3` | `game/particles11.rttex` | 32 | `2,19` |
| `dirtSpriteMannequin1` | `game/particles11.rttex` | 32 | `0,19` |
| `dirtSpriteMannequin2` | `game/particles11.rttex` | 32 | `1,19` |
| `dirtSpriteMannequin3` | `game/particles11.rttex` | 32 | `2,19` |

### Animation tracks and frame sequence

**dirt1** — type `SpriteAnimation`; sprite `dirtSprite1`; loop unspecified; 800 ms total.
  - Frame 0: cell `[0, 19]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[0, 20]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[0, 21]` from 400 to 600 ms; interval 200 ms.
  - Frame 3: cell `[0, 22]` from 600 to 800 ms; interval 200 ms.
**dirt2** — type `SpriteAnimation`; sprite `dirtSprite2`; loop unspecified; 800 ms total.
  - Frame 0: cell `[1, 19]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[1, 20]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[1, 21]` from 400 to 600 ms; interval 200 ms.
  - Frame 3: cell `[1, 22]` from 600 to 800 ms; interval 200 ms.
**dirt3** — type `SpriteAnimation`; sprite `dirtSprite3`; loop unspecified; 600 ms total.
  - Frame 0: cell `[2, 19]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[2, 20]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[2, 21]` from 400 to 600 ms; interval 200 ms.
**dirtMannequin1** — type `SpriteAnimation`; sprite `dirtSpriteMannequin1`; loop `True`; 800 ms total.
  - Frame 0: cell `[0, 19]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[0, 20]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[0, 21]` from 400 to 600 ms; interval 200 ms.
  - Frame 3: cell `[0, 22]` from 600 to 800 ms; interval 200 ms.
**dirtMannequin2** — type `SpriteAnimation`; sprite `dirtSpriteMannequin2`; loop `True`; 800 ms total.
  - Frame 0: cell `[1, 19]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[1, 20]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[1, 21]` from 400 to 600 ms; interval 200 ms.
  - Frame 3: cell `[1, 22]` from 600 to 800 ms; interval 200 ms.
**dirtMannequin3** — type `SpriteAnimation`; sprite `dirtSpriteMannequin3`; loop `True`; 600 ms total.
  - Frame 0: cell `[2, 19]` from 0 to 150 ms; interval 150 ms.
  - Frame 1: cell `[2, 20]` from 150 to 300 ms; interval 150 ms.
  - Frame 2: cell `[2, 21]` from 300 to 450 ms; interval 150 ms.
  - Frame 3: cell `[2, 22]` from 450 to 600 ms; interval 150 ms.
**floatAnim1** — type `SpriteSinPulseAnimation`; sprite `dirtSpriteMannequin1`; loop unspecified; duration not resolved.
  - No direct frame cells/keyframes on this node. Attributes: `{"name":"floatAnim1","sprite":"dirtSpriteMannequin1","autoPlay":"true"}`.
**floatAnim2** — type `SpriteSinPulseAnimation`; sprite `dirtSpriteMannequin2`; loop unspecified; duration not resolved.
  - No direct frame cells/keyframes on this node. Attributes: `{"name":"floatAnim2","sprite":"dirtSpriteMannequin2","autoPlay":"true"}`.
**floatAnim3** — type `SpriteSinPulseAnimation`; sprite `dirtSpriteMannequin3`; loop unspecified; duration not resolved.
  - No direct frame cells/keyframes on this node. Attributes: `{"name":"floatAnim3","sprite":"dirtSpriteMannequin3","autoPlay":"true"}`.

### State machines

No state machines recorded.

### Particle systems

**dirtOrbit1** — update stage `(unspecified)`; emitter: `{"offset":"0, -16","emissionInterval":"0.8","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","maxScale":"1","hasOrbit":"true","hOrbitPeriod":"6000","hAmplitude":"20","hTimeOffset":"0","vAmplitude":"12","vOrbitPeriod":"4000","vTimeOffset":"0","minScale":"0.5"}`; particle: `{"sprite":"dirtSprite1","relativeToEmitter":"true","inSpecificOrder":"false","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.9"}`.
**dirtOrbit2** — update stage `(unspecified)`; emitter: `{"offset":"0, -16","emissionInterval":"0.8","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","maxScale":"1","hasOrbit":"true","hOrbitPeriod":"-6000","hAmplitude":"20","hTimeOffset":"500","vAmplitude":"12","vOrbitPeriod":"4000","vTimeOffset":"1500","minScale":"0.5"}`; particle: `{"sprite":"dirtSprite2","relativeToEmitter":"true","inSpecificOrder":"false","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.9"}`.
**dirtOrbit3** — update stage `(unspecified)`; emitter: `{"offset":"0, -16","emissionInterval":"0.6","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1","maxScale":"1","hasOrbit":"true","hOrbitPeriod":"-6000","hAmplitude":"20","hTimeOffset":"3000","vAmplitude":"6","vOrbitPeriod":"6000","vTimeOffset":"0","minScale":"0.5"}`; particle: `{"sprite":"dirtSprite3","relativeToEmitter":"true","inSpecificOrder":"false","blendingMode":"PREMULTIPLIED_ALPHA","lifeTime":"0.7"}`.

### Render hooks and draw order

- `AddClothingParticles`: sprites — no direct SpriteRender; particles — dirtOrbit1, dirtOrbit2, dirtOrbit3.
- `RenderInFront`: sprites — dirtSpriteMannequin1 @ 8,-8, dirtSpriteMannequin2 @ -20,-22; particles — dirtOrbit1, dirtOrbit2, dirtOrbit3.
- `RenderBehind`: sprites — dirtSpriteMannequin3 @ 10,-4; particles — no direct particle operation.
- `SwitchOffClothingParticles`: sprites — no direct SpriteRender; particles — dirtOrbit1, dirtOrbit2, dirtOrbit3.

### Reuse rule

keep front and behind hooks independent, match state variant rows, and map hit/punch event emitters separately.

## StarryAura

- Source: `ItemRenderers/StarryAura.xml`; family classification: `aura` (heuristic).
- Structure: 1 sprite names / 1 definitions; 1 top-level animation tracks; 6 direct sprite frames; 0 state machines / 0 states / 0 transitions; 0 particle systems.

- Catalog matches: #15654 Starry Night Aura (slot Back).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `Sprite33` | `game/particles_large16.rttex` | 64,64 | `0,8` |

### Animation tracks and frame sequence

**Animation34** — type `SpriteAnimation`; sprite `Sprite33`; loop `True`; 1200 ms total.
  - Frame 0: cell `[0, 8]` from 0 to 200 ms; interval 200 ms.
  - Frame 1: cell `[1, 8]` from 200 to 400 ms; interval 200 ms.
  - Frame 2: cell `[2, 8]` from 400 to 600 ms; interval 200 ms.
  - Frame 3: cell `[3, 8]` from 600 to 800 ms; interval 200 ms.
  - Frame 4: cell `[4, 8]` from 800 to 1000 ms; interval 200 ms.
  - Frame 5: cell `[5, 8]` from 1000 to 1200 ms; interval 200 ms.

### State machines

No state machines recorded.

### Particle systems

No particle systems recorded.

### Render hooks and draw order

- `RenderBackpack`: sprites — Sprite33 @ (offset unspecified); particles — no direct particle operation.

### Reuse rule

keep front and behind hooks independent, match state variant rows, and map hit/punch event emitters separately.

## InfinityAura

- Source: `ItemRenderers/InfinityAura.xml`; family classification: `aura` (heuristic).
- Structure: 9 sprite names / 9 definitions; 7 top-level animation tracks; 68 direct sprite frames; 0 state machines / 0 states / 0 transitions; 8 particle systems.

- Catalog matches: #14086 Infinity Aura (slot Ancestral).

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `fireSprite1` | `game/particles_large12.rttex` | 64 | `0,0` |
| `fireSprite2` | `game/particles_large12.rttex` | 64 | `0,0` |
| `lightningSprite` | `game/particles11.rttex` | 32 | `0,0` |
| `windBackSprite` | `game/particles_large12.rttex` | 64 | `0,0` |
| `windFrontSprite` | `game/particles_large12.rttex` | 64 | `0,0` |
| `windFeetSprite` | `game/particles11.rttex` | 32 | `0,0` |
| `rocksSprite` | `game/particles11.rttex` | 32 | `0,0` |
| `speedLinesSprite` | `game/particles11.rttex` | 32 | `20,11` |
| `timeDilation` | `game/particles_large12.rttex` | 64 | `12,6` |

### Animation tracks and frame sequence

**fireAnimation1** — type `SpriteAnimation`; sprite `fireSprite1`; loop `True`; 1600 ms total.
  - Frame 0: cell `[0, 5]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[1, 5]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[2, 5]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[3, 5]` from 300 to 400 ms; interval 100 ms.
  - Frame 4: cell `[4, 5]` from 400 to 500 ms; interval 100 ms.
  - Frame 5: cell `[5, 5]` from 500 to 600 ms; interval 100 ms.
  - Frame 6: cell `[6, 5]` from 600 to 700 ms; interval 100 ms.
  - Frame 7: cell `[7, 5]` from 700 to 800 ms; interval 100 ms.
  - Frame 8: cell `[8, 5]` from 800 to 900 ms; interval 100 ms.
  - Frame 9: cell `[9, 5]` from 900 to 1000 ms; interval 100 ms.
  - Frame 10: cell `[10, 5]` from 1000 to 1100 ms; interval 100 ms.
  - Frame 11: cell `[11, 5]` from 1100 to 1200 ms; interval 100 ms.
  - Frame 12: cell `[12, 5]` from 1200 to 1300 ms; interval 100 ms.
  - Frame 13: cell `[13, 5]` from 1300 to 1400 ms; interval 100 ms.
  - Frame 14: cell `[14, 5]` from 1400 to 1500 ms; interval 100 ms.
  - Frame 15: cell `[15, 5]` from 1500 to 1600 ms; interval 100 ms.
**fireAnimation2** — type `SpriteAnimation`; sprite `fireSprite2`; loop `True`; 1600 ms total.
  - Frame 0: cell `[10, 5]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[11, 5]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[12, 5]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[13, 5]` from 300 to 400 ms; interval 100 ms.
  - Frame 4: cell `[14, 5]` from 400 to 500 ms; interval 100 ms.
  - Frame 5: cell `[15, 5]` from 500 to 600 ms; interval 100 ms.
  - Frame 6: cell `[0, 6]` from 600 to 700 ms; interval 100 ms.
  - Frame 7: cell `[1, 6]` from 700 to 800 ms; interval 100 ms.
  - Frame 8: cell `[2, 6]` from 800 to 900 ms; interval 100 ms.
  - Frame 9: cell `[3, 6]` from 900 to 1000 ms; interval 100 ms.
  - Frame 10: cell `[0, 5]` from 1000 to 1100 ms; interval 100 ms.
  - Frame 11: cell `[1, 5]` from 1100 to 1200 ms; interval 100 ms.
  - Frame 12: cell `[2, 5]` from 1200 to 1300 ms; interval 100 ms.
  - Frame 13: cell `[3, 5]` from 1300 to 1400 ms; interval 100 ms.
  - Frame 14: cell `[4, 5]` from 1400 to 1500 ms; interval 100 ms.
  - Frame 15: cell `[5, 5]` from 1500 to 1600 ms; interval 100 ms.
**lightningAnimation** — type `SpriteAnimation`; sprite `lightningSprite`; loop `True`; 800 ms total.
  - Frame 0: cell `[12, 11]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[13, 11]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[14, 11]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[15, 11]` from 300 to 400 ms; interval 100 ms.
  - Frame 4: cell `[16, 11]` from 400 to 500 ms; interval 100 ms.
  - Frame 5: cell `[17, 11]` from 500 to 600 ms; interval 100 ms.
  - Frame 6: cell `[18, 11]` from 600 to 700 ms; interval 100 ms.
  - Frame 7: cell `[19, 11]` from 700 to 800 ms; interval 100 ms.
**windBackAnimation** — type `SpriteAnimation`; sprite `windBackSprite`; loop `True`; 800 ms total.
  - Frame 0: cell `[4, 6]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[5, 6]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[6, 6]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[7, 6]` from 300 to 400 ms; interval 100 ms.
  - Frame 4: cell `[8, 6]` from 400 to 500 ms; interval 100 ms.
  - Frame 5: cell `[9, 6]` from 500 to 600 ms; interval 100 ms.
  - Frame 6: cell `[10, 6]` from 600 to 700 ms; interval 100 ms.
  - Frame 7: cell `[11, 6]` from 700 to 800 ms; interval 100 ms.
**WindFrontAnimation** — type `SpriteAnimation`; sprite `windFrontSprite`; loop `True`; 800 ms total.
  - Frame 0: cell `[4, 7]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[5, 7]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[6, 7]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[7, 7]` from 300 to 400 ms; interval 100 ms.
  - Frame 4: cell `[8, 7]` from 400 to 500 ms; interval 100 ms.
  - Frame 5: cell `[9, 7]` from 500 to 600 ms; interval 100 ms.
  - Frame 6: cell `[10, 7]` from 600 to 700 ms; interval 100 ms.
  - Frame 7: cell `[11, 7]` from 700 to 800 ms; interval 100 ms.
**windFeetAnimation** — type `SpriteAnimation`; sprite `windFeetSprite`; loop `True`; 800 ms total.
  - Frame 0: cell `[0, 11]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[1, 11]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[2, 11]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[3, 11]` from 300 to 400 ms; interval 100 ms.
  - Frame 4: cell `[4, 11]` from 400 to 500 ms; interval 100 ms.
  - Frame 5: cell `[5, 11]` from 500 to 600 ms; interval 100 ms.
  - Frame 6: cell `[6, 11]` from 600 to 700 ms; interval 100 ms.
  - Frame 7: cell `[7, 11]` from 700 to 800 ms; interval 100 ms.
**rocksAnimation** — type `SpriteAnimation`; sprite `rocksSprite`; loop `True`; 400 ms total.
  - Frame 0: cell `[8, 11]` from 0 to 100 ms; interval 100 ms.
  - Frame 1: cell `[9, 11]` from 100 to 200 ms; interval 100 ms.
  - Frame 2: cell `[10, 11]` from 200 to 300 ms; interval 100 ms.
  - Frame 3: cell `[11, 11]` from 300 to 400 ms; interval 100 ms.

### State machines

No state machines recorded.

### Particle systems

**fireParticle1** — update stage `(unspecified)`; emitter: `{"offset":"8,-20","offsetFacing":"false","randomizeInterval":"true","intervalMin":"0.1","intervalMax":"0.1","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"fireSprite1","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","initalRGB":"1,1,1","flipX":"false"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.75, 0.75"},{"tag":"KeyFrame","v":"1, 1.5, 1.5"}]},{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.5, 0.9"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**fireParticle2** — update stage `(unspecified)`; emitter: `{"offset":"-8,-20","offsetFacing":"false","randomizeInterval":"true","intervalMin":"0.1","intervalMax":"0.1","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"fireSprite2","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","initalRGB":"1,1,1","flipX":"true"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.75, 0.75"},{"tag":"KeyFrame","v":"1, 1.5, 1.5"}]},{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.5, 0.9"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**windBackParticle** — update stage `(unspecified)`; emitter: `{"offset":"0,-24","randomizeInterval":"true","intervalMin":"0.3","intervalMax":"0.4","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"windBackSprite","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","initalRGB":"1,1,1"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.75, 0.75"},{"tag":"KeyFrame","v":"1, 1.2, 1.2"}]},{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.5, 0.5"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**windFrontParticle** — update stage `(unspecified)`; emitter: `{"offset":"0,-21","randomizeInterval":"true","intervalMin":"0.15","intervalMax":"0.2","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"windFrontSprite","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","initalRGB":"1,1,1"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0, 0.75, 0.75"},{"tag":"KeyFrame","v":"1, 1.2, 1.2"}]},{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.5, 0.5"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**windFeetLeftParticle** — update stage `(unspecified)`; emitter: `{"offset":"-18,-14","randomizeInterval":"true","intervalMin":"0.2","intervalMax":"0.2","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"windFeetSprite","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","initalRGB":"1,1,1","initialScale":"1,1,1"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"0.2, 0.5"},{"tag":"KeyFrame","v":"0.6, 0.2"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**windFeetRightParticle** — update stage `(unspecified)`; emitter: `{"offset":"18,-14","randomizeInterval":"true","intervalMin":"0.2","intervalMax":"0.2","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"windFeetSprite","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","initalRGB":"1,1,1","initialScale":"1,1,1","flipX":"true"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**rocksParticle** — update stage `(unspecified)`; emitter: `{"randomizeInterval":"true","intervalMin":"0.1","intervalMax":"0.2","infParticles":"true","infLifeTime":"true","particlesPerEmission":"1"}`; particle: `{"sprite":"rocksSprite","blendingMode":"PREMULTIPLIED_NORMAL","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","initalRGB":"1,1,1","initialScale":"0.5,0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0"},{"tag":"KeyFrame","v":"0.4, 1"},{"tag":"KeyFrame","v":"0.6, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`
**speedLinesParticle** — update stage `(unspecified)`; emitter: `{"offset":"0,-4","randomizeInterval":"true","intervalMin":"0.05","intervalMax":"0.1","infParticles":"true","infLifeTime":"true","particlesPerEmission":"2"}`; particle: `{"sprite":"speedLinesSprite","blendingMode":"PREMULTIPLIED_ALPHA","isBackgroundParticle":"false","relativeToEmitter":"true","inSpecificOrder":"true","rotateWithVelocity":"true","initalRGB":"1,1,1"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 0"},{"tag":"KeyFrame","v":"0.2, 0"},{"tag":"KeyFrame","v":"0.3, 1"},{"tag":"KeyFrame","v":"1, 0"}]},{"tag":"Curve","a":{"name":"initialScale"},"c":[{"tag":"KeyFrame","v":"0,0,0"},{"tag":"KeyFrame","v":"0.2,1,0.3"},{"tag":"KeyFrame","v":"1,2,0.3"}]}]`

### Render hooks and draw order

- `AddClothingParticles`: sprites — no direct SpriteRender; particles — fireParticle1, fireParticle2, windBackParticle, rocksParticle, windFrontParticle, speedLinesParticle, windFeetLeftParticle, windFeetRightParticle.
- `RenderAura`: sprites — no direct SpriteRender; particles — fireParticle1, fireParticle2, windBackParticle.
- `RenderInFront`: sprites — lightningSprite @ 0,-12, timeDilation @ 0,-24; particles — rocksParticle, speedLinesParticle, windFrontParticle, windFeetLeftParticle, windFeetRightParticle.
- `SwitchOffClothingParticles`: sprites — no direct SpriteRender; particles — fireParticle1, fireParticle2, windBackParticle, rocksParticle, speedLinesParticle, windFrontParticle, windFeetLeftParticle, windFeetRightParticle.

### Reuse rule

keep front and behind hooks independent, match state variant rows, and map hit/punch event emitters separately.

## PlayerBladeSlash

- Source: `WorldRenderers/PlayerBladeSlash.xml`; family classification: `world-effect-projectile-or-stamp` (heuristic).
- Structure: 3 sprite names / 3 definitions; 1 top-level animation tracks; 3 direct sprite frames; 0 state machines / 0 states / 0 transitions; 3 particle systems.

### Sprite definitions

| Sprite | Atlas | Cell size | Default cell |
|---|---|---:|---|
| `s_slash` | `game/particles_large10.rttex` | 64 | `0,4` |
| `s_collision` | `game/tiles_page2.rttex` | 32 | `27,16` |
| `s_hit` | `game/particles.rttex` | 32 | `13,11` |

### Animation tracks and frame sequence

**a_slash** — type `SpriteAnimation`; sprite `s_slash`; loop unspecified; 200 ms total.
  - Frame 0: cell `[2, 4]` from 0 to 66.6667 ms; interval 66.6667 ms.
  - Frame 1: cell `[3, 4]` from 66.6667 to 133.333 ms; interval 66.6667 ms.
  - Frame 2: cell `[4, 4]` from 133.333 to 200 ms; interval 66.6667 ms.

### State machines

No state machines recorded.

### Particle systems

**ps_slash** — update stage `OnCreate`; emitter: `{"offset":"0, 0","particlesPerEmission":"1"}`; particle: `{"sprite":"s_slash","offset":"0, 0","blendingMode":"PREMULTIPLIED_ALPHA","rotateWithVelocity":"true","initialVelocity":"128,0","initialScale":"1.75,0.5","useTargetDir":"true","lifeTime":"0.35"}`.
**ps_projectile** — update stage `OnCreate`; emitter: `{"particlesPerEmission":"1","offset":"0,0"}`; particle: `{"sprite":"s_collision","blendingMode":"PREMULTIPLIED_ALPHA","rotateWithVelocity":"true","initialAlpha":"0","initialVelocity":"600,0","initialScale":"0.25,0.25","collisionDamageAmount":"1","collisionSize":"8,8","lifeTime":"0.35","useTargetDir":"true","collisionType":"","collisionFlag":""}`.
**ps_hit** — update stage `OnHit`; emitter: `{"lifeTime":"0","particlesPerEmission":"1"}`; particle: `{"sprite":"s_hit","initialScale":"1.5,1.5","lifeTime":"0.5"}`.
  - particleCurves: `[{"tag":"Curve","a":{"name":"initialAlpha"},"c":[{"tag":"KeyFrame","v":"0, 1"},{"tag":"KeyFrame","v":"1, 0"}]}]`

### Render hooks and draw order

No render hooks recorded.

### Reuse rule

preserve renderer-specific state, pass, animation, and attachment logic; name similarity alone is not evidence of compatibility.

## Reuse implementation checklist

1. Pick a source module from `renderer-modules/item/` and load it via `renderer-modules/registry.mjs`.
2. Verify the destination atlas source, texture cell size, default cell, animation frame cells, mirroring and target item slot against source captures.
3. Create a clone with `templates/renderer-adapter.mjs`; set `spriteAliases` source→target, `atlasAliases`, `frameOverrides`, and `trackFrames` by animation track name only where the target sheet was checked.
4. Alter offset/pass/timing only from evidence. Different state graphs, input events, lift/pose behavior, or particle lifetimes call for a new rule module, not simple renaming.
5. Wire cloned renderer as `catalog.renderers[newScriptName]` and set the destination item record’s `script` to that exact key. `normalizeCatalogItem` then attempts strict sprite binding by atlas, dimensions and source frame-cell match.
6. Add a fixture for at least idle, walk, jump, fall, punch, and any unique special input. Compare frame by frame; log unsupported XML operations rather than silently discarding them.

## Accuracy boundary

The modules preserve authored XML but are not a replacement for all native renderer execution. Timing rows are explicit calculations under the stated planner assumptions. Operation nodes outside the supported interpreter subset remain data until that operation is implemented and tested. This report does not claim a verified live-game pixel match.
