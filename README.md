# Growtopia player rendering handoff

This package is a researched, editable starting point for Claude to implement player, clothing, and movement rendering in a Growtopia planner. It contains readable ES modules, a source-cited technical guide, a 4,081-item coverage inventory, and a numerical test suite.

**It is not the official Growtopia rendering engine and is not a complete implementation of every item.** The strongest evidence is source-assisted analysis of Set Planner GT's public application and catalog; official-client pixel parity remains unverified ([Set Planner application](https://setplannergt.com/app.d5e8585e60.js), [public catalog](https://setplannergt.com/items.17c8f97f87.dat)).

## Read order

- **PUNCH_RESTORATION.md**: Latest correction restoring the Set Planner generic punch curve, front-arm swing and 200ms held repeat cadence while preserving aiming and uncropped rendering.

- **INPUT_ABILITIES_FX_REVISION.md**: Current revision. Aimed uncropped punches, naked startup, persistent phone controls, 735 sourced item ability matches, animal-only slower gait, shared hover fallback and explicit FX coverage.

For the included runnable demo, serve `demo/` over HTTP, for example `python -m http.server 9000 --directory demo`, then open localhost on port 9000. The four output scales are 32, 64, 128 and 256 pixels per logical tile; adaptive punch/FX bounds may expand PNG dimensions beyond the normal four-tile minimum.

- **CLAUDE.md**: Copy this into Claude's project instructions or attach it first.
- **ARCHIVE_MOUNT_PET_REVISION.md**: Latest archive pipeline, XML track interpreter, split seated gait, public pet cells, phone interface, and remaining fidelity gaps.
- **STATE_ROUTING_REVISION.md**: Read first for floating travel arms, mount idle/travel clocks, Morty ground/air gating, and the shared floating attachment root.
- **ANIMATION_FX_FLOAT_REVISION.md**: Latest phase/cell, 64×64, sprite-FX, texture-edge and source-derived floating fixes, with remaining native-script blockers.
- **RIDING_AND_CATALOG_REVISION.md**: Latest full-catalog adapter, riding bug fixes, pose precedence, native schema correction, and explicit fallback limits.
- **RESEARCH.md**: Read the findings, exact planner constants, architecture, and source distinctions.
- **API.md**: Use the data contracts and integration example.
- **GAPS.md**: Check what is implemented, approximate, or missing before promising fidelity.
- **VALIDATION.md**: Review the test scope and official-client capture protocol.
- **src/**: Integrate the independently written implementation modules.
- **evidence/item-coverage.csv**: Look up an item's public renderer/FX/sleeve/rider dependencies.
- **evidence/catalog-audit.json**: Review structural smoke results and the explicit no-item-draw cases.

## Run

Use Node.js 20 or newer. The core and tests have no npm dependencies.

```sh
cd growtopia-rendering-handoff
npm test
node examples/headless.mjs
```

The browser renderer needs authorized texture images and a decoded public catalog supplied by your application. No Growtopia textures, third-party application bundles, private session data, or sealed data are distributed here. The supplied renderer XML is included as compiled inert data in `evidence/renderer-data.json`; the interpreter remains partial.

```sh
# A local copy of the public planner catalog, not native items.dat:
node tools/unpack-planner.mjs public-items.HASH.dat catalog.json

# Optional native metadata inspection; separate dependency, not needed for tests:
# Install an audited/pinned grow-items version in your own integration project.
node tools/inspect-native-items.mjs /path/to/native/items.dat > native-items.json
```

## What works

- **Transforms**: Logical 32-unit space, single facing reflection, body/root separation, arm and held-item pivots, sprite anchors, rotation pivots, and per-piece flips.
- **Animation**: Recovered planner walk tables, air pose approach, generic punch overlay, explicit frame sequences, unequal durations, and event crossings.
- **Equipment**: Basic planner slot hiding, separate semantic body hiding, body tint/alpha, dynamic face/chest pass changes, sleeves, punch sleeves, and mount-versus-rider attachment separation.
- **Integration**: Descriptor hooks, bounded script operations, seeded local/world FX plumbing, preview motion, and an external MotionFrame interface.
- **Resolution**: Canvas output at 32, 64, 128, and 256 pixels per logical tile, independent atlas density, and optional supersampling.

## Important limits

Public item references are not complete wearable implementations. The catalog names renderer scripts for 317 items and exposes FX dependency flags, while the application loads detailed data separately through its sealed-data machinery ([public catalog](https://setplannergt.com/items.17c8f97f87.dat), [application loader](https://setplannergt.com/app.d5e8585e60.js)).

The included motion controller only demonstrates a flat floor. Exact collision, official movement timing, all script behavior, per-item punch ownership, pet AI, transformed bodies, weather integration, and official raster matching require more authorized evidence and implementation.

## Provenance and use

Research snapshot: October 17, 2026. Numeric reference facts are attributed inline in the research guide; no warranty of official-client correctness or rights to third-party assets is implied.

The code in `src/`, tests, and integration example were written for this handoff rather than copied wholesale from the inspected repositories. If you reuse third-party implementation code in your own product, review its actual license and attribution requirements first.
