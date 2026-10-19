# Renderer archive, split mount gait, pets and mobile revision

This revision incorporates the user-supplied [player stuff archive](https://www.mediafire.com/file/r8ik69x40n43hzv/player+stuff.zip/file), downloaded and inspected as data. No uploaded executable or script was run. The archive SHA-256 is `36d809873a73db0e479339f238a0e481e8e7ff33ea446fcb223cbdd58d0aa256`.

Read this before older revision notes. The earlier statements that renderer bodies were wholly unavailable are superseded for the 314 supplied XML definitions; full native execution support is still not established.

## What changed

- **XML data pipeline**: `tools/compile-renderers.py` compiles XML into inert JSON. All 314 renderer files parse. Seven identical duplicate attributes in four files are removed in the derived copy only; originals and raw hashes remain unchanged.
- **XML runtime**: `src/xml-renderer.mjs` binds captured atlas cells to named sprites, advances matched sprite tracks with `animTime` as the total sequence duration, evaluates supported numeric/boolean state transitions, and handles selected scale/position tracks. It does not evaluate arbitrary code.
- **State selection**: A sprite has one active track. Stateful tracks outrank ambient tracks; Cumulus and Royal Cumulus now use authored 1200ms idle and 600ms movement sequences. Riding Bilby resolves Idle, Walk, Jump and Fall.
- **Selected aura rendering**: StarryAura, DirtAura, TwilightAura, InfinityAura and BeachAura have explicit simple-render-rule paths. This includes full-size sprite animation and a bounded particle interpreter for offsets, intervals, velocity, lifetime, scale, alpha, rotation and selected frames. Particle simulation remains approximate.
- **Public pets**: `src/pet-motion.mjs` samples `petCells.stand/move/rise/fall` using the descriptor's total duration, not a per-frame duration. A bounded follower introduces horizontal and vertical lag and turn recovery. It is not native pet AI.
- **Horse-sit gait**: `src/mounted-gait.mjs` detects captured split seated templates, including Stick Horse, Tiny Horsie and Tiny Appaloosa. While grounded and moving, one phase drives the body hop, seat hop, and opposing vertical offsets of the item halves. Idle and air disable it.
- **One-piece exclusion**: An inferred opposing-half gait is never applied to complete 64px artwork. Native floating mounts are also excluded from the inferred horse gait.
- **Riding Cloud #11168**: Keeps the source-derived base -8, amplitude 1, 1000ms idle bob; its public blink sequence remains ambient. It is not assigned the horse gait or aliased to Cumulus XML. Shared root coupling and moving 45-degree arms remain in force.
- **Demo startup**: Starts idle instead of introducing a walk cycle.
- **Phone interface**: Compact preview plus Clothes/Motion/Settings tabs, horizontally scrollable slots, internally scrollable four-column wardrobe, search without zoom-prone small text, slot unequip, and mobile PNG export. Presets and tint remain available under Settings.

## Integration

Load renderer data before normalizing items:

```js
catalog.renderers = (await fetch("./renderer-data.json").then(r => r.json())).scripts;
catalog.liftProfiles = Object.fromEntries(liftData.profiles.map(p => [p.id, p]));
const items = selectedRawItems.map(raw => normalizeCatalogItem(raw, catalog));
const player = new PlannerPlayer(catalog, items);

function tick(motionFrame, dtMs) {
  // If a host centers the player at x/y=0 for rendering, preserve worldX/Y
  // so follower motion can still observe actual displacement.
  return player.step(motionFrame, dtMs, visual);
}
```

Load every atlas in `item.renderer.sprites` as well as currently sampled pieces. Otherwise a newly selected animation or particle sprite can silently remain invisible.

`renderer-data.json` is compiled inert XML data, not a replacement for its interpreter. The handoff includes the compiled definitions in `evidence/renderer-data.json`; the demo loads them at its project root. Recompile against the supplied archive when changing schema or data.

## Exact boundaries

- **Gait inference**: Captured seat/crop geometry identifies the split seated cohort. This is not a recovered mapping of every native HORSE_SIT/HORSE_SIT2 bit. Override `raw.mountedGait` explicitly when better data exists, or set it to false to exclude an exception.
- **Gait tuning**: Current period is 350ms, hop amplitude 1.5 logical pixels, and side slide amplitude 1.25 logical pixels. These implement the user's described small-step illusion and are not claimed as official constants.
- **Native float curves**: The archive's `ShouldHover` option establishes a mode, not a bob formula. Cumulus/Royal Cumulus frame sequences are now sourced; their unresolved native vertical curve is not silently invented.
- **Particle fidelity**: Emission uses deterministic reference replay, including midpoint timing for interval ranges. History, random distributions, world trails, many transforms and native state/event side effects remain incomplete.
- **Pet fidelity**: Correct public cells and a visible following reference are not full perching, flight, leash-string, attack, collision or terrain behavior.
- **Unsupported XML**: Unknown conditions fail closed. Complex avatar transforms, actions, state timers, native functions, masks, contextual drawing and arbitrary rule composition remain partial.
- **Missing definitions**: Mecha Tank #16400, Pariah's Shawl #16402 and Super Stingers #16404 still have catalog renderer references without matching XML in this archive.
- **Validation scope**: Catalog finiteness, parsed-script counts and bound-track counts are structural coverage, not proof of item-by-item official visual parity.

## Coverage and testing

The coverage report records 314 mapped XML items, 664 strictly matched captured sprite pieces, and 198 items with bound animation tracks. The inferred split seated gait covers 104 snapshot items; 360 records contain pet-cell metadata, with 352 linked to pet follower pieces. These are snapshot counts, not the current official item universe.

The demo suite has 48 passing tests, including 48,972 XML/pet/gait structural state/time cases in addition to prior rendering tests. Targeted checks cover the named clouds, Bilby, horse variants, Starry Night Aura, Dirt/Twilight/Infinity particle paths and Calf Leash clocks.

Browser evidence checks real equip/action interactions, startup idle, mount state transitions, aura rendering, pet movement and reversal, mobile panel switching, empty-search recovery, unequip, export, and resizing the same page from desktop to phone and back. No official-client runtime was available for pixel or timing equivalence.
