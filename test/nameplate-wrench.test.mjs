import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const plate = read("../js/plate.js");
const wrenchUI = read("../js/wrench-ui.js");
const app = read("../js/app.js");
const data = JSON.parse(read("../data/wrench.json"));
const css = read("../css/base.css");

test("nameplate base wrench uses the dedicated quick wrench icon", () => {
  assert.match(plate, /baseWrenchImg\.src = 'img\/wrench-quick\.png'/);
  assert.match(wrenchUI, /quickWrenchImg\.src = 'img\/wrench-quick\.png'/);
});

test("Super Supporter is selectable and renders a green wrench option", () => {
  assert.match(plate, /SUPER_SUPPORTER_WRENCH = 'super-supporter'/);
  assert.match(plate, /superWrenchImg\.src = 'img\/wrench\.png'/);
  assert.match(wrenchUI, /mk\(SUPER_SUPPORTER_WRENCH, 'Super Supporter Wrench'/);
  assert.match(wrenchUI, /entry\[0\] !== SUPER_SUPPORTER_WRENCH/);
  assert.equal(data.styles.some(style => style[0] === "super-supporter"), false);
});

test("pickup uses a world-fixed target while camera coordinates change", () => {
  assert.match(app, /worldX: dropX/);
  assert.match(app, /worldY: dropY/);
  assert.match(app, /const left = cameraPivotX \+ \(pose\.x - frame\.x\) \* scale/);
  assert.match(app, /const top = ground \+ \(pose\.y - pose\.bob\) \* scale/);
});


test("nameplate uses the provided Century Gothic Big font without changing the UI font", () => {
  assert.ok(css.includes('font-family:"Nameplate CG"'));
  assert.ok(css.includes("century_gothic_big.woff2"));
  assert.ok(plate.includes("'Nameplate CG'"));
  assert.ok(!plate.includes("'Main CG'"));
});

test("nameplate size and icon positioning match the original values", () => {
  assert.ok(app.includes("P.plate.draw(c, platePoint.x, platePoint.y, s * zoom, state.clock, 0.80)"));
  assert.ok(plate.includes("if (part.guild) return iconCenterY() - 0.875 * PB;"));
  assert.ok(plate.includes("if (part.role) return (LL ? iconCenterY() - 1.025 * PB : iconCenterY()) - h / 2;"));
  assert.ok(plate.includes("if (part.flag || part.badge) return iconCenterY() - h / 2;"));
});
