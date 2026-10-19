# Set Planner punch animation restoration

The user requested the Set Planner-derived punch back, rather than a redesigned easing animation. This revision supersedes the generic-punch timing and curve in the earlier input/abilities revision.

## Restored behavior

The generic punch again uses the previously extracted Set Planner equations: `stretch = reach * t * 0.106`, `width = min(1.8, 7.43 * t)`, where `t` is seconds. These replace the introduced sine/cosine extension, hold and retraction envelope ([Set Planner application](https://setplannergt.com/app.d5e8585e60.js)).

The held repeat interval is 200ms, with a nominal 260ms released-stroke lifetime. An existing stroke may therefore be retriggered before its released lifetime ends; do not “fix” that by slowing held repeats to 260ms. Tiny floating-point cooldown residue is clamped to zero so 60Hz input does not add another frame.

The front arm starts at 90°, approaches 20° at 900°/s, and preserves its angle between punch frames rather than being reset by the idle pose each tick. The punching arm still aims at the pointer.

## Preserved improvements

- Adaptive draw/export bounds still prevent the old player-box clipping.
- Near/far pointer aiming still controls reach and direction.
- Holding the preview or Punch pad repeats; release, cancellation and outside release clear held input.
- Shirt punch-sleeve mapping still uses the shared punch matrix.
- Native item XML, explicitly supported projectile effects, movement abilities, naked startup and phone controls are not rolled back.

This is the generic planner fallback restoration, not a claim that every custom item punch or the full official-client engine has been recovered.

## Regression coverage

Four new tests cover the original stretch/width at seven ages, continuous front-arm swing, 200ms cadence with a 260ms released lifetime, and 60Hz floating-point timing. Existing aiming geometry tests now assert the original time-dependent expansion rather than forcing the fist to reach its target at 100ms.

Browser QA uses the real controls for held/released punches, near/far aim, reversing aim, outside release and Tuxedo sleeves at desktop and 375px phone sizes. Captures and sampled poses are in `evidence/punch-restoration-browser-qa.json` and `evidence/screenshots/`.
