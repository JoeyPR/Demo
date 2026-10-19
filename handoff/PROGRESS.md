# Progress against PERPLEXITY_WORK_ORDER.txt

| Step | Status | Evidence |
|---|---|---|
| 0 Patch pack | Done | root 94/94, demo 72/72 (matches the work order) |
| 1 Coverage report | Done | `node tools/xml-coverage.mjs evidence/renderer-data.json --json evidence/xml-coverage.json` -> 924 systems, 0 native-ready, 142 partial-only, 782 blocked |
| 2 Stage-driven starts | Done | `test/xml-stage-triggers.test.mjs` (6 tests, real data: AtomConstructs, CaptainBark, CyberCycle) |
| 3 ParticleSystemOff + event-hook gating | Done | `test/xml-event-hooks.test.mjs` (8 tests incl. CyberCycle ps_Hit regression) |
| 4 Honesty in product | Done | `src/xml-badge.mjs`, `test/xml-badge.test.mjs`, Fidelity panel + "Approximate FX" switch (default OFF) |
| 5 Particle flags | Done except 5.10 | 5.1-5.9 each in its own commit with named tests, see `STEP5_TEST_NAMES.md` |
| 6-9 | Not started | |

Totals now: root 209/209, demo 72/72. Branch: `perplexity/native-particles-step5`.

## Deviations from the work order (and why)
1. Stage entries are not added for systems that already have an Update/Render rule, a secondary parent, or an OnFinish parent. Those are governed by the rule (step 3) or the parent (step 6). This keeps 81 "hooked+staged" systems from running when their rule is inactive.
2. EVENT_HOOKS also covers OnPunchBegin (== OnPunchStart) and OnPunchStop (== the frame a punch ends). Both are [HYP]. They appear in ArcaneArmor / CrystalBallHead as paired Update/Off rules, e.g. punch_start_particle = Update@OnPunchBegin + Off@OnPunchStop.
3. Event-hook Updates are one-frame pulses (plus the emitter's own delay), as the work order specified for OnPunchStart.
4. xml-support.mjs was NOT changed in steps 2-4: no field-level behaviour was added.

## Open questions that need the user's capture / decision
- ParticleSystemOff: is it a latch (stays off until another Update) or a reset? Data shows paired Begin/Stop usage but also level-triggered Updates (Update@Update:PUNCH) with Off@OnPunchBegin. Implemented as "stop the running emitter now; may restart next frame".
- AddClothingParticles: level (while worn) as implemented, or an equip-time edge?
- SwitchOffClothingParticles is treated as never live while an item is worn.

## Unresolved by design (reported in the UI, not run)
Hooks/stages with no planner source: OnDamagedTile, OnDestroyedTile, OnKilled, OnRespawned, OnEnteredToWorld, OnItemEquipped.
Systems needing a hit target (initialVelocity: targetPos) are skipped with a reason.


## Owner decisions applied (named constants in src/xml-renderer.mjs)
- `PARTICLE_OFF` = stop emission + reset emitter state (running=false, emitted=0, delayMs=0), live particles finish, not a latch, Off wins a same-frame Update.
- `ADD_CLOTHING_PARTICLES` = continuous while worn, hook conditions re-evaluated every frame.
- `PUNCH_HOOK_EVIDENCE` = OnPunchBegin == punch event, OnPunchStop == frame the punch ends; evidence pairs are asserted against the shipped ArcaneArmor data.
- Their xml-support entries (Emitter.enable, delayTimer, infParticles, particlesToEmit, checkParticleNumToEmit) stay "partial"; no entry in the table is "full".

## Step 5 deviations and [HYP] defaults
- 5.3: the rig already mirrors every draw call at facing=-1, so usePlayerFacing/offsetFacing=false COUNTER-mirror (net: one mirror for true, none for false). Mirroring again, as the work order literally says, would double-flip.
- Absent-flag defaults keep the pre-5.x behaviour: `RELATIVE_TO_EMITTER_DEFAULT`, `USE_PLAYER_FACING_DEFAULT`, `OFFSET_FACING_DEFAULT` are all true.
- 5.6: final* values come only from the evaluator. The old property() fallback picks a random Select item when an input is missing, which would invent colours. Unresolved finals are ignored and listed in `item.xmlIgnoredValues` (shown as a note in the Fidelity panel). A velocity path that depends on an unresolvable finalVelocity skips the particle, like initialVelocity.
- 5.7c: the planner's motion has no punch counter, so each item counts distinct punch events; the count at spawn is kept in the run's trail.
- 5.10 (emitter attachment) is not started: it needs hand-spot and target positions (Step 7).
- Guard commit: unresolvable initialAngle (source="boomerangAngle" etc.) and Curve initialRotationRate used to yield NaN matrices in 4 scripts; they now fall back to 0 and are reported.

## Still open
- Select inputs `variantId` (6 initalRGB + 4 finalVelocity uses) are not supplied by the planner, so those values are ignored/skipped.
