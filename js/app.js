/* The main planner: shared avatar/FX composition, terrain motion, weather,
   equipment and the original inventory/Drop contracts. */
import { PlannerPlayer } from "../demo/engine/player.mjs";
import { WorldMotion, WORLD_ORIGIN_X, WORLD_ORIGIN_Y, WORLD_TILE_SIZE, WORLD_PLAYER_HALF_WIDTH, WORLD_PLAYER_HEIGHT } from "./world-motion.mjs";
import { normalizeCatalogItem } from "../demo/engine/catalog-adapter.mjs";
import { drawCanvas } from "../demo/engine/render.mjs";
import { registerAtlas } from "../demo/engine/canvas-assets.mjs";
import { drawBounds } from "../demo/engine/draw-bounds.mjs";
import { resolveAbilities } from "../demo/engine/abilities.mjs";
import { rendererScripts } from "../demo/engine/research-data.mjs";
import { resolveLook } from "../demo/engine/look.mjs";
import { createReferenceFxAtlas } from "../demo/engine/reference-fx.mjs";
import { WeatherRenderer, loadSheets, hillSceneOffset } from "../weather-engine/weather-renderer.js";
import { applyCloudFix, CLOUD_FIX_KEYS } from "../weather-engine/custom-weathers.js";
import { registerBlocks, registerBackgroundBlocks, renderWorld, BLOCKS, WORLD_W, WORLD_PX_W, CAVE_BACKGROUND_ID, DEFAULT_BACKGROUND_ID, LAND_NONE, DEFAULT_LAND_ID, resolveLandSelection, resolveBackgroundSelection, uniformLandWorld, uniformBackgroundWorld } from "./land-system.mjs";
import { generateWorld, placeBlock, removeBlock, invalidateWorld } from "./land-system.mjs";
import { renderDemoInventoryIcon } from "./inventory-icons.mjs";
import { clampCameraZoom, computeCameraLayout, projectCameraPoint, unprojectCameraPoint } from "./camera.mjs";
import { PLAYER_VISUAL_SCALE, PLAYER_SHADOW_OPACITY, PLAYER_SHADOW_COLOR, getPlayerShadowCalls, playerVisualRect, playerShadowOffset } from "./player-shadow.mjs";
import { PICKUP_ATLAS_RECT, PICKUP_SIZE, PICKUP_BOX_EXTRA_SIZE, PICKUP_HOVER_HEIGHT, PICKUP_COLLECTION_TOTAL_DURATION, PICKUP_ICON_ART_SIZE, pickupDropVary, pickupPose, pickupIconFlightPose, pickupShouldCollect } from "./drop-world.mjs";

const $ = s => document.querySelector(s);
const moduleURL = path => new URL(path, import.meta.url);
const world = $("#pv"), ctx = world.getContext("2d");
const avatar = document.createElement("canvas"), avatarCtx = avatar.getContext("2d");
const avatarShadow = document.createElement("canvas"), avatarShadowCtx = avatarShadow.getContext("2d");
const weatherBG = document.createElement("canvas"), weatherFG = document.createElement("canvas");
const landCanvas = document.createElement("canvas"), landCtx = landCanvas.getContext("2d");
const backgroundCanvas = document.createElement("canvas"), backgroundCtx = backgroundCanvas.getContext("2d");
const landImages = new Map(), landLoads = new Map();
const pickupSprite = new Image();
pickupSprite.src = moduleURL("../img/pickup.png").href;

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
  weatherFailedKey: null,
  ancestralMap: null, ancestralPath: [], abilities: null, hiddenPasses: new Set(),
  landBlock: null, landWorld: null, backgroundBlock: DEFAULT_BACKGROUND_ID, backgroundWorld: null, view: null, aim: null, punchHold: false, punchPointer: null, gesturePunchUntil: 0,
  pickups: [], nextPickupId: 1,
  hiddenItems: new Set(), transmutes: new Map(), effectsEnabled: true,
  worldMode: P.store.get("worldMode", true), editableWorld:null, worldTool:"play", worldSelection:116,
  worldGroundId:2, worldBackgroundId:14, pendingWorldEvents:[]
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
      image.src = moduleURL(`../demo/assets/${name}${name==="tiles_page17.png"?"?v=20261031-new": ""}`).href;
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
  const equippedIds=new Set([...state.equipped.values()].map(item=>item.id));
  for(const key of state.hiddenItems)if(!equippedIds.has(key))state.hiddenItems.delete(key);
  for(const key of state.transmutes.keys())if(!equippedIds.has(key))state.transmutes.delete(key);
  player.setAppearance({hiddenItemIds:state.hiddenItems,transmutes:state.transmutes});
  syncAuraPass();
  state.abilities = resolveAbilities([...state.equipped.values()], state.abilityRegistry);
  motion?.setAbilities(state.abilities);
  P.equippedIds = new Set([...state.equipped.values()].map(i => i.id));
  P.emit("equip-state");
  P.emit("look-update");
  updateHUD();
}
/* Ancestral auras are drawn by the ancestral FX renderer (drawAncestralAura)
   below — the engine's own static RenderAura pass (the artifact's old sprite
   drawn on the character) is hidden so only the animated aura shows. */
function syncAuraPass() {
  const item = displayedItem(9);
  const handled = !!(item && state.ancestralMap?.has(item.id));
  if (handled) state.hiddenPasses.add("RenderAura");
  else state.hiddenPasses.delete("RenderAura");
}
function displayedItem(slot) {
  return resolveLook([...state.equipped.values()],{
    hiddenItemIds:state.hiddenItems,transmutes:state.transmutes
  }).displayed.find(item=>item.slot===slot);
}
function applyAppearance() {
  player?.setAppearance({hiddenItemIds:state.hiddenItems,transmutes:state.transmutes});
  state.ancestralPath.length=0;
  syncAuraPass();
  P.emit("look-update");
}
// Existing customization controls consume this API; inventory equipment IDs
// and Drop retain their existing contracts.
P.look = {
  get() { return [...state.equipped.values()].map(item=>({id:item.id,name:item.name,slot:item.slot,
    visible:!state.hiddenItems.has(item.id),displayId:state.transmutes.get(item.id)?.id??item.id})); },
  setVisible(id,visible) {
    if(![...state.equipped.values()].some(item=>item.id===id))return;
    if(visible)state.hiddenItems.delete(id);else state.hiddenItems.add(id);
    applyAppearance();
  },
  transmute(id,targetId) {
    const equipped=[...state.equipped.values()].find(item=>item.id===id);
    const target=state.catalog?.items.find(item=>item.id===Number(targetId));
    if(!equipped||!target||target.slot!==equipped.slot)return false;
    if(target.id===id)state.transmutes.delete(id);else state.transmutes.set(id,normalize(target));
    applyAppearance();return true;
  },
  get effectsEnabled(){return state.effectsEnabled;},
  setEffects(enabled){state.effectsEnabled=!!enabled;P.emit("look-update");}
};
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
/* Pet and particle hosts query the active world using their own rig-to-feet
   coordinate conversion. The outfit-only mode retains the flat preview. */
function withPetHost(motion) {
  return { ...motion,
    armAngle: state.lastResult?.pose?.frontAngle ?? 0,
    petBareHead: !state.equipped.get(0),
    petLift: state.lastResult?.lift?.y ?? 0,
    petWorld: { solidAt: (x,y) => state.worldMode ? worldSolidAt(x-16,y) : true },
    particleWorld: { solidAt: (x,y) => state.worldMode ? worldSolidAt(x-16,y-32) : y>=32 } };
}
function worldSolidAt(x,y) { return motion instanceof WorldMotion ? motion.solidAt(x,y) : false; }
function step(dt) {
  state.clock += dt;
  if (state.doubleAt !== null && state.clock >= state.doubleAt) {
    state.jumpUntil = state.clock + 100; state.doubleAt = null;
  }
  const input = {
    right: !!(P.input.right), left: !!(P.input.left),
    jump: state.clock < state.jumpUntil || !!P.input.jump,
    punch: (!state.worldMode||state.worldTool==="play") && (state.clock < state.punchUntil || !!P.input.punch || state.punchHold || state.clock < state.gesturePunchUntil)
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
  frame.events.push(...state.pendingWorldEvents.splice(0));
  if (frame.ground && !input.right && !input.left) frame.locomotion = "idle";
  state.lastFrame = frame;
  state.lastResult = player.step(
    withPetHost({ ...frame, worldX: frame.x, worldY: frame.y, x: 0, y: 0 }), dt,
    { skin: state.skin, effects: state.effectsEnabled });
  for(const cue of state.lastResult.audioCues??[])P.emit("punch-cue",cue);
  updatePickupLifecycle(frame);
}
P.on("pad", pad => {
  if(!motion)return;
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
const punchOverUI = t => t.closest && t.closest("#ui, #hud, #toast, #logo, #drop-overlay, #preview-actions, #player-chat-composer, #player-chat-bubble, [data-dd]");
document.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (punchOverUI(e.target) || punchOverDrawer(e)) return;
  if (state.punchPointer !== null) { punchCancel(); return; }   /* second finger: pinch zoom takes over */
  if (!punchInside(e)) return;
  if (state.worldMode && state.worldTool!=="play") { editWorldAt(e);return; }
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
P.on("player-chat-open", punchCancel);

/* ---------------- rendering ------------------------------------------- */
function drawScene(w, h) {
  /* A failed/missing weather must never expose the old demo placeholder sky. */
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
}
function renderAvatar() {
  /* dynamically load any atlas a draw call references but we have not
     registered yet (same as the Demo boot) — pieces appear next frame */
  /* the pet leash string is a line primitive with no atlas; it needs none */
  const missing = [...new Set(state.lastResult.calls.filter(c => !c.line && !atlases.has(c.atlas)).map(c => c.atlas))];
  for (const name of missing) loadAtlas(name);
  const wornAncestral = displayedItem(9);
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

  // Project a separate pure-black alpha mask from the player, wearable sprites,
  // and punch arm/hand. FX, particles, pets, and ancestral effects stay excluded;
  // each included part keeps its own draw matrix so the punch shadow follows it.
  const shadows = getPlayerShadowCalls(calls, {
    ancestralId: displayedItem(9)?.id ?? null,
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
function markWeatherFailed(key, error) {
  if (state.weatherKey !== key) return;
  const firstFailure = state.weatherFailedKey !== key;
  state.weatherRenderer = null;
  state.weatherStill = null;
  state.weatherFailedKey = key;
  if (firstFailure) {
    console.warn("[Weather] " + key + " failed; using black background.", error);
    P.toast("Weather unavailable: " + key);
  }
}
async function setWeather(key) {
  /* "None" was removed from the weathers: a saved 'none' (or empty) falls
     back to Sunny — there is always a weather. */
  if (!key || key === "none") key = "sunny";
  state.weatherKey = key;
  state.weatherRenderer = null;
  state.weatherStill = null;
  state.weatherFailedKey = null;
  /* PREVIEW WHILE LOADING: the weather dropdown's cached fully-rendered still
     of the new weather is shown immediately, before its sheets are decoded */
  if (P.weatherThumb) P.weatherThumb(key).then(c => {
    if (c && state.weatherKey === key && !state.weatherRenderer && state.weatherFailedKey !== key)
      state.weatherStill = c;
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
    markWeatherFailed(key, err);
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
/* Outfit-only terrain remains a selectable uniform strip. Explore World uses
   the same verified tile rules with the editable world and collision grid. */
function landPage(name) {
  if (landImages.has(name)) return Promise.resolve(landImages.get(name));
  if (landLoads.has(name)) return landLoads.get(name);
  const load = new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { landImages.set(name, img); res(img); };
    img.onerror = () => { landImages.set(name, null); res(null); };
    img.src = moduleURL(`../sheets/tiles/${name}.png?v=20261031-world`).href;
  });
  landLoads.set(name, load);
  return load;
}
const DEFAULT_LAND = DEFAULT_LAND_ID;   /* Dirt — the default land the player walks on */
function setLand(id) {
  const resolved = resolveLandSelection(id);
  if (resolved === LAND_NONE) {
    state.landBlock = null; state.landWorld = null;
    if(state.editableWorld&&state.worldMode)P.world.setActive(false);
    return;
  }
  const def = BLOCKS[resolved];
  landPage(def.page || "tiles_page1");
  const backgroundId = state.backgroundBlock ?? CAVE_BACKGROUND_ID;
  const backgroundDef = BLOCKS[backgroundId];
  if (backgroundDef) landPage(backgroundDef.page || "tiles_page1");
  state.landBlock = resolved;
  state.landWorld = uniformLandWorld(resolved, 24, backgroundId);
  applyWorldLook();
}
function setBackground(id) {
  const resolved = resolveBackgroundSelection(id);
  state.backgroundBlock = resolved;
  state.backgroundWorld = resolved == null ? null : uniformBackgroundWorld(resolved);
  if (resolved != null) {
    const def = BLOCKS[resolved];
    landPage(def.page || "tiles_page1");
  }
  /* The same selected wall continues behind the foreground land strip. */
  if (state.landBlock != null)
    state.landWorld = uniformLandWorld(state.landBlock, 24, resolved ?? CAVE_BACKGROUND_ID);
  applyWorldLook();
}
function applyWorldLook() {
  if(!state.editableWorld)return;
  for(let y=0;y<state.editableWorld.fg.length;y++)for(let x=0;x<WORLD_W;x++) {
    if(state.landBlock!=null&&state.editableWorld.fg[y][x]===state.worldGroundId)state.editableWorld.fg[y][x]=state.landBlock;
    if(state.editableWorld.bg[y][x]&&state.editableWorld.bg[y][x]===state.worldBackgroundId)
      state.editableWorld.bg[y][x]=state.backgroundBlock??0;
  }
  state.worldGroundId=state.landBlock??state.worldGroundId;state.worldBackgroundId=state.backgroundBlock??0;
  invalidateWorld(state.editableWorld);
}
P.on("land", id => setLand(id));
P.on("background", id => setBackground(id));

function resetMotionForScene() {
  const previous=motion;
  motion=new WorldMotion({world:state.worldMode?state.editableWorld:null,blocks:BLOCKS});
  motion.clockMs=state.clock;motion.setAbilities(state.abilities??{});
  // Mode changes start at the shared surface origin; equipment stays equipped.
  state.lastFrame=motion.snapshot();state.ancestralPath.length=0;
  state.pendingWorldEvents.length=0;
  if(previous)player?.reset();
  P.emit("input-reset");punchCancel();
}
P.world = {
  get active(){return state.worldMode;},
  setActive(active){state.worldMode=!!active;if(state.worldMode&&state.landBlock==null)P.land.set(DEFAULT_LAND);P.store.set("worldMode",state.worldMode);resetMotionForScene();P.emit("world-update");},
  get tool(){return state.worldTool;},
  setTool(tool){if(!["play","place","erase"].includes(tool))return;state.worldTool=tool;P.emit("input-reset");punchCancel();P.emit("world-update");},
  get selectedId(){return state.worldSelection;},
  select(id){if(BLOCKS[id]?.eligible&&!BLOCKS[id].unsupported){state.worldSelection=Number(id);P.emit("world-update");}},
  get blocks(){return Object.entries(BLOCKS).filter(([,def])=>def.eligible&&!def.unsupported).map(([id,def])=>({id:Number(id),...def}));},
  newWorld(){state.editableWorld=generateWorld(Math.floor(Math.random()*0x7fffffff));state.worldGroundId=2;state.worldBackgroundId=14;applyWorldLook();resetMotionForScene();P.emit("world-update");},
  respawn(){if(!motion)return;const frame=motion.respawn();state.pendingWorldEvents=frame.events.filter(event=>event.type==="respawn");state.ancestralPath.length=0;player?.reset();P.emit("input-reset");P.emit("world-update");},
  get data(){return state.editableWorld;},
  // A deterministic projection shared by mouse/touch editing and QA.
  tileAt(clientX,clientY){return sceneTileAt(clientX,clientY);},
  edit(tx,ty,erase=false){return editWorldTile(tx,ty,erase);}
};
function sceneTileAt(clientX,clientY) {
  const view=state.view;if(!view)return null;
  const rect=world.getBoundingClientRect();
  const point=unprojectCameraPoint((clientX-rect.left)*world.width/rect.width,
    (clientY-rect.top)*world.height/rect.height,view.cameraPivotX,view.cameraPivotY,view.cameraZoom);
  const feetFocus=view.cameraPivotY+16*PLAYER_VISUAL_SCALE*view.s;
  const x=state.lastFrame.x+(point.x-view.cameraPivotX)/view.s;
  const y=state.lastFrame.y+(point.y-feetFocus)/view.s;
  return {tx:((Math.floor((x+WORLD_ORIGIN_X)/WORLD_TILE_SIZE)%WORLD_W)+WORLD_W)%WORLD_W,
    ty:Math.floor((y+WORLD_ORIGIN_Y)/WORLD_TILE_SIZE)};
}
function editWorldTile(tx,ty,erase=false) {
  if(!state.worldMode||!state.editableWorld||!Number.isInteger(tx)||!Number.isInteger(ty))return false;
  const def=BLOCKS[state.worldSelection];if(!def)return false;
  const layer=def.layer==="bg"?"bg":"fg";
  if(erase||state.worldTool==="erase")return removeBlock(state.editableWorld,tx,ty,layer);
  const frame=state.lastFrame,cellLeft=tx*WORLD_TILE_SIZE,cellTop=ty*WORLD_TILE_SIZE;
  const px=((frame.x+WORLD_ORIGIN_X)%(WORLD_W*WORLD_TILE_SIZE)+WORLD_W*WORLD_TILE_SIZE)%(WORLD_W*WORLD_TILE_SIZE);
  const feet=frame.y+WORLD_ORIGIN_Y;
  if(layer==="fg"&&def.collision===1&&cellLeft<px+WORLD_PLAYER_HALF_WIDTH&&cellLeft+WORLD_TILE_SIZE>px-WORLD_PLAYER_HALF_WIDTH&&
      cellTop<feet&&cellTop+WORLD_TILE_SIZE>feet-WORLD_PLAYER_HEIGHT)return false;
  const placed=placeBlock(state.editableWorld,tx,ty,state.worldSelection,layer);
  if(placed&&def.twoDir&&frame.facing<0)state.editableWorld.flip[layer+':'+tx+','+ty]=1;
  return placed;
}
function editWorldAt(event) {
  const tile=sceneTileAt(event.clientX,event.clientY);
  if(tile)editWorldTile(tile.tx,tile.ty,event.button===2);
}
world.addEventListener("contextmenu",event=>{
  if(state.worldMode&&state.worldTool!=="play"){event.preventDefault();editWorldAt(event);}
});
function drawInteractiveWorld(w,h,s,camera,layer) {
  if(!state.editableWorld)return;
  const start=unprojectCameraPoint(0,0,camera.cameraPivotX,camera.cameraPivotY,camera.zoom);
  const end=unprojectCameraPoint(w,h,camera.cameraPivotX,camera.cameraPivotY,camera.zoom);
  const tileScale=s*(WORLD_TILE_SIZE/32),bw=Math.ceil((end.x-start.x)/tileScale)+2,bh=Math.ceil((end.y-start.y)/tileScale)+2;
  const canvas=layer==="bg"?backgroundCanvas:landCanvas,c=layer==="bg"?backgroundCtx:landCtx;
  if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
  c.clearRect(0,0,bw,bh);c.imageSmoothingEnabled=false;
  const feetFocus=camera.cameraPivotY+16*PLAYER_VISUAL_SCALE*s;
  const camX=(WORLD_ORIGIN_X+camera.cameraWorldX+(start.x-camera.cameraPivotX)/s)*32/WORLD_TILE_SIZE;
  const camY=(WORLD_ORIGIN_Y+camera.cameraWorldY+(start.y-feetFocus)/s)*32/WORLD_TILE_SIZE;
  const atlas=page=>{if(!landImages.has(page))landPage(page);return landImages.get(page)??null;};
  const stats=renderWorld(c,state.editableWorld,atlas,camX,camY,bw,bh,state.clock,{layers:[layer],repeatX:true});
  if(layer==="bg")state.backgroundStats=stats;else state.landStats=stats;
  ctx.drawImage(canvas,0,0,bw,bh,start.x,start.y,bw*tileScale,bh*tileScale);
}
function drawLandGround(w, h, ground, s, frame, zoom, cameraWorldX = frame.x) {
  // Render land blocks at 20 screen-units per 32-unit source tile: the
  // midpoint between 16 and 24. Grid coordinates stay native at 32 per tile.
  const landS = s * (20 / 32);
  const lw = Math.ceil(w / (landS * zoom));
  const lh = Math.max(1, Math.ceil(h / (landS * zoom)) + 2);
  if (landCanvas.width !== lw || landCanvas.height !== lh) {
    landCanvas.width = lw; landCanvas.height = lh;
  }
  landCtx.imageSmoothingEnabled = false;
  const span = WORLD_PX_W;
  const camX = ((Math.floor(cameraWorldX - lw / 2) % span) + span) % span;
  landCtx.clearRect(0, 0, lw, lh);
  const atlasFn = page => landImages.get(page) ?? null;
  state.landStats=renderWorld(landCtx, state.landWorld, atlasFn, camX, 24 * 32, lw, lh, state.clock,{repeatX:true});
  const dx = (w - lw * landS) / 2;
  ctx.drawImage(landCanvas, 0, 0, lw, lh, dx, ground, lw * landS, lh * landS);
}

function drawBackgroundTiles(w, h, s, camera) {
  if (!state.backgroundWorld) return;
  const tileScale = s * (20 / 32);
  const bw = Math.ceil(w / tileScale) + 2;
  const bh = Math.ceil(h / tileScale) + 2;
  if (backgroundCanvas.width !== bw || backgroundCanvas.height !== bh) {
    backgroundCanvas.width = bw;
    backgroundCanvas.height = bh;
  }
  backgroundCtx.imageSmoothingEnabled = false;
  backgroundCtx.clearRect(0, 0, bw, bh);
  const camX = Math.floor(camera.cameraWorldX - camera.cameraPivotX / tileScale);
  const camY = Math.floor(camera.cameraWorldY - camera.cameraPivotY / tileScale);
  const span = WORLD_PX_W;
  const wrappedX = ((camX % span) + span) % span;
  const atlasFn = page => landImages.get(page) ?? null;
  state.backgroundStats=renderWorld(backgroundCtx, state.backgroundWorld, atlasFn, wrappedX, camY, bw, bh, state.clock,{layers:['bg'],repeatX:true});
  ctx.drawImage(backgroundCanvas, 0, 0, bw, bh, 0, 0, bw * tileScale, bh * tileScale);
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
  const item = displayedItem(9);
  if(!state.effectsEnabled)return;
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

/* Hill bands use the inverse of camera travel so the landscape moves opposite
   the player, reversing naturally when the player changes direction. Travel
   is never clamped at the decorative scene's edge. */
function hillOffsetsNow(w, h, s, cameraWorldX) {
  const r = state.weatherRenderer;
  if (!r || !r.hillSpeeds?.size) return new Map();
  const cfg = r.cfg;
  const pxPerSceneUnit = Math.max(w / cfg.w, h / cfg.h);   /* the renderer's COVER scale */
  const offsets = new Map();
  for (const [sheetIndex, speed] of r.hillSpeeds) {
    offsets.set(sheetIndex, hillSceneOffset(-cameraWorldX, s, pxPerSceneUnit, speed));
  }
  // A single sprite sheet can contain multiple independent parallax bands.
  // Arid's two desert_wobbly groups follow their nearest desert hill layer.
  for (const [track, speed] of (r.hillTrackSpeeds ?? new Map())) {
    offsets.set(track, hillSceneOffset(-cameraWorldX, s, pxPerSceneUnit, speed));
  }
  return offsets;
}

/* ---------------- frame loop ------------------------------------------- */
let hudTimer = 0;
let lastFrameError = null;
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
  /* Track the player continuously in world X/Y. The camera has no edge clamps;
     the foreground and parallax layers consume this live camera position. */
  const camera = computeCameraLayout({
    width: w, height: h, scale: s, frameX: frame.x, frameY: frame.y, zoom
  });
  const { ground, rootX, rootY, cameraPivotX, cameraPivotY } = camera;
  state.view = {
    rootX, rootY, s, lift, cameraZoom: zoom, cameraPivotX, cameraPivotY,
    cameraWorldX: camera.cameraWorldX, cameraWorldY: camera.cameraWorldY
  };

  c.imageSmoothingEnabled = false;
  // Backdrop remains viewport-filling; otherwise zoom-out would reveal blanks.
  try {
    if (state.weatherRenderer) {
      const now = performance.now();
      const t = now < state.weatherAnimAt ? state.weatherT0 : state.weatherT0 + now - state.weatherAnimAt;
      /* Hill offsets use the camera's live world X; other weather elements keep
         their own animation timeline. */
      state.weatherRenderer.render(t, hillOffsetsNow(w, h, s, camera.cameraWorldX));
      c.drawImage(weatherBG, 0, 0, w, h);
    } else if (state.weatherStill && state.weatherFailedKey !== state.weatherKey) {
      c.drawImage(state.weatherStill, 0, 0, w, h);
    } else {
      drawScene(w, h);
    }
  } catch (weatherError) {
    markWeatherFailed(state.weatherKey, weatherError);
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

  /* Selected Growtopia BG block tiles the viewport behind the player. */
  if(state.worldMode)drawInteractiveWorld(w,h,s,camera,"bg");
  else drawBackgroundTiles(w, h, s, camera);
  const playerRect = playerVisualRect(b, rootX, rootY, s);
  const shadowOffset = playerShadowOffset(-1);
  // The player shadow is always projected to the left, independent of facing.
  // It shares the avatar's zoom transform and dimensions so it stays attached.
  // Render order: shadow behind land; player and clothing in front of land.
  c.imageSmoothingEnabled = false;
  c.save();
  c.globalAlpha = PLAYER_SHADOW_OPACITY;
  c.drawImage(avatarShadow,
    playerRect.x + shadowOffset.x, playerRect.y + shadowOffset.y,
    playerRect.width, playerRect.height);
  c.restore();
  if(state.worldMode)drawInteractiveWorld(w,h,s,camera,"fg");
  else if (state.landWorld) drawLandGround(w, h, ground, s, frame, zoom, camera.cameraWorldX);
  drawAncestralAura(s, rootX, ground, frame, "behind", cameraPivotX, cameraPivotY, zoom);
  // Scale the player and all clothing around rig feet (16,32). Land tiles use
  // the full 32-unit world scale; the character remains at 0.78 scale.
  c.imageSmoothingEnabled = false;
  c.drawImage(avatar, playerRect.x, playerRect.y, playerRect.width, playerRect.height);
  drawAncestralAura(s, rootX, ground, frame, "front", cameraPivotX, cameraPivotY, zoom);
  const playerTop = ground + frame.y * s - 32 * PLAYER_VISUAL_SCALE * s + lift * PLAYER_VISUAL_SCALE * s;
  c.restore();
  // Pickups use an explicit world-to-screen projection outside the world transform.
  // This keeps their world anchor fixed as the camera follows the player; offscreen
  // pickups remain in state and naturally reappear when the camera comes back.
  drawPickups(c, frame, s, cameraPivotX, cameraPivotY, zoom);
  // The plate renderer resets the canvas transform internally, so project its
  // head-height anchor explicitly and scale its lettering with the camera.
  if (P.plate) {
    const platePoint = projectCameraPoint(
      w / 2 - 3, playerTop - 6 * s, cameraPivotX, cameraPivotY, zoom
    );
    P.plate.draw(c, platePoint.x, platePoint.y, s * zoom, state.clock, 0.80);
    const rect=world.getBoundingClientRect();
    P.emit("player-chat-anchor",{x:rect.left+platePoint.x*rect.width/world.width,
      y:rect.top+(platePoint.y-(P.rtfont.hasVisibleName(P.plateConfig.get().growId)?9:0)*s*zoom)*rect.height/world.height,
      scale:s*zoom*rect.width/world.width});
  }
  // Foreground weather is viewport-space, as it was before camera-scope
  // rendering; zooming the world must not move or scale rain/snow overlays.
  if (state.weatherRenderer) {
    try { c.drawImage(weatherFG, 0, 0, w, h); }
    catch (weatherError) { markWeatherFailed(state.weatherKey, weatherError); }
  }

  if (performance.now() - hudTimer > 250) { hudTimer = performance.now(); updateHUD(); }
  lastFrameError = null;
  } catch (err) {
    /* Keep the simulation alive after a transient drawing error. A single
       renderer exception must not permanently disable Drop, movement or tabs. */
    const message = String(err?.message || err || "Unknown render error");
    if (message !== lastFrameError) {
      console.error("[Planner] frame render failed; continuing.", err);
      lastFrameError = message;
    }
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#000";
    c.fillRect(0, 0, w, h);
    c.restore();
    $("#hud").textContent = "Render warning: " + message;
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

function unequipDroppedItem(item) {
  let removed = false;
  for (const [slot, worn] of state.equipped) {
    if (worn.id === item.id) {
      state.equipped.delete(slot);
      removed = true;
    }
  }
  if (!removed) return;
  const wornItems = [...state.equipped.values()];
  player.equip(wornItems);
  syncAuraPass();
  state.abilities = resolveAbilities(wornItems, state.abilityRegistry);
  motion?.setAbilities(state.abilities);
  P.equippedIds = new Set(wornItems.map(worn => worn.id));
  P.emit("equip-state");
  updateHUD();
}

function dropWorldItem(item, amount) {
  if (!state.ready || !state.lastFrame || !item || item.gone) {
    P.toast("This item cannot be dropped right now.");
    return;
  }
  const frame = state.lastFrame;
  const facing = Math.sign(frame.facing || motion?.facing || 1) || 1;
  const dropVary = pickupDropVary();
  const renderedPixelsPerWorldUnit = Math.max(0.001,
    (state.view?.s ?? 4) * (state.view?.cameraZoom ?? 1));
  const dropX = frame.x + facing * 18 + dropVary.x / renderedPixelsPerWorldUnit;
  const dropY = frame.y + PICKUP_HOVER_HEIGHT + dropVary.y / renderedPixelsPerWorldUnit;
  const pickup = {
    id: state.nextPickupId++,
    item,
    amount,
    dropVary,
    icon: P.thumb(item, 64),
    spawnedAt: state.clock,
    startX: frame.x + facing * 5,
    targetX: dropX,
    worldX: dropX,
    startY: dropY - 2,
    targetY: dropY,
    worldY: dropY,
    collectAt: null,
    collectStartX: null,
    collectStartY: null,
    artCanvas: null,
    shadowCanvas: null,
    frameCanvas: null,
    frameShadowCanvas: null,
    iconCanvas: null
  };
  state.pickups.push(pickup);
  item.gone = true;
  if (P.inv.focus?.id === item.id) P.inv.focus = null;
  if (P.inv.sel?.id === item.id) P.inv.sel = null;
  unequipDroppedItem(item);
  P.inv.refresh();
  P.emit("item-dropped", { item, amount, pickupId: pickup.id });
  P.toast("Dropped " + (amount > 1 ? amount + " × " : "") + item.name);
}

function updatePickupLifecycle(frame) {
  let inventoryChanged = false;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];
    if (pickup.collectAt == null && pickupShouldCollect(pickup, state.clock, frame)) {
      pickup.collectAt = state.clock;
      pickup.collectStartX = pickup.worldX ?? pickup.targetX;
      pickup.collectStartY = pickup.worldY ?? pickup.targetY;
      P.emit("pickup-collect-start", { item: pickup.item, pickupId: pickup.id });
      continue;
    }
    if (pickup.collectAt != null &&
        state.clock - pickup.collectAt >= PICKUP_COLLECTION_TOTAL_DURATION) {
      pickup.item.gone = false;
      state.pickups.splice(i, 1);
      inventoryChanged = true;
      P.emit("item-picked-up", { item: pickup.item, amount: pickup.amount, pickupId: pickup.id });
      P.toast("Picked up " + (pickup.amount > 1 ? pickup.amount + " × " : "") + pickup.item.name);
    }
  }
  if (inventoryChanged) P.inv.refresh();
}

function pickupShadowFrom(source) {
  const shadow = document.createElement("canvas");
  shadow.width = shadow.height = 64;
  const shadowCtx = shadow.getContext("2d");
  shadowCtx.drawImage(source, 0, 0);
  shadowCtx.globalCompositeOperation = "source-in";
  shadowCtx.fillStyle = "rgba(" + PLAYER_SHADOW_COLOR.join(",") + ",1)";
  shadowCtx.fillRect(0, 0, shadow.width, shadow.height);
  return shadow;
}

function ensurePickupArt(pickup) {
  if (pickup.artCanvas && pickup.shadowCanvas && pickup.frameCanvas &&
      pickup.frameShadowCanvas && pickup.iconCanvas) return;
  if (!pickupSprite.complete || pickupSprite.naturalWidth < PICKUP_ATLAS_RECT.x + PICKUP_ATLAS_RECT.width) return;

  // Keep the frame and item on separate transparent layers so the icon can
  // jump out of the frame during collection while the empty frame shrinks.
  const frame = document.createElement("canvas");
  frame.width = frame.height = 64;
  const frameCtx = frame.getContext("2d");
  frameCtx.imageSmoothingEnabled = false;
  frameCtx.drawImage(pickupSprite,
    PICKUP_ATLAS_RECT.x, PICKUP_ATLAS_RECT.y,
    PICKUP_ATLAS_RECT.width, PICKUP_ATLAS_RECT.height,
    0, 0, frame.width, frame.height);

  const icon = document.createElement("canvas");
  icon.width = icon.height = 64;
  const iconCtx = icon.getContext("2d");
  iconCtx.imageSmoothingEnabled = false;
  if (pickup.icon) {
    const iconSize = PICKUP_ICON_ART_SIZE;
    iconCtx.drawImage(pickup.icon,
      (icon.width - iconSize) / 2, (icon.height - iconSize) / 2, iconSize, iconSize);
  }

  // Normal state: the icon sits behind the pickup frame exactly as before.
  const art = document.createElement("canvas");
  art.width = art.height = 64;
  const artCtx = art.getContext("2d");
  artCtx.imageSmoothingEnabled = false;
  artCtx.drawImage(icon, 0, 0);
  artCtx.drawImage(frame, 0, 0);

  pickup.iconCanvas = icon;
  pickup.frameCanvas = frame;
  pickup.frameShadowCanvas = pickupShadowFrom(frame);
  pickup.artCanvas = art;
  pickup.shadowCanvas = pickupShadowFrom(art);
}

function pickupInventoryTarget() {
  const grid = document.getElementById("grid");
  const canvasRect = world.getBoundingClientRect();
  if (!grid || !canvasRect.width || !canvasRect.height) {
    return { x: world.width * 0.5, y: world.height * 0.78 };
  }
  const r = grid.getBoundingClientRect();
  // Aim at the first visible inventory row, just inside its upper-left edge.
  // Convert screen coordinates into the preview canvas's fixed logical space.
  const screenX = r.left + Math.min(r.width * 0.1, 65);
  const screenY = r.top + Math.min(r.height * 0.14, 48);
  return {
    x: (screenX - canvasRect.left) * world.width / canvasRect.width,
    y: (screenY - canvasRect.top) * world.height / canvasRect.height,
  };
}

function drawPickups(c, frame, scale, cameraPivotX, cameraPivotY, zoom) {
  if (!state.pickups.length) return;
  c.imageSmoothingEnabled = false;
  const inventoryTarget = pickupInventoryTarget();

  for (const pickup of state.pickups) {
    const pose = pickupPose(pickup, state.clock, frame);
    const baseSize = PICKUP_SIZE * scale * zoom;
    const boxBaseSize = baseSize + PICKUP_BOX_EXTRA_SIZE;
    const size = boxBaseSize * pose.scale;
    const anchorX = cameraPivotX + (pose.x - frame.x) * scale * zoom;
    const bottomY = cameraPivotY +
      (16 * PLAYER_VISUAL_SCALE + pose.y - frame.y - pose.bob) * scale * zoom;
    const left = anchorX - size / 2;
    const top = bottomY - size;
    const isFlying = pose.phase === "collecting";

    // A collecting pickup can shrink away while its separate icon is still
    // in flight, so don't skip the entire pickup just because the box is tiny.
    if (!isFlying && size < 0.5) continue;
    c.save();
    ensurePickupArt(pickup);

    const shadowDirection = playerShadowOffset(-1);
    if (!isFlying) {
      // Drop / 500 ms collection pause: retain the original complete pickup.
      if (pickup.shadowCanvas) {
        c.save();
        c.globalAlpha *= PLAYER_SHADOW_OPACITY;
        c.drawImage(pickup.shadowCanvas,
          left + shadowDirection.x * zoom,
          top + shadowDirection.y * zoom, size, size);
        c.restore();
      }

      if (pickup.artCanvas) {
        c.drawImage(pickup.artCanvas, left, top, size, size);
      } else {
        if (pickup.icon) {
          const iconSize = size * PICKUP_ICON_ART_SIZE / 64;
          const inset = (size - iconSize) / 2;
          c.drawImage(pickup.icon, left + inset, top + inset, iconSize, iconSize);
        }
        if (pickupSprite.complete && pickupSprite.naturalWidth >= PICKUP_ATLAS_RECT.x + PICKUP_ATLAS_RECT.width) {
          c.drawImage(pickupSprite,
            PICKUP_ATLAS_RECT.x, PICKUP_ATLAS_RECT.y,
            PICKUP_ATLAS_RECT.width, PICKUP_ATLAS_RECT.height,
            left, top, size, size);
        } else {
          c.strokeStyle = "#fff";
          c.lineWidth = Math.max(1, size * 0.06);
          c.strokeRect(left + size * 0.08, top + size * 0.08, size * 0.84, size * 0.84);
        }
      }
    } else {
      // Draw only the empty pickup frame at its original world position.
      if (size >= 0.5) {
        if (pickup.frameShadowCanvas) {
          c.save();
          c.globalAlpha *= PLAYER_SHADOW_OPACITY;
          c.drawImage(pickup.frameShadowCanvas,
            left + shadowDirection.x * zoom,
            top + shadowDirection.y * zoom, size, size);
          c.restore();
        }
        if (pickup.frameCanvas) {
          c.drawImage(pickup.frameCanvas, left, top, size, size);
        } else if (pickupSprite.complete && pickupSprite.naturalWidth >= PICKUP_ATLAS_RECT.x + PICKUP_ATLAS_RECT.width) {
          c.drawImage(pickupSprite,
            PICKUP_ATLAS_RECT.x, PICKUP_ATLAS_RECT.y,
            PICKUP_ATLAS_RECT.width, PICKUP_ATLAS_RECT.height,
            left, top, size, size);
        } else {
          c.strokeStyle = "#fff";
          c.lineWidth = Math.max(1, size * 0.06);
          c.strokeRect(left + size * 0.08, top + size * 0.08, size * 0.84, size * 0.84);
        }
      }

      // Launch the item icon up and right first, then curve left into the
      // inventory. It scales gradually and fades near the target.
      const start = { x: anchorX, y: bottomY - boxBaseSize / 2 };
      const flight = pickupIconFlightPose(start, inventoryTarget, pose.iconProgress, baseSize);
      if (flight.alpha > 0.005) {
        const flightSize = baseSize * flight.scale;
        c.save();
        c.globalAlpha *= flight.alpha;
        if (pickup.iconCanvas) {
          c.drawImage(pickup.iconCanvas,
            flight.x - flightSize / 2, flight.y - flightSize / 2,
            flightSize, flightSize);
        } else if (pickup.icon) {
          const iconSize = flightSize * PICKUP_ICON_ART_SIZE / 64;
          c.drawImage(pickup.icon,
            flight.x - iconSize / 2, flight.y - iconSize / 2,
            iconSize, iconSize);
        }
        c.restore();
      }
    }

    // Keep dropped stack counts attached to the shrinking box, not the flying icon.
    if (pickup.amount > 1 && size > 2 && pose.scale > 0.25) {
      const label = String(pickup.amount);
      const fontSize = Math.max(3, Math.min(size * 0.27, scale * 5.5 * zoom));
      c.font = "700 " + fontSize + "px 'Main CG', sans-serif";
      c.textAlign = "right";
      c.textBaseline = "bottom";
      c.lineWidth = Math.max(0.5, fontSize * 0.12);
      c.strokeStyle = "rgba(0,0,0,.9)";
      c.fillStyle = "#fff";
      c.strokeText(label, left + size - size * 0.07, top + size - size * 0.06);
      c.fillText(label, left + size - size * 0.07, top + size - size * 0.06);
    }
    c.restore();
  }
}

P.on("drop-confirm", payload => {
  const amount = Number(payload?.amount);
  if (!payload?.item || !Number.isSafeInteger(amount) || amount < 1 || amount > 999999) {
    P.toast("Enter a valid drop amount.");
    return;
  }
  dropWorldItem(payload.item, amount);
});


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
    if (rendererResponse.ok) state.catalog.renderers = rendererScripts(await rendererResponse.json());
    try { const fx = await fetch(moduleURL("../demo/fx-data.json")); if (fx.ok) state.catalog.fxRenderers = rendererScripts(await fx.json()); } catch {}
    try { const pd = await fetch(moduleURL("../demo/punch-data.json")); if (pd.ok) state.catalog.punchData = await pd.json(); } catch {}
    try { const cues=await fetch(moduleURL("../demo/punch-sfx.json"));if(cues.ok)state.catalog.punchSfx=await cues.json(); } catch {}
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
      const c = createReferenceFxAtlas();
      images.set("reference-fx.png", c);
      atlases.set("reference-fx.png", registerAtlas(c));
    }

    motion = new WorldMotion({blocks:BLOCKS});
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
      const [landResponse, backgroundResponse, worldResponse] = await Promise.all([
        fetch(moduleURL("../data/land-blocks.json?v=2")),
        fetch(moduleURL("../data/blocks.json")),
        fetch(moduleURL("../data/world-blocks.json"))
      ]);
      if (!landResponse.ok || !backgroundResponse.ok) throw new Error("Block catalog unavailable");
      const [landRows, backgroundRows] = await Promise.all([landResponse.json(), backgroundResponse.json()]);
      registerBlocks(landRows);
      registerBackgroundBlocks(backgroundRows);
      if(!worldResponse.ok)throw Error("World block catalog unavailable");
      registerBlocks(await worldResponse.json());
    } catch (error) {
      console.warn("[Background] Block catalog could not be loaded.", error);
    }
    /* Load the saved wall before the first frame so the scene starts complete. */
    setBackground(P.store.get("background", String(DEFAULT_BACKGROUND_ID)));
    setLand(resolveLandSelection(P.store.get("land", String(DEFAULT_LAND))));
    state.editableWorld=generateWorld(1);
    applyWorldLook();
    if(state.landBlock==null)state.worldMode=false;
    resetMotionForScene();

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

document.addEventListener("keydown",event=>{
  if(event.code!=="KeyR"||!state.worldMode||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;
  event.preventDefault();P.world.respawn();
});
