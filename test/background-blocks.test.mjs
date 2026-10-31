import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BLOCKS,
  BACKGROUND_BLOCK_IDS,
  CAVE_BACKGROUND_ID,
  DEFAULT_BACKGROUND_ID,
  registerBackgroundBlocks,
  resolveBackgroundSelection,
  uniformBackgroundWorld,
  uniformLandWorld,
} from "../js/land-system.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const officialBlocks = JSON.parse(read("../data/blocks.json"));
const landRows = JSON.parse(read("../data/land-blocks.json"));
const backgroundJs = read("../js/background.js");
const landJs = read("../js/land.js");
const gridJs = read("../js/grid.js");
const appJs = read("../js/app.js");
const blackboxJs = read("../js/blackbox.js");
const blackboxCss = read("../css/blackbox.css");
const invCss = read("../css/inv.css");
const dropWorld = read("../js/drop-world.mjs");
const indexHtml = read("../index.html");

test("background catalog registers only unique available background-layer blocks", () => {
  registerBackgroundBlocks(officialBlocks);
  const rows = officialBlocks.filter(row =>
    row.kind === "bg" &&
    row.name &&
    !/null_item|unavailable/i.test(row.name) &&
    row.texture &&
    !/null_item|unavailable/i.test(row.texture)
  );
  assert.equal(BACKGROUND_BLOCK_IDS.size, 293);
  assert.equal(BACKGROUND_BLOCK_IDS.size, rows.length);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  assert.equal(new Set(rows.map(row => row.name.toLowerCase())).size, rows.length);
  assert.ok(rows.every(row => BLOCKS[row.id].layer === "bg"));
  assert.ok(rows.every(row => BLOCKS[row.id].collision === 0));
  assert.doesNotMatch(backgroundJs, /null_item|unavailable/i);
});

test("Cave Background remains the default non-colliding 47-blob wall", () => {
  registerBackgroundBlocks(officialBlocks);
  assert.equal(DEFAULT_BACKGROUND_ID, CAVE_BACKGROUND_ID);
  assert.equal(BLOCKS[CAVE_BACKGROUND_ID].name, "cave background");
  assert.equal(BLOCKS[CAVE_BACKGROUND_ID].spread, 2);
  assert.equal(BLOCKS[CAVE_BACKGROUND_ID].collision, 0);
  assert.equal(resolveBackgroundSelection(CAVE_BACKGROUND_ID), CAVE_BACKGROUND_ID);

  const world = uniformBackgroundWorld(CAVE_BACKGROUND_ID);
  assert.ok(world);
  assert.ok(world.bg.every(row => row.every(id => id === CAVE_BACKGROUND_ID)));
  assert.ok(world.fg.every(row => row.every(id => id === 0)));
});

test("the selected wall is also used behind the foreground land strip", () => {
  registerBackgroundBlocks(officialBlocks);
  const world = uniformLandWorld(2, 24, 52);
  assert.ok(world.bg.slice(0, 24).every(row => row.every(id => id === 0)));
  assert.ok(world.bg.slice(24).every(row => row.every(id => id === 52)));
  assert.ok(world.fg.slice(24).every(row => row.every(id => id === 2)));
});

test("Land omits Data-prefixed aliases such as duplicate candy and melon bedrock", () => {
  const choices = landRows.filter(row =>
    /dirt|bedrock/i.test(row[1]) && !/^data\\s+/i.test(row[1].trim())
  );
  assert.equal(choices.length, 14);
  assert.ok(choices.every(row => !/^data\\s+/i.test(row[1].trim())));
  assert.equal(new Set(choices.map(row => row[1].toLowerCase())).size, choices.length);
  assert.match(landJs, /!\\/^data\\\\s\\+/i);
});

test("tab changes never focus the search field or open the mobile keyboard", () => {
  const handler = gridJs.slice(gridJs.indexOf("P.on('searchOn'"), gridJs.indexOf("P.on('fav-toggle'"));
  assert.match(handler, /searchOn = on/);
  assert.doesNotMatch(handler, /#q.*focus|focus\\(\\)/);
  assert.doesNotMatch(gridJs, /P\\.\\$\\('#q'\\)\\.focus\\(\\)/);
});

test("Clothing tools keep one-click focus and synchronize the quick-drawer tool", () => {
  assert.match(gridJs, /P\\.inv\\.focus = item/);
  assert.match(gridJs, /P\\.plateConfig\\.setWrenchOn\\(wrenchOn\\)/);
  assert.match(gridJs, /P\\.blackbox\\?\\.\\(item\\.name, 1500, box\\)/);
  assert.match(gridJs, /if \\(!toolArmed\\)[\\s\\S]*?toolArmed = true/);
  assert.match(gridJs, /P\\.plateConfig\\.setWrenchOn\\(on\\)/);
  assert.match(gridJs, /P\\.blackbox\\?\\.\\(on \\? 'Wrench' : 'Fist', 1500, currentToolBox\\)/);
  assert.match(invCss, /\\.box\\.focus::before\\{opacity:1\\}/);
  assert.doesNotMatch(invCss, /\\.box\\.tool::before\\{display:none\\}/);
  assert.match(invCss, /width:calc\\(100% \\+ 2px\\);height:calc\\(100% \\+ 2px\\)/);
});

test("item names use the anchored blackbox, with Immortal names colored by RTFont 6", () => {
  assert.match(blackboxJs, /P\\.blackbox = function\\(message, duration = 1800, anchor = null\\)/);
  assert.match(blackboxJs, /positionAbove\\(anchor\\)/);
  assert.match(blackboxJs, /P\\.rtfont\\.color\\("6"/);
  assert.match(blackboxJs, /fitMessageWidth\\(plainText\\)/);
  assert.match(blackboxCss, /white-space:\\s*nowrap/);
  assert.match(blackboxCss, /overflow-wrap:\\s*normal/);
  assert.match(gridJs, /P\\.blackbox\\?\\.\\(item\\.name, 1500, box\\)/);
  assert.match(indexHtml, /id="blackbox"/);
});

test("pickup artwork gains exactly one additional source pixel", () => {
  assert.match(dropWorld, /PICKUP_ICON_ART_SIZE = 64 \\* 0\\.64 \\+ 10/);
});

test("Weather Background selector loads the available BG catalog and uses real tile properties", () => {
  assert.match(backgroundJs, /row\\.kind === 'bg'/);
  assert.match(backgroundJs, /row\\.spread_type/);
  assert.match(backgroundJs, /P\\.emit\\('background', block\\.id\\)/);
  assert.match(appJs, /registerBackgroundBlocks\\(backgroundRows\\)/);
  assert.match(appJs, /uniformBackgroundWorld\\(resolved\\)/);
  assert.match(appJs, /drawBackgroundTiles\\(w, h, s, camera\\)/);
  assert.match(indexHtml, /js\\/background\\.js/);
});
