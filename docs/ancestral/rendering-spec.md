# Growtopia Ancestral Artifacts — Rendering Specification

This document specifies how the Ancestral (artifact) auras are rendered, as
reconstructed from the Growtopia Set Planner (setplannergt.com). It is the
reference for `renderer.js`. Everything here is **planner-derived and
draw-call-verified** unless explicitly marked otherwise.

## 1. What an Ancestral is (rendering-wise)

When a player equips an Ancestral artifact, the game draws an animated aura
around the character. In the planner's data model each of the 30 items
(5 families x 6 levels) carries:

| Field | Meaning |
|---|---|
| `fx` | right-facing track set (the default recording) |
| `fxLeft` | left-facing track set (a **separate recording**, not a mirror) |
| `game` | "sparkle" moments (only levels 5-6 have real data) |
| `at`, `seed` | atlas cell + seed colors (for the inventory icon / swatches) |
| `box`, `gameIcon`, `clockOrbit`, `unturned`, `fxFacing`, `fxWorld` | metadata flags (see below) |

The three visual layers, drawn back to front:

1. **Sparkle** — a single pulsing glow (game moments), drawn *under* the fx.
2. **Streaks** — the family-colored rising flame particles (blend `1`, additive).
3. **Moons** — the white orbiting crescents (blend `2`, normal), levels 3+.

## 2. Coordinate space

All fx math happens in a 128x128 "avatar-local" canvas where the character's
feet anchor is at **(16, 32)** — `FX_ANCHOR = [16, 32]`. Track `x, y` values are
pixels *relative to that anchor* (negative y = up). The demo centers the
region with a base transform `[2, 0, 0, 2, 16, 32]` (scale 2, translate so the
anchor lands mid-canvas).

To place the aura on a real character in a game, replace the base transform
with your camera/cell matrix — everything else is unchanged.

## 3. Track format and sampling

```js
// one track:
{ blend: 1, keys: [[t, x, y, sx, sy, rot, r, g, b, a], ...], align: "a", ... }
```

* `keys` are keyframes sorted by time `t` (ms). Interpolation between
  keyframes is **linear** on every component (planner `fxAt`: binary-search the
  bracketing pair, lerp each field).
* `blend` 1 = streak (drawn with `globalCompositeOperation = "lighter"`),
  `blend` 2 = moon (`source-over`).
* `align` selects the anchor within the sprite cell via the `ALIGN` map
  (e.g. centered anchors are `[0.5, 0.5]`); the cell size comes from the
  sprite sheet (32x32 for `particles.png`).
* Streak cells all use `particles.png` cell (13, 12) = source (416, 384).
  Moon cells are family-specific: totem (8,13), tesseract (7,3),
  seed (7,13), lens (22,1), orb (6,5) — all on `particles.png`.

### Alive window / period wrap

A track's keys span `span = last_t - first_t` milliseconds, but the whole set
repeats with `data.period` (10000 ms right-facing, 4000 ms left-facing).
A track is alive at time `t` for every phase:

```js
for (let u = ((t - start) % period + period) % period; u <= span; u += period)
  entries.push(fxEntry(track, start + u));
```

The right set has 303 streak tracks staggered ~33 ms apart with ~693 ms spans,
so **~21 streaks are alive at any instant** (verified against live captures).
Moon counts are family- and level-specific — levels 3+ only, and 40 tracks
for totem/seed/orb vs 24 for tesseract/lens (left sets: 14 and 10), ~7
alive at once. The sparkle (game moments) only has real data at levels 5-6
(40 moments); levels 1-4 carry a single empty moment.

## 4. Entry matrix (the core formula)

For each alive track, sample the keyframe and build a 2D affine matrix:

```
m = T(16 + x, 32 + y) · R(rot) · S(sx, sy) · T(-align.x · cell, -align.y · cell)
```

That is: translate to the particle position, rotate, scale, then shift so the
sprite's anchor lands on that position. Implemented with column-major 6-tuples
`[a, b, c, d, e, f]` (matches `ctx.setTransform`), composed by `mul()`:

```js
mul(a, b) = [a0*b0+a2*b1, a1*b0+a3*b1, a0*b2+a2*b3, a1*b2+a3*b3,
             a0*b4+a2*b5+a4, a1*b4+a3*b5+a5]
```

To draw: `ctx.setTransform(...mul(base, m))` (compose first — setTransform
takes exactly 6 numbers), then
`ctx.drawImage(sheet, cellX, cellY, cellW, cellH, 0, 0, cellW, cellH)`.

## 5. Facing — the critical, verified behavior

* **Facing right** (default): use `fx` tracks, no extra transform.
* **Facing left**: use `fxLeft` tracks **drawn as-is — NO mirror**.

This was settled empirically, not by reading the (obfuscated) source: capture
every `drawImage` call the planner makes on its character canvas while
facing left (Playwright instrumentation, full matrix at draw time), derive
the viewport cell matrix from the sparkle/moon structure, and compare
against all four hypotheses (left/right data x mirrored/unmirrored). Only
**left data, unmirrored** fits: median error 0.010 px for streaks, 0.023 px
for moons (the other hypotheses are 5-100x worse). Independent
confirmation: the eyes sprite's x-scale sign (positive in right-facing
captures, negative in left-facing ones) matches the selected track set in
every capture.

The planner's `fxFacing: "other"` flag marks items that ship a distinct
left-facing recording — the ancestrals are all `"other"`.

### The coordinate contract (why no mirror is needed)

The planner, facing left, mirrors its whole character cell — the eye
sprite draws with matrix `Cleft = [-A, 0, 0, A, eEyes, fEyes]` — and
applies an entry-level mirror `M = [-1, 0, 0, 1, 32, 0]` (flip around
x = 16) to the fx entries. The two would compose:

```
Cleft · M = [A, 0, 0, A, eEyes - 32·A, fEyes]
```

i.e. a positive base times the fxLeft entries drawn as-is — which is what
the captures fit.

For the verified left capture (A = 4.5714, eEyes = 206.86): the fitted
e0 (60.58) equals eEyes - 32·A to 0.01 px, consistent with the composition
Cleft · M above. Caveat: this is a consistency check on the recorded eye
draw matrix and the fitted base (x-translation and scale), not a full
transform-chain log at the composition call site.

**Contract for `drawAncestral`: `base` must be a positive (unmirrored)
transform for both facings.** The renderer swaps track sets internally
and applies no mirror; that reproduces the planner's composed output
exactly. If your integration mirrors its character canvas for left-facing
(as the planner does), convert the base with `base = mul(C, M)` (compose
the mirror AFTER your base: the planner's final = Cleft · M · entry).

The left recording is *sparser* than the right (121 streaks vs 303,
14 moons vs 40) and runs on a shorter period (4000 ms vs 10000 ms). It is a
genuine re-recording, so the left aura looks different from the right aura,
not just flipped.

## 6. Sparkle (game moments)

Levels 5-6 carry 40 "game" moments (50 ms apart, 2000 ms period). The
sparkle is one pulsing, swinging glow drawn AFTER the fx (on top of the
streaks where they overlap — verified by frame-aligned captures):

* Position: `x = 16 + amplitude · sin(ω t)` — a horizontal pendulum
  (amplitude 24 px for the totem), `y` fixed per family (totem 6,
  tesseract 0, seed 16, lens 8, orb 6).
* Scale `k` oscillates; alpha `o` is 0.882 for totem/orb, 1.0 otherwise.
* Moments are interpolated with **50 ms steps** (planner `smoothMomentOf`):
  snap to the nearest moment grid point, then lerp — do not interpolate
  continuously across the raw keyframe times.
* Matrix: `m = T(x, y) · S(k) · T(-ax · sw, -ay · sh)` where `sw, sh` are the
  sprite size and `(ax, ay)` the anchor fraction.
* The sparkle is **unturned**: it does NOT change with facing (drawn the
  same for left and right). Verified in captures.

## 7. Tinting

Track keyframes carry `(r, g, b)` color. The tint is applied by pre-rendering
the sprite cell to an offscreen canvas:

1. `ctx.globalCompositeOperation = "multiply"`, fill with the color
   (each channel quantized to /8 steps — planner `quant`), draw the cell.
2. `ctx.globalCompositeOperation = "destination-in"`, draw the cell again
   (restores the alpha mask).

Cache the tinted cells (key = cell + color) — the same color repeats for
every draw of a track. Family colors: totem golden (255,191,2), tesseract
blue (51,153,255), seed green (25,255,25), lens red (216,25,12), orb magenta
(255,25,255). Moons are white (255,255,255) — tinted per-track keyframes.

## 8. Draw order

`drawAncestral(ctx, level, t, {facing, sheets, base})`:

1. All fx entries in track order (streaks and moons interleaved as the
   data orders them): streaks (blend 1) with
   `globalCompositeOperation = "lighter"` (additive — this is what makes
   the flames glow), moons (blend 2) with `source-over`.
2. Sparkle last (if the level has game data): alpha `o`, `source-over` —
   ON TOP of the streaks where they overlap (frame-aligned captures show
   the planner's sparkle draw follows the last fx draw in every frame).
3. Restore state.

The capture records show the fx draws and then the sparkle within each
eyes-to-eyes interval; that establishes the fx-then-sparkle relative order
observed in these captures, not a general avatar-layering contract (the
intervals were not independently identified as frame starts).

## 9. Icon helpers

* `drawArtifactIcon(ctx, level, sheets)` — draws the in-inventory item
  sprite from `player_artifact.png` (per `level.atlas`) using `level.box`.
* `seedColors(level)` — the two seed swatch colors (hex).

## 10. Verification summary (all live-capture based)

Method: Playwright-driven canvas instrumentation of the planner. Every
`drawImage` on the planner's character canvas is recorded with its full
matrix at draw time. The first captures (right- and left-facing) recorded
the matrix cached from the last `setTransform`; a later validation capture
re-recorded with `ctx.getTransform()` inside the hook and confirmed the two
agree on every draw, with zero interleaved `transform`/`scale`/`translate`
calls — so no transform is missed by the cached-matrix method. The
viewport cell matrix is derived from each capture's own structure (sparkle
anchor regression + moon scales), then captured draws are tested against
the renderer's interpolated track paths (chebyshev distance in local px).

All fx checks below are on **Totem of Wisdom L5** (item 5132).

### Selected-frame, fitted-phase matrix comparison (strongest check)

Single eyes-to-eyes intervals were extracted from settled captures (the
once-per-interval eyes draw; 238 intervals in the left capture). For each,
the animation phase t0 was fitted so the renderer's entries at t0 match
the interval's draws, then the draw sequences were compared (count, order
within each category — streaks and moons were compared separately, not as
one interleaved sequence — and all 6 matrix components of fxEntries()
output; alpha/tint/blend/source cells and the full drawAncestral() output
were not part of this comparison):

| Interval | Draws | Streaks worst | Moons worst | Order (per category) |
|---|---|---|---|---|
| LEFT #100 | 21 streaks + 8 moons | 0.048 px | 0.085 px | MATCHES |
| LEFT #150 | 21 + 9 | 0.033 px | 0.117 px | MATCHES |
| LEFT #200 | 21 + 6 | 0.030 px | 0.107 px | MATCHES |
| RIGHT #150 | 21 + 8 | 0.010 px | 0.027 px | MATCHES |
| RIGHT #250 | 21 + 8 | 0.012 px | 0.022 px | MATCHES |

Sparkle at the shared phase: RIGHT #150 0.017 px and RIGHT #250 0.024 px
match; LEFT #150 0.073 px matches. UNRESOLVED: LEFT #100 differs by
1.214 px and LEFT #200 by 0.529 px at the fitted fx phase — the sparkle
phase relationship is not fully explained (stepped 50 ms interpolation
may contribute, but this is not demonstrated). Consecutive intervals'
fitted phases advance ~16.7-17.3 ms, consistent with the browser frame
rate. Caveat: t0 is fitted per interval (one degree of freedom); the
constraint being verified is that all ~30 draws of an interval match one
shared phase, per category in order, with sub-0.12 px matrices. This
check caught and fixed a real bug: the sparkle draws AFTER the fx, not
before (see §8).

| Check | Result |
|---|---|
| Right-facing streaks (3 s capture) | 3778/3778 draws on renderer paths, median 0.005 px |
| Right-facing moons | median 0.005 px |
| Right-facing 12.5 s capture (spans the 10 s period) | median 0.008 px, max 0.084 px |
| Left-facing streaks (4 s capture) | 5019/5019 draws (full population, no subsampling) on renderer paths — 2D trajectory proximity with scale-bucketed candidates: median 0.004 px, p95 0.016 px, max 0.091 px (this check's worst draw; not a bound on moons or other properties) |
| Left-facing moons | median 0.023 px |
| Left-facing hypothesis test | left-unmirrored fits 5-100x better than left-mirrored / right-unmirrored / right-mirrored |
| Coordinate composition | fitted base consistent with planner mirrored-cell x entry-mirror (Cleft·M) to 0.01 px in x-translation (see §5) |
| Facing indicator (eyes sprite x-scale) | right-facing captures positive, left-facing captures negative — consistent with the track-set selection in every capture |
| Alive counts | streaks ~21 and moons ~7 per frame in both facings — consistent with capture rates (counts estimated from capture duration at the browser frame rate, not frame-matched) |
| End-to-end set match (renderer run in Node vs capture) | captured draws found in renderer: streaks 98.9-99.9%, moons 81.9-94.6% — inconclusive at that check's tolerance; the trajectory checks above are the strongest evidence, but they cover position/scale path membership only, not synchronized rendering |
| Sparkle anchor structure | exact (regression slope -32 vs predicted -32) |
| All 30 items x 2 facings | renderer entry-generation checks: finite matrices, valid entries, expected counts (moons appear at L3, sparkle moments at L5) — not visual verification of every item |
| Data export | round-trip comparison against the decrypted source records (lossless) |

Fidelity claim (status): **provisional stationary aura renderer covering
all 30 items. All items pass entry-generation checks; selected Totem L5
frames show fitted-phase agreement for streak and moon matrices.**
Recorded-trajectory checks: every captured planner draw lies on this
renderer's interpolated track paths (median 0.004-0.023 px; the full
left-streak positional check's worst draw is 0.091 px). Selected intervals
match in count, per-category order, and matrices (streaks < 0.05 px,
moons < 0.12 px). Alive counts are consistent with the captures.
What these checks do NOT prove: full-frame parity (combined order, alpha,
tint, blend, source cells of a complete drawAncestral() output), the
sparkle phase on two left-facing intervals (unresolved, above),
pixel-level alpha/tint rounding, and any item other than Totem L5 at the
frame level (the other 29 items pass entry-generation checks and share the
data pipeline).

### Movement-aware mode (verified)

The planner's `fxWorld` machinery anchors each particle to the position
where the character **stood when that particle instance was born**. This
package implements it: pass a `motion` object to `drawAncestral()` (or
`fxEntries(level, t, facing, motion)`):

```
motion = {
  x, y,    // current position, fx-local px (eyes anchor: y = eyesPy/A)
  facing,  // current facing (1 / -1)
  path,    // [[t, x, y, facing], ...] one sample per frame, last ~6000 ms
}
```

Per-instance behavior (matches the planner's drawFx movement branch):

1. **Side filter** — the character's facing *at birth* (path step lookup,
  latest sample <= birth) decides which track set the instance belongs to:
  left tracks only if the character faced left when the instance started.
  Both right+left sets are combined with their own loop periods
  (10,000 ms right / 4,000 ms left).
2. **World offset** — every entry is shifted by
  `T(birthX − charX, birthY − charY)`.

**Why no facing sign on dx:** the planner composes
`eR = T(a)·eB·T(−a)` with
`eB = [eE, 0, 0, 1, eE·(birthX − charX), birthY − charY]`
(eE = current facing). The eE on eB's x-scale cancels the eE on its
x-translation through the anchor normalization (and, for left-facing
cells, the entry mirror M), so in this renderer's positive-base contract
the net effect is a plain translation `T(dx, dy)` for BOTH facings.
Confirmed against a live planner capture: pre-fix, the captured draws
differed from the output by exactly 2× the birth offset during a left
walk; post-fix the left walk fits to 0.2–1.7 px.

**Physics (demo only):** the demo's character uses the planner's movement
constants — walk speed 250 px/s, accel 1200, ground friction 1200, gravity
1000, jump 450, fall cap 400, plus RISE_EXTRA 5000: a *jump-cut* (extra
downward gravity while rising without the jump key held — short taps give
short hops) — in fx-local pixels (the world grid is 7×32 px wide, matching
the planner's world exactly).

**Verification (capture `cap10`, 544 frames):** a scripted walk-right,
wall-jump, walk-left sequence was captured from the live planner with
every canvas draw recorded, then replayed through this renderer with a
per-frame fitted fx clock. The objective is the per-category P-spread:
with captured draws order-paired to renderer entries, `captured ·
inv(mine)` must give the same cell transform P for every draw in a
category; separate median cells are fitted for streaks and moons, and the
reported spread is the max deviation from each category's median (a strong
per-draw check, though it does not by itself establish complete-frame
parity or that both categories share one common cell). Results
(median / worst, px):

| phase (facing) | n  | median | worst |
|---------------|----|--------|------|
| stand right   | 204| 0.12   | 27.5*|
| walk right    | 29 | 0.12   | 1.4  |
| air right     | 85 | 0.24   | 27.6*|
| stand left    | 166| 0.04   | 1.5  |
| walk left     | 30 | 0.14   | 1.7  |
| air left      | 28 | 0.65   | 1.8  |

501 of 542 scored frames fit under 2 px (543 frames evaluated; one had
no count-matching fit — see below). The fitted fx clock is monotonic
(0 violations).

\* One unresolved residual instance explains every frame above 5 px: a
single streak (track@1683, born fx 11683.0 during a jump rise) is
offset by 6 px in y across its 693 ms lifetime (frames 177–217). Its
birth frame (176, wall 2939, y 59) is exactly the one frame whose fit
failed — the capture holds 22 streaks there versus the renderer's 21,
so the harness could not fit its fx time, and that sample's timestamp in
later reconstructed paths is a linear fallback (fx 11686.05, 3.05 ms
after the birth). The capture implies the planner's path lookup
returned y 59 for the birth — consistent with the birth frame's true
fx time being at or before fx 11683.0, which the fallback timestamp
cannot confirm or refute. The cause is unresolved; a plausible
contributor is this failed-fit frame's reconstructed timestamp, but
that has not been independently established, and no claim of full
planner parity is made from this capture beyond the scored frames.

The remaining "not proven" items: the sparkle phase on two left-facing
intervals (unresolved, above), pixel-level alpha/tint rounding, and other
items at the frame level (the other 29 items share the pipeline and pass
entry-generation checks).

## 11. Attribution

Assets and data are property of Ubisoft / Robinson Technologies (Growtopia).
They were extracted from the Set Planner (setplannergt.com) for
interoperability research. The rendering code here is an independent
reimplementation. Research gaps (not covered by planner evidence):
in-game render specifics outside the planner (e.g., exact in-game draw
order vs other auras) — the planner is the sole verified source.

## 12. Sources

- Set Planner GT — https://setplannergt.com (live instrumentation; item
  pages e.g. https://setplannergt.com/item/ancestral-tesseract-of-dimensions-level-4)
- Growtopia Wiki — https://growtopia.fandom.com/wiki/Ancestral_Totem_of_Wisdom
  and sibling family pages (system facts, see docs/system.md)
