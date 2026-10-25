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
  hillTrackScrollSpeeds,
  hillTrackPeriods,
} from "../weather-engine/weather-renderer.js";

const arid = JSON.parse(readFileSync(new URL("../data/variants/base/arid.json", import.meta.url), "utf8"));

test("hill1, hill2 and hill3 use independent player-relative speeds", () => {
  const speeds = hillScrollSpeeds({ sheets: ["hills1.webp", "hills2.webp", "hills3.webp"] });
  assert.equal(speeds.get(0), 0.5);
  assert.equal(speeds.get(1), 0.25);
  assert.equal(speeds.get(2), 0.125);
});

test("parallax starts immediately with travel and reverses with the player", () => {
  assert.equal(hillSceneOffset(10, 4, 2, 1), 20);
  assert.equal(hillSceneOffset(10, 4, 2, 0.5), 10);
  assert.equal(hillSceneOffset(10, 4, 2, 0.25), 5);
  assert.equal(hillSceneOffset(-10, 4, 2, 1), -20);
  assert.equal(hillSceneOffset(0, 4, 2, 1), 0);
});

test("Arid wobble groups follow their matching desert hill layers", () => {
  const movingSheets = hillSheetIndices(arid);
  const speeds = hillScrollSpeeds(arid);
  const periods = hillPeriods(arid);
  const trackSpeeds = hillTrackScrollSpeeds(arid, speeds);
  const trackPeriods = hillTrackPeriods(arid, periods);
  assert.deepEqual([...movingSheets].sort((a, b) => a - b), [0, 1, 3]);
  assert.equal(speeds.get(0), 0.125, "desert_hills is half as fast as before");
  assert.equal(speeds.get(1), 0.25, "desert_hills2 is half as fast as before");
  assert.equal(periods.get(0), 1200);
  assert.equal(periods.get(1), 1200);

  const wobbleTracks = arid.tracks.filter(track => track.s === 3);
  const upperWobbles = wobbleTracks.filter(track => Math.abs(track.k.find(k => k.length > 1)[2] - 130.2) < 1);
  const lowerWobbles = wobbleTracks.filter(track => Math.abs(track.k.find(k => k.length > 1)[2] - 245) < 1);
  assert.equal(upperWobbles.length, 2);
  assert.equal(lowerWobbles.length, 2);
  for (const track of upperWobbles) {
    assert.equal(trackSpeeds.get(track), speeds.get(1), "upper desert_wobbly follows desert_hills2");
    assert.equal(trackPeriods.get(track), periods.get(1));
  }
  for (const track of lowerWobbles) {
    assert.equal(trackSpeeds.get(track), speeds.get(0), "lower desert_wobbly follows desert_hills");
    assert.equal(trackPeriods.get(track), periods.get(0));
  }
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
  assert.match(app, /offsets\.set\(track, hillSceneOffset\(frame\.x, s, pxPerSceneUnit, speed\)\)/);
  assert.doesNotMatch(app, /hillTravelExcess\(frame\.x/);
});
