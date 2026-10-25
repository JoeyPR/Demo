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
import { WeatherRenderer, loadSheets, hillSceneOffset } from "../weather-engine/weather-renderer.js";
import { applyCloudFix, CLOUD_FIX_KEYS } from "../weather-engine/custom-weathers.js";
import { registerBlocks, renderWorld, BLOCKS, WORLD_W, WORLD_PX_W, CAVE_BACKGROUND_ID, LAND_NONE, DEFAULT_LAND_ID, resolveLandSelection, uniformLandWorld } from "./land-system.mjs";
import { renderDemoInventoryIcon } from "./inventory-icons.mjs";
import { clampCameraZoom, computeCameraLayout, unprojectCameraPoint } from "./camera.mjs";
import { PLAYER_VISUAL_SCALE, PLAYER_SHADOW_OPACITY, getPlayerShadowCalls, playerVisualRect, playerShadowOffset } from "./player-shadow.mjs";

const $ = s => document.querySelector(s);
const moduleURL = path => new URL(path, import.meta.url);
const world = $("#pv"), ctx = world.getContext("2d");
const avatar = document.createElement("canvas"), avatarCtx = avatar.getContext("2d");
const avatarShadow = document.createElement("canvas"), avatarShadowCtx = avatarShadow.getContext("2d");
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
  ancestralMap: null, ancestralPath: [], abilities: null, hiddenPasses: new Set(),
  landBlock: null, landWorld: null, view: null, aim: null, punchHold: false, punchPointer: null, gesturePunchUntil: 0
};
let player, motion, lastTimestamp = 0;
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
  // A different ancestral starts a fresh motion sequence; don't inherit the
  // previous item's walking/jump history or its in-flight FX birth positions.
  if (raw.slot === 9) state.ancestralPath.length = 0;
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
P.on("skin", i => {
  state.skin = SKINS[i].rgb;
  // Refresh currently mounted inventory canvases that use skin-relative tint.
  // The grid is virtualized, so this touches only the visible boxes.
  document.querySelectorAll(".box .ic canvas").forEach(canvas => {
    if (canvas.__demoItem) renderDemoInventoryIcon(canvas, canvas.__demoItem, state.skin);
  });
});

/* ---------------- simulation ------------------------------------------- */
/* Pet engine host extras carried on the motion: the rig arm angle and player
   lift lag one render (the pose resolves after the items advance), the
   bare-head flag feeds head-riding pets, and the preview floor is flat so the
   solid query is always standable — the source queries real world tiles for
   the pet trail's platform edges. */
function withPetHost(motion) {
  return { ...motion,
    armAngle: state.lastResult?.pose?.frontAngle ?? 0,
    petBareHead: !state.equipped.get(0),
    petLift: state.lastResult?.lift?.y ?? 0,
    petWorld: { solidAt: () => true } };
}
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
    /* Unproject the pointer through the camera scope before aiming in the
       player's fixed 32-unit rig coordinates. */
    const { x: aimX, y: aimY } = unprojectCameraPoint(
      state.aim.x, state.aim.y,
      state.view.cameraPivotX, state.view.cameraPivotY, state.view.cameraZoom
    );
    const cx = rootX + 16 * s, cy = rootY + 32 * s;
    motion.facing = aimX >= cx ? 1 : -1;
    let x = 16 + (aimX - cx) / s;
    if (motion.facing < 0) x = 32 - x;
    input.punchTarget = [x, 32 + (aimY - cy) / s - (lift ?? 0)];
  }
  const frame = motion.step(dt, input);
  if (frame.ground && !input.right && !input.left) frame.locomotion = "idle";
  state.lastFrame = frame;
  state.lastResult = player.step(
    withPetHost({ ...frame, worldX: frame.x, worldY: frame.y, x: 0, y: 0 }), dt,
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
  /* the pet leash string is a line primitive with no atlas; it needs none */
  const missing = [...new Set(state.lastResult.calls.filter(c => !c.line && !atlases.has(c.atlas)).map(c => c.atlas))];
  for (const name of missing) loadAtlas(name);
  const wornAncestral = state.equipped.get(9);
  const customAncestralId = wornAncestral && state.ancestralMap?.has(wornAncestral.id)
    ? wornAncestral.id : null;
  const calls = state.lastResult.calls.filter(c =>
    !state.hiddenPasses.has(c.pass) &&
    // The dedicated ancestral renderer owns the worn artifact's appearance.
    // Suppress its legacy sprite draws even when they use RenderInFront.
    !(customAncestralId !== null && c.owner === customAncestralId) &&
    (c.line || atlases.has(c.atlas)));
  const bounds = drawBounds(calls), scale = state.resolution / 32;
  const width = Math.ceil(bounds.width * scale), height = Math.ceil(bounds.height * scale);
  if (avatar.width !== width || avatar.height !== height) { avatar.width = width; avatar.height = height; }
  if (avatarShadow.width !== width || avatarShadow.height !== height) { avatarShadow.width = width; avatarShadow.height = height; }
  avatarCtx.setTransform(1, 0, 0, 1, 0, 0);
  avatarCtx.clearRect(0, 0, width, height);
  state.avatarBounds = bounds;
  drawCanvas(avatarCtx, calls, atlases, { tilePixels: state.resolution, camera: [bounds.x, bounds.y] });

  // Project a separate pure-black alpha mask from the player and wearable
  // sprites. FX, visuals, particles, pets, the ancestral and punch pieces are
  // intentionally excluded; each remaining item keeps its own draw matrix.
  const punching = !!state.lastFrame?.punch;
  const punchItemId = punching ? state.lastResult?.punchPose?.itemId ?? null : null;
  const shadows = getPlayerShadowCalls(calls, {
    ancestralId: state.equipped.get(9)?.id ?? null,
    punchingItemId: punchItemId,
    punching,
  });
  avatarShadowCtx.setTransform(1, 0, 0, 1, 0, 0);
  avatarShadowCtx.clearRect(0, 0, width, height);
  if (shadows.length) drawCanvas(avatarShadowCtx, shadows, atlases,
    { tilePixels: state.resolution, camera: [bounds.x, bounds.y] });
  return calls.length;
}

/* ---------------- weather --------------------------------------------- */
/* Loading a weather goes through a static preview first: once the weather's
   sheets are decoded, its fully-rendered first frame is held still for a
   moment (STATIC fully rendered weather), then the animation takes over from
   that exact timeline position (ANIMATED fully rendered weather) — no jump. */
const WEATHER_STATIC_MS = 500;
async function setWeather(key) {
  /* "None" was removed from the weathers: a saved 'none' (or empty) falls
     back to Sunny — there is always a weather. */
  if (!key || key === "none") key = "sunny";
  state.weatherKey = key;
  state.weatherRenderer = null;
  state.weatherStill = null;
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
// The weather renderer shares these canvases by reference. Resize them when
// the preview switches logical dimensions (mobile/desktop or orientation).
P.on("preview", pv => {
  const w = pv?.w ?? world.width, h = pv?.h ?? world.height;
  for (const canvas of [weatherBG, weatherFG]) {
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }
});

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
const DEFAULT_LAND = DEFAULT_LAND_ID;   /* Dirt — the default land the player walks on */
function setLand(id) {
  /* Only the Dirt and Bedrock families are land options, plus a genuine
     None: no land at all (and therefore no Cave Background — it is a backdrop
     behind land blocks, never drawn on its own). Legacy unsupported picks
     normalize to None via resolveLandSelection. */
  const resolved = resolveLandSelection(id);
  if (resolved === LAND_NONE) { state.landBlock = null; state.landWorld = null; return; }
  const def = BLOCKS[resolved];
  landPage(def.page || "tiles_page1");
  /* Cave Background renders BEHIND the blocks: it fills the world's background
     layer (renderWorld draws bg before fg), so its sheet page must load too. */
  landPage(BLOCKS[CAVE_BACKGROUND_ID].page || "tiles_page1");
  state.landBlock = resolved;
  /* uniform world: rows 0-23 air, rows 24-59 the selected block with Cave
     Background behind it — the top row picks up the block's top-edge autotile
     variant; world-edge columns read as connected so scrolling wraps cleanly */
  state.landWorld = uniformLandWorld(resolved);
}
P.on("land", id => setLand(id));
function drawLandGround(w, h, ground, s, frame, zoom) {
  // Render land tiles at 24 screen-units per 32-unit source tile — the
  // midpoint between the former 16-unit and 32-unit sizes. Player scale stays
  // separate at 0.78; tile/world coordinates remain native.
  const landS = s * (24 / 32);
  const lw = Math.ceil(w / (landS * zoom));
  const lh = Math.max(1, Math.ceil(h / (landS * zoom)) + 2);
  if (landCanvas.width !== lw || landCanvas.height !== lh) {
    landCanvas.width = lw; landCanvas.height = lh;
  }
  landCtx.imageSmoothingEnabled = false;
  const span = WORLD_PX_W;
  const camX = ((Math.floor(frame.x) % span) + span) % span;
  landCtx.clearRect(0, 0, lw, lh);
  const atlasFn = page => landImages.get(page) ?? null;
  renderWorld(landCtx, state.landWorld, atlasFn, camX, 24 * 32, lw, lh, state.clock);
  if (camX + lw > span) renderWorld(landCtx, state.landWorld, atlasFn, camX - span, 24 * 32, lw, lh, state.clock);
  const dx = (w - lw * landS) / 2;
  ctx.drawImage(landCanvas, 0, 0, lw, lh, dx, ground, lw * landS, lh * landS);
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
function drawAncestralAura(s, rootX, ground, frame, layer, cameraPivotX, cameraPivotY, zoom) {
  const item = state.equipped.get(9);
  if (!item || !state.ancestralMap) return;
  const info = state.ancestralMap.get(item.id);
  if (!info) return;
  const lift = state.lastResult.lift?.y ?? 0;
  // The effect renderer writes absolute transforms. Scale its authored rig
  // space with the player, while pinning the FX anchor (16,32) to the same
  // current feet/chest point and applying camera zoom exactly once.
  const anchorX = rootX + 16 * s;
  const anchorY = ground + (frame.y + lift) * s;
  const screenAnchorX = cameraPivotX + (anchorX - cameraPivotX) * zoom;
  const screenAnchorY = cameraPivotY + (anchorY - cameraPivotY) * zoom;
  const fxScale = s * PLAYER_VISUAL_SCALE * zoom;
  const base = [fxScale, 0, 0, fxScale,
    screenAnchorX - 16 * fxScale,
    screenAnchorY - 32 * fxScale];
  // The ancestral renderer's movement-aware sequence needs the avatar's
  // actual position history, not just its current facing. It samples this
  // path at each FX instance's birth time, so walking, jumps, and turns all
  // choose the correct authored animation sequence for every ancestral.
  const charX = 16 + frame.x;
  const charY = 32 + frame.y + lift;
  // The behind pass runs first: record exactly once per displayed frame so
  // both depth passes receive the same current sample. Keep the last 6 s,
  // which covers the lifetime of the authored FX particles without growing
  // history forever. Frame time can repeat when RAF outruns the sim step.
  if (layer === "behind") {
    const sample = [state.clock, charX, charY, motion.facing];
    const last = state.ancestralPath[state.ancestralPath.length - 1];
    if (last && last[0] === state.clock) state.ancestralPath[state.ancestralPath.length - 1] = sample;
    else state.ancestralPath.push(sample);
    while (state.ancestralPath.length && state.ancestralPath[0][0] < state.clock - 6000)
      state.ancestralPath.shift();
  }
  drawAncestral(ctx, info.level, state.clock, {
    facing: motion.facing,
    sheets: Object.fromEntries(images),
    tint: ancestralTint,
    base, layer,
    motion: { x: charX, y: charY, facing: motion.facing, path: state.ancestralPath }
  });
}

/* Every hill band follows accumulated player travel immediately — no
   waiting until the player reaches a world edge. The weather renderer applies
   each sheet's own speed: hill1 = 1x, hill2 = 0.5x, hill3 = 0.25x. */
function hillOffsetsNow(w, h, s, frame) {
  const r = state.weatherRenderer;
  if (!r || !r.hillSpeeds?.size) return new Map();
  const cfg = r.cfg;
  const pxPerSceneUnit = Math.max(w / cfg.w, h / cfg.h);   /* the renderer's COVER scale */
  const offsets = new Map();
  for (const [sheetIndex, speed] of r.hillSpeeds) {
    offsets.set(sheetIndex, hillSceneOffset(frame.x, s, pxPerSceneUnit, speed));
  }
  // A single sprite sheet can contain multiple independent parallax bands.
  // Arid's two desert_wobbly groups follow their nearest desert hill layer.
  for (const [track, speed] of (r.hillTrackSpeeds ?? new Map())) {
    offsets.set(track, hillSceneOffset(frame.x, s, pxPerSceneUnit, speed));
  }
  return offsets;
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
  // Logical draw scale never includes zoom. Only the camera transform changes.
  const s = Math.min(4, Math.max(3, w / 480));
  const zoom = clampCameraZoom(P.camZoom?.v ?? 1);

  renderAvatar();
  const b = state.avatarBounds;
  const lift = result.lift?.y ?? 0;
  /* the singular camera: player-centered zoom — the pivot is the ground point
     under the player, and there are no clamps, pans or post-zoom shifts, so
     for a fixed pose every position below is identical at every zoom */
  const camera = computeCameraLayout({ width: w, height: h, scale: s, frameY: frame.y, zoom });
  const { ground, rootX, rootY, cameraPivotX, cameraPivotY } = camera;
  state.view = { rootX, rootY, s, lift, cameraZoom: zoom, cameraPivotX, cameraPivotY };

  c.imageSmoothingEnabled = false;
  // Backdrop remains viewport-filling; otherwise zoom-out would reveal blanks.
  if (state.weatherRenderer) {
    const now = performance.now();
    const t = now < state.weatherAnimAt ? state.weatherT0 : state.weatherT0 + now - state.weatherAnimAt;
    /* hill weathers drift with the player's travel beyond the rendered world
       region (see hillSceneOffset); every other weather ignores it */
    state.weatherRenderer.render(t, hillOffsetsNow(w, h, s, frame));
    c.drawImage(weatherBG, 0, 0, w, h);
  } else if (state.weatherStill) {
    c.drawImage(state.weatherStill, 0, 0, w, h);
  } else {
    drawScene(w, h);
  }

  // Apply the one player-centered scope transform to all foreground world art:
  // zoom scales the actor's position, jump displacement, ground and land
  // together around the player's ground point. Physics positions, tile
  // coordinates and the avatar's source pixels do not change when zooming.
  c.save();
  c.translate(cameraPivotX, cameraPivotY);
  c.scale(zoom, zoom);
  c.translate(-cameraPivotX, -cameraPivotY);

  const playerRect = playerVisualRect(b, rootX, rootY, s);
  const shadowOffset = playerShadowOffset(motion.facing);
  // Keep the shadow in screen space: it follows the zoom-projected player
  // position, but neither its 12px offset nor its silhouette size scales.
  const shadowScreenCenterX = cameraPivotX +
    (playerRect.x + playerRect.width / 2 - cameraPivotX) * zoom;
  const shadowScreenBottomY = cameraPivotY +
    (playerRect.y + playerRect.height - cameraPivotY) * zoom;
  const shadowScreenX = shadowScreenCenterX - playerRect.width / 2 + shadowOffset.x;
  const shadowScreenY = shadowScreenBottomY - playerRect.height + shadowOffset.y;
  // Render order: the shadow is behind land, while the player and clothing
  // remain in front of land as in the original preview.
  c.imageSmoothingEnabled = false;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = PLAYER_SHADOW_OPACITY;
  c.drawImage(avatarShadow, shadowScreenX, shadowScreenY,
    playerRect.width, playerRect.height);
  c.restore();
  if (state.landWorld) drawLandGround(w, h, ground, s, frame, zoom);
  drawAncestralAura(s, rootX, ground, frame, "behind", cameraPivotX, cameraPivotY, zoom);
  // Scale the player and all clothing around rig feet (16,32). Land tiles use
  // the full 32-unit world scale; the character remains at 0.78 scale.
  c.imageSmoothingEnabled = false;
  c.drawImage(avatar, playerRect.x, playerRect.y, playerRect.width, playerRect.height);
  drawAncestralAura(s, rootX, ground, frame, "front", cameraPivotX, cameraPivotY, zoom);
  if (P.plate) {
    const playerTop = ground + frame.y * s - 32 * PLAYER_VISUAL_SCALE * s + lift * PLAYER_VISUAL_SCALE * s;
    P.plate.draw(c, w / 2, playerTop - 6 * s, s * 0.9, state.clock);
  }
  c.restore();
  // Foreground weather is viewport-space, as it was before camera-scope
  // rendering; zooming the world must not move or scale rain/snow overlays.
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

/* ---------------- Demo-native inventory icons -----------------------------
   Item-specific source cells and tint/layer indicators are loaded from Demo's
   generated inventory icon index; all render code and source images stay local. */
P.thumb = function (raw, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-hidden", "true");
  canvas.__demoItem = raw;
  renderDemoInventoryIcon(canvas, raw, state.skin);
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
      withPetHost({ ...state.lastFrame, worldX: state.lastFrame.x, worldY: state.lastFrame.y, x: 0, y: 0 }), 0,
      { skin: state.skin, effects: true });
    state.equipped.clear();
    state.abilities = resolveAbilities([], state.abilityRegistry);
    motion.setAbilities(state.abilities);
    await loadAncestrals();
    try {
      const rows = await (await fetch(moduleURL("../data/land-blocks.json?v=2"))).json();
      registerBlocks(rows);
    } catch { /* land tab will report unavailable */ }
    /* set the land before the first frame so the scene is complete (Dirt by
       default; a saved 'none' or a legacy unsupported pick renders no land) */
    setLand(resolveLandSelection(P.store.get("land", String(DEFAULT_LAND))));

    state.ready = true;
    P.equippedIds = new Set();
    P.emit("catalog");
    P.emit("boot");
    updateHUD();
    /* restore the saved weather (Sunny by default — there is no "None" weather) */
    setWeather(P.store.get("weather", "sunny"));
  } catch (error) {
    console.error(error);
    $("#hud").textContent = "Unable to start: " + error.message;
  }
})();
