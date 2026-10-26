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

test("nameplate anchor and scale follow the camera and requested offsets", () => {
  const p = projectCameraPoint(100, 80, 50, 50, 2);
  assert.deepEqual(p, { x: 150, y: 110 });
  assert.match(app, /projectCameraPoint\([\s\S]*cameraPivotX, cameraPivotY, zoom/);
  assert.match(app, /w \/ 2 - 2, playerTop - 6 \* s/);
  assert.match(app, /P\.plate\.draw\(c, platePoint\.x, platePoint\.y, s \* 0\.88 \* zoom/);
  assert.match(plate, /const iconPart = part\.flag \|\| part\.badge \|\| part\.guild;[\s\S]*\+ \(iconPart \? 1 : 0\)/);
});

test("filter dropdown has no inset shadow at its top-left", () => {
  const panelRule = inventoryCss.match(/#filter-panel\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(panelRule.length > 0, "filter panel style exists");
  assert.doesNotMatch(panelRule, /inset\s/);
  assert.match(panelRule, /box-shadow:[^;]*#000/);
});

test("inventory drag range clamps downward movement and caps upward movement", () => {
  assert.match(handle, /return \[-maxUp, 0\]/);
  assert.match(handle, /const preview = P\.\$\('#preview'\)/);
  assert.match(handle, /baseBottom - previewTop \+ edgeGap/);
});

test("land and weather dropdown controls are reduced in size", () => {
  assert.match(dropdowns, /\.dd-btn \.dd-thumb\s*\{\s*width: 24px; height: 24px/);
  assert.match(dropdowns, /\.dd-btn \.dd-thumb \{ width: 20px; height: 20px; \}/);
  assert.match(dropdowns, /font: 600 11px\/1/);
});

test("prehistoric pet icons use the clean four-variant sprite strip", () => {
  assert.equal(prehistoricPng.readUInt32BE(16), 128);
  assert.equal(prehistoricPng.readUInt32BE(20), 32);
  assert.match(icons, /const PREHISTORIC_SPRITE = "p_prehistoric\.png"/);
  assert.match(icons, /value\.toLowerCase\(\)\.includes\("prehistoric"\)/);
  assert.match(icons, /return cropCandidate\(\{[\s\S]*file: PREHISTORIC_SPRITE,[\s\S]*sx: column \* 32,[\s\S]*sy: 0,[\s\S]*w: 32,[\s\S]*h: 32/);
  assert.doesNotMatch(icons, /new PlannerPlayer|normalizeCatalogItem|renderPetComposition|drawCanvas\(workCtx/);
  assert.match(app, /renderDemoInventoryIcon\(canvas, raw, state\.skin\)/);
});
