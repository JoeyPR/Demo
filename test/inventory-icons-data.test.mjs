import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = new URL("../", import.meta.url);
const index = JSON.parse(await readFile(new URL("demo/inventory-icons.json", root), "utf8"));
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
  assert.ok(index.items.some(item => Array.isArray(item.iconTints) && item.iconTints.length));
  assert.ok(index.items.some(item => Array.isArray(item.iconLayers) && item.iconLayers.length));
  assert.ok(index.items.some(item => item.iconRule));
});
