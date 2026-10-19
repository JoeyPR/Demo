# Animation, sprite effects, and floating revision

The previous revision exposed the catalog but did not faithfully animate many records. A finite draw matrix and a present texture file are not sufficient evidence of correct rendering; this pass addresses frame-cell selection, split rows, additive sprite effects, texture edge sampling, and source-supported float.

## Input reconciliation

The two files received in this turn were `setplanner_items_decoded.json` and `items.txt`; no separate `app.js` attachment arrived. The supplied JSON contains 4,067 wearables, and the supplied native text file declares version 26 with 16,434 item rows; all 4,081 records from the newer public catalog join to the supplied native text by ID, so the active wardrobe was not downgraded to the older snapshot ([active public catalog](https://setplannergt.com/items.17c8f97f87.dat)).

The app source used remains the previously inspected public `app.d5e8585e60.js`, with its statically decoded snapshot; the current homepage still identifies that bundle ([homepage](https://setplannergt.com/), [bundle](https://setplannergt.com/app.d5e8585e60.js)).

Native text is parsed as delimited data, never evaluated as code. Renderer configuration names, punch options, extra options and texture references are joined for dependency tracking, not misrepresented as the contents of the renderer or emitter scripts.

## Root causes and changes

- **Captured phase versus frame origin**: A captured still can show frame 6 of an eight-frame sequence. Treating that capture coordinate as a permanent offset adds six cells to every later frame and can sample beyond the sheet; the adapter now finds the corresponding source cell before deriving the local offset ([catalog cell/frame metadata](https://setplannergt.com/items.17c8f97f87.dat)).
- **64×64 split geometry**: Public icon records can use separate upper/lower 64-pixel rows that do not both fit inside the first part's rectangle; same-atlas sequence binding now retains each row offset and full 64×64 dimensions instead of leaving one row frozen or shrinking it to a 32-pixel cell ([Morty and other catalog records](https://setplannergt.com/items.17c8f97f87.dat)).
- **Fallback origin and stacked cells**: Public part `at` positions are top-left draw positions, while `cell[2]` describes stacked rows rendered into the same destination; fallback records now use top-left anchors and keep those rows separate ([`drawPlainParts`](https://setplannergt.com/app.d5e8585e60.js)).
- **Clock-driven sprites**: `clockFrames` can independently select sprite cells and opacity pulses, including public aura records; their timebase must not be replaced by an unrelated first-part animation ([`clockCells`](https://setplannergt.com/app.d5e8585e60.js)).
- **Additive blending**: Captured `add` was dropped by the reference command conversion, suppressing glow; it now reaches Canvas `lighter` blending, and captured smoothing hints reach the rasterizer ([renderer material handling](https://setplannergt.com/app.d5e8585e60.js)).
- **Public flicker and pulse**: The public part renderer supports fluctuating scale, alpha and blend flags, plus separate x/y pulse periods; those descriptions are now sampled rather than frozen in the icon's captured appearance ([`drawPlainParts`](https://setplannergt.com/app.d5e8585e60.js)).
- **Explicit orbit particles**: Pineapple Chakram has a public three-orbit descriptor with radius, phase, scale and sprite cells, and source arithmetic for its 2,500 ms trajectory and 200 ms frame clock; it now draws in body space with front/back occlusion instead of following the held-item wrist ([catalog descriptor](https://setplannergt.com/items.17c8f97f87.dat), [`chakramCells`](https://setplannergt.com/app.d5e8585e60.js)).
- **Texture edge semantics**: For right/bottom-overflow crops, the inspected source's sampler clamps player samples and wraps pet samples; an ordinary Canvas crop would clip away pixels. The new sampler matches that behavior and preserves the source's separate negative-only clipping behavior ([`Y6` sampler](https://setplannergt.com/app.d5e8585e60.js)).
- **Float timebase**: The source's default lift helper uses a one-second sine term for multiple item families, not the prototype's arbitrary two-second manual bob; eligible item profiles now apply automatically with that source-derived period ([lift helper and `playerLift`](https://setplannergt.com/app.d5e8585e60.js)).

Atlas acquisition now uses the public homepage's per-file `ATLAS_V` query hashes rather than assuming an unversioned response belongs to the current catalog ([version map](https://setplannergt.com/)).

## Float evidence and integration

An isolated, reviewed arithmetic function was evaluated without bootstrapping the application, accessing storage, executing a loader or fetching protected payloads. All 4,081 public wearables were probed individually in the helper's default actor state; 164 nonzero profiles fit a constant plus float32 sine, and 148 were not contradicted by their captured still lift, including 50 dynamic profiles.

The 16 contradictory profiles remain disabled. A still-offset consistency check can reject a profile, but cannot prove complete runtime semantics, arbitrary combinations, air states, script options, or exact official-client parity.

For the common profile family:

\[
y(t)=\operatorname{f32}\left(b+a\,\operatorname{f32}
\left(\sin\left(2\pi\,\operatorname{f32}
\left(\frac{\operatorname{trunc}(t)\bmod1000}{1000}\right)\right)\right)\right)
\]

The numeric base and amplitude are item-specific, not a universal replacement for every hovering item's script. For example, the isolated source returns base −5/amplitude 2 for Ring of Winds #1876 and base −8/amplitude 1 for Riding Cloud #11168 ([source lift arithmetic](https://setplannergt.com/app.d5e8585e60.js)).

```js
const catalog = await loadDecodedPlannerCatalog();
const liftEvidence = await loadJSON("./evidence/lift-profiles.json");
catalog.liftProfiles = Object.fromEntries(
  liftEvidence.profiles.map(profile => [profile.id, profile])
);

const equipped = rawEquipment.map(raw => normalizeCatalogItem(raw, catalog));
const player = new PlannerPlayer(catalog, equipped);

function update(frame, dtMs) {
  // Player.step advances normalized catalog items with this same frame.
  const result = player.step(frame, dtMs, {skin: selectedSkin});
  // Float is automatic. Do not add a second generic bob on top.
  // result.lift exposes owner, evidence, profile and combination limits.
  render(result.calls);
}
```

`loadDecodedPlannerCatalog`, `loadJSON` and `render` above are host adapters, not additional recovered native functions. The manual UI override is now named “Force generic float,” runs on a one-second cycle, and stays off by default.

For a supported floating vehicle profile, rider and vehicle/seat geometry now share the complete root lift, including its base. See STATE_ROUTING_REVISION.md; the earlier delta-only rule left an incorrect static separation.

## What “FX supported” means here

Public sprite frame cycles, additive materials, public flicker/pulse descriptions, and the explicit Pineapple Chakram orbit are implemented in this revision. Flicker uses a deterministic per-item/per-frame random surrogate with the published parameter range; matching that distribution is not matching the original random seed or every original frame.

`fx:1`, `punchFx:1`, and `airJumpFx:1` only indicate external dependencies. Those flags do not encode particle count, spawn interval, velocity, lifetime, collision, trails, render pass, attachment owner or animation clips, so the implementation does not invent those values and claim correctness ([public flags](https://setplannergt.com/items.17c8f97f87.dat)).

Similarly, `clockOrbit` lists identify which captured sprite groups keep an independent orbit clock, not their missing trajectory samples; they are not enough to reconstruct every orbit from one still ([source movement-record handling](https://setplannergt.com/app.d5e8585e60.js)).

## Remaining blockers

- **Modern native scripts**: Cumulus, CyberCycle, JusticeLens and SelfBalancingScooter are present as native renderer XML filenames in the inspected depot listing, but a filename is not the file body or its dependent images/effects ([SteamDB file inventory](https://steamdb.info/depot/866021/)).
- **Acquisition**: Public guessed renderer/FX endpoints returned errors, while official website/download access returned 403 in this environment. No session protections were bypassed; no installer or unknown binary was executed.
- **Mounted clips and hands**: State-specific mount travel/air/punch clips, authored arm ownership and after-punch recovery still require the actual movement descriptors or authorized captures. Static neutral arms remain explicitly labeled fallback.
- **Combination behavior**: The numeric float profiles represent single-item/default-state arithmetic. Multiple simultaneous lift-affecting items are flagged as unverified; they are not silently treated as additive native effects.
- **Script-heavy bodies and companions**: Native body replacements, collision-aware pets, special clothing suppression and particle emitters are not recovered just because the wardrobe can draw their captured artwork.

The private-server projects inspected remain useful for native metadata and network state, not client frame curves; their protocol fields do not solve these missing client assets ([GrowServer](https://github.com/StileDevs/GrowServer), [GTopia serializer](https://raw.githubusercontent.com/keichira/GTopia/main/Source/Item/ItemInfo.cpp)).

For the next exact reconstruction pass, supply an authorized copy of the relevant `GameData/ItemRenderers/*.xml` files plus the script/effect dependencies they reference, or synchronized in-game captures for named items. If a newer local `app.js` was intended as an attachment, attach it separately; this turn received only JSON and text.

## Verification, without inflating scope

The new lift adapter is compared against 2,072 changed-input results from the isolated source function, using 14 timestamps for each of 148 eligible profiles. Five synthetic pixel fixtures compare edge clamping, pet wrapping and negative-only clipping against the isolated source sampler.

Browser checks exercise actual mounted stills, both 64×64 Morty rows, additive Golden Aura, automatic Ring of Winds float with the manual override off, and output dimensions at all supported resolutions. Existing geometry checks remain useful, but neither these checks nor the source comparisons establish official-client visual parity for all equipment combinations.

Raw REA Evidence for the reviewed source function was saved before summarizing. The shipped evidence summary records the pinned REA version and source-assisted scope; full third-party application code is not included in the code archive.
