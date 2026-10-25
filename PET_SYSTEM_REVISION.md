# Pet engine port revision (SetPlannerGT source-assisted)

This revision replaces the old approximate follower (`src/pet-motion.mjs`, `demo/engine/pet-motion.mjs`) with a direct port of the SetPlannerGT pet engine, extracted from the deobfuscated `app.js` of the live planner bundle ([application](https://setplannergt.com/app.d5e8585e60.js)). The port is source-assisted and verified against the live canvas where noted; it is **not** official-client verified. No invented item data was added: every constant, table and formula below traces to the source bundle or the planner catalog.

Read this after `ARCHIVE_MOUNT_PET_REVISION.md` and `STATE_ROUTING_REVISION.md`. The old `pet-motion.mjs` statements about a "bounded follower" are superseded.

## What changed

- **`src/pet-system.mjs` (new, mirrored at `demo/engine/pet-system.mjs`)**: a full port of the source `PlayerMotionController` pet step (`petOwn`/`petStates`/`petPoint`/`petMove`/`petCellNow`/`petString` and the kind table). One `PetEngine` instance per pet item, state persisting across frames on the engine.
  - **Trail pets (kinds 0..38)**: chase a 20-tick trail of behind-points (`TRAIL=20`, `TICK=1/60`, `TRAIL_SPEED=350`, `BEHIND=16`, `HALVE=20`, snap 60/250/350 per kind family). The pet only starts moving once the trail flushes (~21 ticks) — this is the source's observable follow lag, not a bug.
  - **Flyers (kinds 1/3/9/23/25/27)**, **hovers (11/31/32)**, **kites (4/30/34)**, **perch (5/35)**, **hop (28/29)**, **ball (18)**, **owlbeard (10)**, **phoenix (17)**, **agent (37)**, **walkRunJump and flyWalk (38)** all dispatch as in the source.
  - **Machine pets (kind 200)**: wolf (11704/11706), dragon (11562), Crimson Thief Mask (13116) and Captain Bark (13116-family config, item 15336 uses flyWalk instead) with the source state machines (`PET_MACHINES`), including the wolf's punch leap toward `punchAim`.
  - **Pet cells**: `petCellNow` samples `stand/move/rise/fall` rows on the pet's **own clock** (`t68`), selected by the pet's last-tick displacement and ground state. Cells are absolute (`cell[0]*sw`, `cell[1]*sh`), verified against the live canvas (wolf resting cell `(0,13)` reads `(0,704)` on `tf_page1.png`).
  - **Leash string**: kinds 4/30 draw a line primitive from the pet to the arm-anchored hand point (`petString`), rendered by `render.mjs` as a canvas line (`lineCap: round`, default rgb `[180,180,180]`). The piece is flagged `petLine` and cleaned up every step.
  - **Machine extras**: authored-space copies of the main piece (dragon wing) flagged `petExtra`, rotated around the main pin, cleaned up every step.
  - **Punch**: `PunchDelay` publishes 1 on a punch event and decays on the pet clock; the wolf leap targets the punch aim. The sprite flip follows the source `SQ`: `(petPunching ? hostFacingLeft : petFaceLeft) XOR hostMirror` — while the pet shows punch cells (none ship in the current catalog) it faces the player. The previous aim-side guess (`punchAimLeft`) was removed as unsupported.
- **`src/catalog-adapter.mjs`**: imports `pet-system.mjs` (old `pet-motion.mjs` deleted from both trees). Machine pets without `gameIcon` pet records get a generated 64×64 piece from their `parts` rect (`sx: rect[0], sy: rect[1]-32`, anchor 0.5/0.5 at the part's authored `at`) — verified against the live canvas. `advancePet` now runs **before** `advanceXmlRenderer` so scripted states (Captain Bark) can read the pet variables.
- **`src/xml-renderer.mjs`**: `variable()` resolves flat `motion.petVars` keys first; `CompareCustomVariable` added with the source's numeric coercion and `operatorType ?? operator ?? "Equal"` semantics.
- **`src/fx-engine.mjs`**: `getVar` exposes `pet.velocity.x/y/length`, `pet.facingLeft`, `distanceToPet` from the published `motion.pet`, and `PunchDelay`/petVars from `host.petVars`.
- **`src/render.mjs`**: line primitive handled in `sampleItem` and `drawCanvas` (stroked before atlas lookup).
- **Host wiring (`js/app.js`, `demo/app.js`)**: a `withPetHost(motion)` helper feeds the engine `armAngle` (previous render's `pose.frontAngle` — the pose resolves after items advance, so it lags one frame), `petBareHead` (no head item equipped), `petLift` (`lift.y`), and a flat-floor `solidAt` for the preview (the source queries real world tiles for trail platform edges).
- **Tests**: new `test/pet-system.test.mjs` (9 tests) covering kind lookup, trail lag, machine pet cells, flyers, PunchDelay, PetFlyWalk publication, hidden pets, the owl gap and piece boundedness. The two old pet tests were rewritten to the engine's own-clock semantics (60Hz frames, moving host, 21-tick trail flush). The leash-line finiteness checks in `demo/test/render-regression.test.mjs` and `demo/test/archive-renderers.test.mjs` now validate line geometry.
- **Bug fixed during testing**: the leash line piece was pushed without `petLine: true`, so it accumulated one piece per frame; now flagged and cleaned.

## Host contract

`advancePet(item, timeMs, motion)` reads `worldX/worldY` (feet line; the engine hosts at rig top-left, center = `[x+16, y+32]`), `dtMs` (clamped to 50ms like the source step), `vx/vy`, `facing`, `ground`, `punch.ageMs/.target`, `events` (punch ids), `petBareHead`, `petLift`, `armAngle`, `petWorld.solidAt`, and publishes `motion.pet`, `motion.petState`, `motion.petVars` (flat `PetFlyWalk.*` keys) for the FX layer and scripted renderers.

## Verification status

- `npm test`: **111/111 pass** (was 102; +9 pet tests).
- `demo/test` suite: 65/72, with the **same 7 failures as commit `4fb7669`** (pre-existing: floating vehicle delta, default-state fixtures, texture edge clamping/pet wrapping, Riding Cloud, horse-sit mounts, XML emitter hooks, generic float). No new failures.
- Engine behavior verified empirically in Node (spawn points, trail flush, cell sampling, machine cells, PunchDelay) and against live-site measurements taken earlier (wolf 298×174 px at 5.558 px/unit, 64×64 machine pieces at absolute cells).

## Render verification follow-up (browser QA)

A later session completed the empirical render verification end-to-end against the local server with a headless browser driving the real UI (search + two-click grid equip). Full measurements and screenshots: `evidence/pet-render-browser-qa.json` and `evidence/screenshots/pet-*.png`.

- **All representative pets render**: Puppy Leash (kind 8 trail), Butterfly Leash (kind 1 flyer), Calf Leash (kind 0 trail), Summer Kite (kind 4 kite + string), Alpha Wolf / Pet Blood Dragon / Crimson Thief Mask (kind 200 machines, the mask via its generated 64×64 piece) and Captain Bark (kind 38 flyWalk script pet).
- **Follow lag reproduced**: holding right, the player starts moving at t=847 ms and the pet at t=1166 ms — a 319 ms (~19-20 tick) lag, matching the source's 20-tick trail flush.
- **Wolf punch leap and hover extra**: a held punch drives the leap (y arc −32→−16→−32, 100+ units of travel toward the punch aim, past the player), the wolf faces the player while punching (source `petPunching` semantics), and at hover-at-target the machine pushes its second piece — cell `[10, row+1]`, rotated ~93°, additively blended — confirmed as two `RenderPet` pieces for 40+ frames. The dragon machine follows the motion state directly with no extras, as ported.
- **Bug found and fixed — leash string dropped by the host atlas filter**: `renderAvatar` in `js/app.js` and `demo/app.js` filtered draw calls with `atlases.has(c.atlas)`; the string is a line primitive with no atlas, so it never reached `drawCanvas`. Both hosts now pass line pieces through (`c.line || atlases.has(c.atlas)`) and exclude them from the missing-atlas scan. The Summer Kite string now renders from the pet to the hand anchor. (The earlier "player invisible in world" symptom on the proxy-deployed copy did not reproduce on a local server and was an environment artifact, not app code.)
- **Regression check after the fix**: `npm test` 111/111; `demo/test` 65/72 with the same 7 pre-existing failures as `4fb7669`.
- The flat-floor `solidAt` and the one-frame arm-angle lag are visually imperceptible in the preview (the string anchor tracks the hand); both remain documented placeholders below.

## Remaining work

1. **Legendary Owl (11142) data gap**: its `parts` record lacks `pet:1` and it has no `gameIcon` pet records, so no pet pieces exist and no engine runs — the live client gates the same way (`drawsPet` requires slot-script RenderPet rules). If official data or a catalog update ships pet records, the engine will pick them up unchanged. Do not invent records.
2. **Pre-existing `demo/test` failures (7)**: unrelated to pets (lift/gait/fixture drift). Separate cleanup; do not bundle into a pet commit.
3. **u:0/u:12 gameIcon pairs**: pet items ship two identical records (u:0 and u:12); both become pieces exactly as the source pushes them (the group pin average is unaffected). Visually identical stacking; if a future catalog ships differing cells per band, verify against the source's record selection before changing the adapter.
4. **`solidAt` world query**: the preview supplies a flat floor; the source queries real tiles for platform edges (trail pets walking off ledges). A world-aware `solidAt` can be wired when the demo grows real terrain.
