/**
 * Custom weathers — the three "special" weathers that work like their
 * in-game Growtopia weather machines, plus a documented cloud fix.
 *
 * These are ADDITIONS to the captured planner weather system:
 *   - Haze       (customizable RGB background + haze, like the game's
 *                 colorable haze weather)
 *   - Background (Weather Machine - Background, item 5000: pick any
 *                 background block, the whole backdrop becomes that block)
 *   - Stuff      (Weather Machine - Stuff, item 3832: pick any block and
 *                 watch it rain down — or up, with reversed gravity)
 *
 * All three follow the same interface as WeatherRenderer:
 *     renderer.render(nowMs)
 * so they can drive the same two canvases (#wxb background, #wxf foreground).
 */
import { WeatherRenderer } from './weather-renderer.js';

/* ================================================================== */
/* 1. Cloud fix for Sunny / Monochrome / Spring                        */
/* ================================================================== */

/**
 * The planner's configs for `sunny`, `monochrome` and `spring` contain
 * full cloud animations (drift, alpha fades, sizes) — but every cloud
 * track is positioned ABOVE the visible scene (scene y in [-1134, -193]
 * for a 1200x768 scene), so no clouds are visible. The real game shows
 * drifting clouds for these weathers. This fix remaps the cloud tracks
 * into the visible sky band. It is an APPROXIMATION: the drift, sizes,
 * alpha and timing are the planner's real data; only the vertical
 * placement is remapped (original y in [-1140, -190] -> [20, 240]).
 *
 * Apply to a freshly loaded config BEFORE constructing a WeatherRenderer.
 */
export const CLOUD_FIX_KEYS = new Set(['sunny', 'monochrome', 'spring']);

export function applyCloudFix(cfg) {
  // find the cloud sheet(s): any sheet whose name contains "cloud"
  const cloudSheets = new Set();
  (cfg.sheets || []).forEach((name, i) => {
    if (/cloud/i.test(name)) cloudSheets.add(i);
  });
  if (!cloudSheets.size) return cfg;

  const SRC_MIN = -1140, SRC_MAX = -190;   // observed cloud band (scene units)
  const DST_MIN = 20,   DST_MAX = 240;     // visible sky band

  for (const track of cfg.tracks) {
    if (!cloudSheets.has(track.s)) continue;
    for (const kf of track.k) {
      if (kf.length === 1) continue;       // end marker
      const t = (kf[2] - SRC_MIN) / (SRC_MAX - SRC_MIN);   // 0..1
      kf[2] = DST_MIN + t * (DST_MAX - DST_MIN);
    }
  }
  return cfg;
}

/* ================================================================== */
/* 2. Haze — one weather, two custom colors                            */
/* ================================================================== */

/* --- small HSL helpers ------------------------------------------- */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t0, t1, t2) => {
      if (t0 < 0) t0 += 1; if (t0 > 1) t0 -= 1;
      if (t0 < 1 / 6) return p + (q - p) * 6 * t0;
      if (t0 < 1 / 2) return q;
      if (t0 < 2 / 3) return p + (q - p) * (2 / 3 - t0) * 6;
      return p;
    };
    r = f(h + 1 / 3, 0, 0); g = f(h, 0, 0); b = f(h - 1 / 3, 0, 0);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Renders the haze weather with two user-selected colors.
 *
 * The planner ships four fixed-color haze presets (purple/fire/green/
 * aqua) that share one structure: 1 solid fill track + ~67 background
 * wisps (drawn normally on the background canvas) + ~62 foreground
 * wisps (drawn additively on the foreground canvas; the presets also
 * differ slightly in timing/positions). This weather uses one of
 * those configs as a TEMPLATE and recolors it:
 *
 *   - Background RGB -> the solid background fill
 *   - Haze RGB       -> ALL wisps (both canvas groups)
 *
 * Wisp recoloring keeps each keyframe's original LIGHTNESS variation
 * (that is what gives the haze depth) and rescales it around the
 * picked color's lightness, so black, white and any saturated color all
 * produce distinct, contrast-correct results.
 */
export class HazeWeather {
  /**
   * @param templateCfg  a captured *-haze config (any color — the colors
   *                    are replaced)
   * @param imgs         sheet images map (from loadSheets)
   * @param bgCanvas / fgCanvas  the two stacked canvases
   */
  constructor(templateCfg, imgs, bgCanvas, fgCanvas) {
    this.template = templateCfg;
    this.imgs = imgs;
    this.bg = bgCanvas;
    this.fg = fgCanvas;
    this.renderer = null;
    this.setColors('#800080', '#9500cc');   // purple defaults
  }

  /** Parse '#rrggbb' -> [r, g, b] */
  static hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  setColors(bgHex, hazeHex) {
    const bg = HazeWeather.hexToRgb(bgHex);
    const haze = HazeWeather.hexToRgb(hazeHex);
    const cfg = JSON.parse(JSON.stringify(this.template));

    // group keyframes: fill = tracks[0]; wisps = everything else
    // (both wisp groups take the HAZE color; only their captured
    // lightness variation and blending differ)
    const fillKfs = cfg.tracks[0].k;
    const allWisps = [];
    for (let i = 1; i < cfg.tracks.length; i++) {
      allWisps.push(cfg.tracks[i].k);
    }

    // fill: the exact background color
    for (const kf of fillKfs) {
      if (kf.length === 1) continue;
      kf[6] = bg[0]; kf[7] = bg[1]; kf[8] = bg[2];
    }

    // recolor a group of keyframe arrays with a picked color
    const recolor = (kfsList, rgb) => {
      // reference lightness = mean lightness of the group's keyframes
      let sum = 0, n = 0;
      for (const kfs of kfsList) for (const kf of kfs) {
        if (kf.length === 1) continue;
        sum += rgbToHsl(kf[6], kf[7], kf[8])[2]; n++;
      }
      const refL = Math.max(0.05, sum / Math.max(1, n));
      const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      const pickedL = rgbToHsl(rgb[0], rgb[1], rgb[2])[2];
      for (const kfs of kfsList) for (const kf of kfs) {
        if (kf.length === 1) continue;
        const l0 = rgbToHsl(kf[6], kf[7], kf[8])[2];
        const l = Math.min(1, Math.max(0, l0 * pickedL / refL));
        const [r, g, b] = hslToRgb(h, s, l);
        kf[6] = r; kf[7] = g; kf[8] = b;
      }
    };
    recolor(allWisps, haze);

    this.renderer = new WeatherRenderer(cfg, this.imgs, this.bg, this.fg);
  }

  render(now) { this.renderer.render(now); }
}

/* ================================================================== */
/* 3. Background — Weather Machine - Background (item 5000)           */
/* ================================================================== */

/**
 * In-game behavior (wiki): wrench the machine, click a background block,
 * and the world's background is filled with the selected block —
 * an infinite tiled scape of that block.
 *
 * This renderer tiles one block sprite across the ENTIRE canvas (not
 * just the letterboxed scene rect) at 32 CSS pixels per tile, which is
 * the game's block size.
 *
 * Fully-surrounded autotile: in a completely tiled scape every tile has
 * all 8 neighbors, so blocks with a connectable spread type must use
 * their MIDDLE piece, not the base (end) tile. The offsets follow the
 * community planner's autotile engine (Growtopia Explorer, autotile.js):
 *   spread 2 / 5 (terrain, cave)  -> base tile (mask 255 rule)
 *   spread 3 / 14 (horizontal)    -> (tx+1, ty)  middle piece
 *   spread 7 (vertical)           -> (tx+1, ty)  middle piece
 *   spread 4 (directional surface) -> (tx+3, ty)  floor-attached
 *   spread 1 / 6 / others          -> base tile
 */
export class BackgroundWeather {
  /**
   * @param sheetImg  the tiles_page image containing the block
   * @param sx, sy    the block's FULLY-SURROUNDED tile position in sheet
   *                 pixels — use fullScapeSource(block)
   * @param bgCanvas / fgCanvas
   */
  constructor(sheetImg, sx, sy, bgCanvas, fgCanvas) {
    this.sheet = sheetImg;
    this.sx = sx; this.sy = sy;
    this.bg = bgCanvas; this.fg = fgCanvas;
  }

  render(now) {
    const bgc = this.bg.getContext('2d');
    const fgc = this.fg.getContext('2d');
    const W = this.bg.width, H = this.bg.height;
    fgc.setTransform(1, 0, 0, 1, 0, 0);
    fgc.clearRect(0, 0, this.fg.width, this.fg.height);

    // tile size: 32 CSS pixels, scaled to canvas (device) pixels
    const cssW = this.bg.getBoundingClientRect().width || W;
    const tile = Math.max(1, Math.round(32 * (W / Math.max(1, cssW))));

    bgc.setTransform(1, 0, 0, 1, 0, 0);
    bgc.clearRect(0, 0, W, H);
    bgc.imageSmoothingEnabled = false;
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) {
        bgc.drawImage(this.sheet, this.sx, this.sy, 32, 32, x, y, tile, tile);
      }
    }
    bgc.imageSmoothingEnabled = true;
  }
}

/* ================================================================== */
/* 4. Stuff — Weather Machine - Stuff (item 3832)                      */
/* ================================================================== */

/** Deterministic PRNG (mulberry32) so scrubbing/re-render is stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * In-game behavior (store text): "Choose any item from your inventory,
 * adjust some settings, and watch it rain down from the sky! Or up, if
 * you prefer reversing the gravity."
 *
 * Renders the chosen block raining over a plain daytime sky. The exact
 * in-game particle physics were not verified in this research; this uses
 * a steady spawn rate, constant fall speed and a gentle per-particle
 * rotation drift — an approximation of the in-game look. Particles are
 * fully deterministic from the render time, so pausing and scrubbing
 * behave exactly like the keyframe weathers. Rain spans the FULL
 * canvas width (in scene units), not just the 1200-unit scene.
 */
export class StuffWeather {
  /**
   * @param sheetImg  tiles_page image containing the block
   * @param sx, sy    block position in sheet pixels
   * @param bgCanvas / fgCanvas
   */
  constructor(sheetImg, sx, sy, bgCanvas, fgCanvas) {
    this.sheet = sheetImg;
    this.sx = sx; this.sy = sy;
    this.bg = bgCanvas; this.fg = fgCanvas;
    this.direction = 'down';      // 'down' | 'up'
    this.interval = 130;         // ms between spawns
    this.speed = 260;            // scene-units per second (fall/rise speed)
    this.rotation = 40;          // max deg/sec drift
  }

  setDirection(d) { this.direction = d; }

  render(now) {
    const bgc = this.bg.getContext('2d');
    const fgc = this.fg.getContext('2d');
    const W = this.bg.width, H = this.bg.height;

    // backdrop: plain daytime sky (in-game backdrop not documented)
    bgc.setTransform(1, 0, 0, 1, 0, 0);
    bgc.fillStyle = '#60c8f2';
    bgc.fillRect(0, 0, W, H);

    // foreground: the raining blocks, in scene units like the planner
    const scale = Math.min(W / 1200, H / 768);
    const offX = (W - 1200 * scale) / 2, offY = (H - 768 * scale) / 2;
    // full canvas width in scene units (covers letterbox margins too)
    const xMin = -offX / scale, xMax = (W - offX) / scale;
    const spanX = xMax - xMin;

    fgc.setTransform(1, 0, 0, 1, 0, 0);
    fgc.clearRect(0, 0, this.fg.width, this.fg.height);
    fgc.save();
    fgc.translate(offX, offY);
    fgc.scale(scale, scale);

    const lifetime = (768 + 80) / this.speed * 1000;  // ms to cross the scene
    const count = Math.ceil(lifetime / this.interval);
    const size = 32;                                   // blocks are 32 units

    for (let i = 0; i < count; i++) {
      const rnd = mulberry32(i * 2654435761);
      const x = xMin + rnd() * spanX;
      const rotSpeed = (rnd() - 0.5) * 2 * this.rotation;
      const spawnPhase = rnd() * this.interval;
      const scaleJitter = 0.75 + rnd() * 0.5;

      const age = ((now - spawnPhase - i * this.interval) % lifetime + lifetime) % lifetime;
      const p = age / 1000;                            // seconds of flight
      const y = this.direction === 'down'
        ? -40 + this.speed * p
        : 768 + 40 - this.speed * p;

      fgc.save();
      fgc.translate(x, y);
      fgc.rotate(rotSpeed * p * Math.PI / 180);
      const s = size * scaleJitter;
      fgc.imageSmoothingEnabled = false;
      fgc.drawImage(this.sheet, this.sx, this.sy, 32, 32, -s / 2, -s / 2, s, s);
      fgc.restore();
    }
    fgc.restore();
  }
}

/* ================================================================== */
/* 5. Loading helper for block sprites                                 */
/* ================================================================== */

/**
 * Load the tiles_page image a block needs (cached per texture name).
 * @param block  an entry from data/blocks.json
 * @param baseUrl  path prefix to sheets/tiles/ (must end with /)
 * @param cache   optional Map to reuse loaded images across selections
 * @returns {Promise<HTMLImageElement>} the sheet image
 */
export function loadBlockSheet(block, baseUrl = 'sheets/tiles/', cache = new Map()) {
  if (cache.has(block.texture)) return cache.get(block.texture);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve(img);
    img.src = baseUrl + block.texture;
  });
  cache.set(block.texture, p);
  return p;
}

/** The block's pixel position inside its tiles_page (32px grid). */
export function blockSource(block) {
  return { sx: block.tx * 32, sy: block.ty * 32 };
}

/**
 * The block's FULLY-SURROUNDED tile position — what an infinite tiled
 * scape of this block looks like (middle piece for connectable spread
 * types; see BackgroundWeather). Use for the Background weather.
 */
export function fullScapeSource(block) {
  const st = block.spread_type || 0;
  let dx = 0;
  if (st === 3 || st === 14 || st === 7) dx = 1;      // middle piece
  else if (st === 4) dx = 3;                            // floor-attached
  return { sx: (block.tx + dx) * 32, sy: block.ty * 32 };
}
