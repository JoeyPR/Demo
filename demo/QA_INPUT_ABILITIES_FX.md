# Input, abilities, mounts, and FX revision QA

## Claims and checks

- Naked startup: fresh load has no equipped IDs, idle pose, single jump status and disabled double-jump preview action.
- Jump abilities: equip Fairy Wings and Soda Jetpack by the actual search/equip UI; inspect status and jump behavior. Unit tests cover jump budget, held slow fall, high-jump height, and airborne equipment changes.
- Punch: real pointer down, drag near/far and across the player, hold, release and cancellation. Check repeat attacks and expanding render bounds. Unit tests verify shoulder-space tip geometry at three targets.
- Persistent controls: desktop and 375px, wardrobe/motion/settings tabs, controls visible and usable with no document horizontal overflow. At 375×667, a full 100px item-card row remains visible; compact-preview jump headroom keeps the airborne player visible.
- Mounts: Broomstick, Meteor, Comet have no animal split gait and share a bob with the player. Stick Horse's opposing halves use a 460ms cycle, only when walking.
- Named FX: Golden Pickaxe sparkle, Snorkel bubbles, Comet/Meteor dust; Cyclopean Visor, Heartbow and Tommygun punch recipes. Procedural reference art is not claimed as native sprites.
- Native XML: finite catalog-wide matrices with additional reachable emitter hooks, gravity and local offsets. Unsupported expressions are skipped and tracked, not silently zeroed.
- Pets: own heading and catch-up locomotion, public atlas cell animation; no claim of native pet AI or combat.
- Resolutions: 32, 64, 128, 256 work through shared bounds/export path.

## Exploratory checks

- Drag punch to the opposite side, release outside the canvas and switch tabs while holding; ensure input does not stick.
- Equip, remove, and re-equip jump items while airborne; ensure the air-jump budget does not refill.
- Resize the same browser page desktop to phone and back, then use movement controls.

## Evidence

The automated test log, browser QA result and desktop/mobile screenshots are saved with this revision. Numerical gait, float, physics and procedural FX timing remain reference tuning.
