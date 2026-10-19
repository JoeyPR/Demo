# Progress against PERPLEXITY_WORK_ORDER.txt

| Step | Status | Evidence |
|---|---|---|
| 0 Patch pack | Done | root 94/94, demo 72/72 (matches the work order) |
| 1 Coverage report | Done | `node tools/xml-coverage.mjs evidence/renderer-data.json --json evidence/xml-coverage.json` -> 924 systems, 0 native-ready, 142 partial-only, 782 blocked |
| 2 Stage-driven starts | Done | `test/xml-stage-triggers.test.mjs` (6 tests, real data: AtomConstructs, CaptainBark, CyberCycle) |
| 3 ParticleSystemOff + event-hook gating | Done | `test/xml-event-hooks.test.mjs` (8 tests incl. CyberCycle ps_Hit regression) |
| 4 Honesty in product | Done | `src/xml-badge.mjs`, `test/xml-badge.test.mjs`, Fidelity panel + "Approximate FX" switch (default OFF) |
| 5 Particle flags | Not started | next: 5.1 relativeToEmitter (244 systems) |
| 6-9 | Not started | |

Totals now: root 113/113, demo 72/72.

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
