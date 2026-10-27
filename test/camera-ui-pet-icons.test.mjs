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
  assert.match(app, /w \/ 2 - 3, playerTop - 6 \* s/);
  assert.match(app, /P\.plate\.draw\(c, platePoint\.x, platePoint\.y, s \* zoom, state\.clock, 0\.80/);
  assert.match(plate, /const iconPR = built\.size \* p;[\s\S]*const PR = iconPR \* factor/);
  assert.match(plate, /const PG = iconPR \* 1\.25 \* PN/);
  assert.match(plate, /const LC = iconPR \* 1\.226 \* 1\.2/);
  assert.match(plate, /textScale = 1/);
  assert.match(plate, /const iconPart = part\.flag \|\| part\.badge \|\| part\.guild/);
});

test("filter panel retains its inner and outer drop shadows", () => {
  const panelRule = inventoryCss.match(/#filter-panel\{([^}]*)\}/)?.[1] ?? "";
  const selectedRule = inventoryCss.match(/\.filter-option\[aria-pressed=true\]\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(panelRule.length > 0, "filter panel style exists");
  assert.ok(selectedRule.length > 0, "selected category style exists");
  assert.match(panelRule, /inset\s/);
  assert.doesNotMatch(selectedRule, /box-shadow|inset/);
  assert.match(panelRule, /box-shadow:[^;]*#000/);
});

test("inventory drag range allows downward movement and caps upward movement at preview", () => {
  assert.match(handle, /return \[-maxUp, maxDown\]/);
  assert.match(handle, /const H = ui\.offsetHeight/);
  assert.match(handle, /const maxDown = H \* \(606 - 130\) \/ 894/);
  assert.match(handle, /const preview = P\.\$\('#preview'\)/);
  assert.match(handle, /const baseTop = handleRect\.top - applied/);
  assert.match(handle, /const previewCap = Math\.max\(0, baseTop - previewTop - edgeGap\)/);
});

test("land and weather dropdown controls are reduced in size and filter arrow is larger", () => {
  assert.match(dropdowns, /\.dd-btn \.dd-thumb\s*\{\s*width: 24px; height: 24px/);
  assert.match(dropdowns, /\.dd-btn \.dd-thumb \{ width: 20px; height: 20px; \}/);
  assert.match(dropdowns, /font: 600 11px\/1/);
  assert.match(inventoryCss, /#filter-button span\{[^}]*border-left:calc\(15\*var\(--u\)\)[^}]*border-right:calc\(15\*var\(--u\)\)[^}]*border-top:calc\(16\*var\(--u\)\)/);
});

test("prehistoric pet icons map color variants per species row", () => {
  assert.equal(prehistoricPng.readUInt32BE(16), 128);
  assert.equal(prehistoricPng.readUInt32BE(20), 512);
  assert.match(icons, /const PREHISTORIC_SPRITE = "p_prehistoric\.png"/);
  assert.match(icons, /const PREHISTORIC_SPECIES = Object\.freeze\(\[/);
  assert.match(icons, /"pteranodon"[\s\S]*"triceratops"/);
  assert.match(icons, /const offset = id - 3952;[\s\S]*const row = Math\.floor\(offset \/ 8\);[\s\S]*const column = Math\.floor\(\(offset % 8\) \/ 2\)/);
  assert.match(icons, /sx: cell\.column \* 32,[\s\S]*sy: cell\.row \* 32,[\s\S]*w: 32,[\s\S]*h: 32/);
  assert.match(icons, /if \(prehistoric\) \{[\s\S]*paintContained\(canvas, frame \?\? blankFrame\(\)\);[\s\S]*return;/);
  assert.match(app, /renderDemoInventoryIcon\(canvas, raw, state\.skin\)/);
});
