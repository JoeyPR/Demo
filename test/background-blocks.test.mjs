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
    row.kind === "bg" && row.name && row.texture &&
    !/null_item|unavailable/i.test(row.name) &&
    !/null_item|unavailable/i.test(row.texture)
  );
  assert.equal(BACKGROUND_BLOCK_IDS.size, 293);
  assert.equal(BACKGROUND_BLOCK_IDS.size, rows.length);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
  assert.equal(new Set(rows.map(row => row.name.toLowerCase())).size, rows.length);
  assert.ok(rows.every(row => BLOCKS[row.id].layer === "bg"));
  assert.ok(rows.every(row => BLOCKS[row.id].collision === 0));
  assert.ok(backgroundJs.includes("row.kind === 'bg'"));
  assert.ok(backgroundJs.includes("!/null_item|unavailable/i.test(row.name)"));
  assert.ok(backgroundJs.includes("!/null_item|unavailable/i.test(row.texture)"));
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
    /dirt|bedrock/i.test(row[1]) && !row[1].trim().startsWith("Data ")
  );
  assert.equal(choices.length, 14);
  assert.ok(choices.every(row => !row[1].trim().startsWith("Data ")));
  assert.equal(new Set(choices.map(row => row[1].toLowerCase())).size, choices.length);
  assert.ok(landJs.includes("!/^data\\s+/i"));
});

test("tab changes never focus the search field or open the mobile keyboard", () => {
  const handler = gridJs.slice(gridJs.indexOf("P.on('searchOn'"), gridJs.indexOf("P.on('fav-toggle'"));
  assert.ok(handler.includes("searchOn = on;"));
  assert.ok(handler.includes("P.inv.refresh();"));
  assert.ok(!handler.includes("focus("));
});

test("Clothing tools keep one-click focus and synchronize the quick-drawer tool", () => {
  const start = gridJs.indexOf("function activate(item, box)");
  const end = gridJs.indexOf("g.addEventListener('click'", start);
  assert.ok(start >= 0 && end > start);
  const activate = gridJs.slice(start, end);
  assert.ok(activate.includes("if (item.tool)"));
  assert.ok(activate.includes("P.inv.focus = item"));
  assert.ok(activate.includes("const wrenchOn = item.toolType === 'wrench'"));
  assert.ok(activate.includes("P.plateConfig.setWrenchOn(wrenchOn)"));
  assert.ok(activate.includes("P.blackbox?.(item.name, 1500, box)"));
  const focusStart = gridJs.indexOf("function markFocus()");
  const focusEnd = gridJs.indexOf("\n  }", focusStart);
  const focus = gridJs.slice(focusStart, focusEnd);
  assert.ok(focus.includes("b.dataset.toolType === f.toolType"));
  assert.ok(gridJs.includes("if (!toolArmed)"));
  assert.ok(gridJs.includes("P.plateConfig.setWrenchOn(on)"));
  assert.ok(gridJs.includes("P.blackbox?.(on ? 'Wrench' : 'Fist', 1500, currentToolBox)"));
  assert.ok(invCss.includes(".box.tool .ic img{width:calc(100% + 2px);height:calc(100% + 2px);max-width:none;object-fit:contain;image-rendering:pixelated;flex:none}"));
  assert.ok(invCss.includes("#grid-window .box.tool.focus{background-image:url(../img/box-blue.png)"));
  assert.ok(!invCss.includes("#grid-window .box.tool::before{display:none}"));
});

test("item names use the anchored blackbox, with Immortal names colored by RTFont 6", () => {
  assert.ok(blackboxJs.includes("P.blackbox = function(message, duration = 1800, anchor = null)"));
  assert.ok(blackboxJs.includes("positionAbove(anchor)"));
  assert.ok(blackboxJs.includes('P.rtfont.color("6"'));
  assert.ok(blackboxJs.includes("fitMessageWidth(plainText)"));
  assert.ok(blackboxCss.includes("white-space: nowrap"));
  assert.ok(blackboxCss.includes("overflow-wrap: normal"));
  assert.ok(gridJs.includes("P.blackbox?.(item.name, 1500, box)"));
  assert.ok(indexHtml.includes('id="blackbox"'));
});

test("pickup artwork gains exactly one additional source pixel", () => {
  assert.ok(dropWorld.includes("PICKUP_ICON_ART_SIZE = 64 * 0.64 + 10"));
});

test("Weather Background selector loads the available BG catalog and uses real tile properties", () => {
  assert.ok(backgroundJs.includes("row.kind === 'bg'"));
  assert.ok(backgroundJs.includes("row.spread_type"));
  assert.ok(backgroundJs.includes("P.emit('background', block.id)"));
  assert.ok(appJs.includes("registerBackgroundBlocks(backgroundRows)"));
  assert.ok(appJs.includes("uniformBackgroundWorld(resolved)"));
  assert.ok(appJs.includes("drawBackgroundTiles(w, h, s, camera)"));
  assert.ok(indexHtml.includes('src="js/background.js"'));
});
