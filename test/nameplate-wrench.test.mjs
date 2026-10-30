import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const plate = read("../js/plate.js");
const wrenchUI = read("../js/wrench-ui.js");
const app = read("../js/app.js");
const data = JSON.parse(read("../data/wrench.json"));
const flags = JSON.parse(read("../img/flags/options.json"));
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
  assert.ok(app.includes("const anchorX = cameraPivotX + (pose.x - frame.x) * scale * zoom"));
  assert.ok(app.includes("const bottomY = cameraPivotY +"));
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
  assert.ok(plate.includes("const COUNTRY_FLAG_EDGE_INSET = 2;"));
  assert.ok(plate.includes("width - COUNTRY_FLAG_EDGE_INSET * 2"));
  assert.ok(plate.includes("height - COUNTRY_FLAG_EDGE_INSET * 2"),
    "country flags have a visible two-pixel inset on all four edges without shrinking badges or role icons");
  assert.ok(plate.includes("(part.flag ? COUNTRY_FLAG_EDGE_INSET : 0)"),
    "the smaller flag remains centered in its original nameplate space");
});


test("Dr. title keeps the reference red style without adding a glow", () => {
  assert.ok(plate.includes("dr:     { rgba: [255, 39, 29, 255] },"));
  assert.ok(!plate.includes("dr:     { rgba: [255, 39, 29, 255], shadow:"));
  assert.ok(plate.includes("const drPrefixColour = drTitle && styleKey === 'dr' ?"), "Dr. prefix color only applies when Dr. is the active style");
  assert.ok(plate.includes("const isDrPrefix = ci < (part.drPrefixLength ?? 0);"));
  assert.ok(plate.includes("const inherited = isDrPrefix && !perLetter ? colorFn(0, 0) : colorFn(ci, seen);"), "higher-priority title styling must control Dr. prefix color");
});

test("player name and guild role text use their requested independent size increases", () => {
  assert.ok(plate.includes("const PR = iconPR * factor + 2"));
  assert.ok(plate.includes("const tagPR = iconPR * factor + 5"));
  assert.ok(plate.includes("tagWidth(k, part.text, tagPR, PR)"));
  assert.ok(plate.includes("cap ? tagPR * CAPS : tagPR"));
  assert.ok(plate.includes("const tagSeparate = guildRole && !hasTextOrStyle;"));
  assert.ok(plate.includes("const rawName = rawNameBase + roleSuffix;"));
  assert.ok(plate.includes("guildRoleStartIndex"));
  assert.ok(plate.includes("const inGuildRole = part.guildRoleStartIndex != null && ci >= part.guildRoleStartIndex"));
});

test("wrench Status is single-select and scales styles plus decorations", () => {
  assert.ok(plate.includes("wrenchStatus: 'default'"));
  assert.ok(plate.includes("setWrenchStatus(id)"));
  assert.ok(plate.includes("WRENCH_STATUS_SCALE[state.wrenchStatus]"));
  assert.ok(plate.includes("default: 0.48, supporter: 0.56, 'super-supporter': 0.64"));
  assert.ok(wrenchUI.includes("default: 0.48, supporter: 0.56, 'super-supporter': 0.64"));
  assert.ok(wrenchUI.includes("STATUS_OPTIONS = ["));
  assert.ok(wrenchUI.includes("P.plateConfig.setWrenchStatus(id)"));
  assert.ok(wrenchUI.includes("superOption.disabled = st.wrenchStatus !== 'super-supporter'"));
  assert.ok(wrenchUI.includes("preview(entry, isStyle, st.wrenchStatus)"));
});

test("country flag metadata is complete and flag assets are bundled locally in Demo", () => {
  assert.ok(flags.length >= 250, "all country flag options should be present");
  for (const id of ["puertorico", "unitedstates", "fr", "jp", "role_fisherman"])
    assert.ok(flags.some(flag => flag.value === id), "missing flag option " + id);
  assert.ok(plate.includes("COUNTRY_FLAGS_DIR = 'img/flags/'"));
  assert.ok(plate.includes("COUNTRY_FLAGS_DIR + state.flag + '.png'"));
  assert.ok(plate.includes("src.split('/').filter(Boolean).join('/')"));
  assert.ok(!plate.includes("raw.githubusercontent.com/JoeyPR/Planner"));
  assert.ok(!plate.includes("cdn.jsdelivr.net/gh/JoeyPR/Planner"));
  assert.ok(!plate.includes("im.dataset.flagMirror"));
  assert.ok(flags.some(flag => flag.value === "ci"), "Côte d’Ivoire should be selectable");
  for (const flag of flags)
    assert.ok(existsSync(new URL("../img/flags/" + flag.filename, import.meta.url)), "missing bundled flag asset " + flag.filename);
});

test("guild roles inherit active title styling rather than always becoming a plain tag", () => {
  assert.ok(plate.includes("const hasTextOrStyle = !!styleKey || sel.some(t => t.prefix || t.suffix)"));
  assert.ok(plate.includes("const tagSeparate = guildRole && !hasTextOrStyle"));
  assert.ok(plate.includes("const roleSuffix = guildRole && !tagSeparate ? ' ' + guildRole.text : ''"));
  assert.ok(plate.includes("style: styleKey, colour: [255, 255, 255]"));
});
