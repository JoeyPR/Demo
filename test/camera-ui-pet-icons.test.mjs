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
const inventoryCss = read("../css/inv.css");
const plate = read("../js/plate.js");
const prehistoricPng = readFileSync(new URL("../demo/assets/p_prehistoric.png", import.meta.url));

test("camera supports a closer close-up and a capped 1.28x zoom-out", () => {
  assert.equal(CAMERA_ZOOM_MAX, 4);
  assert.ok(Math.abs(CAMERA_ZOOM_MIN - 1 / 1.28) < 1e-10);
  assert.equal(clampCameraZoom(99), 4);
  assert.ok(Math.abs(clampCameraZoom(0) - 1 / 1.28) < 1e-10);
  assert.equal(preview.includes("min: 1 / 1.28, max: 4"), true);
});

test("nameplate tracks camera zoom, uses 0.82 scale, and is offset left", () => {
  const p = projectCameraPoint(100, 80, 50, 50, 2);
  assert.deepEqual(p, { x: 150, y: 110 });
  assert.match(app, /projectCameraPoint\([\s\S]*cameraPivotX, cameraPivotY, zoom/);
  assert.match(app, /w \/ 2 - 3, playerTop - 6 \* s/);
  assert.match(app, /P\.plate\.draw\(c, platePoint\.x, platePoint\.y, s \* 0\.82 \* zoom/);
  assert.match(plate, /const iconPart = part\.flag \|\| part\.badge \|\| part\.guild;[\s\S]*\+ \(iconPart \? 1 : 0\)/);
});

test("filter panel keeps its inner and outer shadows but selected text has no inset shadow", () => {
  const panelRule = inventoryCss.match(/#filter-panel\{([^}]*)\}/)?.[1] ?? "";
  const selectedRule = inventoryCss.match(/\.filter-option\[aria-pressed=true\]\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(panelRule.length > 0);
  assert.ok(selectedRule.length > 0);
  assert.match(panelRule, /inset\s/);
  assert.match(panelRule, /box-shadow:[^;]*#000/);
  assert.doesNotMatch(selectedRule, /box-shadow|inset/);
});

test("inventory handle initializes and permits both directions with an upward cap", () => {
  assert.match(handle, /const H = ui\.offsetHeight \|\| 894/);
  assert.match(handle, /const maxDown = H \* \(606 - 130\) \/ 894/);
  assert.match(handle, /return \[-maxUp, maxDown\]/);
  assert.match(handle, /setPointerCapture\(e\.pointerId\)/);
  assert.match(handle, /baseBottom - previewTop \+ edgeGap/);
});

test("land and weather dropdown controls are reduced in size", () => {
  assert.match(dropdowns, /\.dd-btn \.dd-thumb\s*\{\s*width: 24px; height: 24px/);
  assert.match(dropdowns, /\.dd-btn \.dd-thumb \{ width: 20px; height: 20px; \}/);
  assert.match(dropdowns, /font: 600 11px\/1/);
});

test("land renders at a fixed scale outside the camera zoom transform", () => {
  assert.match(app, /function drawLandGround\(w, h, ground, s, frame, cameraWorldX = frame\.x\)/);
  assert.match(app, /const lw = Math\.ceil\(w \/ landS\)/);
  assert.match(app, /ctx\.setTransform\(1, 0, 0, 1, 0, 0\)/);
  assert.match(app, /const landGround = cameraPivotY \+ \(ground - cameraPivotY\) \* zoom/);
  assert.match(app, /drawLandGround\(w, h, landGround, s, frame, camera\.cameraWorldX\)/);
});

test("prehistoric pet icons use the clean RGBA 128x512 sprite sheet and correct color/species mapping", () => {
  assert.equal(prehistoricPng.readUInt32BE(16), 128);
  assert.equal(prehistoricPng.readUInt32BE(20), 512);
  assert.equal(prehistoricPng.readUInt8(25), 6, "sprite must be RGBA, not palette-transparency PNG");
  assert.match(icons, /const PREHISTORIC_SPRITE = "p_prehistoric\.png"/);
  assert.match(icons, /assetURL\.searchParams\.set\("v", "3"\)/);
  assert.match(icons, /const PREHISTORIC_SPECIES = Object\.freeze\(\[/);
  assert.match(icons, /"pteranodon"[\s\S]*"triceratops"/);
  assert.match(icons, /const petIndex = offset \/ 2;[\s\S]*const row = petIndex % 16;[\s\S]*const column = Math\.floor\(petIndex \/ 16\)/);
  assert.match(icons, /image\.naturalWidth < 128 \|\| image\.naturalHeight < 512/);
  assert.match(icons, /ctx\.drawImage\(image, cell\.column \* 32, cell\.row \* 32, 32, 32, 0, 0, 32, 32\)/);
  assert.match(icons, /if \(!hasPixels\(frame\)\) throw new Error\("Prehistoric sprite cell is transparent:/);
  assert.match(app, /renderDemoInventoryIcon\(canvas, raw, state\.skin\)/);
});
