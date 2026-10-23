# XML renderer audit — player stuff.zip

## Scope and evidence

This audit is grounded in the uploaded renderer archive and the current Demo implementation. The archive contains 314 ItemRenderers XML files and 33 WorldRenderers XML files (347 actual XMLs). The embedded inventory mentions 14 weather renderer entries, but no WeatherRenderers directory or weather XML is present in this ZIP. Four XMLs are listed in source repair notes as malformed due to duplicate identical attributes; the library converter applies the documented repair in memory for analysis while retaining the original XML bytes unchanged.

The item side contains 1,475 Sprite definition nodes across 1,467 unique sprite-name keys, 1,426 top-level animation-track entries across XML animation types, 4,095 explicit SpriteAnimation Frame entries, 3,520 KeyFrame nodes, and 921 particle systems. These are archive counts, not counts of renderer behaviors fully implemented by the planner.

Four item XMLs are not mapped by same-name script references in the catalog: AtomConstructs, LightningNunchucks, Template, and WingedHair. The ZIP has no Pickaxe-named or Slippers-named item renderer. Tool or slipper behavior copied from neighboring families must therefore be labelled inferred until the correct source XML or in-game evidence is available.

## What an XML renderer actually describes

1. **Sprites and texture cells.** A sprite name points to a texture atlas, a cell size and a default cell. The draw operation can select that sprite by name. Keep this separate from which sprite animation track chooses a cell over time.
2. **State machines.** Named states and transitions react to host variables, input events, movement state, equipment, game context or item-specific conditions. Entry time can reset the clock for tracks gated by that state. Missing host variables or incomplete condition handlers prevent faithful behavior.
3. **Animation tracks.** SpriteAnimation selects from an explicit Frame list. CurveAnimation and SpriteCurveAnimation instead animate numeric properties such as offsets, scale and other values. SequenceAnimation and interpolation families need their own semantics; flattening them to sprite frames is incorrect.
4. **Ordered RenderRules hooks.** Hook names such as RenderBackpack, RenderShoes, RenderInFront, RenderBehind, RenderPet, Update, UpdatePunch and AddClothingParticles identify different stages. StopIf, Group, Translate, state gates and event checks change visibility and placement.
5. **Particle systems.** A ParticleSystem definition holds emitter and particle properties; render/update operations in rules decide where it is advanced or drawn. Emitter lifetime, emission interval, emission count and the lifetime of an already-emitted particle are distinct.
6. **Host integration.** Facing, player and pet velocity, punch/jump events, equipment checks, transform flags, hit-tile events, selfie states and other custom variables must be supplied by the host renderer. The XML source assumes a game runtime that defines these values.

## Timing interpretation used in the current planner

Where SpriteAnimation has N explicit frames and a resolved numeric total duration D, this project's helper displays each frame for D/N milliseconds. Tracks guarded by playOnState use elapsed time since the matching state entered. Explicit isLoop=true wraps the sequence; explicit false clamps to the final frame. If animTime is missing or cannot be converted to a positive number, the current planner's helper falls back to 175 ms per frame.

These are **planner-calculated intervals**, not verified claims about the native client's scheduler. Symbolic or variable-valued animation duration, ExitTime handling, nested sequences and unsupported interpolation types require additional runtime semantics before their timing can be called exact.

## Representative source observations

### CrepeCape — a state-driven cape plus a separate movement trail

- Sprite definitions: s_Cape (64px cells in game/particles_large15.rttex), s_Collar (32px cells in game/player_cosmetics3.rttex), and s_spark (32px cells in game/particles12.rttex).
- Action state machine: Idle, Walk, JumpStraight and FallStraight. Transition conditions reference speed, vertical speed and onGround. A separate Trail state machine switches between Idle and Move using speed thresholds.
- Cape timeline: idle track has one frame at cell (0,11), duration 50ms. JumpStraight has cells (0,12),(1,12), total 200ms, 100ms per frame. FallStraight has cells (2,12),(3,12), total 200ms, 100ms per frame. Walk has seven cells (1,11) through (7,11), total 700ms, 100ms per frame.
- The spark track uses two identical cells at (18,0); no explicit animTime means the planner fallback is 175ms per entry (350ms estimated total). This is not a meaningful two-image visual change because both cells are the same.
- Trail emitter ps_luteTrailMove: emission interval 0.1s, five particles per emission, infinite emission/lifetime flags, particle lifetime 0.75s, additive blend, gravity vector (0,30), scale interpolated from (0.25,0.25) to (0.75,0.75).
- Draw order is split: cape in RenderBackpack at offset (-1,-16), collar in RenderFrontpack, trail updated through AddClothingParticles and drawn separately. Copying only s_Cape would omit collar and trail behavior.

### WingsOfInfinity — composite wings, multiple tracks and independent trails

- The XML defines 11 sprites, 15 top-level animation tracks, 31 sprite-frame entries, 12 particle systems, two state machines and five states.
- Movement has Idle, Jump and Fall. The source has distinct top/bottom, feathered/mechanical, and mirrored left/right components, rather than a single wing image.
- Example idle tracks for upper feathered wing parts use two frames over 400ms (200ms/frame). Their active-state guard is Movement.Idle. Other tracks must be read individually; do not apply the idle schedule to jump/fall tracks.
- RenderBackpack includes 16 direct sprite render operations and 24 particle operations in the analyzed source. Trail systems are split by wing component and can have state-specific activation. Particle curves independently change alpha, velocity and other parameters.
- Reuse requirement: bind every piece, preserve the left/right flip, top/bottom ordering, Movement state graph, render pass, and emitter offset/lifetime. A new wing with different texture-cell layout cannot be fixed by renaming one sprite.

### EclipseWings — four-frame wing sequence and special particle layers

- The principal sprite track a_wings uses cells (4,6),(5,6),(6,6),(7,6). The XML omits animTime, so the planner fallback estimates 175ms per frame and 700ms total. The XML also omits an explicit loop flag, so whether the native client loops is not established by this field alone.
- The SelfieTake state machine contains Default and Max; the Max state has ExitTime 0.6 and is reached on the JUMPDOUBLE action.
- ps_wingsLeft and ps_wingsRight use additive rendering and relative-to-emitter particles, with an emitter offset (0,-16), infinite emission flags and 0.2s emission interval. Separate flare and bokeh particle systems are activated for JUMPDOUBLE in AddClothingParticles.
- RenderBackpack draws mirrored wing copies using different left/right alignments. The template is therefore two mirrored sprite draws plus independent trails/special effects, not just one loop.

### SpringLoadedShoes — curves change the rig, not just footwear cells

- The renderer defines s_foot1, s_foot2 and s_pogoStick and has eight curve-style animation tracks with 700ms timing.
- The MotionY machine contains No, Yes and Mannequin states. a_Offset uses normalized keyframes (0,0), (0.07,0), (0.25,-15), (0.5,-18), (0.75,-15), (0.93,0), (1,0). The middle of the cycle raises/offsets the pogo pose; at normalized time 0.5, the curve value is -18.
- Other tracks change pole scale, pole offset and left/right foot positions. These are separate properties and should not be replaced by one sprite sequence.
- RenderShoes contains two SpriteRender calls with nested Group/Translate structure. Reusing this renderer for plain shoes or slippers without stripping its lift/foot curves will transfer the pogo behavior.

### DiamondSparklingSneakers — decorative animation and emitter curves

- The a_godRays track has two frames, cells (5,15),(8,14), and no explicit animTime. Planner fallback gives 175ms per frame (350ms estimated total).
- a_sparks uses cells (18,28),(19,29),(20,28) over 600ms, 200ms per frame.
- ps_godRays emits two particles every 0.7s, with particle lifetime 1s and a scale curve that grows from 1.0 to 1.75 over the first 70% of life. This is independent of the spark sprite's 600ms timeline.
- RenderShoes directly draws foot1 and foot2. Do not attach the emitter to an arm or assume these tracks affect player movement.

### AnomalyAura — front/back layers plus a state-selected visual mode

- Four sprite tracks, each with 11 explicit frames, use 900ms total duration in the extracted tracks (about 81.818ms/frame by even-division calculation).
- There are separate auraBack and auraFront sprites, drawn in RenderBehind and RenderInFront with offset (0,-20) and scale (1.1,1.1).
- State machines include Punch and ActiveType; ActiveType includes Light, Dark, None and Both, and determines which frame track is active. A TimerState machine also controls timed state changes.
- OnDamagedTile and OnDestroyedTile each carry particle update operations for hit-flash and target sparkle effects. Those event handlers must be wired by the host; an always-running aura loop is not an adequate replacement.

### 14DEViLsFriendlyDoggyLeash — pet motion is its own state machine

- Sprite definitions include player pants, s_Dog and s_Punch. The Motion machine has None, Up, Down, Horizontal, Punch, Death and Sleep; SleepParticle independently toggles On/Off.
- Idle sequence: cells (0,0) through (3,0), 400ms total, 100ms/frame. Horizontal move: cells (4,0),(5,0),(6,0), 300ms total, 100ms/frame. Punch: cells (1,1),(2,1), 400ms total, 200ms/frame. Death: cells (4,1),(5,1), 2000ms total, 1000ms/frame. Jump/fall/sleep are distinct state-gated tracks.
- PunchParticle has offset (10,-16), 0.2s emission interval, particle lifetime 0.5s, and a scale curve from 0.8 to 1.2. RenderPet draws the pet; UpdatePet and UpdatePunch supply distinct behavior hooks.
- Reuse requirement: pet velocity and action host variables, pet anchor, leash/held-piece draw order, and punch/sleep/death event semantics must all match.

## What is implemented today vs what is only preserved

The converted JavaScript modules preserve the renderer XML structure and expose normalized sprite/rule/animation/particle/state-machine data. They do not guarantee that every node executes. The current Demo interpreter implements a subset of condition handling, state transitions, sprite frame sampling, simple scale/position animation and bounded particle behavior. Its own source describes it as a partial interpreter. SequenceAnimation, many interpolation/curve nodes, native context/outline/pet attachment operations and other tags need separate implementation and tests.

