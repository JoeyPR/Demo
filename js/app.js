/* APP: the Demo rendering engine wired into the NewPlanner UI. This module
   replaces NewPlanner's own player renderer — every sprite, pose, walk
   cycle, FX and XML renderer comes from the Demo engine unchanged. */
import { PlannerPlayer } from "../demo/engine/player.mjs";
import { PreviewMotion } from "../demo/engine/motion.mjs";
import { normalizeCatalogItem } from "../demo/engine/catalog-adapter.mjs";
import { drawCanvas } from "../demo/engine/render.mjs";
import { registerAtlas } from "../demo/engine/canvas-assets.mjs";
import { drawBounds } from "../demo/engine/draw-bounds.mjs";
import { resolveAbilities } from "../demo/engine/abilities.mjs";
import { WeatherRenderer, loadSheets } from "../weather-engine/weather-renderer.js";
import { applyCloudFix, CLOUD_FIX_KEYS } from "../weather-engine/custom-weathers.js";
import { registerBlocks, renderWorld, BLOCKS, TILE, WORLD_W } from "./land-system.mjs";
import { renderPlannerInventoryIcon } from "./inventory-icons.mjs";

const $ = s => document.querySelector(s);
const moduleURL = path => new URL(path, import.meta.url);
const world = $("#pv"), ctx = world.getContext("2d");
const avatar = document.createElement("canvas"), avatarCtx = avatar.getContext("2d");
const weatherBG = document.createElement("canvas"), weatherFG = document.createElement("canvas");
const landCanvas = document.createElement("canvas"), landCtx = landCanvas.getContext("2d");
const landImages = new Map(), landLoads = new Map();

const SKINS = [
  { name: "Warm peach", rgb: [255, 206, 180, 255] },
  { name: "Golden tan", rgb: [208, 149, 105, 255] },
  { name: "Deep brown", rgb: [128, 82, 61, 255] },
  { name: "Cool blue", rgb: [127, 194, 218, 255] },
  { name: "Soft stone", rgb: [186, 194, 175, 255] }
];

const state = {
  catalog: null, equipped: new Map(), skin: SKINS[P.store.get("skin", 0)].rgb,
  resolution: 128, clock: 0, jumpUntil: 0, punchUntil: 0, doubleAt: null,
  lastFrame: null, lastResult: null, ready: false, remainder: 0,
  weatherRenderer: null, weatherKey: null, weatherAnimAt: 0, weatherT0: 0, weatherStill: null,
  ancestralMap: null, abilities: null, hiddenPasses: new Set(), contentTop: 0,
  landBlock: null, landWorld: null, view: null, aim: null, punchHold: false, punchPointer: null, gesturePunchUntil: 0
};
let player, motion, lastTimestamp = 0;
/* The base actor is calibrated to the 32-unit tile grid. Transparent margins
   in the visible base frame make the silhouette slightly shorter than a tile
   at 1.0. Pixel measurement of the supplied capture (229px actor / 160px
   tile at PS=1.5625) gives PS=(160*1.5625)/229 ≈ 1.092. This multiplier is
   shared by all camera zoom levels; the land stays at 32 world units. */
const PS = 1.092;
const atlases = new Map(), images = new Map(), atlasLoads = new Map(), failedAtlases = new Set();

/* ---------------- atlas loading (from the Demo renderer) ---------------- */
function loadAtlas(name) {
  if (atlases.has(name)) return Promise.resolve(images.get(name));
  if (atlasLoads.has(name)) return atlasLoads.get(name);
  const load = (async () => {
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = moduleURL(`../demo/assets/${name}`).href;
      await image.decode();
      images.set(name, image);
      const atlas = registerAtlas(image), tint = atlas.tintedCrop;
      atlas.tintedCrop = call => {
        try { return tint(call); } catch {
          const crop = document.createElement("canvas");
          crop.width = call.sw; crop.height = call.sh;
          crop.getContext("2d").drawImage(image, call.sx, call.sy, call.sw, call.sh, 0, 0, call.sw, call.sh);
          return crop;
        }
      };
      atlases.set(name, atlas);
      return image;
    } catch { failedAtlases.add(name); return null; }
  })();
  atlasLoads.set(name, load);
  return load;
}
function ensureItemAssets(item) {
  return Promise.all([...new Set([...item.pieces.map(p => p.a),
    ...Object.values(item.renderer?.sprites ?? {}).map(s => s.atlas)])].filter(Boolean).map(loadAtlas));
}
function normalize(raw) {
  const item = normalizeCatalogItem(raw, state.catalog);
  item.native = state.nativeMetadata?.items?.[raw.id] ?? null;
  ensureItemAssets(item);
  return item;
}

/* ---------------- equip ----------------------------------------------- */
function equipToggle(id) {
  const raw = state.catalog.items.find(i => i.id === id);
  if (!raw) return;
  if (state.equipped.get(raw.slot)?.id === id) state.equipped.delete(raw.slot);
  else state.equipped.set(raw.slot, normalize(raw));
  player.equip([...state.equipped.values()]);
  syncAuraPass();
  state.abilities = resolveAbilities([...state.equipped.values()], state.abilityRegistry);
  motion?.setAbilities(state.abilities);
  P.equippedIds = new Set([...state.equipped.values()].map(i => i.id));
  P.emit("equip-state");
  updateHUD();
}
/* Ancestral auras are drawn by the ancestral FX renderer (drawAncestralAura)
   below — the engine's own static RenderAura pass (the artifact's old sprite
   drawn on the character) is hidden so only the animated aura shows. */
function syncAuraPass() {
  const item = state.equipped.get(9);
  const handled = !!(item && state.ancestralMap?.has(item.id));
  if (handled) state.hiddenPasses.add("RenderAura");
  else state.hiddenPasses.delete("RenderAura");
}
P.on("equip", payload => equipToggle(typeof payload === "object" && payload !== null ? payload.id : payload));
P.on("skin", i => { state.skin = SKINS[i].rgb; });

/* ---------------- simulation ------------------------------------------- */
function step(dt) {
  state.clock += dt;
  if (state.doubleAt !== null && state.clock >= state.doubleAt) {
    state.jumpUntil = state.clock + 100; state.doubleAt = null;
  }
  const input = {
    right: !!(P.input.right), left: !!(P.input.left),
    jump: state.clock < state.jumpUntil || !!P.input.jump,
    punch: state.clock < state.punchUntil || !!P.input.punch || state.punchHold || state.clock < state.gesturePunchUntil
  };
  /* touch punch aim: the gesture's canvas point steers the punch at the
     character — same contract as the Demo render lab (punchTarget is in
     32-unit world space relative to the avatar root, facing-adjusted).
     Only the gesture's own punches (hold, or the tap queued by
     gesturePunchUntil) consume the aim — a keyboard/pad punch keeps the
     engine's default target. */
  const gesturePunch = state.punchHold || state.clock < state.gesturePunchUntil;
  if (gesturePunch && state.aim && state.view) {
    const { rootX, rootY, s, lift } = state.view;
    /* the visual feet pivot — screen→rig conversion inverts the PS scale,
       so the arm reaches to where the finger actually is */
    const cx = rootX + 16 * s, cy = rootY + 32 * s;
    motion.facing = state.aim.x >= cx ? 1 : -1;
    let x = 16 + (state.aim.x - cx) / (s * PS);
    if (motion.facing < 0) x = 32 - x;
    input.punchTarget = [x, 32 + (state.aim.y - cy) / (s * PS) - (lift ?? 0)];
  }
  const frame = motion.step(dt, input);
  if (frame.ground && !input.right && !input.left) frame.locomotion = "idle";
  state.lastFrame = frame;
  state.lastResult = player.step(
    { ...frame, worldX: frame.x, worldY: frame.y, x: 0, y: 0 }, dt,
    { skin: state.skin, effects: true });
}
P.on("pad", pad => {
  if (pad.k === "jump" && pad.down) { motion.lastJump = false; state.jumpUntil = state.clock + 150; }
  if (pad.k === "punch" && pad.down) state.punchUntil = state.clock + 34;
});
window.addEventListener("blur", () => { P.input.left = P.input.right = P.input.jump = P.input.punch = 0; });

/* ---------------- touch punch (tap/hold/drag on the preview) ------------- */
/* Hold a touch on the preview to hold the punch, drag to steer it, and let go
   when the touch leaves the preview box. The gesture never touches P.input —
   it drives its own punchHold flag, so releasing it can't clear a punch held
   by the keyboard or the on-screen pad.
   A fast tap can release before the next simulation step, so the tap's aim
   coordinates must SURVIVE the release: punchRelease only stops the hold,
   while punchCancel (left the preview, pinch, blur) also kills the queued
   tap punch (gesturePunchUntil) so nothing can stick around delayed. */
function punchRelease() {
  state.punchHold = false;
  state.punchPointer = null;
}
function punchCancel() {
  punchRelease();
  state.gesturePunchUntil = 0;
}
function punchAimFromEvent(e) {
  const r = world.getBoundingClientRect();
  state.aim = {
    x: (e.clientX - r.left) * world.width / r.width,
    y: (e.clientY - r.top) * world.height / r.height
  };
}
function punchInside(e) {
  const r = world.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}
/* the inventory overlays the world canvas (the canvas covers the window), so
   "inside the preview" also means: not over the drawer. The drawer slides as
   five blocks (#top/#handle/#tabs/#main/#side) whose rects follow the drag —
   a point over any of them is over the inventory, not the world */
function punchOverDrawer(e) {
  const x = e.clientX, y = e.clientY;
  return ["top", "handle", "tabs", "main", "side"].some(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
}
const punchOverUI = t => t.closest && t.closest("#ui, #hud, #toast, #logo, [data-dd]");
document.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (punchOverUI(e.target) || punchOverDrawer(e)) return;
  if (state.punchPointer !== null) { punchCancel(); return; }   /* second finger: pinch zoom takes over */
  if (!punchInside(e)) return;
  punchAimFromEvent(e);
  state.punchHold = true;
  state.punchPointer = e.pointerId;
  state.gesturePunchUntil = state.clock + 34;   /* one punch even if the tap ends before the next step */
}, { capture: false });
document.addEventListener("pointermove", e => {
  if (state.punchPointer !== e.pointerId) return;
  if (!punchInside(e) || punchOverDrawer(e)) { punchCancel(); return; }   /* let go at the preview's edge / over the inventory */
  punchAimFromEvent(e);
});
const punchDrop = e => { if (state.punchPointer === e.pointerId) punchRelease(); };   /* release: keep the tap's aim */
document.addEventListener("pointerup", punchDrop);
document.addEventListener("pointercancel", e => { if (state.punchPointer === e.pointerId) punchCancel(); });
document.addEventListener("lostpointercapture", punchDrop);
window.addEventListener("blur", punchCancel);

/* ---------------- rendering ------------------------------------------- */
const PALETTE = {
  sky: "#c6dcd1"
};
function drawScene(w, h) {
  /* plain sky fallback — only shown if the weather fails to load */
  ctx.fillStyle = PALETTE.sky; ctx.fillRect(0, 0, w, h);
}
function renderAvatar() {
  /* dynamically load any atlas a draw call references but we have not
     registered yet (same as the Demo boot) — pieces appear next frame */
  const missing = [...new Set(state.lastResult.calls.filter(c => !atlases.has(c.atlas)).map(c => c.atlas))];
  for (const name of missing) loadAtlas(name);
  const wornAncestral = state.equipped.get(9);
  const customAncestralId = wornAncestral && state.ancestralMap?.has(wornAncestral.id)
    ? wornAncestral.id : null;
  const calls = state.lastResult.calls.filter(c =>
    !state.hiddenPasses.has(c.pass) &&
    // The dedicated ancestral renderer owns the worn artifact's appearance.
    // Suppress its legacy sprite draws even when they use RenderInFront.
    !(customAncestralId !== null && c.owner === customAncestralId) &&
    atlases.has(c.atlas));
  const bounds = drawBounds(calls), scale = state.resolution / 32;
  const width = Math.ceil(bounds.width * scale), height = Math.ceil(bounds.height * scale);
  if (avatar.width !== width || avatar.height !== height) { avatar.width = width; avatar.height = height; }
  avatarCtx.setTransform(1, 0, 0, 1, 0, 0);
  avatarCtx.clearRect(0, 0, width, height);
  state.avatarBounds = bounds;
  drawCanvas(avatarCtx, calls, atlases, { tilePixels: state.resolution, camera: [bounds.x, bounds.y] });
  /* tight top of the actually-drawn pixels: the bounds box keeps a 128-unit
     floor with big empty margins (a bare player's body is ~0..32), and the
     camera clamp must follow the real head — at PS scale the box's margins
     would over-scroll the camera at high zoom */
  {
    const sc = state.resolution / 32;
    const data = avatarCtx.getImageData(0, 0, width, height).data;
    let topPx = height;
    outer: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) { topPx = y; break outer; }
      }
    }
    state.contentTop = bounds.y + topPx / sc;
  }
  return calls.length;
}

/* ---------------- weather --------------------------------------------- */
/* Loading a weather goes through a static preview first: once the weather's
   sheets are decoded, its fully-rendered first frame is held still for a
   moment (STATIC fully rendered weather), then the animation takes over from
   that exact timeline position (ANIMATED fully rendered weather) — no jump. */
const WEATHER_STATIC_MS = 500;
async function setWeather(key) {
  state.weatherKey = key;
  state.weatherRenderer = null;
  state.weatherStill = null;
  if (!key || key === "none") return;
  /* PREVIEW WHILE LOADING: the weather dropdown's cached fully-rendered still
     of the new weather is shown immediately, before its sheets are decoded */
  if (P.weatherThumb) P.weatherThumb(key).then(c => {
    if (c && state.weatherKey === key && !state.weatherRenderer) state.weatherStill = c;
  }).catch(() => {});
  try {
    const res = await fetch(moduleURL(`../data/variants/base/${key}.json`));
    if (!res.ok) throw Error("weather config missing");
    const cfg = await res.json();
    /* sunny / monochrome / spring ship with their cloud tracks parked above
       the visible scene — remap them into the sky band (documented fix) */
    if (CLOUD_FIX_KEYS.has(key)) applyCloudFix(cfg);
    const imgs = await loadSheets(cfg, moduleURL("../sheets/").href);
    if (state.weatherKey !== key) return; /* switched again while loading */
    weatherBG.width = world.width; weatherBG.height = world.height;
    weatherFG.width = world.width; weatherFG.height = world.height;
    const renderer = new WeatherRenderer(cfg, imgs, weatherBG, weatherFG);
    state.weatherStill = null;   /* the full render takes over from the preview */
    const t0 = Math.round(cfg.loop * cfg.step * 0.4);   /* still frame position */
    renderer.render(t0);                                /* draw the static preview */
    state.weatherRenderer = renderer;
    state.weatherT0 = t0;
    state.weatherAnimAt = performance.now() + WEATHER_STATIC_MS;
  } catch (err) {
    P.toast("Weather unavailable: " + key);
  }
}
P.on("weather", key => setWeather(key));

/* ---------------- land -------------------------------------------------- */
/* The land system (land-system.mjs, from the Planner-LANDsystem package):
   selecting a foreground block re-renders the ground strip the player walks
   on, using the package's autotiling against a uniform filled world. No
   background blocks and no placement — the planner ground is visual only. */
function landPage(name) {
  if (landImages.has(name)) return Promise.resolve(landImages.get(name));
  if (landLoads.has(name)) return landLoads.get(name);
  const load = new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { landImages.set(name, img); res(img); };
    img.onerror = () => { landImages.set(name, null); res(null); };
    img.src = moduleURL(`../sheets/tiles/${name}.png`).href;
  });
  landLoads.set(name, load);
  return load;
}
const DEFAULT_LAND = 2;   /* Dirt — the default land the player walks on */
function setLand(id) {
  if (id == null || id === "none") id = DEFAULT_LAND;
  if (!BLOCKS[id]) { state.landBlock = null; state.landWorld = null; return; }
  const def = BLOCKS[id];
  landPage(def.page || "tiles_page1");
  state.landBlock = id;
  /* uniform world: rows 0-23 air, rows 24-59 the selected block — the top
     row picks up the block's top-edge autotile variant, everything below is
     interior; world-edge columns read as connected so scrolling wraps cleanly */
  const fg = [];
  for (let y = 0; y < 60; y++) fg.push(new Array(WORLD_W).fill(y < 24 ? 0 : id));
  state.landWorld = { seed: 1, fg, bg: fg.map(r => r.map(() => 0)), flip: {} };
}
P.on("land", id => setLand(id));
function drawLandGround(w, h, ground, s, frame) {
  const lw = Math.ceil(w / s), lh = Math.max(1, Math.ceil((h - ground) / s) + 2);
  if (landCanvas.width !== lw || landCanvas.height !== lh) { landCanvas.width = lw; landCanvas.height = lh; }
  landCtx.imageSmoothingEnabled = false;   /* re-set after every resize (resize resets context state) */
  const span = WORLD_W * TILE;
  /* snap the camera to whole world pixels — tiles always land on the 32x32
     pixel grid, so moving and zooming can never open seams between them */
  const camX = Math.floor(((frame.x % span) + span) % span);
  landCtx.clearRect(0, 0, lw, lh);
  const atlasFn = page => landImages.get(page) ?? null;
  renderWorld(landCtx, state.landWorld, atlasFn, camX, 24 * TILE, lw, lh, state.clock);
  /* the world is only WORLD_W tiles wide — when the viewport runs past its
     right edge, draw the wrapped columns again on the right (the ground is a
     uniform fill, so the seam is invisible) */
  if (camX + lw > span) renderWorld(landCtx, state.landWorld, atlasFn, camX - span, 24 * TILE, lw, lh, state.clock);
  ctx.drawImage(landCanvas, 0, 0, lw, lh, 0, ground, lw * s, lh * s);
}

/* ---------------- ancestral -------------------------------------------- */
async function loadAncestrals() {
  try {
    const data = await (await fetch(moduleURL("../docs/ancestral/data.json"))).json();
    const map = new Map();
    for (const [famKey, fam] of Object.entries(data.families))
      for (const lv of fam.levels) map.set(lv.id, { family: famKey, level: lv, name: lv.name });
    state.ancestralMap = map;
    syncAuraPass();
    /* the inventory grid uses this to give leveled ancestrals the box-art item box */
    P.ancestralIds = new Set(map.keys());
  } catch { state.ancestralMap = new Map(); }
}
const { drawAncestral, TintCache } = await import("../docs/ancestral/renderer.js");
const ancestralTint = new TintCache();
function drawAncestralAura(s, rootX, ground, frame, layer) {
  const item = state.equipped.get(9);
  if (!item || !state.ancestralMap) return;
  const info = state.ancestralMap.get(item.id);
  if (!info) return;
  const lift = state.lastResult.lift?.y ?? 0;
  /* base must map the fx anchor (16,32) onto the character's CURRENT canvas
     position. `ground` is already the camera-adjusted ground line
     (groundCam), so the aura shares the avatar's transform exactly — no
     extra camera offset. frame.y is the root's world-space movement
     (unscaled, like rootY), while lift is a body shift baked into the
     avatar canvas — magnified by PS like every rig-space offset, so a
     mounted or floating character keeps its effects anchored to it.
     The fx are drawn in character-following mode: NO motion path is passed,
     so fxEntries never world-anchors the particles — world-anchored fx
     freeze at their birth positions and trail stale frames behind the
     walking player (the "old sprite" the effects showed). The orbiting
     artifacts follow the character instead, like the real game. */
  const base = [s * PS, 0, 0, s * PS,
    rootX + (16 - 16 * PS) * s,
    ground - 32 * s + frame.y * s + (32 - 32 * PS + lift * PS) * s];
  drawAncestral(ctx, info.level, state.clock, {
    facing: motion.facing,
    /* the ancestral renderer reads sheets as a plain object keyed by name */
    sheets: Object.fromEntries(images),
    tint: ancestralTint,
    base, layer
  });
}

/* ---------------- frame loop ------------------------------------------- */
let hudTimer = 0;
function updateHUD() {
  const hud = $("#hud");
  if (!state.lastFrame) return;
  const f = state.lastFrame;
  const act = f.punch ? "PUNCH" : f.locomotion ? f.locomotion.toUpperCase() : "IDLE";
  const ab = state.abilities;
  const extra = [ab?.doubleJump ? "double jump" : null, ab?.highJump ? "high jump" : null, ab?.speedy ? "speedy" : null].filter(Boolean).join(" · ");
  hud.textContent = `${act}${extra ? " · " + extra : ""} · ${state.equipped.size} pieces`;
}
P.on("frame", ({ dt, ctx: c, w, h }) => {
  if (!state.ready || !state.lastResult) return;
  try {
  const ms = Math.min(100, dt * 1000);
  state.remainder += ms;
  while (state.remainder >= 1000 / 60) { step(1000 / 60); state.remainder -= 1000 / 60; }

  const frame = state.lastFrame, result = state.lastResult;
  /* camera zoom (100% by default — close to the player): scales the player,
     land and plate inside the preview — the weather backdrop always fills
     the canvas */
  const s = Math.min(4, Math.max(3, w / 480)) * P.camZoom.v;
  /* ground line: player centered in the frame (Growtopia keeps the actor
     mid-screen; the inventory overlays the lower part of the world) */
  const ground = h / 2 + 16 * PS * s;   /* visible body (~32*PS world units) centered: body center = h/2 */
  const scroll = frame.x * s;

  /* render the avatar FIRST so the current frame's bounds (which include
     hats, hair and item lift) drive the camera */
  renderAvatar();
  const b = state.avatarBounds;
  /* vertical camera: the player may rise freely until the top of the plate +
     head reaches the preview's top border, then the camera follows so the
     player is never cut off — the ground strip and shadow move with it */
  const lift = result.lift?.y ?? 0;
  const topUnits = Math.min(state.contentTop ?? b?.y ?? 0, lift - 12);   /* name plate above the head */
  const freeTop = ground - 32 * s + frame.y * s + (32 + (topUnits - 32) * PS) * s;
  const cameraY = Math.min(0, freeTop - 6);
  const groundCam = ground - cameraY;
  const rootX = w / 2 - 16 * s, rootY = groundCam - 32 * s + frame.y * s;
  /* published for the touch-punch aim (used by the next step) */
  state.view = { rootX, rootY, s, lift };

  c.imageSmoothingEnabled = false;
  /* background: the weather scene (plain sky only if it failed to load) —
     static fully-rendered preview first, then animated from that frame */
  if (state.weatherRenderer) {
    const now = performance.now();
    if (now < state.weatherAnimAt) state.weatherRenderer.render(state.weatherT0);
    else state.weatherRenderer.render(state.weatherT0 + now - state.weatherAnimAt);
    c.drawImage(weatherBG, 0, 0, w, h);
  } else if (state.weatherStill) {
    c.imageSmoothingEnabled = false;
    c.drawImage(state.weatherStill, 0, 0, w, h);
  } else {
    drawScene(w, h, ground, s, scroll);
  }
  /* shadow */
  c.fillStyle = "rgba(37,61,53,0.17)";
  const shadow = Math.max(0.3, 1 + frame.y / 150);
  c.beginPath();
  c.ellipse(w / 2, groundCam + 2, 16 * PS * s * shadow, 3 * PS * s * shadow, 0, 0, Math.PI * 2);
  c.fill();
  /* ground strip over the weather scene so the player is anchored; the land
     system always renders it (Dirt by default) */
  if (state.landWorld) drawLandGround(w, h, groundCam, s, frame);
  /* avatar + ancestral aura: the orbiting fx pass behind the player first,
     then the avatar, then the front fx (Growtopia's orbiting artifacts circle
     behind the player on the far side of their orbit) */
  drawAncestralAura(s, rootX, groundCam, frame, "behind");
  /* the avatar canvas is scaled by PS around the feet pivot (rig 16,32):
     rig point (16,32) lands on (rootX + 16*s, groundCam) — planted on the
     ground line, centered — and every other point follows proportionally */
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(avatar,
    rootX + (16 - 16 * PS) * s + b.x * PS * s,
    rootY + (32 - 32 * PS) * s + b.y * PS * s,
    b.width * PS * s, b.height * PS * s);
  c.restore();
  /* ancestral aura (front fx) */
  drawAncestralAura(s, rootX, groundCam, frame, "front");
  /* name plate above the head (Website plate system, drawn at world scale).
     The plate's animations expect MILLISECONDS — state.clock is already ms.
     A touch smaller than the world scale, nudged a touch left of center. */
  if (P.plate) {
    P.plate.draw(c, w / 2 - 2 * s, rootY + (32 + (lift - 38) * PS) * s, s * 0.9, state.clock);
  }
  /* weather foreground layer (rain, snow, particles in front) */
  if (state.weatherRenderer) c.drawImage(weatherFG, 0, 0, w, h);

  if (performance.now() - hudTimer > 250) { hudTimer = performance.now(); updateHUD(); }
  } catch (err) {
    console.error(err);
    state.ready = false;
    $("#hud").textContent = "Render error: " + err.message;
  }
});

/* ---------------- export ------------------------------------------------ */
document.querySelector('[data-a="export"]')?.addEventListener("click", () => {
  try {
    /* the live preview renders on the 32px tile grid (matching the land's
       32x32 style); exports still come out at the dense 128px scale */
    const live = state.resolution;
    state.resolution = 128;
    renderAvatar();
    state.resolution = live;
    const a = document.createElement("a");
    a.download = `growtopia-${avatar.width}px.png`;
    a.href = avatar.toDataURL("image/png");
    a.click();
    P.toast(`Exported ${avatar.width} × ${avatar.height} PNG`);
    renderAvatar();   /* restore the preview-resolution canvas */
  } catch { P.toast("Export blocked by image security."); }
});

/* ---------------- dyes (Makeup tab) ------------------------------------- */
P.dyes = { hair: [255, 255, 255], whites: [255, 255, 255], pupils: [0, 0, 0] };
P.applyDyes = function () {
  tintSheets(["player_hair.png", "player_hairhair.png"], P.dyes.hair);
  tintEyes();
};
function tintSheets(names, rgb) {
  const t = rgb.map(v => v / 255);
  for (const name of names) {
    const src = images.get(name);
    if (!src || !src.complete || !src.naturalWidth) continue;
    const c = document.createElement("canvas");
    c.width = src.naturalWidth; c.height = src.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(src, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < id.data.length; i += 4) {
      id.data[i] *= t[0]; id.data[i + 1] *= t[1]; id.data[i + 2] *= t[2];
    }
    g.putImageData(id, 0, 0);
    atlases.set(name, registerAtlas(c));
  }
}
function tintEyes() {
  const name = "player_eyes.png", src = images.get(name);
  if (!src || !src.complete || !src.naturalWidth) return;
  const wT = P.dyes.whites.map(v => v / 255), pT = P.dyes.pupils.map(v => v / 255);
  const c = document.createElement("canvas");
  c.width = src.naturalWidth; c.height = src.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < id.data.length; i += 4) {
    const lum = (id.data[i] + id.data[i + 1] + id.data[i + 2]) / 3;
    const t = lum < 60 ? pT : wT;   /* dark pixels are the pupils, light the sclera */
    id.data[i] *= t[0]; id.data[i + 1] *= t[1]; id.data[i + 2] *= t[2];
  }
  g.putImageData(id, 0, 0);
  atlases.set(name, registerAtlas(c));
}

/* ---------------- Planner inventory icons -------------------------------
   The old Demo thumbnail path cropped arbitrary gameIcon/worn sprites. Use
   Planner's authoritative inventory icon profiles, chosen frame, composed
   feet icons and color reconstruction. The source frame stays 32×32; CSS
   confines it to the safe interior of each item box. */
P.thumb = function (raw, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-hidden", "true");
  renderPlannerInventoryIcon(canvas, raw);
  return canvas;
};

/* ---------------- boot -------------------------------------------------- */
window.plannerApp = state;   /* debug/QA hook */
state.landCanvas = landCanvas;   /* QA: terrain-layer probe (transparent pixels = land holes) */
(async function init() {
  try {
    const response = await fetch(moduleURL("../demo/catalog.json"));
    if (!response.ok) throw Error("Catalog did not load");
    state.catalog = await response.json();
    P.catalog = state.catalog;
    const liftData = await (await fetch(moduleURL("../demo/lift-profiles.json"))).json();
    state.catalog.liftProfiles = Object.fromEntries(liftData.profiles.map(p => [p.id, p]));
    const rendererResponse = await fetch(moduleURL("../demo/renderer-data.json"));
    if (rendererResponse.ok) state.catalog.renderers = (await rendererResponse.json()).scripts;
    try { const fx = await fetch(moduleURL("../demo/fx-data.json")); if (fx.ok) state.catalog.fxRenderers = (await fx.json()).scripts; } catch {}
    try { const pd = await fetch(moduleURL("../demo/punch-data.json")); if (pd.ok) state.catalog.punchData = await pd.json(); } catch {}
    state.nativeMetadata = await (await fetch(moduleURL("../demo/native-metadata.json"))).json();
    state.abilityRegistry = await (await fetch(moduleURL("../demo/ability-registry.json"))).json();

    const names = ["player_body_only.png", "player_head.png", "player_extraleg.png", "player_feet.png", "player_eyes.png",
      "player_arm.png", "player_puncharm.png", "player_sleeve.png", "player_hair.png", "player_hairhair.png",
      "player_shirt.png", "player_pants.png", "player_handitem.png", "player_back.png", "player_horsepants.png",
      "particles.png", "particles2.png", "tiles_page1.png"];
    await Promise.all(names.map(loadAtlas));

    /* procedural reference FX sheet (same as the Demo boot): plain shapes
       the fx renderers reference when an item has no dedicated particles */
    {
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(10, 10, 7, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(6, 24); g.lineTo(16, 14); g.lineTo(26, 24); g.closePath(); g.fill();
      g.beginPath(); g.arc(18, 6, 3, 0, Math.PI * 2); g.fill();
      images.set("reference-fx.png", c);
      atlases.set("reference-fx.png", registerAtlas(c));
    }

    motion = new PreviewMotion();
    player = new PlannerPlayer(state.catalog);
    state.lastFrame = motion.snapshot();
    state.lastResult = player.step(
      { ...state.lastFrame, worldX: state.lastFrame.x, worldY: state.lastFrame.y, x: 0, y: 0 }, 0,
      { skin: state.skin, effects: true });
    state.equipped.clear();
    state.abilities = resolveAbilities([], state.abilityRegistry);
    motion.setAbilities(state.abilities);
    await loadAncestrals();
    try {
      const rows = await (await fetch(moduleURL("../data/land-blocks.json?v=2"))).json();
      registerBlocks(rows);
    } catch { /* land tab will report unavailable */ }
    /* set the land (Dirt by default) before the first frame so the scene is complete */
    const savedLand0 = P.store.get("land", String(DEFAULT_LAND));
    setLand(savedLand0 === "none" ? DEFAULT_LAND : +savedLand0);

    state.ready = true;
    P.equippedIds = new Set();
    P.emit("catalog");
    P.emit("boot");
    updateHUD();
    /* restore the saved weather (Sunny by default) */
    const saved = P.store.get("weather", "sunny");
    if (saved && saved !== "none") setWeather(saved);
  } catch (error) {
    console.error(error);
    $("#hud").textContent = "Unable to start: " + error.message;
  }
})();
