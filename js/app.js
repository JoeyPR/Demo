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

const $ = s => document.querySelector(s);
const moduleURL = path => new URL(path, import.meta.url);
const world = $("#pv"), ctx = world.getContext("2d");
const avatar = document.createElement("canvas"), avatarCtx = avatar.getContext("2d");
const weatherBG = document.createElement("canvas"), weatherFG = document.createElement("canvas");

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
  weatherRenderer: null, weatherKey: null, ancestralMap: null,
  ancestralPath: [], abilities: null, hiddenPasses: new Set()
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
  player.equip([...state.equipped.values()]);
  state.abilities = resolveAbilities([...state.equipped.values()], state.abilityRegistry);
  motion?.setAbilities(state.abilities);
  P.equippedIds = new Set([...state.equipped.values()].map(i => i.id));
  P.emit("equip-state");
  updateHUD();
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
    punch: state.clock < state.punchUntil || !!P.input.punch
  };
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

/* ---------------- rendering ------------------------------------------- */
const PALETTE = {
  sky: "#c6dcd1", cloud: "#e8eee0", sun: "#f7e9ac", far: "#acbeab", hill: "#94ac94",
  grass: "#799555", edge: "#a1b36c", soil: "#8a745a", dark: "#76644f"
};
function cloud(x, y, s, color) {
  ctx.fillStyle = color;
  for (const [dx, dy, w, h] of [[0, 8, 62, 12], [10, 0, 28, 28], [38, 5, 32, 20], [-8, 13, 18, 10]])
    ctx.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.ceil(w * s), Math.ceil(h * s));
}
function drawScene(w, h, ground, s, scroll) {
  ctx.fillStyle = PALETTE.sky; ctx.fillRect(0, 0, w, h);
  const sunX = w * .77, sunY = h * .22;
  ctx.fillStyle = PALETTE.sun; ctx.fillRect(sunX - 18, sunY - 24, 36, 48); ctx.fillRect(sunX - 24, sunY - 18, 48, 36);
  cloud(w * .15 - scroll * .08, h * .22, 1.35, PALETTE.cloud);
  cloud(w * .58 - scroll * .04, h * .12, .75, PALETTE.cloud);
  cloud(w * .89 - scroll * .03, h * .37, .65, PALETTE.cloud);
  ctx.fillStyle = PALETTE.far;
  for (let i = -1; i < 12; i++) {
    const x = i * 110 - ((scroll * .13) % 110), top = ground - 55 - (i % 3) * 18;
    ctx.fillRect(x, top, 110, h); ctx.fillRect(x + 20, top - 18, 70, 20);
  }
  ctx.fillStyle = PALETTE.hill;
  for (let i = -1; i < 8; i++) {
    const x = i * 160 - ((scroll * .23) % 160), top = ground - 22 - (i % 3) * 11;
    ctx.fillRect(x, top, 160, h); ctx.fillRect(x + 24, top - 16, 95, 20);
  }
}
function drawGround(w, h, ground, s, scroll) {
  const tile = 32 * s;
  ctx.fillStyle = PALETTE.soil; ctx.fillRect(0, ground, w, h - ground);
  for (let i = -1; i < Math.ceil(w / tile) + 1; i++) {
    const x = i * tile - (scroll % tile);
    ctx.fillStyle = PALETTE.dark; ctx.fillRect(Math.round(x), ground + 14, 1, h);
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(Math.round(x), ground, tile + 1, 13);
    ctx.fillStyle = PALETTE.edge; ctx.fillRect(Math.round(x), ground, tile + 1, 4);
  }
}
function renderAvatar() {
  const calls = state.lastResult.calls.filter(c => !state.hiddenPasses.has(c.pass) && atlases.has(c.atlas));
  const bounds = drawBounds(calls), scale = state.resolution / 32;
  const width = Math.ceil(bounds.width * scale), height = Math.ceil(bounds.height * scale);
  if (avatar.width !== width || avatar.height !== height) { avatar.width = width; avatar.height = height; }
  avatarCtx.setTransform(1, 0, 0, 1, 0, 0);
  avatarCtx.clearRect(0, 0, width, height);
  state.avatarBounds = bounds;
  drawCanvas(avatarCtx, calls, atlases, { tilePixels: state.resolution, camera: [bounds.x, bounds.y] });
  return calls.length;
}

/* ---------------- weather --------------------------------------------- */
async function setWeather(key) {
  state.weatherKey = key;
  state.weatherRenderer = null;
  if (!key || key === "none") return;
  try {
    const res = await fetch(moduleURL(`../data/variants/base/${key}.json`));
    if (!res.ok) throw Error("weather config missing");
    const cfg = await res.json();
    const imgs = await loadSheets(cfg, moduleURL("../sheets/").href);
    weatherBG.width = world.width; weatherBG.height = world.height;
    weatherFG.width = world.width; weatherFG.height = world.height;
    if (state.weatherKey !== key) return; /* switched again while loading */
    state.weatherRenderer = new WeatherRenderer(cfg, imgs, weatherBG, weatherFG);
  } catch (err) {
    P.toast("Weather unavailable: " + key);
  }
}
P.on("weather", key => setWeather(key));

/* ---------------- ancestral -------------------------------------------- */
async function loadAncestrals() {
  try {
    const data = await (await fetch(moduleURL("../docs/ancestral/data.json"))).json();
    const map = new Map();
    for (const [famKey, fam] of Object.entries(data.families))
      for (const lv of fam.levels) map.set(lv.id, { family: famKey, level: lv, name: lv.name });
    state.ancestralMap = map;
  } catch { state.ancestralMap = new Map(); }
}
const { drawAncestral } = await import("../docs/ancestral/renderer.js");
const ANCESTRAL_SHEETS = { "particles.png": true, "particles2.png": true, "tiles_page1.png": true };
function drawAncestralAura(s, rootX, ground, cameraY, frame) {
  const item = state.equipped.get(9);
  if (!item || !state.ancestralMap) return;
  const info = state.ancestralMap.get(item.id);
  if (!info) return;
  const lift = state.lastResult.lift?.y ?? 0;
  /* the character's current position in the fx-local world frame */
  const charX = 16 + frame.x, charY = 32 + frame.y + lift;
  const base = [s, 0, 0, s, rootX + 16 * s - charX * s, ground - 32 * s - cameraY];
  const motionState = {
    x: charX, y: charY,
    facing: motion.facing,
    path: state.ancestralPath
  };
  state.ancestralPath.push([state.clock, charX, charY, motion.facing]);
  while (state.ancestralPath.length > 240) state.ancestralPath.shift();
  drawAncestral(ctx, info.level, state.clock, {
    facing: motion.facing, sheets: images, base, motion: motionState
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
  const s = Math.min(4, Math.max(3, w / 480));
  const ground = h * 0.78;
  const headroom = Math.min(100, Math.max(4, ground - 32 * s + Math.min(0, (result.lift?.y ?? 0) * s) - 18));
  const cameraY = Math.min(0, frame.y * s + headroom);
  const scroll = frame.x * s;
  const rootX = w / 2 - 16 * s, rootY = ground - 32 * s + frame.y * s - cameraY;

  c.imageSmoothingEnabled = false;
  /* background: weather scene or the Demo's procedural reference scene */
  if (state.weatherRenderer) {
    state.weatherRenderer.render(performance.now() % 2147483647);
    c.drawImage(weatherBG, 0, 0, w, h);
  } else {
    drawScene(w, h, ground, s, scroll);
  }
  /* shadow */
  c.fillStyle = "rgba(37,61,53,0.17)";
  const shadow = Math.max(0.3, 1 + frame.y / 150);
  c.beginPath();
  c.ellipse(w / 2, ground + 2, 16 * s * shadow, 3 * s * shadow, 0, 0, Math.PI * 2);
  c.fill();
  /* ground strip over the weather scene so the player is anchored */
  if (state.weatherRenderer) drawGround(w, h, ground, s, scroll);
  /* avatar */
  renderAvatar();
  const b = state.avatarBounds;
  c.drawImage(avatar, rootX + b.x * s, rootY + b.y * s, b.width * s, b.height * s);
  /* ancestral aura */
  drawAncestralAura(s, rootX, ground, cameraY, frame);
  /* name plate above the head */
  if (P.plate) {
    const t = state.clock / 1000;
    P.plate.draw(c, w / 2, rootY + (result.lift?.y ?? 0) * s - 6 * s, Math.max(1, s * 0.42), t);
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
    renderAvatar();
    const a = document.createElement("a");
    a.download = `growtopia-${state.resolution}px.png`;
    a.href = avatar.toDataURL("image/png");
    a.click();
    P.toast(`Exported ${avatar.width} × ${avatar.height} PNG`);
  } catch { P.toast("Export blocked by image security."); }
});

/* ---------------- thumbnails for the grid ------------------------------- */
P.thumb = function (raw, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = size * 2; canvas.height = size * 2;
  canvas.style.width = canvas.style.height = size + "px";
  const c2 = canvas.getContext("2d");
  c2.imageSmoothingEnabled = false;
  const pieces = (raw.gameIcon ?? []).filter(r => r.a);
  const primary = pieces.find(r => r.a === raw.atlas) ?? pieces[0] ?? (raw.atlas ? {
    a: raw.atlas, sx: (raw.x ?? 0) * (raw.cell?.[0] ?? 1) * 32, sy: (raw.y ?? 0) * (raw.cell?.[1] ?? 1) * 32,
    sw: (raw.cell?.[0] ?? 1) * 32, sh: (raw.cell?.[1] ?? 1) * 32
  } : null);
  const draw = () => {
    c2.clearRect(0, 0, canvas.width, canvas.height);
    if (primary && images.has(primary.a)) {
      const s2 = size * 1.6;
      c2.drawImage(images.get(primary.a), primary.sx, primary.sy, primary.sw, primary.sh,
        (size * 2 - s2) / 2, (size * 2 - s2) / 2, s2, s2);
    } else {
      c2.fillStyle = "#a8b79e"; c2.font = `${size * .48}px monospace`; c2.textAlign = "center";
      c2.fillText(primary ? "…" : "?", size, size * 1.15);
    }
  };
  if (primary && !images.has(primary.a)) loadAtlas(primary.a).then(draw);
  draw();
  return canvas;
};

/* ---------------- boot -------------------------------------------------- */
window.plannerApp = state;   /* debug/QA hook */
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

    state.ready = true;
    P.equippedIds = new Set();
    P.emit("catalog");
    P.emit("boot");
    updateHUD();
    /* restore the saved weather */
    const saved = P.store.get("weather", "none");
    if (saved && saved !== "none") setWeather(saved);
  } catch (error) {
    console.error(error);
    $("#hud").textContent = "Unable to start: " + error.message;
  }
})();
