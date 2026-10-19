# Integration API

The code is deliberately framework-independent. Use it inside the existing planner rather than replacing the weather renderer or application shell.

## Core data contracts

### MotionFrame

Positions are logical pixels, time is milliseconds, velocities are logical pixels per second, and angles elsewhere in the API are degrees. A host-supplied MotionFrame is preferred over the flat-floor preview controller.

```js
const frame = {
  x: 100, y: 40,             // top-left of the logical player tile, not feet
  vx: 250, vy: 0,
  facing: 1,                // 1 or -1
  ground: true,
  locomotion: "walk",        // idle | walk | jump | fall | glide
  clockMs: 2400,            // global visual clock
  moveMs: 99,               // current movement-state phase
  jumpHeld: false,
  punch: null,              // or {ageMs, pose?: explicitArmTrack}
  events: []                // newly crossed event records
};

// Stable event identity prevents duplicate hooks and particles.
const event = {
  id: "player-1:doubleJump:17",
  type: "doubleJump",        // jump | doubleJump | punch | land
  at: 2400,
  x: 100, y: 40, facing: 1
};
```

`land` is an event rather than a built-in locomotion clip. A descriptor can respond to it without forcing the renderer to fabricate a universal landing animation.

### Player visual options

Visual options are rendering inputs, not changes to collision geometry. A host may choose different semantics for custom avatar scale, but it must keep simulation and display units separate.

```js
const visual = {
  skin: [255, 206, 180, 255],
  scaleX: 1, scaleY: 1,
  liftX: 0, liftY: 0,
  renderBareFeetWithShoes: false
};
```

The default item skin resolver uses the first equipped item with skin metadata and multiplies basic alpha factors. That priority is deterministic for development but is not an established official rule for conflicting items.

### Normalized item

Imported items preserve raw evidence and warnings. To mark an item complete, supply its actual pieces/clips/hooks/emitters and a validation record rather than removing its warning string.

```js
const item = {
  id: 123456,                // synthetic example, not a real item claim
  name: "Synthetic example",
  slot: 5,
  provenance: "authored-descriptor",
  completeness: "reference-only",
  warnings: [],
  raw: {},
  hideSlots: [],             // planner clothing slots
  wrappedSlots: [],          // retained metadata; no wrapped substitution engine
  hide: [],                  // semantic body tags, NOT native bytes
  headless: false,
  hideFace: false,
  hideLegs: false,
  noPants: false,
  skin: null,
  bodyAlpha: 1,
  invisible: false,
  riderLift: 0,
  punchSleeves: [],
  pose: {},
  pieces: [],
  clips: {},
  hooks: {},
  emitters: []
};
```

### Piece record

The source rectangle is measured in the registered atlas's pixels. `x`, `y`, anchors, rotations, and attachments are converted through the logical transform hierarchy.

```js
const piece = {
  a: "authorized-atlas.png",
  sx: 64, sy: 0, sw: 32, sh: 32,
  pixelsPerUnit: 1,         // must match the registered source atlas density
  x: 16, y: 32,
  ax: 0.5, ay: 1,
  k: [1, 1],
  r: 0,
  rp: [0, 0],
  f: [false, false],
  o: 1,
  t: null,                 // [r,g,b] multiplier or use skin:true
  skin: false,
  pass: "RenderHandItem",
  attachment: "frontHand",
  referenceAngle: 0
};
```

Supported attachment policies are `body`, `head` (currently body-equivalent), `backArm`, `frontArm`, `backHand`, `frontHand`, `backFoot`, `frontFoot`, `mount`, and `world`. A `world` piece has a world-space position supplied by its descriptor; a mount remains in player-root space but is not lifted with the rider.

For a dense source atlas, explicitly set the piece and atlas `pixelsPerUnit` values consistently. Anchor fractions and source-flip extents are normalized through that density, while x/y and rotation-pivot coordinates remain logical; catalog import cannot infer every custom atlas's authored cell conventions.

### Clip

An item clip contains arrays of piece records as frames. An explicit descriptor outranks the approximate public catalog fallback.

```js
const clips = {
  idle: {
    frames: [
      [{...piece, sx: 64}],
      [{...piece, sx: 96}]
    ],
    durations: [100, 200],
    loop: true
  },
  punch: {
    frames: [
      [{...piece, sx: 128}],
      [{...piece, sx: 160}]
    ],
    durations: [66, 132],
    loop: false
  }
};
```

The current renderer chooses punch over the current locomotion clip, then falls back to idle. Double-jump and landing selection, intro/loop/outro segments, and after-punch tails need a host selector or an extension to `sampleItem`; their evidence semantics are documented in RESEARCH.md rather than falsely marked implemented.

### Arm tracks

Arm tracks use `keys: [[time,backAngle,frontAngle,...]]`, a period, and optional loop/tail behavior. Punch tracks can additionally return width and stretch channels.

```js
const explicitPunch = {
  ageMs: 66,
  pose: {
    keys: [
      [0, 0, 0, 1, 0.2],
      [66, 270, 90, 1.5, 1],
      [200, 270, 20, 1, 0.1]
    ],
    loop: false
  }
};
```

This numeric example is synthetic and only demonstrates the format. Do not assign it to a real item without source or capture evidence.

## Hooks and effects

### Bounded script hooks

Hooks accept a small declarative operation list. They cannot read arbitrary globals, execute JavaScript, or open URLs.

```js
const hooks = {
  update: [{
    op: "if",
    left: {read: "locomotion"},
    equals: "glide",
    then: [{op: "pose", key: "frontAngle", value: 200}]
  }],
  doubleJump: [{op: "emit", emitter: "synthetic-double-jump"}]
};
```

`pose`, `hide`, and `emit` are straightforward overrides or requests. `piece` returns an already normalized draw call with a matrix, source rectangle, pass, alpha, and optional owner; unlike ordinary catalog piece records, it is not passed through `spriteMatrix` again.

An emit request contains `itemId` and `emitterId`. The host must resolve the authorized emitter descriptor, identify its triggering event, and call EffectSystem; the player wrapper intentionally does not fabricate recipes or automatically rasterize particles.

### Emitter descriptor

Each emitter must identify whether it follows an attachment or retains its birth position. The following recipe is synthetic and must not be described as any real Growtopia item's effect.

```js
const emitter = {
  id: "synthetic-double-jump",
  trigger: "doubleJump",
  space: "world",           // or "local"
  at: [16, 32],
  count: 8,
  lifeMs: 500,
  velocity: [0, -30],
  spread: [40, 10],
  gravity: 60
};
```

World effects retain their birth anchor and facing; local effects are transformed through a current anchor during sampling. Particle sprite selection, advanced curves, orbit, rate emitters, and blend passes remain host-level extensions.

## Loading a public catalog

Use the offline decoder on a public file obtained through an authorized route. Neither helper fetches sealed data or requests keys.

```sh
node tools/unpack-planner.mjs public-items.HASH.dat catalog.json
```

```js
import {requirePlannerCatalog, importPlannerItem} from "./src/items.mjs";
import {PlannerPlayer} from "./src/player.mjs";

const catalog = requirePlannerCatalog(await fetch("/catalog.json").then(r => r.json()));
const record = catalog.items.find(item => item.id === desiredItemId);
if (!record) throw new Error("Item ID absent from this catalog");
const wearable = importPlannerItem(record);
const player = new PlannerPlayer(catalog, [wearable]);
```

Display `wearable.warnings` in development. Do not turn `completeness: "reference-only"` into “fully supported” merely because an idle image looks plausible.

## Browser integration

Keep asset loading and authorization in the host application. The following example shows the renderer interface rather than a complete deployed website.

```js
import {PlannerPlayer} from "./src/player.mjs";
import {drawCanvas} from "./src/render.mjs";
import {registerAtlas, createRenderSurface} from "./src/canvas-assets.mjs";

const player = new PlannerPlayer(catalog, equippedItems);
const atlases = new Map();
for (const [name, image] of authorizedLoadedImages) {
  atlases.set(name, registerAtlas(image, {pixelsPerUnit: 1}));
}

// 128 pixels per tile; viewport spans 3x3 tiles for hats/wings.
const tilePixels = 128;
const surface = createRenderSurface(3 * tilePixels, 3 * tilePixels, {
  supersample: 2
});

function simulateOneStep(motionFrame, dtMs) {
  return player.step(motionFrame, dtMs, {liftY: 0});
}

function paint(state) {
  const ctx = surface.context;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, surface.working.width, surface.working.height);
  drawCanvas(ctx, state.calls, atlases, {
    tilePixels,
    camera: [-32, -32],
    dpr: 2 // supersample working scale in this export path
  });
  return surface.resolve();
}
```

Do not multiply both the working-surface size and `dpr` by an extra export scale elsewhere. For a device-pixel-aware on-screen canvas, compute the one backing-store multiplier deliberately rather than accumulating independent DPR and supersampling factors by accident.

Call `player.step` once per simulation step and cache its pose/draw result for display frames. Calling a stateful rig update during arbitrary paint operations would incorrectly advance its approach animations more than once.

## Weather integration

The host owns the world pass graph. A useful default is background weather, world tiles, player/back effects, avatar passes, foreground world particles, and foreground weather, but the user's established weather behavior should decide the actual order.

Advance player and weather clocks from the same monotonic simulation time without sharing clip-reset state. When exporting a frame, select a single timestamp and sample both systems consistently.

## Native metadata adapter

The optional native inspection tool relies on a separately installed `grow-items` package. Its inspected source reads version-gated fields but does not itself establish the runtime semantics of renderer scripts or body bytes ([parser source](https://raw.githubusercontent.com/StileDevs/grow-items/main/lib/Items.ts)).

The wrapper refuses headers outside versions 11 through 27 and guards item count as a conservative integration choice. That guard is not a claim that those are the only real Growtopia item formats or that all files in the range have been tested.

## Determinism and seeking

The rig, motion controller, event-deduplication state, and particles are stateful. To scrub backwards, restore a complete checkpoint and replay fixed steps; do not simply lower the clock on a live state object.

The package does not yet provide serialization/restoration helpers for every stateful subsystem. Add those before implementing arbitrary timeline scrubbing or distributed frame rendering.
