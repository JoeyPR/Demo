import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("favorites persist as an ID list, deduplicate, and enforce the 20-item cap", () => {
  const context = { window: { P: {} } };
  vm.runInNewContext(read("../js/favorites.js"), context);
  const favorites = context.window.P.favoriteStore;
  assert.equal(favorites.MAX_FAVORITES, 20);

  const twentyIds = Array.from({ length: 20 }, (_, index) => index + 1);
  assert.deepEqual(Array.from(favorites.normalize([...twentyIds, 2, "bad"])), twentyIds);

  const blocked = favorites.toggle(twentyIds, 21);
  assert.equal(blocked.limitReached, true);
  assert.equal(blocked.action, "limit");
  assert.deepEqual(Array.from(blocked.ids), twentyIds);

  const removed = favorites.toggle(twentyIds, 1);
  assert.equal(removed.action, "removed");
  const added = favorites.toggle(removed.ids, 21);
  assert.equal(added.action, "added");
  assert.equal(added.ids.length, 20);
  assert.equal(added.ids.at(-1), 21);
});

test("the donor ID-list favorite system is restored before inventory boot and saved on every toggle", () => {
  const html = read("../index.html");
  const grid = read("../js/grid.js");
  assert.ok(html.indexOf("js/favorites.js") < html.indexOf("js/grid.js"));
  assert.match(grid, /P\.favoriteStore\.normalize\(P\.store\.get\('favs', \[\]\)\)/);
  assert.match(grid, /P\.store\.set\('favs', result\.ids\)/);
  assert.match(grid, /You can only favorite up to 20 items/);
  assert.match(grid, /syncFlags\(\); renderQuick\(\); P\.inv\.refresh\(\)/);
});

test("Wrench uses the visible screen at 3:4 and fits button labels together", () => {
  const ui = read("../js/item-wrench-ui.js");
  const css = read("../css/item-wrench.css");
  assert.match(ui, /window\.visualViewport/);
  assert.match(ui, /const width = Math\.min\(viewWidth \* 0\.94, viewHeight \* 0\.94 \* 3 \/ 4\)/);
  assert.match(ui, /const height = width \* 4 \/ 3/);
  assert.match(css, /aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(ui, /buttonTextScale = Math\.min\(1/);
  assert.match(css, /--wrench-button-text-scale/);
});

test("Wrench opens only for an equipped selected item and warns otherwise", () => {
  const ui = read("../js/item-wrench-ui.js");
  const side = read("../js/side.js");
  assert.match(ui, /function isItemEquipped\(item\)/);
  assert.match(ui, /P\.blackbox\?\.\("Equip the item first\."/);
  assert.match(side, /function isEquipped\(item\)/);
  assert.match(side, /P\.blackbox\?\.\("Equip the item first\."/);
  assert.match(side, /P\.emit\('item-wrench-request', focused\)/);
});

test("Drop, Info and Wrench mutually close when another dialog claims the modal slot", () => {
  const drop = read("../js/drop.js");
  const info = read("../js/item-info.js");
  const wrench = read("../js/item-wrench-ui.js");
  assert.match(drop, /P\.on\("dialog-open", name => \{ if \(name !== "drop"\) close\(\); \}\)/);
  assert.match(info, /P\.on\('dialog-open',name=>\{if\(name!=='info'\)close\(\);\}\)/);
  assert.match(wrench, /P\.on\("dialog-open", name => \{/);
  assert.match(drop, /P\.emit\("dialog-open", "drop"\)/);
  assert.match(info, /P\.emit\('dialog-open','info'\)/);
  assert.match(wrench, /P\.emit\("dialog-open", "wrench"\)/);
});

test("Info uses the same top position and maximum height as Drop", () => {
  const info = read("../css/item-info.css");
  const drop = read("../css/drop.css");
  assert.match(info, /\.item-info-dialog\{top:12\.2%;max-height:75%/);
  assert.match(drop, /top:\s*12\.2%/);
  assert.match(drop, /max-height:\s*75%/);
});

test("Fist and Wrench pass through INFO rather than being blocked by the tool guard", () => {
  const side = read("../js/side.js");
  assert.match(side, /if \(b\.dataset\.a === 'info'\) \{ A\.info\(it\); return; \}/);
});

test("chat outline and shadow grow by one pixel, text has no shadow, and speech fades in 500ms", () => {
  const css = read("../css/player-chat.css");
  const js = read("../js/player-chat.js");
  assert.match(css, /border:calc\(var\(--bd\) \+ 1px\) solid #A5E3FB/);
  assert.match(css, /calc\(var\(--sh\) \+ 1px\)/);
  assert.match(css, /border:calc\(max\(1px,var\(--bd\)\) \+ 1px\) solid #A5E3FB/);
  assert.match(css, /box-shadow:2px 2px 0 #000,inset 2px 2px 0 #000/);
  assert.match(css, /#playerChat[\s\S]*?text-shadow:none/);
  assert.match(css, /#player-chat-bubble[\s\S]*?text-shadow:none/);
  assert.match(css, /transition:opacity 500ms/);
  assert.match(css, /transition-duration:500ms/);
  assert.match(js, /FADE_IN_MS = 500, FADE_OUT_MS = 500/);
});

test("pickup box gains two more rendered pixels", () => {
  const source = read("../js/drop-world.mjs");
  assert.match(source, /PICKUP_BOX_EXTRA_SIZE = 4/);
});


test("preview chat handle is 10 percent smaller and the topBar opens from the preview top edge", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.match(js, /source\.width \* 0\.9/);
  assert.match(js, /source\.height \* 0\.9/);
  assert.match(js, /topBar\.style\.top = area\.top \+ 'px'/);
  assert.match(css, /#topBar\{position:fixed/);
});

test("player chat has a history pane above a compact Growtopia-style input row", () => {
  const js = read("../js/player-chat.js");
  const css = read("../css/player-chat.css");
  assert.match(js, /make\('div', 'player-chat-log'\)/);
  assert.match(js, /make\('div', 'player-chat-input-row'\)/);
  assert.match(js, /P\.rtfont\?\.color\('7', 'Enter a message here'\)/);
  assert.match(js, /make\('span', 'player-chat-counter', '0\/120'\)/);
  assert.match(js, /counter\.textContent = length \+ '\/' \+ MAX_LENGTH/);
  assert.match(js, /textarea\.maxLength = MAX_LENGTH/);
  assert.match(css, /#player-chat-log\{flex:1 1 auto/);
  assert.match(css, /\.player-chat-input-row\{[^}]*height:34px/);
});

test("chat history uses fixed EST timestamps, preserves RTFont, and formats title/world roles", () => {
  const js = read("../js/player-chat.js");
  assert.match(js, /const EST_OFFSET_MS = 5 \* 60 \* 60 \* 1000/);
  assert.match(js, /P\.rtfont\?\.color\('o', '\[' \+ time \+ '\]'\)/);
  assert.match(js, /worldRole === 'owner' \? '2'/);
  assert.match(js, /worldRole === 'admin' \? '\^'/);
  assert.match(js, /isDoctor \? '4'/);
  assert.match(js, /isLegend \? '9'/);
  assert.match(js, /name \+= ' of Legend'/);
  assert.match(js, /name = \(isDoctor \? 'Dr\. ' : ''\)/);
  assert.match(js, /body\.textContent = message/);
  assert.match(js, /P\.rtfont\?\.scan\(row\)/);
  assert.match(js, /P\.rtfont\?\.hasCodes\(rawGrowId\)\) return rawGrowId/);
  assert.match(js, /const MAX_LOG_MESSAGES = 50/);
});

test("Player Customization exposes Owner/Admin rank options for chat-name color preview", () => {
  const custom = read("../js/customization.js");
  assert.match(custom, /World Rank \(Chat Preview\)/);
  assert.match(custom, /\['owner', 'World Owner'\]/);
  assert.match(custom, /\['admin', 'World Admin'\]/);
  assert.match(custom, /P\.playerChat\?\.setWorldRole\(chatWorldSelect\.value\)/);
});
