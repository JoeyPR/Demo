/* Planner runtime with player/item rendering removed.
   Simulation, tile collision, Land drawing, weather, inventory and Drop remain. */
import { WorldMotion, WORLD_ORIGIN_X, WORLD_ORIGIN_Y, WORLD_TILE_SIZE } from "./world-motion.mjs";
import { SKINS, resolveStoredSkin } from "./skin-colors.mjs";
import { normalizeCatalogItem } from "../demo/engine/catalog-adapter.mjs";
import { resolveAbilities } from "../demo/engine/abilities.mjs";
import { WeatherRenderer, loadSheets, hillSceneOffset } from "../weather-engine/weather-renderer.js";
import { applyCloudFix, CLOUD_FIX_KEYS } from "../weather-engine/custom-weathers.js";
import { registerBlocks, registerBackgroundBlocks, renderWorld, BLOCKS, LAND_NONE, DEFAULT_LAND_ID, resolveLandSelection, uniformLandWorld } from "./land-system.mjs";
import { renderDemoInventoryIcon } from "./inventory-icons.mjs";
import { buildItemWrenchDefinitionFromVariableMap } from "../src/item-wrench-variable-map.mjs";
import { buildItemWrenchDefinitionFromGameOptions } from "../src/item-wrench-game-options.mjs";
import { clampCameraZoom, computeCameraLayout, unprojectCameraPoint } from "./camera.mjs";
import { PLAYER_VISUAL_SCALE, PLAYER_SHADOW_OPACITY, PLAYER_SHADOW_COLOR, playerShadowOffset } from "./player-shadow.mjs";
import { PICKUP_ATLAS_RECT, PICKUP_SIZE, PICKUP_BOX_EXTRA_SIZE, PICKUP_HOVER_HEIGHT, PICKUP_COLLECTION_TOTAL_DURATION, PICKUP_ICON_ART_SIZE, pickupDropVary, pickupPose, pickupIconFlightPose, pickupShouldCollect } from "./drop-world.mjs";

const $ = s => document.querySelector(s);
const moduleURL = path => new URL(path, import.meta.url);
const world = $("#pv"), ctx = world.getContext("2d");
const weatherBG = document.createElement("canvas"), weatherFG = document.createElement("canvas");
const landCanvas = document.createElement("canvas"), landCtx = landCanvas.getContext("2d");
const landImages = new Map(), landLoads = new Map();
const pickupSprite = new Image();
pickupSprite.src = moduleURL("../img/pickup.png").href;
const initialSkin = SKINS[resolveStoredSkin(P.store.get("skin", 0))];

const state = {
  catalog: null, equipped: new Map(), skin: initialSkin.rgb, skinPalette: initialSkin.palette,
  clock: 0, jumpUntil: 0, punchUntil: 0, doubleAt: null, lastFrame: null,
  ready: false, remainder: 0,
  weatherRenderer: null, weatherKey: null, weatherAnimAt: 0, weatherT0: 0,
  weatherStill: null, weatherFailedKey: null,
  landBlock: null, landWorld: null, view: null, aim: null,
  punchHold: false, punchPointer: null, gesturePunchUntil: 0,
  pickups: [], nextPickupId: 1,
  hiddenItems: new Set(), transmutes: new Map(), effectsEnabled: true,
  livePreview: false, editableWorld: null, pendingWorldEvents: [],
  itemWrenchDefinitions: null, itemWrenchVariableMaps: null, itemWrenchGameOptions: null
};
let motion;
/* Wrench metadata remains available to inventory controls; no wearable atlas is loaded. */
function attachItemWrenchMetadata(item, raw = item) {
  const id = String(raw.id);
  const variableMap = state.itemWrenchVariableMaps?.items?.[id];
  const gameOptionsRecord = state.itemWrenchGameOptions?.items?.[id];
  item.wrenchGameOptions = gameOptionsRecord?.gameOptions ?? null;
  item.wrenchDefinition = state.itemWrenchDefinitions?.items?.[id] ??
    buildItemWrenchDefinitionFromVariableMap(variableMap, raw.id) ??
    buildItemWrenchDefinitionFromGameOptions(gameOptionsRecord, raw.id) ?? null;
  return item;
}
function normalize(raw) {
  const item = normalizeCatalogItem(raw, state.catalog);
  item.native = state.nativeMetadata?.items?.[raw.id] ?? null;
  attachItemWrenchMetadata(item, raw);
  item.wrenchSettings = P.itemWrench?.get(raw.id) ??
    P.store.get("itemWrenchSettings", {})?.[String(raw.id)] ?? null;
  
  return item;
}

// Wrench drafts update only the equipped instance; the dialog owns persistence.
// Cancel emits the saved snapshot, so this same path also rolls preview changes back.
function applyWrenchPreview(payload) {
  const id = Number(payload?.itemId);
  const item = [...state.equipped.values()].find(worn => worn.id === id);
  if (!item) return;
  item.wrenchSettings = payload?.values ?? null;
  if (payload?.definition) item.wrenchDefinition = payload.definition;
}
P.on("item-wrench-preview", applyWrenchPreview);
P.on("item-wrench-update", applyWrenchPreview);
P.on("item-wrench-cancel", applyWrenchPreview);


// Inventory equip state and movement abilities remain independent of player drawing.
function equipToggle(id) {
  const raw = state.catalog.items.find(i => i.id === id);
  if (!raw) return;
  if (state.equipped.get(raw.slot)?.id === id) state.equipped.delete(raw.slot);
  else state.equipped.set(raw.slot, normalize(raw));
  const equippedIds = new Set([...state.equipped.values()].map(item => item.id));
  for (const key of state.hiddenItems) if (!equippedIds.has(key)) state.hiddenItems.delete(key);
  for (const key of state.transmutes.keys()) if (!equippedIds.has(key)) state.transmutes.delete(key);
  const wornItems = [...state.equipped.values()];
  state.abilities = resolveAbilities(wornItems, state.abilityRegistry);
  motion?.setAbilities(state.abilities);
  P.equippedIds = equippedIds;
  P.emit("equip-state");
  P.emit("look-update");
  updateHUD();
}
function applyAppearance(){P.emit("look-update");}
P.look={
  get(){return [...state.equipped.values()].map(item=>({id:item.id,name:item.name,slot:item.slot,
    visible:!state.hiddenItems.has(item.id),displayId:state.transmutes.get(item.id)?.id??item.id}));},
  setVisible(id,visible){
    if(![...state.equipped.values()].some(item=>item.id===id))return;
    if(visible)state.hiddenItems.delete(id);else state.hiddenItems.add(id);
    applyAppearance();
  },
  transmute(id,targetId){
    const equipped=[...state.equipped.values()].find(item=>item.id===id);
    const target=state.catalog?.items.find(item=>item.id===Number(targetId));
    if(!equipped||!target||target.slot!==equipped.slot)return false;
    if(target.id===id)state.transmutes.delete(id);else state.transmutes.set(id,normalize(target));
    applyAppearance();return true;
  },
  get effectsEnabled(){return state.effectsEnabled;},
  setEffects(enabled){state.effectsEnabled=!!enabled;P.emit("look-update");}
};
P.on("equip",payload=>equipToggle(typeof payload==="object"&&payload!==null?payload.id:payload));
P.on("skin", id => {
  const skin = SKINS[resolveStoredSkin(id)];
  state.skin = skin.rgb;
  state.skinPalette = skin.palette;
  // Refresh currently mounted inventory canvases that use skin-relative tint.
  // The grid is virtualized, so this touches only the visible boxes.
  document.querySelectorAll(".box .ic canvas").forEach(canvas => {
    if (canvas.__demoItem) renderDemoInventoryIcon(canvas, canvas.__demoItem, state.skin);
  });
});
/* ---------------- movement and collision ------------------------------- */
function step(dt){
  state.clock+=dt;
  if(state.doubleAt!==null&&state.clock>=state.doubleAt){
    state.jumpUntil=state.clock+100;state.doubleAt=null;
  }
  const input={
    right:state.livePreview&&!!P.input.right,
    left:state.livePreview&&!!P.input.left,
    jump:state.livePreview&&(state.clock<state.jumpUntil||!!P.input.jump),
    punch:state.livePreview&&(state.clock<state.punchUntil||!!P.input.punch||
      state.punchHold||state.clock<state.gesturePunchUntil)
  };
  const gesturePunch=state.punchHold||state.clock<state.gesturePunchUntil;
  if(gesturePunch&&state.aim&&state.view){
    const {rootX,rootY,s,cameraPivotX,cameraPivotY,cameraZoom}=state.view;
    const aim=unprojectCameraPoint(state.aim.x,state.aim.y,cameraPivotX,cameraPivotY,cameraZoom);
    const cx=rootX+16*s,cy=rootY+32*s;
    motion.facing=aim.x>=cx?1:-1;
    let x=16+(aim.x-cx)/s;
    if(motion.facing<0)x=32-x;
    input.punchTarget=[x,32+(aim.y-cy)/s];
  }
  const frame=motion.step(dt,input);
  if(!Array.isArray(frame.events))frame.events=[];
  frame.events.push(...state.pendingWorldEvents.splice(0));
  if(frame.ground&&!input.right&&!input.left)frame.locomotion="idle";
  state.lastFrame=frame;
  updatePickupLifecycle(frame);
}
P.on("pad", pad => {
  if(!motion||!state.livePreview)return;
  if (pad.k === "jump" && pad.down) { motion.lastJump = false; state.jumpUntil = state.clock + 150; }
  if (pad.k === "punch" && pad.down) state.punchUntil = state.clock + 34;
});
window.addEventListener("blur", () => { P.input.left = P.input.right = P.input.jump = P.input.punch = 0; });


window.addEventListener("blur",()=>{
  P.input.left=P.input.right=P.input.jump=P.input.punch=0;
});

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
const punchOverUI = t => t.closest && t.closest("#ui, #hud, #toast, #logo, #drop-overlay, #item-info-overlay, #preview-mode-toggle, #preview-actions, #topBar, #player-chat-composer, #player-chat-bubble, [data-dd]");
document.addEventListener("pointerdown", e => {
  if (!state.livePreview) return;
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
P.on("player-chat-open", punchCancel);
P.on("input-reset", punchCancel);
P.on("item-info-open", () => { P.emit("input-reset"); punchCancel(); });


/* ---------------- weather ------------------------------------------------ */
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


/* ---------------- playable Land ------------------------------------------ */
function landPage(name){
  if(landImages.has(name))return Promise.resolve(landImages.get(name));
  if(landLoads.has(name))return landLoads.get(name);
  const load=new Promise(resolve=>{
    const img=new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>{landImages.set(name,img);resolve(img);};
    img.onerror=()=>{landImages.set(name,null);resolve(null);};
    img.src=moduleURL(`../sheets/tiles/${name}.png?v=20261031-world`).href;
  });
  landLoads.set(name,load);
  return load;
}
const DEFAULT_LAND=DEFAULT_LAND_ID;
function setLand(id){
  const resolved=resolveLandSelection(id);
  state.landBlock=resolved===LAND_NONE?null:resolved;
  state.editableWorld=uniformLandWorld(state.landBlock??0,24,0);
  state.landWorld=state.landBlock==null?null:state.editableWorld;
  if(state.landBlock!=null)landPage(BLOCKS[resolved].page||"tiles_page1");
  if(motion)resetMotionForScene();
}
P.on("land",setLand);
function resetMotionForScene(){
  motion=new WorldMotion({world:state.landBlock==null?null:state.editableWorld,blocks:BLOCKS});
  motion.clockMs=state.clock;
  motion.setAbilities(state.abilities??{});
  state.jumpUntil=state.punchUntil=0;
  state.doubleAt=null;
  state.lastFrame=motion.snapshot();
  state.pendingWorldEvents.length=0;
  P.emit("input-reset");
  punchCancel();
}
P.previewMode={
  get live(){return state.livePreview;},
  setLive(live){
    const next=!!live;if(next===state.livePreview)return;
    state.livePreview=next;resetMotionForScene();P.emit("preview-mode",{live:next});
  },
  respawn(){resetMotionForScene();},
  get world(){return state.editableWorld;}
};
function drawTerrainLayer(w,h,s,camera){
  if(!state.editableWorld||state.landBlock==null)return;
  const start=unprojectCameraPoint(0,0,camera.cameraPivotX,camera.cameraPivotY,camera.zoom);
  const end=unprojectCameraPoint(w,h,camera.cameraPivotX,camera.cameraPivotY,camera.zoom);
  const tileScale=s*(WORLD_TILE_SIZE/32),pad=16;
  const bw=Math.ceil((end.x-start.x)/tileScale)+pad*2;
  const bh=Math.ceil((end.y-start.y)/tileScale)+pad*2;
  if(landCanvas.width!==bw||landCanvas.height!==bh){landCanvas.width=bw;landCanvas.height=bh;}
  landCtx.clearRect(0,0,bw,bh);
  landCtx.imageSmoothingEnabled=false;
  const feetFocus=camera.cameraPivotY+16*PLAYER_VISUAL_SCALE*s;
  const camX=(WORLD_ORIGIN_X+camera.cameraWorldX+(start.x-camera.cameraPivotX)/s)*32/WORLD_TILE_SIZE-pad;
  const camY=(WORLD_ORIGIN_Y+camera.cameraWorldY+(start.y-feetFocus)/s)*32/WORLD_TILE_SIZE-pad;
  const rasterX=Math.floor(camX),rasterY=Math.floor(camY);
  const atlas=page=>{if(!landImages.has(page))landPage(page);return landImages.get(page)??null;};
  state.landStats=renderWorld(landCtx,state.editableWorld,atlas,rasterX,rasterY,bw,bh,state.clock,
    {layers:["fg"],repeatX:true,foregroundPass:"all"});
  ctx.drawImage(landCanvas,0,0,bw,bh,
    start.x+(rasterX-camX-pad)*tileScale,
    start.y+(rasterY-camY-pad)*tileScale,bw*tileScale,bh*tileScale);
}

/* Preserve weather's world-travel parallax; there is no longer an avatar FX pass. */
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



/* ---------------- frame loop -------------------------------------------- */
let hudTimer=0,lastFrameError=null;
function drawScene(w,h){ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);}
function updateHUD(){
  const hud=$("#hud");if(!state.lastFrame)return;
  const frame=state.lastFrame;
  const action=!state.livePreview?"PREVIEW":frame.punch?"PUNCH":
    frame.locomotion?frame.locomotion.toUpperCase():"IDLE";
  const abilities=state.abilities;
  const extra=[abilities?.doubleJump?"double jump":null,abilities?.highJump?"high jump":null,
    abilities?.speedy?"speedy":null].filter(Boolean).join(" · ");
  hud.textContent=`${action}${extra?" · "+extra:""} · ${state.equipped.size} pieces`;
}
P.on("frame",({dt,ctx:c,w,h})=>{
  if(!state.ready||!state.lastFrame)return;
  try{
    const ms=Math.min(100,dt*1000);state.remainder+=ms;
    while(state.remainder>=1000/60){step(1000/60);state.remainder-=1000/60;}
    const frame=state.lastFrame,s=Math.min(4,Math.max(3,w/480));
    const zoom=clampCameraZoom((P.camZoom?.v??1)*(state.livePreview?1:1.65));
    const camera=computeCameraLayout({width:w,height:h,scale:s,frameX:frame.x,frameY:frame.y,zoom});
    const {rootX,rootY,cameraPivotX,cameraPivotY}=camera;
    state.view={rootX,rootY,s,lift:0,cameraZoom:zoom,cameraPivotX,cameraPivotY,
      cameraWorldX:camera.cameraWorldX,cameraWorldY:camera.cameraWorldY};
    c.imageSmoothingEnabled=false;
    try{
      if(state.weatherRenderer){
        const now=performance.now();
        const t=now<state.weatherAnimAt?state.weatherT0:state.weatherT0+now-state.weatherAnimAt;
        state.weatherRenderer.render(t,hillOffsetsNow(w,h,s,camera.cameraWorldX));
        c.drawImage(weatherBG,0,0,w,h);
      }else if(state.weatherStill&&state.weatherFailedKey!==state.weatherKey){
        c.drawImage(state.weatherStill,0,0,w,h);
      }else drawScene(w,h);
    }catch(error){markWeatherFailed(state.weatherKey,error);drawScene(w,h);}
    c.save();
    c.translate(cameraPivotX,cameraPivotY);c.scale(zoom,zoom);
    c.translate(-cameraPivotX,-cameraPivotY);
    drawTerrainLayer(w,h,s,camera);
    c.restore();
    drawPickups(c,frame,s,cameraPivotX,cameraPivotY,zoom);
    if(state.weatherRenderer){
      try{c.drawImage(weatherFG,0,0,w,h);}
      catch(error){markWeatherFailed(state.weatherKey,error);}
    }
    if(performance.now()-hudTimer>250){hudTimer=performance.now();updateHUD();}
    lastFrameError=null;
  }catch(error){
    const message=String(error?.message||error||"Unknown world error");
    if(message!==lastFrameError){
      console.error("[Planner] world frame failed; simulation remains active.",error);
      lastFrameError=message;
    }
    c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle="#000";c.fillRect(0,0,w,h);c.restore();
    $("#hud").textContent="World warning: "+message;
  }
});

document.querySelector('[data-a="export"]')?.addEventListener("click",()=>{
  P.toast("Character rendering is temporarily disabled.");
});
/* Inventory thumbnails are retained; these are catalog UI art, not avatar passes. */
P.dyes={hair:[255,255,255],whites:[255,255,255],pupils:[0,0,0]};
P.applyDyes=function(){ /* wearable rendering is disconnected during the rebuild */ };
P.thumb=function(raw,size=64){
  const canvas=document.createElement("canvas");canvas.width=64;canvas.height=64;
  canvas.style.width="100%";canvas.style.height="100%";
  canvas.setAttribute("aria-hidden","true");canvas.__demoItem=raw;
  renderDemoInventoryIcon(canvas,raw,state.skin);return canvas;
};
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

function drawPickups(c, frame, scale, cameraPivotX, cameraPivotY, zoom, pass="art") {
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
    if(pass==="shadow") {
      const mask=isFlying?pickup.frameShadowCanvas:pickup.shadowCanvas;
      if(mask&&size>=.5) {
        c.globalAlpha*=PLAYER_SHADOW_OPACITY;
        c.drawImage(mask,left+shadowDirection.x*zoom,top+shadowDirection.y*zoom,size,size);
      }
      c.restore();continue;
    }
    if (!isFlying) {
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



/* ---------------- boot --------------------------------------------------- */
window.plannerApp=state;state.landCanvas=landCanvas;
(async function init(){
  try{
    const response=await fetch(moduleURL("../demo/catalog.json"));
    if(!response.ok)throw Error("Catalog did not load");
    state.catalog=await response.json();P.catalog=state.catalog;
    try{state.nativeMetadata=await(await fetch(moduleURL("../demo/native-metadata.json"))).json();}
    catch{state.nativeMetadata={items:{}};}
    try{state.abilityRegistry=await(await fetch(moduleURL("../demo/ability-registry.json"))).json();}
    catch{state.abilityRegistry={};}
    try{
      const [definitions,maps,options]=await Promise.all([
        fetch(moduleURL("../data/item-wrench-definitions.json")),
        fetch(moduleURL("../data/item-wrench-variable-maps.json")),
        fetch(moduleURL("../data/item-wrench-game-options.json"))
      ]);
      if(definitions.ok)state.itemWrenchDefinitions=await definitions.json();
      if(maps.ok)state.itemWrenchVariableMaps=await maps.json();
      if(options.ok)state.itemWrenchGameOptions=await options.json();
    }catch(error){console.warn("[Item Wrench] Native customization data unavailable.",error);}
    for(const rawItem of state.catalog.items)attachItemWrenchMetadata(rawItem);
    motion=new WorldMotion({blocks:BLOCKS});
    state.lastFrame=motion.snapshot();
    state.equipped.clear();
    state.abilities=resolveAbilities([],state.abilityRegistry);
    motion.setAbilities(state.abilities);
    try{
      const [landResponse,backgroundResponse,worldResponse]=await Promise.all([
        fetch(moduleURL("../data/land-blocks.json?v=2")),
        fetch(moduleURL("../data/blocks.json")),
        fetch(moduleURL("../data/world-blocks.json"))
      ]);
      if(!landResponse.ok||!backgroundResponse.ok)throw Error("Block catalog unavailable");
      const [landRows,backgroundRows]=await Promise.all([landResponse.json(),backgroundResponse.json()]);
      registerBlocks(landRows);registerBackgroundBlocks(backgroundRows);
      if(!worldResponse.ok)throw Error("World block catalog unavailable");
      registerBlocks(await worldResponse.json());
    }catch(error){console.warn("[World] Block catalog could not be loaded.",error);}
    setLand(resolveLandSelection(P.store.get("land",String(DEFAULT_LAND))));
    state.ready=true;P.equippedIds=new Set();
    P.emit("catalog");P.emit("boot");updateHUD();
    setWeather(P.store.get("weather","sunny"));
  }catch(error){console.error(error);$("#hud").textContent="Unable to start: "+error.message;}
})();

document.addEventListener("keydown",event=>{
  if(event.code!=="KeyR"||!state.livePreview||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName))return;
  event.preventDefault();P.previewMode.respawn();
});
