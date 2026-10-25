/**
 * Growtopia Weather Renderer — clean reference implementation.
 *
 * This is a faithful, readable port of the weather animation engine used by
 * Set Planner GT (setplannergt.com), which recreates Growtopia's in-game
 * weather machines as animated 2D scenes. It renders a weather "config"
 * (a small JSON file per weather) onto two stacked canvases:
 *
 *   background canvas (#wxb) — behind the character
 *   foreground canvas (#wxf) — in front of the character
 *
 * A weather config looks like this (all values are real, from `sunny`):
 *
 * {
 *   "w": 1200,            // logical scene width  (px)
 *   "h": 768,             // logical scene height (px)
 *   "step": 50,           // duration of one timeline step, in ms
 *   "n": 260,             // total steps on the timeline (intro + loop)
 *   "loop": 240,          // steps that form the seamless loop
 *   "sheets": [           // sprite sheets this weather draws from
 *     "cloud.webp", "hills1.webp", "hills2.webp", "hills3.webp", "sun.webp"
 *   ],
 *   "tracks": [           // animation tracks — each draws one sprite
 *     { "l": 0, "s": -1, "b": 0, "k": [ /* keyframes *\/ ] },
 *     { "l": 0, "s": 4, "b": 2, "k": [ /* keyframes *\/ ] }
 *   ]
 * }
 *
 * Track fields:
 *   l — layer. 0 = background canvas, 1 = foreground canvas.
 *   s — sprite sheet index into `sheets`, or -1 for a plain colored
 *       rectangle (fill). The fill color comes from the keyframe's rgb.
 *   b — blend mode. 1 = additive ("lighter"), anything else = normal.
 *       (Configs use 0, 1 and 2; 0 and 2 both render normally.)
 *   k — keyframes (see below).
 *
 * Keyframe format — an array of numbers, or a 1-element "end marker":
 *   [ t, x, y, w, h, rot, r, g, b, a, sx, sy, sw, sh, flip, hold ]
 *
 *   t    — step index on the timeline this keyframe applies at
 *   x, y — top-left of the drawn sprite in logical scene coordinates
 *   w, h — width / height the sprite is drawn at (scaled to this)
 *   rot  — rotation in degrees, clockwise, around the sprite center
 *   r,g,b — tint color 0-255 (sprite pixels are multiplied by this)
 *   a    — opacity 0-255 (0 = invisible, 255 = fully opaque)
 *   sx, sy, sw, sh — source rectangle in the sprite sheet
 *   flip — bit flags: 1 = flip horizontally, 2 = flip vertically
 *   hold — 1 = "step change": do not ease from the previous keyframe
 *          into this one; jump straight to these values
 *
 * End marker: a keyframe that is just [t] (length 1) means the track is
 * dead from step t onward — it is not drawn.
 *
 * Between two keyframes every value is LINEARLY interpolated by elapsed
 * step fraction — except rotation, which takes the shortest angular path
 * when the keyframes are 1 step apart (used for spinning sprites).
 * If the next keyframe has `hold` set, interpolation is skipped.
 */

/* ------------------------------------------------------------------ */
/* WeatherRenderer                                                     */
/* ------------------------------------------------------------------ */

export class WeatherRenderer {
  /**
   * @param {object} cfg        the decoded weather config (see above)
   * @param {Object<string,HTMLImageElement>} imgs
   *        map of sheet filename -> loaded <img> element
   *        (keys must match the names in cfg.sheets)
   * @param {HTMLCanvasElement} bgCanvas   behind the character
   * @param {HTMLCanvasElement} fgCanvas   in front of the character
   */
  constructor(cfg, imgs, bgCanvas, fgCanvas) {
    this.cfg = cfg;
    this.imgs = imgs;
    this.bg = bgCanvas;
    this.fg = fgCanvas;
    this.tintCache = new Map();   // sheetImg -> Map(colorKey, canvas)>
    this.tintCount = 0;
    // Continuous player-driven parallax, independently tuned per band.
    // desert_wobbly is deliberately paired with desert_hills for Arid.
    this.hillSheets = hillSheetIndices(cfg);
    this.hillPeriods = hillPeriods(cfg);
    this.hillSpeeds = hillScrollSpeeds(cfg);
    // Arid's desert_wobbly sheet contains two separate track bands, each of
    // which inherits its own desert hill band's speed and period.
    this.hillTrackSpeeds = hillTrackScrollSpeeds(cfg, this.hillSpeeds);
    this.hillTrackPeriods = hillTrackPeriods(cfg, this.hillPeriods);
    this.hillOffsets = new Map();
    // The engine derives the true layer ("near" = foreground) from the raw
    // `l` field: an l=1 track is only foreground if EVERY keyframe is either
    // an end marker [t] or a small sprite (w < 64 AND h < 64). Big l=1
    // sprites (like overlay backgrounds) stay on the background canvas.
    for (const t of cfg.tracks || []) {
      t.near = (t.l === 1 && t.k.every(kf =>
        kf.length === 1 || (kf[3] < 64 && kf[4] < 64))) ? 1 : 0;
    }
  }

  /** Advance to wall-clock time `now` (ms). Call this every frame.
   *
   * `hillOffsets` is a Map keyed by sheet index or individual track object.
   * Track-specific offsets override the shared sheet offset, allowing multiple
   * parallax groups on one texture. The app derives offsets continuously from
   * player world X and each band's speed. A numeric value remains supported
   * for still/manual callers and applies the same offset to every hill sheet. */
  render(now, hillOffsets) {
    if (hillOffsets instanceof Map) {
      this.hillOffsets = new Map(hillOffsets);
    } else if (Number.isFinite(hillOffsets)) {
      this.hillOffsets = new Map([...this.hillSheets].map(index => [index, hillOffsets]));
    } else {
      this.hillOffsets = new Map();
    }
    this._renderLayer(this.bg.getContext('2d'), this.bg, now, 0);
    this._renderLayer(this.fg.getContext('2d'), this.fg, now, 1);
  }

  /**
   * Draws one layer. `layer` is 0 (background) or 1 (foreground).
   * This is the c4() function of the original engine.
   */
  _renderLayer(ctx, canvas, now, layer) {
    const cfg = this.cfg;
    const W = canvas.width, H = canvas.height;

    // --- pick scale: COVER — always fill the whole canvas -----------------
    // The scene is scaled so it covers the canvas completely (edges are
    // cropped), so the weather always reaches the preview's border with no
    // letterbox bands and no mirrored fill.
    const scale = Math.max(W / cfg.w, H / cfg.h);

    const offX = (W - cfg.w * scale) / 2;
    const offY = (H - cfg.h * scale) / 2;

    // --- clear the whole canvas (the original engine does this every ----
    // frame before drawing). Without it, sprites on the transparent
    // foreground canvas leave permanent trails.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(offX, offY);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;

    const loopSteps = cfg.loop;                 // steps in the seamless loop
    const leadIn   = cfg.n - cfg.loop;          // crossfade zone length
    // current position on the timeline, in steps (can be fractional)
    const t = ((now / cfg.step) % loopSteps + loopSteps) % loopSteps;

    // --- draw the tracks for this layer ------------------------------
    // During the first `leadIn` steps of every loop cycle the engine
    // crossfades: the tail end of the timeline (step t + loopSteps) is
    // drawn as the base, and the head (step t) fades in on top of it.
    // For a seamless loop the two states look identical, so this is
    // invisible — it exists to hide any mismatch at the loop point.
    if (t < leadIn) {
      this._drawTracks(ctx, layer, t + loopSteps, 1);          // base: tail
      const { cvs, c } = this._offscreen(canvas);             // head: fade-in
      c.save();
      c.translate(offX, offY);
      c.scale(scale, scale);
      c.imageSmoothingEnabled = true;
      this._drawTracks(c, layer, t, 1);
      c.restore();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = t / leadIn;
      ctx.drawImage(cvs, 0, 0);
      ctx.restore();
    } else {
      this._drawTracks(ctx, layer, t, 1);
    }

    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Draws every track of `layer` at timeline step `step`.
   * This is the G4() function of the original engine.
   */
  _drawTracks(ctx, layer, step, alphaMul) {
    const cfg = this.cfg;
    let lastAlpha = -1;
    let lastBlend = '';

    for (const track of cfg.tracks) {
      // layer 0 = background canvas, 1 = foreground — decided by the
      // derived `near` field (see constructor), not the raw `l` field.
      if (track.near !== layer) continue;

      const kfs = track.k;
      if (step < kfs[0][0]) continue;            // not started yet

      // binary-search the last keyframe with kfs[i][0] <= step
      let lo = 0, hi = kfs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (kfs[mid][0] <= step) lo = mid; else hi = mid - 1;
      }
      const cur = kfs[lo];
      if (cur.length === 1) continue;             // end marker — track is dead

      const next = kfs[lo + 1];
      // interpolation factor between cur and next (0..1), or 0 = hold
      const f = (next && next.length > 1 && !next[15] && next[0] > cur[0])
        ? (step - cur[0]) / (next[0] - cur[0])
        : 0;

      const alpha = this._lerp(cur, next, f, 9) / 255 * alphaMul;
      if (alpha <= 0.004) continue;

      const x = this._lerp(cur, next, f, 1);
      const y = this._lerp(cur, next, f, 2);
      const w = this._lerp(cur, next, f, 3);
      const h = this._lerp(cur, next, f, 4);

      const a = Math.min(1, alpha);
      const blend = track.b === 1 ? 'lighter' : 'source-over';
      if (a !== lastAlpha) ctx.globalAlpha = lastAlpha = a;
      if (blend !== lastBlend) ctx.globalCompositeOperation = lastBlend = blend;

      // ---- sheet index -1: plain colored rectangle ------------------
      if (track.s < 0) {
        ctx.fillStyle = `rgb(${Math.round(this._lerp(cur, next, f, 6))},` +
                        `${Math.round(this._lerp(cur, next, f, 7))},` +
                        `${Math.round(this._lerp(cur, next, f, 8))})`;
        ctx.fillRect(x, y, w, h);
        continue;
      }

      // ---- normal sprite track --------------------------------------
      const img = this.imgs[cfg.sheets[track.s]];
      if (!img || !img.complete || !img.naturalWidth) continue;

      // tint color, quantized to multiples of 8 (matches original cache)
      const r = Math.min(255, Math.round(this._lerp(cur, next, f, 6) / 8) * 8);
      const g = Math.min(255, Math.round(this._lerp(cur, next, f, 7) / 8) * 8);
      const b = Math.min(255, Math.round(this._lerp(cur, next, f, 8) / 8) * 8);
      const sheet = (r === 255 && g === 255 && b === 255)
        ? img
        : this._tinted(img, r, g, b);

      // rotation — degrees, shortest angular path for 1-step keyframe pairs
      let rot = cur[5];
      if (f) {
        const d = (next[0] - cur[0] === 1)
          ? ((next[5] - cur[5] + 540) % 360) - 180   // wrap-aware spin
          : next[5] - cur[5];
        rot += d * f;
      }

      const flip = cur[14];    // 1 = flipX, 2 = flipY, 3 = both

      // Hill bands scroll with the player: draw the sprite at its wrapped
      // position and one period earlier so the band stays seamless at every
      // offset (see hillDrawXs).
      const drawXs = this._hillDrawXs(track, x);

      for (const dx of drawXs) {
        if (rot || flip) {
          ctx.save();
          ctx.translate(dx + w / 2, y + h / 2);
          if (rot) ctx.rotate(rot * Math.PI / 180);
          ctx.scale((flip & 1) ? -1 : 1, (flip & 2) ? -1 : 1);
          // source rect comes from the CURRENT keyframe only
          ctx.drawImage(sheet, cur[10], cur[11], cur[12], cur[13],
                        -w / 2, -h / 2, w, h);
          ctx.restore();
        } else if (w > 64) {
          // slight overscan on big sprites to avoid hairline seams
          ctx.drawImage(sheet, cur[10], cur[11], cur[12], cur[13],
                        dx - 0.35, y - 0.35, w + 0.7, h + 0.7);
        } else {
          ctx.drawImage(sheet, cur[10], cur[11], cur[12], cur[13], dx, y, w, h);
        }
      }
    }

    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* --- helpers ------------------------------------------------------ */

  /** Wrapped draw positions using this sheet's independent parallax offset. */
  _hillDrawXs(track, x) {
    const offset = this.hillOffsets.get(track) ?? this.hillOffsets.get(track.s) ?? 0;
    if (!offset || !this.hillSheets.has(track.s)) return [x];
    const period = this.hillTrackPeriods.get(track) ?? this.hillPeriods.get(track.s);
    return hillDrawXs(x, offset, period);
  }

  /** linear interpolation of keyframe field `i` between `a` and `b`. */
  _lerp(a, b, f, i) {
    return f ? a[i] + (b[i] - a[i]) * f : a[i];
  }

  /** reusable offscreen canvas the size of `canvas`. */
  _offscreen(canvas) {
    if (!this._oc || this._oc.width !== canvas.width || this._oc.height !== canvas.height) {
      this._oc = document.createElement('canvas');
      this._oc.width = canvas.width;
      this._oc.height = canvas.height;
    }
    const c = this._oc.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this._oc.width, this._oc.height);
    return { cvs: this._oc, c };
  }

  /**
   * Multiply-tint a sprite sheet and cache the result.
   * (Same technique as the original: draw, `multiply` fill, then
   * `destination-in` to restore the alpha channel.)
   */
  _tinted(img, r, g, b) {
    let m = this.tintCache.get(img);
    if (!m) this.tintCache.set(img, m = new Map());
    const key = r << 16 | g << 8 | b;
    let p = m.get(key);
    if (!p) {
      p = document.createElement('canvas');
      p.width = img.naturalWidth;
      p.height = img.naturalHeight;
      const c = p.getContext('2d');
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = `rgb(${r},${g},${b})`;
      c.fillRect(0, 0, p.width, p.height);
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(img, 0, 0);
      // keep the cache bounded (original evicts after 400)
      if (++this.tintCount > 400) { this.tintCache.clear(); this.tintCount = 1; }
      m.set(key, p);
    }
    return p;
  }
}

/* ------------------------------------------------------------------ */
/* Hill helpers (pure, exported for tests)                             */
/* ------------------------------------------------------------------ */

/** Sheet indices belonging to hill bands, including Arid's paired wobble layer. */
export function hillSheetIndices(cfg) {
  const out = new Set();
  const sheets = cfg.sheets || [];
  const hasDesertHills = sheets.some(name => /^desert_hills(?:\.|$)/i.test(name));
  sheets.forEach((name, i) => {
    if (/hill/i.test(name) || (/desert_wobbly/i.test(name) && hasDesertHills)) out.add(i);
  });
  return out;
}

/**
 * Relative motion per sheet, now half as fast as the previous tuning:
 * hill1 = 0.5x, hill2 = 0.25x, hill3 = 0.125x. In Arid, desert_hills is
 * 0.125x and desert_hills2 is 0.25x. Wobble groups inherit their matching
 * parent layer in hillTrackScrollSpeeds().
 */
export function hillScrollSpeeds(cfg) {
  const sheets = cfg.sheets || [];
  const speeds = new Map();

  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i];
    if (/desert_wobbly/i.test(name)) {
      speeds.set(i, 0.125); // fallback; each Arid wobble track gets an override
    } else if (/^desert_hills2(?:\.|$)/i.test(name)) speeds.set(i, 0.25);
    else if (/^desert_hills(?:\.|$)/i.test(name)) speeds.set(i, 0.125);
    else if (/hills?1/i.test(name)) speeds.set(i, 0.5);
    else if (/hills?2/i.test(name)) speeds.set(i, 0.25);
    else if (/hills?3/i.test(name)) speeds.set(i, 0.125);
    else if (/hill/i.test(name)) speeds.set(i, 0.125);
  }
  return speeds;
}

/** First drawable Y coordinate for assigning a wobble track to its hill band. */
function firstTrackY(track) {
  const first = (track.k || []).find(kf => kf.length > 1);
  return first ? first[2] : Infinity;
}

/** Arid's two desert_wobbly groups are layered at different heights. Match
 * each wobble track to the closest desert_hills/desert_hills2 track so its
 * speed follows the landscape that it decorates. Map keys are track objects.
 */
export function hillTrackScrollSpeeds(cfg, sheetSpeeds = hillScrollSpeeds(cfg)) {
  const sheets = cfg.sheets || [];
  const tracks = cfg.tracks || [];
  const parentTracks = tracks.filter(track =>
    /^desert_hills2?(?:\.|$)/i.test(sheets[track.s] || ""));
  const result = new Map();
  if (!parentTracks.length) return result;

  for (const track of tracks) {
    if (!/desert_wobbly/i.test(sheets[track.s] || "")) continue;
    const y = firstTrackY(track);
    const parent = parentTracks.reduce((best, candidate) =>
      Math.abs(firstTrackY(candidate) - y) < Math.abs(firstTrackY(best) - y) ? candidate : best
    );
    result.set(track, sheetSpeeds.get(parent.s) ?? 0.125);
  }
  return result;
}

/** Same nearest-parent pairing for seamless repeat periods on Arid wobble bands. */
export function hillTrackPeriods(cfg, sheetPeriods = hillPeriods(cfg)) {
  const sheets = cfg.sheets || [];
  const tracks = cfg.tracks || [];
  const parentTracks = tracks.filter(track =>
    /^desert_hills2?(?:\.|$)/i.test(sheets[track.s] || ""));
  const result = new Map();
  if (!parentTracks.length) return result;

  for (const track of tracks) {
    if (!/desert_wobbly/i.test(sheets[track.s] || "")) continue;
    const y = firstTrackY(track);
    const parent = parentTracks.reduce((best, candidate) =>
      Math.abs(firstTrackY(candidate) - y) < Math.abs(firstTrackY(best) - y) ? candidate : best
    );
    const period = sheetPeriods.get(parent.s);
    if (Number.isFinite(period)) result.set(track, period);
  }
  return result;
}

/**
 * Wrap period of each hill band, derived from the band's own repeated
 * geometry — NOT from an assumed scene width: sibling tracks sharing a
 * sheet repeat at their closest x spacing; a lone track repeats at its own
 * sprite width. Returns a Map<sheetIndex, period>.
 */
export function hillPeriods(cfg) {
  const hills = hillSheetIndices(cfg);
  const bySheet = new Map();
  for (const t of cfg.tracks || []) {
    if (hills.has(t.s)) {
      if (!bySheet.has(t.s)) bySheet.set(t.s, []);
      bySheet.get(t.s).push(t);
    }
  }
  const periods = new Map();
  for (const [s, tracks] of bySheet) {
    const xs = [...new Set(tracks.flatMap(t =>
      t.k.filter(kf => kf.length > 1).map(kf => kf[1])))];
    let period = null;
    if (xs.length >= 2) {
      xs.sort((a, b) => a - b);
      period = Infinity;
      for (let i = 1; i < xs.length; i++)
        period = Math.min(period, xs[i] - xs[i - 1]);
    }
    if (period == null || !Number.isFinite(period) || period <= 0) {
      const kf = tracks[0].k.find(kf => kf.length > 1);
      period = kf ? kf[3] : (cfg.w || 0);
    }
    periods.set(s, period);
  }

  // Arid's desert_wobbly sprites are a companion texture to desert_hills.
  // Reuse its wrap period so all wobbling accents drift seamlessly in lockstep.
  const sheets = cfg.sheets || [];
  const desertBase = sheets.findIndex(name => /^desert_hills(?:\.|$)/i.test(name));
  const desertWobbly = sheets.findIndex(name => /desert_wobbly/i.test(name));
  if (desertBase >= 0 && desertWobbly >= 0 && periods.has(desertBase)) {
    periods.set(desertWobbly, periods.get(desertBase));
  }
  return periods;
}

/**
 * Draw positions for a hill sprite at scene x with travel `offset`: the
 * sprite wrapped into one period plus one copy a period earlier, so the
 * band covers the scene seamlessly at every offset. No offset → the
 * sprite's own position, unchanged.
 */
export function hillDrawXs(x, offset, period) {
  if (!offset || !period || period <= 0) return [x];
  const base = ((x + offset) % period + period) % period;
  return [base - period, base];
}

/**
 * Legacy pure helper retained for callers that need a bounded-region distance.
 * Active hill parallax no longer uses a world-edge threshold.
 */
export function hillTravelExcess(worldX, regionMin, regionMax) {
  if (!Number.isFinite(worldX)) return 0;
  return worldX - Math.min(regionMax, Math.max(regionMin, worldX));
}

/**
 * Convert absolute player travel (world px) to a hill-layer offset in weather
 * scene units. The scale ratio makes movement match the rendered player speed
 * while keeping weather canvases viewport-space. `parallax` is each sheet's
 * speed multiplier. Current presets are hill1 = 0.5x, hill2 = 0.25x,
 * and hill3 = 0.125x (each half the speed of the previous tuning).
 */
export function hillSceneOffset(playerTravelWorldPx, worldPxPerUnit, pxPerSceneUnit, parallax = 0.25) {
  if (!Number.isFinite(playerTravelWorldPx) || !playerTravelWorldPx) return 0;
  if (!Number.isFinite(worldPxPerUnit) || worldPxPerUnit <= 0) return 0;
  if (!Number.isFinite(pxPerSceneUnit) || pxPerSceneUnit <= 0) return 0;
  return playerTravelWorldPx * (worldPxPerUnit / pxPerSceneUnit) * parallax;
}

/* ------------------------------------------------------------------ */
/* Loading helper                                                       */
/* ------------------------------------------------------------------ */

/**
 * Load every sprite sheet a weather config needs.
 * @returns {Promise<Object<string,HTMLImageElement>>}
 */
export async function loadSheets(cfg, baseUrl = 'sheets/') {
  const imgs = {};
  await Promise.all((cfg.sheets || []).map(name =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = img.onerror = resolve;
      img.src = baseUrl + name;
      imgs[name] = img;
    })
  ));
  return imgs;
}

/**
 * Simple animation loop driver.
 * @param {WeatherRenderer} renderer
 * @param {function} onFrame called after each render (optional)
 */
export function animate(renderer, onFrame) {
  const t0 = performance.now();
  const frame = () => {
    renderer.render(performance.now() - t0);
    if (onFrame) onFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
