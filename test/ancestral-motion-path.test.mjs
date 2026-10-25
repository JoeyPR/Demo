import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fxEntries, pathAt } from "../docs/ancestral/renderer.js";

const makeTrack = (sheet) => ({
  sheet,
  cell: [32, 32],
  keys: [
    [0, 0, 0, 1, 1, 0, 255, 255, 255, 255],
    [1000, 100, 0, 1, 1, 0, 255, 255, 255, 255],
  ],
  cells: [[0, 0, 0]],
  align: 0,
  flip: [0, 0],
  blend: 1,
});

test("ancestral FX uses the recorded position and facing from each particle's birth time", () => {
  const right = makeTrack("particles.png");
  const left = makeTrack("particles2.png");
  const level = {
    fxWorld: true,
    fx: { period: 1000, tracks: [right] },
    fxLeft: { period: 1000, tracks: [left] },
  };
  const path = [
    [0, 10, 32, 1],
    [250, 60, 28, 1],
    [500, 110, 40, -1],
  ];
  const motion = { x: 110, y: 40, facing: -1, path };

  assert.deepEqual(pathAt(path, 100), path[0]);
  assert.deepEqual(pathAt(path, 500), path[2]);

  // The track instance was born at t=0, facing right. It uses the recorded
  // birth position, not the current left-facing pose, to select its track and
  // offset the sprite back along the player's movement/jump history.
  const entries = fxEntries(level, 500, -1, motion);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sheet, "particles.png");
  assert.equal(entries[0].m[4], -34);
  assert.equal(entries[0].m[5], 24);
});

test("preview records and supplies the ancestral motion path", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /ancestralPath:\s*\[\]/);
  assert.match(app, /const charX = 16 \+ frame\.x;/);
  assert.match(app, /const charY = 32 \+ frame\.y \+ lift;/);
  assert.match(app, /motion:\s*\{\s*x:\s*charX,\s*y:\s*charY,\s*facing:\s*motion\.facing,\s*path:\s*state\.ancestralPath\s*\}/);
  assert.match(app, /state\.clock - 6000/);
});
