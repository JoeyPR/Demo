/* WORLD ENGINE — terrain rendering subsystem.
   The real setplanner world engine (vendored, unmodified) renders the Land
   world with Growtopia's own tile rules and atlas art. The demo's land grid
   (js/land-system.mjs) is converted into a setplanner world object, so the
   same grid the player physically walks on (WorldMotion) is exactly the grid
   that gets drawn — the Land concept stays intact, now with native visuals.

   Coordinate mapping (32-unit world space, spawn tile [50, 24]):
     demo frame.x/frame.y (player centre / feet, relative to 50.5/24 tiles)
       -> world px  frame.x + 1616, frame.y + 768
       -> stage camera = player world px minus half the view (top-left anchor)
   */

import * as WP from "../render-vendor/worldplay.mjs";

let kit = null;
let stage = null;
let world = null;
let canvasEl = null;
let landW = 100;
let landH = 60;

/* setplanner requests absolute paths (/atlas/..., /world/..., /weather/...,
   /ui/...). The demo serves the same trees from its root, so requests are
   simply re-rooted; no key server, no virtual fetch — the files are real.
   WorldKit.load's fetcher contract resolves to parsed JSON (like the site's
   default), so the wrapper follows it. */
function localJsonFetch(url) {
  const path = String(url).replace(/^([a-z]+:\/\/[^/]*)?\/+/, "");
  return fetch(path).then(res => res.ok
    ? res.json()
    : Promise.reject(new Error(path + ": HTTP " + res.status)));
}

export async function init() {
  if (kit) return kit;
  kit = await WP.WorldKit.load(localJsonFetch);
  return kit;
}

/* Build a setplanner world JSON from the demo's editable land grid. */
export function worldJsonFromGrid(fg, bg, width, height) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const f = fg[y][x] | 0;
      const b = bg[y][x] | 0;
      if (f || b) tiles.push([x, y, f, b]);
    }
  }
  return {
    width, height,
    name: "DEMO",
    spawn: [50, 24],
    weather: 0,
    tiles,
  };
}

export async function setLandWorld(fg, bg, width, height) {
  await init();
  landW = width;
  landH = height;
  const json = worldJsonFromGrid(fg, bg, width, height);
  world = await WP.worldFromBytes(new TextEncoder().encode(JSON.stringify(json)));
  if (stage) {
    stage.dispose();
    stage = null;
  }
  if (!canvasEl) return world;
  stage = new WP.WorldStage(kit, world, canvasEl, { stage: true });
  return world;
}

export function attachCanvas(canvas) {
  canvasEl = canvas;
}

/* Live tile edit (land-system placeBlock/removeBlock) — updates the same
   world object the renderer draws, then invalidates the renderer. */
export function setTile(x, y, fg, bg) {
  if (!stage || !world) return;
  if (x < 0 || y < 0 || x >= landW || y >= landH) return;
  const idx = y * landW + x;
  if (Number.isFinite(fg)) world.setValue("fg", idx, fg | 0);
  if (Number.isFinite(bg)) world.setValue("bg", idx, bg | 0);
  stage.renderer.invalidate();
}

/* Per-frame render. tilePx is the on-screen size of one 32-unit tile
   (32 * scale * zoom in the demo's camera terms). */
export function render(nowMs, playerWorldX, playerWorldY, tilePx, width, height, dpr) {
  if (!stage) return null;
  const camera = stage.renderer.camera;
  if (camera.viewW !== width || camera.viewH !== height) stage.resize(width, height, dpr);
  /* stageView sets the view rectangle's TOP-LEFT corner (calibrated against
     the renderer: camera.x/y = world px at the view's top-left edge), so the
     player is centred by subtracting half the view. Z/V are the view size in
     world px (tilePx = 32 * viewH / Z). */
  const viewHWorld = (32 * height) / tilePx;
  const viewWWorld = (32 * width) / tilePx;
  const viewX = playerWorldX - 1600 - viewWWorld / 2; /* play.ox = spawn tile 50 * 32 */
  const viewY = playerWorldY - 768 - viewHWorld / 2;  /* play.oy = spawn tile 24 * 32 */
  stage.stageView(viewX, viewY, viewHWorld, viewWWorld);
  stage.render(nowMs, null);
  return stage;
}

export function ready() {
  return !!stage;
}

/* Debug/QA hook: the live stage + world for calibration and tests. */
export function debugStage() {
  return { stage, world, kit, canvas: canvasEl };
}

export { WP };
