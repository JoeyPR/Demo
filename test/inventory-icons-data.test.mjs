import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const index = JSON.parse(await readFile(new URL("demo/inventory-icons.json", root), "utf8"));
const rendererSource = await readFile(new URL("js/inventory-icons.mjs", root), "utf8");
const assetNames = new Set((await readdir(new URL("demo/assets/", root))).filter(name => name.endsWith(".png")));

test("Demo inventory icon metadata covers every catalog item exactly once", async () => {
  const catalog = JSON.parse(await readFile(new URL("demo/catalog.json", root), "utf8"));
  const ids = new Set(index.items.map(item => String(item.id)));
  assert.equal(index.items.length, catalog.items.length);
  assert.equal(ids.size, index.items.length);
  for (const item of catalog.items) assert.ok(ids.has(String(item.id)), "missing icon metadata for " + item.id);
});

test("all icon source candidates resolve to local Demo assets", () => {
  for (const item of index.items) {
    assert.ok(item.candidates.length, "no local icon source for item " + item.id);
    for (const candidate of item.candidates) assert.ok(assetNames.has(candidate.file), item.id + ": missing " + candidate.file);
    for (const layer of item.iconLayers ?? []) assert.ok(assetNames.has(layer.a), item.id + ": missing layered sprite " + layer.a);
    for (const layer of item.profileLayers ?? []) assert.ok(assetNames.has(String(layer.path).split("/").pop()), item.id + ": missing profile sprite " + layer.path);
  }
});

test("Set Planner tint and layered-icon indicators remain represented", () => {
  const tinted = index.items.filter(item => Array.isArray(item.iconTints) && item.iconTints.length);
  assert.equal(tinted.length, 208, "preserve Website's 208 per-item iconTints entries");
  assert.ok(tinted.some(item => item.iconTints.includes("s")), "skin-relative tint must be present");
  assert.ok(tinted.some(item => item.iconTints.some(tint => typeof tint === "string" && /^[0-9a-f]{6}$/i.test(tint))));
  assert.ok(index.items.some(item => Array.isArray(item.iconLayers) && item.iconLayers.length));
  assert.ok(index.items.some(item => item.iconRule), "Planner's per-item icon indication rules must be present");
});

test("authored icon sheets, local tint sources, and item overrides are used", () => {
  const byId = new Map(index.items.map(item => [Number(item.id), item]));
  for (const id of [1800, 2074]) {
    assert.ok(byId.get(id).tintCandidate?.file.endsWith("_icon.png"), id + ": tint source must be an icon sheet");
  }
  for (const [id, file] of [[5020, "d_aura_icon.png"], [5208, "player_feet6_icon.png"],
    [10338, "bf_begchmp_icon.png"], [14552, "player_cosmetics3_icon.png"]]) {
    assert.ok(byId.get(id).candidates.some(candidate => candidate.file === file), id + ": missing " + file);
  }
  assert.deepEqual([byId.get(5020).tintCandidate.sx, byId.get(5020).tintCandidate.sy], [0, 0],
    "standalone icon sheets must use their own origin rather than the worn-atlas coordinates");
  assert.ok(index.stats.tintSourcesUsingIconSheets >= 208);
});

test("vertical icon sources retain 32px per-frame stride", () => {
  const vertical = index.items.flatMap(item => item.candidates ?? [])
    .filter(candidate => candidate.vertical);
  for (const candidate of vertical) {
    assert.equal(candidate.strideY, 32);
    assert.ok(candidate.cellHeight >= 1);
  }
});


test("layered items keep their primary icon candidate", () => {
  assert.match(rendererSource, /renderWebsiteLayers\(record\.iconLayers,\s*skin,\s*frame\)/,
    "secondary layers must be composed with the selected item icon");
  assert.doesNotMatch(rendererSource,
    /if \(record\?\.iconLayers\?\.length\) \{\s*const composed = await renderWebsiteLayers\(record\.iconLayers, skin\);\s*if \(composed && hasPixels\(composed\)\) return composed;/,
    "iconLayers must not short-circuit and discard the primary icon");
  for (const item of index.items.filter(item => Array.isArray(item.iconLayers) && item.iconLayers.length)) {
    assert.ok(Array.isArray(item.candidates) && item.candidates.length,
      "item " + item.id + " must retain its own icon candidate alongside extra layers");
  }
});
