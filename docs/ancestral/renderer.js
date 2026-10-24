/**
 * Growtopia Ancestral Artifacts — FX renderer
 * ============================================
 *
 * Faithful reimplementation of the fx track engine used by the Growtopia
 * Set Planner (setplannergt.com), reverse-engineered from its obfuscated
 * app.js and verified against live draw-call captures.
 *
 * How an Ancestral renders (per frame, at time t ms):
 *
 *   1. SPARKLE (Level 5-6 only)  — a small orb that pendulums horizontally
 *      around the character's chest, defined by "game moments" (keyframes
 *      every 50 ms, period 2000 ms). Level 1-4 game moments are EMPTY —
 *      no sparkle.
 *
 *   2. FX TRACKS — two kinds of keyframed particle tracks:
 *        • streaks (blend 1): rising additive sparkles (303 tracks)
 *        • moons   (blend 2): rotating orbiting sprites (24-40 tracks,
 *                             Level 3+ only, one per family)
 *      Every track is a list of keys [t, x, y, sx, sy, rot, r, g, b, a],
 *      LINEARLY interpolated, replayed on a 10 s loop (4 s for left-facing
 *      data). Colors are quantized to steps of 8 (0-255). Streaks use
 *      'lighter' (additive) compositing, moons normal compositing.
 *
 *   3. The artifact sprite (player_artifact.png) is NOT drawn on the
 *      character — the planner renders only sparkle + fx for worn
 *      ancestrals (verified by canvas dumps). Use drawArtifactIcon() if
 *      you want the in-inventory look.
 *
 * Coordinate space: a 128x128 "avatar-local" canvas. fx track (x, y) are
 * pixels relative to the fx anchor (16, 32) — the character's feet/chest.
 * Facing left swaps in the separately-recorded fxLeft tracks, drawn AS-IS
 * (fxFacing "other" = a distinct left recording, no mirroring — verified
 * against live draw-call captures). The sparkle never mirrors (unturned).
 *
 * Requires the sheets: particles.png, particles2.png, tiles_page1.png
 * (and player_artifact.png for the icon helper).
 */

/* ------------------------------------------------------------------ */
/* Matrix helpers (2x3 affine, same layout as canvas setTransform)      */
/* ------------------------------------------------------------------ */

const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const translate = (x, y) => [1, 0, 0, 1, x, y];
const scale = (x, y) => [x, 0, 0, y, 0, 0];
const rotateDeg = (deg) => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
};

/** Cell alignment anchors (planner's G8 map). */
const ALIGN = {
  0: [0, 0], 1: [0.5, 0.5], 2: [0.5, 1], 3: [1, 0], 4: [0, 1],
  5: [0.5, 0], 6: [0, 0.5], 7: [1, 1], 8: [1, 0.5],
};

/** fx anchor: all fx track positions are relative to this point (chest). */
const FX_ANCHOR = [16, 32];

/** Quantize a 0-255 color channel to steps of 8 (planner behavior). */
const quant = (v) => Math.min(255, Math.round(v / 8) * 8);

/* ------------------------------------------------------------------ */
/* Key sampling (planner's fxAt binary search + linear interpolation)   */
/* ------------------------------------------------------------------ */

/**
 * Interpolate a track's keys at time c.
 * Returns {x, y, sx, sy, rot, r, g, b, a} or null if outside key range.
 */
export function sampleKeys(keys, c) {
  let lo = 0, hi = Math.max(0, keys.length - 2);
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid + 1][0] < c) lo = mid + 1; else hi = mid;
  }
  const P = keys[lo], d = keys[Math.min(lo + 1, keys.length - 1)];
  const b = d[0] > P[0] ? Math.min(1, Math.max(0, (c - P[0]) / (d[0] - P[0]))) : 0;
  const o = (i) => P[i] + (d[i] - P[i]) * b;
  return { x: o(1), y: o(2), sx: o(3), sy: o(4), rot: o(5), r: o(6), g: o(7), b: o(8), a: o(9) };
}

/* ------------------------------------------------------------------ */
/* FX entries — turn tracks at time t into drawable entries            */
/* ------------------------------------------------------------------ */

/**
 * Build the draw entries for one item's fx at time t.
 * facing: 1 = right (default), -1 = left (swaps in the fxLeft data, drawn as-is).
 * motion (optional, movement-aware mode): { x, y, facing, path }
 *   - x, y: the character's CURRENT position in fx-local pixel units
 *     (feet anchor: standing on flat ground = y 32).
 *   - facing: current facing (usually the same as `facing`).
 *   - path: [[t, x, y, facing], ...] — the character's recorded motion
 *     history (one sample per frame, pruned to the last ~6000 ms; see
 *     the planner's path recording). Used for BIRTH-position anchoring:
 *     each particle instance is offset by its birth position minus the
 *     current position (so the trail stays where it was born) and
 *     left/right track sets are chosen by the facing AT BIRTH.
 *   When motion is provided and the level has fxWorld (all ancestrals do),
 *   the combined right+left track sets are used with per-side periods.
 * Returns [{ sheet, sx, sy, sw, sh, m, alpha, add, tint }]
 */
export function fxEntries(level, t, facing = 1, motion = null) {
  const useLeft = facing < 0 && level.fxLeft && level.fxLeft.tracks.length;
  const data = useLeft ? level.fxLeft : level.fx;
  const world = !!(motion && motion.path && motion.path.length && level.fxWorld);
  const entries = [];

  // Movement mode: combined right+left tracks (planner's eM branch).
  const leftSet = level.fxLeft && level.fxLeft.tracks.length ? level.fxLeft : null;
  const tracks = world && leftSet
    ? [...level.fx.tracks, ...leftSet.tracks]
    : data.tracks;
  const leftTracks = world && leftSet ? new Set(leftSet.tracks) : null;

  for (const track of tracks) {
    const isLeft = leftTracks ? leftTracks.has(track) : !useLeft ? false : true;
    // per-side period in movement mode (planner's ea)
    const period = world
      ? (isLeft ? (leftSet.period ?? level.fx.period) : level.fx.period)
      : data.period;
    const keys = track.keys;
    const start = keys[0][0];
    const span = keys[keys.length - 1][0] - start;
    // The track repeats every `period`; keys may span longer than one
    // period, so the same track can be alive more than once.
    for (let u = ((t - start) % period + period) % period; u <= span; u += period) {
      const birth = t - u; // when this instance started (planner's em)
      if (world) {
        // side filter: left entries only if the character faced left at
        // BIRTH; right entries only if it faced right (planner's el check)
        const p = pathAt(motion.path, birth);
        if ((p[3] < 0) !== isLeft) continue;
        // world-anchor offset: shift by (birth position - current position).
        // The planner's eB carries the facing sign eE on BOTH the x-scale and
        // the x-translation; composed with the anchor normalization (and, when
        // facing left, the entry mirror M), both eE factors cancel into a
        // plain translation T(dx, dy) in this renderer's positive-base
        // contract — verified against live left-walk captures (the captured
        // draws differ from the pre-fix output by exactly 2*offset).
        entries.push(fxEntry(track, start + u, [
          1, 0, 0, 1, p[1] - motion.x, p[2] - motion.y,
        ]));
      } else {
        entries.push(fxEntry(track, start + u));
      }
    }
  }

  // NOTE: no mirror here. Facing left, the planner's captures are
  // consistent with a mirrored character cell composed with an entry-level
  // mirror M = [-1,0,0,1,32,0] (Cleft·M fits our positive base to 0.01 px
  // in x-translation — a consistency check, not a logged transform chain;
  // see docs/rendering-spec.md §5). Contract: callers pass a positive
  // (unmirrored) base for both facings; to adapt a mirrored base C, pass
  // mul(C, M).
  return entries;
}

/**
 * Latest path sample with time <= t, or the first sample if t is before
 * all of them (the planner's S0 — step lookup, no interpolation).
 */
export function pathAt(path, t) {
  if (!path || !path.length) return null;
  if (path[0][0] > t) return path[0];
  let lo = 0, hi = path.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (path[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return path[lo];
}

/** One track sampled at time c -> one drawable entry (planner's fxAt).
 * offset: optional affine applied on top of the entry matrix (the planner's
 * world-anchor eR, mul(eR, m)) — used in movement mode. */
function fxEntry(track, c, offset) {
  const s = sampleKeys(track.keys, c);
  const [cellW, cellH] = track.cell ?? [32, 32];
  // cell selection: last "cells" entry whose time <= c  ->  [t, cx, cy]
  let cell = track.cells[0];
  for (const ce of track.cells) { if (ce[0] > c) break; cell = ce; }
  const [cx, cy] = [cell[1], cell[2]];

  const align = ALIGN[track.align] ?? [0, 0];
  const fx = track.flip ?? [0, 0];
  const scaleX = s.sx * (fx[0] ? -1 : 1);
  const scaleY = s.sy * (fx[1] ? -1 : 1);
  const alignT = translate(
    -(fx[0] ? 1 - align[0] : align[0]) * cellW,
    -(fx[1] ? 1 - align[1] : align[1]) * cellH
  );

  let m = mul(
    translate(FX_ANCHOR[0] + s.x, FX_ANCHOR[1] + s.y),
    mul(rotateDeg(s.rot), mul(scale(scaleX, scaleY), alignT))
  );
  if (offset) m = mul(offset, m);

  const r = quant(s.r), g = quant(s.g), b = quant(s.b);
  return {
    sheet: track.sheet.replace(/\.rttex$/, '.png'),
    sx: cx * cellW, sy: cy * cellH, sw: cellW, sh: cellH,
    m, alpha: s.a / 255,
    add: track.blend === 1,
    tint: r === 255 && g === 255 && b === 255 ? null : [r, g, b],
    smooth: track.smooth === 1,
  };
}

/* ------------------------------------------------------------------ */
/* Sparkle — game moments with 50 ms smoothing (planner smoothMomentOf) */
/* ------------------------------------------------------------------ */

/**
 * Interpolate the "game" moments at time t. Returns the current cell
 * list (each cell has a, sx, sy, sw, sh, x, y, ax, ay, k, o, ...).
 * Level 1-4 have a single empty moment -> no sparkle.
 */
export function sparkleCells(level, t) {
  const game = level.game;
  const moments = game?.moments;
  if (!moments?.length) return [];
  const period = game.period;
  if (!period || moments.length < 2) return moments[0][1];

  const w = t % period;
  let gi = 0;
  for (let v = 0; v < moments.length; v++) { if (moments[v][0] > w) break; gi = v; }
  const [t0, cells] = moments[gi];
  const t1 = gi + 1 < moments.length ? moments[gi + 1][0] : period;
  const next = moments[(gi + 1) % moments.length][1];
  const step = game.step ?? 50;
  const hold = Math.max(t0, t1 - step);
  const x = (w - hold) / Math.max(1, t1 - hold);
  if (x <= 0) return cells;

  // Match cells between the two moments and interpolate x, y, k, r.
  const used = new Set();
  const out = cells.map((d) => {
    let o = next.find((n, i) => !used.has(i) && n.a === d.a &&
      Math.abs(n.x - d.x) <= 24 && Math.abs(n.y - d.y) <= 24 &&
      Math.abs((((n.r ?? 0) - (d.r ?? 0)) % 360 + 540) % 360 - 180) < 90);
    if (!o) return d;
    used.add(next.indexOf(o));
    const f = (a, b2) => a + (b2 - a) * x;
    const cell = { ...d, x: f(d.x, o.x), y: f(d.y, o.y) };
    if (d.k && o.k) cell.k = [f(d.k[0], o.k[0]), f(d.k[1], o.k[1])];
    if (d.r !== undefined && o.r !== undefined) {
      const dr = (((o.r - d.r) % 360) + 540) % 360 - 180;
      if (Math.abs(dr) < 90) cell.r = d.r + dr * x;
    }
    return cell;
  });
  return out;
}

/** One sparkle cell -> draw entry (planner's P0 transform). */
export function sparkleEntries(level, t) {
  return sparkleCells(level, t)
    .filter((c) => c.a)
    .map((c) => {
      const [kx, ky] = c.k ?? [1, 1];
      const m = mul(translate(c.x, c.y),
                   mul(scale(kx, ky), translate(-c.ax * c.sw, -c.ay * c.sh)));
      return {
        sheet: c.a, sx: c.sx, sy: c.sy, sw: c.sw, sh: c.sh,
        m, alpha: c.o ?? 1, add: false, tint: c.t ?? null, smooth: c.sm,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Tinted bitmap cache (planner: multiply + destination-in)             */
/* ------------------------------------------------------------------ */

export class TintCache {
  constructor() { this.map = new Map(); this.sheetIds = new WeakMap(); this.nextSheetId = 1; }

  /* stable id per sheet image — `${sheet}` alone stringifies every Image the
     same way ("[object HTMLImageElement]"), so different sprites' cells
     collided on one cache key and returned each other's bitmaps */
  sheetId(sheet) {
    let id = this.sheetIds.get(sheet);
    if (id === undefined) { id = this.nextSheetId++; this.sheetIds.set(sheet, id); }
    return id;
  }

  /** Get (or build) the cell bitmap tinted with [r,g,b]. */
  get(sheet, sx, sy, sw, sh, tint) {
    const key = `${this.sheetId(sheet)}|${sx},${sy},${sw},${sh}|${tint ? tint.join(',') : ''}`;
    let c = this.map.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      const x = c.getContext('2d');
      x.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
      if (tint) {
        x.globalCompositeOperation = 'multiply';
        x.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
        x.fillRect(0, 0, sw, sh);
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
      }
      this.map.set(key, c);
    }
    return c;
  }
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Draw one ancestral level at time t onto ctx.
 *
 * opts:
 *   sheets    { 'particles.png': Image, ... }   (required)
 *   tint      TintCache                          (optional, auto-created)
 *   facing    1 | -1                              (default 1)
 *   base      [a,b,c,d,e,f] matrix: avatar-local -> canvas (default identity)
 *   sparkle   bool — draw the L5/L6 sparkle (default true)
 *   motion    { x, y, facing, path } — movement-aware mode (see fxEntries):
 *             particles anchor to their birth positions and track sets
 *             are chosen by the facing at birth. `base` must place the
 *             fx anchor (16,32) at the character's CURRENT position.
 */
export function drawAncestral(ctx, level, t, opts = {}) {
  const sheets = opts.sheets;
  const tint = opts.tint ?? new TintCache();
  const facing = opts.facing ?? 1;
  const base = opts.base ?? [1, 0, 0, 1, 0, 0];
  /* depth layer: the orbiting moons circle AROUND the player — entries in the
     top half of their orbit (entry y above the orbit midpoint ~14, chest
     height in the fx-local frame where the feet sit at y=32) pass BEHIND the
     player; callers render 'behind' before the avatar and 'front' after it.
     Sparkles always render in front. */
  const layer = opts.layer ?? null;
  const BEHIND_Y = 14;

  // FX tracks first; the sparkle is drawn AFTER the fx (verified by
  // frame-aligned capture: the planner's sparkle draw follows the last
  // fx draw in every frame).
  for (const e of fxEntries(level, t, facing, opts.motion ?? null)) {
    if (layer === 'behind' && !(e.m[5] < BEHIND_Y)) continue;
    if (layer === 'front' && e.m[5] < BEHIND_Y) continue;
    const img = sheets[e.sheet];
    if (!img) continue;
    const bmp = tint.get(img, e.sx, e.sy, e.sw, e.sh, e.tint);
    ctx.save();
    ctx.setTransform(...mul(base, e.m));
    ctx.globalAlpha = e.alpha;
    ctx.globalCompositeOperation = e.add ? 'lighter' : 'source-over';
    ctx.imageSmoothingEnabled = e.smooth !== false;
    ctx.drawImage(bmp, 0, 0);
    ctx.restore();
  }

  if (opts.sparkle !== false && layer !== 'behind') {
    for (const e of sparkleEntries(level, t)) {
      const img = sheets[e.sheet];
      if (!img) continue;
      const bmp = tint.get(img, e.sx, e.sy, e.sw, e.sh, e.tint);
      ctx.save();
      ctx.setTransform(...mul(base, e.m));
      ctx.globalAlpha = e.alpha;
      ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = e.smooth !== false;
      ctx.drawImage(bmp, 0, 0);
      ctx.restore();
    }
  }
}

/**
 * Draw the artifact's inventory icon (player_artifact.png cell).
 * level.atlas = { sheet, x, y }; level.box = [bx, by, bw, bh] within the
 * 32x32 cell. The planner does NOT draw this on the character.
 */
export function drawArtifactIcon(ctx, level, sheets, opts = {}) {
  const img = sheets[level.atlas.sheet];
  if (!img) return;
  const [bx, by, bw, bh] = level.box;
  const base = opts.base ?? [1, 0, 0, 1, 0, 0];
  ctx.save();
  ctx.setTransform(...base);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img,
    level.atlas.x * 32 + bx, level.atlas.y * 32 + by, bw, bh,
    -16, -16, 32, 32);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Misc                                                               */
/* ------------------------------------------------------------------ */

/** The two seed colors as [r,g,b] pairs (hex seed = 12 chars, 2 colors). */
export function seedColors(level) {
  const s = level.seed ?? '';
  const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return s.length >= 12 ? [hex(s.slice(0, 6)), hex(s.slice(6, 12))] : [];
}
