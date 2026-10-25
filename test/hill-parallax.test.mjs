import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WeatherRenderer,
  hillDrawXs,
  hillPeriods,
  hillSceneOffset,
  hillScrollSpeeds,
  hillSheetIndices,
} from "../weather-engine/weather-renderer.js";

const arid = JSON.parse(readFileSync(new URL("../data/variants/base/arid.json", import.meta.url), "utf8"));

test("hill1, hill2 and hill3 use independent player-relative speeds", () => {
  const speeds = hillScrollSpeeds({ sheets: ["hills1.webp", "hills2.webp", "hills3.webp"] });
  assert.equal(speeds.get(0), 1);
  assert.equal(speeds.get(1), 0.5);
  assert.equal(speeds.get(2), 0.25);
});

test("parallax starts immediately with travel and reverses with the player", () => {
  assert.equal(hillSceneOffset(10, 4, 2, 1), 20);
  assert.equal(hillSceneOffset(10, 4, 2, 0.5), 10);
  assert.equal(hillSceneOffset(10, 4, 2, 0.25), 5);
  assert.equal(hillSceneOffset(-10, 4, 2, 1), -20);
  assert.equal(hillSceneOffset(0, 4, 2, 1), 0);
});

test("Arid desert_wobbly follows desert_hills at the same speed and repeat period", () => {
  const movingSheets = hillSheetIndices(arid);
  const speeds = hillScrollSpeeds(arid);
  const periods = hillPeriods(arid);
  assert.deepEqual([...movingSheets].sort((a, b) => a - b), [0, 1, 3]);
  assert.equal(speeds.get(0), 0.25, "desert_hills uses the slowest parallax speed");
  assert.equal(speeds.get(1), 0.5, "desert_hills2 uses half player speed");
  assert.equal(speeds.get(3), speeds.get(0), "desert_wobbly moves with desert_hills");
  assert.equal(periods.get(0), 1200);
  assert.equal(periods.get(3), periods.get(0), "wobble sheet shares the desert_hills wrap period");
});

test("each sheet draws using its own offset rather than a shared hill offset", () => {
  const cfg = {
    w: 100, h: 100, step: 50, n: 2, loop: 1,
    sheets: ["hills1.webp", "hills2.webp"],
    tracks: [
      { l: 0, s: 0, b: 0, k: [[0, 0, 0, 100, 20], [1, 0, 0, 100, 20]] },
      { l: 0, s: 0, b: 0, k: [[0, 100, 0, 100, 20], [1, 100, 0, 100, 20]] },
      { l: 0, s: 1, b: 0, k: [[0, 0, 20, 100, 20], [1, 0, 20, 100, 20]] },
      { l: 0, s: 1, b: 0, k: [[0, 100, 20, 100, 20], [1, 100, 20, 100, 20]] },
    ],
  };
  const canvas = { getContext() { throw new Error("render is not called in this test"); } };
  const renderer = new WeatherRenderer(cfg, {}, canvas, canvas);
  renderer.render = function (_now, offsets) { this.hillOffsets = new Map(offsets); };
  renderer.render(0, new Map([[0, 10], [1, 5]]));
  assert.deepEqual(renderer._hillDrawXs(cfg.tracks[0], 0), [-90, 10]);
  assert.deepEqual(renderer._hillDrawXs(cfg.tracks[2], 0), [-95, 5]);
});

test("live app calculates offsets from current player X instead of a world-edge threshold", async () => {
  const { readFileSync: readApp } = await import("node:fs");
  const app = readApp(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /hillSceneOffset\(frame\.x, s, pxPerSceneUnit, speed\)/);
  assert.match(app, /hillOffsetsNow\(w, h, s, frame\)/);
  assert.doesNotMatch(app, /hillTravelExcess\(frame\.x/);
});
