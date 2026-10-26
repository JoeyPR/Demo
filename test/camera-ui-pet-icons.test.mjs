import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, clampCameraZoom } from "../js/camera.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../js/app.js");
const preview = read("../js/preview.js");
const handle = read("../js/handle.js");
const dropdowns = read("../css/dropdowns.css");
const icons = read("../js/inventory-icons.mjs");
const inventoryCss = read("../css/inv.css");
const plate = read("../js/plate.js");
const prehistoricPng = readFileSync(new URL("../demo/assets/p_prehistoric.png", import.meta.url));

test("camera still clamps its close and zoom-out limits", () => {
  assert.equal(CAMERA_ZOOM_MAX, 4);
  assert.ok(Math.abs(CAMERA_ZOOM_MIN - 1 / 1.28) < 1e-10);
  assert.equal(clampCameraZoom(99), 4);
  assert.ok(Math.abs(clampCameraZoom(0) - 1 / 1.28) < 1e-10);
  assert.equal(preview.includes("min: 1 / 1.28, max: 4"), true);
});

test("camera zoom follows player and weather, while land tiles stay fixed-size", () => {
  assert.match(app, /function drawZoomedWeatherLayer[\s\S]*Math\.max\(1, 1 \/ zoom\)/);
  assert.match(app, /function drawZoomedWeatherLayer[\s\S]*pivotX \+ \(w \/ 2 - pivotX\) \/ zoom/);
  assert.match(app, /drawZoomedWeatherLayer\(c, weatherBG, w, h, zoom, cameraPivotX, cameraPivotY, true\)/);
  assert.match(app, /drawZoomedWeatherLayer\(c, weatherFG, w, h, zoom, cameraPivotX, cameraPivotY, false, false\)/);
  assert.match(app, /const applyCameraZoom = \(\) => \{[\s\S]*c\.scale\(zoom, zoom\)/);
  assert.match(app, /applyCameraZoom\(\);[\s\S]*c\.drawImage\(avatar, playerRect\.x, playerRect\.y/);
  assert.match(app, /const landGround = cameraPivotY \+ \(ground - cameraPivotY\) \* zoom/);
  assert.match(app, /const landS = s; \/\/ Native Growtopia tile size: 32 world units per block\./);
  assert.match(app, /const plateX = cameraPivotX \+ \(w \/ 2 - 3 - cameraPivotX\) \* zoom/);
  assert.match(app, /const plateY = cameraPivotY \+ \(playerTop - 6 \* s - cameraPivotY\) \* zoom/);
  assert.match(app, /P\.plate\.draw\(c, plateX, plateY, s \* 0\.80 \* zoom, state\.clock\)/);
  assert.match(plate, /const iconPart = part\.flag \|\| part\.badge \|\| part\.guild;[\s\S]*\+ \(iconPart \? 1 : 0\)/);
});

test("filter panel keeps its inner and outer shadows but selected text has no inset shadow", () => {
  const panelRule = inventoryCss.match(/#filter-panel\{([^}]*)\}/)?.[1] ?? "";
  const selectedRule = inventoryCss.match(/\.filter-option\[aria-pressed=true\]\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(panelRule.length > 0);
  assert.ok(selectedRule.length > 0);
  assert.match(panelRule, /inset\s/);
  assert.match(panelRule, /calc\(5\*var\(--u\)\) calc\(5\*var\(--u\)\) 0 #000/);
  assert.doesNotMatch(selectedRule, /box-shadow|inset/);
});

test("inventory handle tracks pointers at window level and permits both directions", () => {
  assert.match(handle, /const applied = parseFloat\(getComputedStyle\(root\)\.getPropertyValue\('--dy'\)\) \|\| 0/);
  assert.match(handle, /const baseTop = rect\.top - applied/);
  assert.match(handle, /const maxUp = Math\.max\(0, baseTop - topLimit\)/);
  assert.match(handle, /baseTop >= previewRect\.bottom/);
  assert.match(handle, /const H = ui\.offsetHeight \|\| innerHeight/);
  assert.match(handle, /const maxDown = Math\.max\(0, H \* \(606 - 130\) \/ 894\)/);
  assert.match(handle, /return \[-maxUp, maxDown\]/);
  assert.match(handle, /window\.addEventListener\('pointermove'/);
  assert.match(handle, /setPointerCapture\(e\.pointerId\)/);
  assert.match(handle, /P\.store\.set\('dy', Math\.round\(dy\)\)/);
});

test("land tiles remain fixed-size at the requested 32 world units", () => {
  assert.match(app, /function drawLandGround\(w, h, ground, s, frame, cameraWorldX = frame\.x\)/);
  assert.match(app, /const landS = s; \/\/ Native Growtopia tile size: 32 world units per block\./);
  assert.match(app, /ctx\.setTransform\(1, 0, 0, 1, 0, 0\)/);
  assert.match(app, /drawLandGround\(w, h, ground, s, frame, camera\.cameraWorldX\)/);
  assert.doesNotMatch(app, /const landGround = cameraPivotY \+ \(ground - cameraPivotY\) \* zoom/);
});

test("land and weather dropdown controls are reduced in size", () => {
  assert.match(dropdowns, /\.dd-btn \.dd-thumb\s*\{\s*width: 24px; height: 24px/);
  assert.match(dropdowns, /\.dd-btn \.dd-thumb \{ width: 20px; height: 20px; \}/);
  assert.match(dropdowns, /font: 600 11px\/1/);
});

test("filter dropdown arrow is larger while the nameplate remains at 0.80 scale", () => {
  assert.match(inventoryCss, /border-left:calc\(12\*var\(--u\)\) solid transparent/);
  assert.match(inventoryCss, /border-right:calc\(12\*var\(--u\)\) solid transparent;border-top:calc\(13\*var\(--u\)\) solid #dfdfdf/);
  assert.match(app, /P\.plate\.draw\(c, plateX, plateY, s \* 0\.80 \* zoom, state\.clock\)/);
});

test("prehistoric pet icons use the clean 128x512 sheet, exact ID mapping, and no debug atlas fallback", () => {
  assert.equal(prehistoricPng.readUInt32BE(16), 128);
  assert.equal(prehistoricPng.readUInt32BE(20), 512);
  assert.equal(prehistoricPng.readUInt8(25), 6, "sprite must be RGBA");
  assert.match(icons, /const PREHISTORIC_SPRITE = "p_prehistoric\.png"/);
  assert.match(icons, /new URL\("\.\.\/demo\/assets\/p_prehistoric\.png", import\.meta\.url\)/);
  assert.match(icons, /new URL\("\.\.\/img\/p_prehistoric\.png", import\.meta\.url\)/);
  assert.match(icons, /url\.searchParams\.set\("v", "pet-icons-v4"\)/);
  assert.match(icons, /const petIndex = \(id - 3952\) \/ 2;[\s\S]*return \{ column: Math\.floor\(petIndex \/ 16\), row: petIndex % 16 \}/);
  assert.match(icons, /ctx\.drawImage\(image, cell\.column \* 32, cell\.row \* 32, 32, 32, 0, 0, 32, 32\)/);
  assert.match(icons, /fallbackPrehistoricFrame\(cell\)/);
  assert.match(icons, /Never render the old atlas\/debug marker/);
  assert.doesNotMatch(icons, /Prehistoric pet sprite icon failed; trying catalog icon/);
  assert.match(app, /renderDemoInventoryIcon\(canvas, raw, state\.skin\)/);
});
