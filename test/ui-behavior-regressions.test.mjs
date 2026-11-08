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

test("Drop and Info mutually close when another dialog claims the modal slot", () => {
  const drop = read("../js/drop.js");
  const info = read("../js/item-info.js");
  assert.match(drop, /P\.on\("dialog-open", name => \{ if \(name !== "drop"\) close\(\); \}\)/);
  assert.match(info, /P\.on\('dialog-open',name=>\{if\(name!=='info'\)close\(\);\}\)/);
  assert.match(drop, /P\.emit\("dialog-open", "drop"\)/);
  assert.match(info, /P\.emit\('dialog-open','info'\)/);
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

test("pickup box gains two more rendered pixels", () => {
  const source = read("../js/drop-world.mjs");
  assert.match(source, /PICKUP_BOX_EXTRA_SIZE = 4/);
});
