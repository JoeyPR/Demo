# Floating arms, mount states, and attachment roots

This revision supersedes earlier unconditional item-frame playback and floating-vehicle attachment guidance. It implements the user's observed behavior; it does not establish official-client pixel or timing parity.

## Integration contract

- **Single state input**: Call `PlannerPlayer.step(motionFrame, dtMs, visual)` once per tick. It advances normalized catalog items, pose, rig, and lift from the same MotionFrame. Do not separately advance these same items on a second clock.
- **Semantic policy**: `src/motion-policy.mjs` distinguishes `air`, `travel`, and `ambient` sequences. Neither a 32-pixel nor a 64-pixel cell determines its action.
- **Floating arms**: Moving, grounded floating players approach back-arm -45 degrees and front-arm +45 degrees. A single root reflection makes the arms spread outward in either facing. Stopping returns to the neutral or authored mount pose. Punch and airborne poses retain precedence.
- **Transition timing**: The reference approach speed is configurable code at 900 degrees per second, about 50 ms for a 45-degree transition. This is reference tuning, not recovered official timing.
- **Mount states**: Nonfloating vehicles use ground-travel sequences only while walking. Idle and airborne sampling use the first listed neutral cell. Entering travel restarts its clock; reversing direction does not. A first listed frame is a fallback, not proof of the official idle clip.
- **Morty family**: Gray 7836, Orange 7838, Pink 7840, and Diamond 7842 use air-gated sequences. Idle and walking keep the neutral cell, jump/fall/glide animate, and landing returns to neutral. The static trunk is not treated as an animated row.
- **Shared floating root**: Player-attached floating geometry, including floating mounts and seat pieces, receives the same complete root lift. Do not add an independent second sine to the item, rider, overlay, or display canvas. World-space particles remain world-attached.
- **Manual float**: The generic override replaces source float rather than stacking another lift. It is explicitly a demo reference, not an item-specific native curve.
- **Ambient effects**: Aura clocks, pulse, flicker, and orbit remain independent of locomotion gating.

## Data overrides and evidence

`part.animationPolicy` overrides `raw.animationPolicy`, then family defaults apply. Values are `air`, `travel`, or `ambient`. Set explicit item data when a vehicle has an animated idle, a separate airborne clip, or another exception; do not broaden the fallback into an assertion that every vehicle behaves identically.

`floatBehavior.enabled` can explicitly include or exclude an item. Otherwise the reference consults ShouldHover metadata, eligible dynamic lift profiles, and the known Cumulus/JusticeLens renderer names. Negative rider lift alone does not prove floating.

The source-assisted baseline remains the [Set Planner application](https://setplannergt.com/app.d5e8585e60.js) and [public catalog](https://setplannergt.com/items.17c8f97f87.dat). Public stills do not establish idle-to-walk-to-air transitions. The 45-degree arm and Morty ground/air corrections originate in the user's observations, not a newly recovered native clip.

## Verification and remaining limits

The demo regression suite has 38 passing tests. These cover 4,081 catalog records across four structural movement states, 50 state-gated mount sequences, all four Morty variants, floating root coupling in both facings, arm interruption and recovery, ambient FX, and nonstacking manual float. Finite draw geometry is not visual correctness for every item.

Browser checks exercise floating travel in both directions, stopping, mount idle/walk/idle, and Morty ground/air routing. Exact native float curves remain unresolved for items without usable source profiles, and native-script references remain incomplete. In particular, classifying Cumulus as floating does not recover its missing item-specific dynamic curve.

## Review checklist for Claude

- Preserve the same MotionFrame for item frames and body poses.
- Preserve full sprite dimensions, row-local offsets, punch sleeves, layer order, and one facing mirror.
- Keep mount idle, travel, and air policies separate.
- Keep the rider, floating owner item, and seat on the same floating root.
- Do not treat all renderer scripts or all item effects as implemented.
- Compare timing and cells against authorized official-client recordings before claiming exact fidelity.
