import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, clampCameraZoom, projectCameraPoint } from "../js/camera.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../js/app.js");
const preview = read("../js/preview.js");
const handle = read("../js/handle.js");
const dropdowns = read("../css/dropdowns.css");
const icons = read("../js/inventory-icons.mjs");

test("camera supports a closer close-up and a capped 1.28x zoom-out", () => {
  assert.equal(CAMERA_ZOOM_MAX, 4);
  assert.ok(Math.abs(CAMERA_ZOOM_MIN - 1 / 1.28) < 1e-10);
  assert.equal(clampCameraZoom(99), 4);
  assert.ok(Math.abs(clampCameraZoom(0) - 1 / 1.28) < 1e-10);
  assert.equal(preview.includes("min: 1 / 1.28, max: 4"), true);
});

test("nameplate anchor and scale follow the same camera zoom as the player", () => {
  const p = projectCameraPoint(100, 80, 50, 50, 2);
  assert.deepEqual(p, { x: 150, y: 110 });
  assert.match(app, /projectCameraPoint\([\s\S]*cameraPivotX, cameraPivotY, zoom/);
  assert.match(app, /P\.plate\.draw\(c, platePoint\.x, platePoint\.y, s \* 0\.9 \* zoom/);
});

test("inventory drag range clamps downward movement and has an upward cap", () => {
  assert.match(handle, /return \[-maxUp, 0\]/);
  assert.match(handle, /const preview = P\.\$\('#preview'\)/);
  assert.match(handle, /baseBottom - previewTop \+ edgeGap/);
});

test("land and weather dropdown controls are reduced in size", () => {
  assert.match(dropdowns, /\.dd-btn \.dd-thumb\s*\{\s*width: 24px; height: 24px/);
  assert.match(dropdowns, /\.dd-btn \.dd-thumb \{ width: 20px; height: 20px; \}/);
  assert.match(dropdowns, /font: 600 11px\/1/);
});

test("pet icons are reconstructed from final composed pet draw calls and never fall back to marked atlas icons", () => {
  assert.match(icons, /normalizeCatalogItem\(rawItem, catalog\)/);
  assert.match(icons, /call\.owner === owner && call\.pet && !call\.line/);
  assert.match(icons, /drawCanvas\(workCtx, calls, atlases/);
  assert.match(icons, /if \(isPetCompositeItem\(item\)\)[\s\S]*paintContained\(canvas, frame \?\? blankFrame\(\)\)[\s\S]*return;/);
  assert.match(app, /renderDemoInventoryIcon\(canvas, raw, state\.skin, state\.catalog\)/);
});
