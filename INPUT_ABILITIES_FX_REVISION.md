# Input, abilities, mounts, and FX revision

This is the current revision. Preserve the planner's weather system and full wearable catalog. This is a tested reconstruction/reference, not the official client.

## Integration

- **Startup:** create `PreviewMotion()` with no abilities; use `equipped=[]`.
- **Equipment changes:** call `player.equip(items)`, `resolveAbilities(items, registry)` and `motion.setAbilities(result)`. Do not refill an already-consumed air jump when equipment changes.
- **Shared tick:** call `motion.step(dt,input)`, then `PlannerPlayer.step(frame,dt,visual)` once. The player advances catalog clips, state machines, gait, pets and effects. Do not advance items twice.
- **Pointer aiming:** convert preview pixels into logical root coordinates, reflect x exactly once into the right-facing rig frame, subtract shared float lift from y, and supply `input.punchTarget=[x,y]`. Aim may oppose travel direction.
- **Held punch:** supply `input.punch=true` each tick while held. The restored Set Planner generic stroke has a nominal 260ms released lifetime and a 200ms held repeat interval; its stretch/width curves are in PUNCH_RESTORATION.md. Clear held state on release, cancellation, lost capture, blur and visibility change. Queue short taps across ticks.
- **Render/export:** use `drawBounds(calls)` over every transformed source rectangle. Allocate at bounds size times `resolution/32`, use bounds x/y as the draw camera, and place that surface at the same logical camera origin. Never squeeze a long punch back into a fixed tile-centered buffer.
- **Phone controls:** keep the movement/action strip outside tab-switched panels. Short phones get a compact preview, three-column item cards with bounded labels, and a full selectable clothing row. Jump camera headroom adapts to preview height so the airborne avatar does not disappear above it. `demo/app.js`, `index.html` and `style.css` contain the current implementation.

```js
const motion = new PreviewMotion();
const player = new PlannerPlayer(catalog, []);
function equipmentChanged(items) {
  player.equip(items);
  motion.setAbilities(resolveAbilities(items, abilityRegistry));
}
function tick(dt, input) {
  const frame = motion.step(dt, input);
  const result = player.step(frame, dt, {effects: true});
  return {...result, bounds: drawBounds(result.calls)};
}
```

Import these functions from `src/motion.mjs`, `player.mjs`, `abilities.mjs` and `draw-bounds.mjs`. The demo registers its original procedural `reference-fx.png` atlas at startup; another host must do the same or supply its own authorized effect art.

## Equipment abilities

The registry matches 735 unique supplied items to exact normalized names in 36 fetched wiki slot tables. Counts overlap: 395 double jump, 77 high jump, 70 slow fall, 309 Speedy. Two conditional Sprite's Robe rows are deferred rather than wrongly granting both jump mods. No table row failed to match this supplied catalog.

- **Naked player:** one ground jump.
- **Fairy Wings, ID 156:** double jump only ([Double Jump back items](https://growtopiawiki.com/w/Mods/Double_Jump/Back)).
- **Soda Jetpack, ID 1762:** high jump plus slow fall while Jump is held; no additional air jump ([High Jump back items](https://growtopiawiki.com/w/Mods/High_Jump/Back), [Slow Fall back items](https://growtopiawiki.com/w/Mods/Slow_Fall/Back)).
- **Speedy:** explicit equipment-specific faster land travel ([Speedy](https://growtopiawiki.com/w/Mods/Speedy)). The 1.4 speed multiplier is reference tuning, not a recovered native constant.

High jump adds one logical 32-unit tile to this reference controller's held-jump height. Native impulse, gravity, friction and modifier coefficients remain unverified. Every registry entry retains URLs, labels and notes. Unknown items never gain abilities from a name, FX flag or sprite size. Water, collision, combat, conditional/random modifiers and all other special abilities are not implemented by this four-mod registry.

## Mounts and floating

Split horse-sit gait requires an animal identity and split 32px geometry. Motorcycles, snowmobiles, bikes, lamps, carpets, comets and brooms are excluded. Complete 64px sprites are excluded. Player hop and opposing halves share one 460ms cycle, slower than the previous 350ms reference, only while grounded and travelling.

Animal words cover ground animals, birds, insects and aquatic animals; verified horse aliases include Aimster's Nightmare, White Fury and Enbarr ([Aimster's Nightmare](https://growtopiawiki.com/w/Aimster%27s_Nightmare), [White Fury](https://growtopiawiki.com/w/White_Fury), [Enbarr](https://growtopiawiki.com/w/Enbarr,_The_Flowing_Mane)). A flying-animal name does not imply levitation: Riding Bumblebee explicitly cannot fly and grants double jump ([Riding Bumblebee](https://growtopiawiki.com/w/Riding_Bumblebee)).

Broomstick, Meteor and Comet have explicit float classification; Broomstick levitation is also documented ([Riding Broomstick](https://growtopiawiki.com/w/Riding_Broomstick)). Eligible recovered source lift curves take priority. Known hover without a usable curve, including Cumulus/Harvest Broomstick, now uses a bounded shared reference bob instead of remaining static: amplitude 1, period 1000ms. This fallback is labelled `reference-float-fallback`, with `outfitInteractionsVerified=false`. It is not a recovered native curve. Mount, clothing, seat and body share the same time-varying root. Moving float arms retain the existing ±45° pose and recover on stop.

## Effects

Reachable XML particle hooks are no longer limited to the five aura replacements. Supported `ParticleSystemUpdate`/`ParticleSystemRender` hooks are deduplicated by emitter. Relative activation clocks, finite emission counts, delays, enable flags, gravity, additive blend, local translations and particle-local sprite clocks run. Particles persist within their finite lifetime when the action ends; repeated punch events restart finite bursts. `JUMPSTART` and `JUMPDOUBLE` require actual controller events. Common normal/mini-player, facing, sitting, transform and known wearing predicates are evaluated from explicit render context; unknown predicates fail closed. Captured clothing is retained where full native transforms are unsupported. Non-finite expressions are skipped and recorded, not silently replaced by zero.

Seven explicit procedural reference recipes run through the shared draw list and export bounds:

- **Golden Pickaxe, 1438:** small looping sparkle ([Golden Pickaxe](https://growtopiawiki.com/w/Golden_Pickaxe)).
- **Snorkel, 288:** small bubbles from the tube. This appearance is user-observed; the wiki supports its soap/cosmetic description but provides no emitter constants ([Snorkel](https://growtopiawiki.com/w/Snorkel)).
- **Comet/Meteor, 2048/2064:** moving green/blue dust trails ([Riding Comet](https://growtopiawiki.com/w/Riding_Comet), [Riding Meteor](https://growtopiawiki.com/w/Riding_Meteor)).
- **Cyclopean Visor, 138:** aimed laser ([Cyclopean Visor](https://growtopiawiki.com/w/Cyclopean_Visor)).
- **Heartbow, 366:** aimed heart projectile ([Heartbow](https://growtopiawiki.com/w/Heartbow)).
- **Tommygun, 472:** aimed bullet ([Tommygun](https://growtopiawiki.com/w/Tommygun)).

These recipes use original procedural art, tuned timings and bounded lifetimes, not native particle clips. Hand weapon recipes take priority over a face punch effect. Weapon arms aim without the generic stretching fist. World-born effects stay at birth locations when the player moves.

The seven-state/action probe observed XML particles on 176 items. Six items in this probe have unsupported particle expressions. **940 items have FX-related flags but neither an observed XML emitter in this probe nor an explicit recipe.** They remain unresolved, not effect-free. Source field presence is not rendering coverage. Generic demo jump confetti has been removed rather than presented as every item's native effect.

## Pets and native metadata

Pets retain public stand/move/rise/fall atlas playback. Catch-up motion now keeps locomotion active until the pet reaches its trailing position. Heading follows its own travel instead of instantly mirroring every owner turn. Native terrain navigation, perching, combat and special AI remain outside this follower reference.

All declared fields for all 4,081 supplied wearable rows are preserved as original strings under `sourceFields` in the demo native metadata. This includes action type, `punch_options`, extra options, pet ability, description, `data_position_80` and version arrays. There were no malformed rows. Unknown bytes have not been relabelled as validated effect or ability flags.

## Files and tests

- **src/**: current executable engine, including `abilities.mjs`, `draw-bounds.mjs` and `item-fx.mjs`.
- **demo/**: runnable demo source, catalog, compiled XML, native metadata, lift profiles, reference atlases and data-generation tools. Serve this folder over HTTP; do not open index.html directly as a file URL. Game assets retain their original ownership and are included for the requested local reconstruction/reference.
- **evidence/ability-registry.json**: sourced item modifiers and conditional rows.
- **evidence/input-abilities-fx-coverage.json**: actual sampled emitters, unsupported expressions, reference recipes, gait and ability status.
- **evidence/item-coverage.csv**: combined dependency and current behavior inventory.
- **evidence/input-browser-qa.json**: real pointer/touch checks and current test outcomes.

The demo has 72 passing tests and the reference package has 81. Tests cover all 4,081 items across twelve state/time cases, finite matrices, source frame sizes, ability budgets, aimed punch geometry, held cadence, shared float root and emitter lifetime/event gating. Browser checks cover desktop/375px layout, real touch input, naked startup, near/far punches, release/repeat, named abilities, Cumulus Idle/Moving/Idle transitions, mount idle/travel and all four PNG resolutions. These validate tested contracts, not native-engine parity.
